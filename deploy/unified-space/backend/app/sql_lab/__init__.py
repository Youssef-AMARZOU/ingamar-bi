from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from app.models import Query, Database, SavedQuery
from app import db
import uuid
import time
import re
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError

sql_lab_bp = Blueprint('sql_lab', __name__)

FORBIDDEN_KEYWORDS = re.compile(
    r'\b(DROP\s+TABLE|ALTER\s+TABLE|TRUNCATE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+'
    r'SET|CREATE\s+TABLE|CREATE\s+DATABASE|GRANT|REVOKE|EXECUTE|EXEC|'
    r'COPY|VACUUM|CREATE\s+INDEX|CREATE\s+VIEW|CREATE\s+FUNCTION)\b',
    re.IGNORECASE
)

PARAM_RE = re.compile(r'\{\{(\w+)\}\}')

def validate_sql(sql):
    if FORBIDDEN_KEYWORDS.search(sql):
        return False, 'DDL and DML statements are not allowed. Only SELECT queries are permitted.'
    return True, ''

def substitute_params(sql, params=None):
    if not params:
        return sql, {}
    placeholders = PARAM_RE.findall(sql)
    if not placeholders:
        return sql, {}
    result = sql
    used = {}
    for p in placeholders:
        val = params.get(p)
        if val is not None:
            result = result.replace('{{' + p + '}}', str(val))
            used[p] = val
    return result, used

@sql_lab_bp.route('/databases', methods=['GET'])
@jwt_required()
def list_databases():
    databases = Database.query.filter_by(expose_in_sqllab=True).all()
    return jsonify([d.to_dict() for d in databases]), 200

@sql_lab_bp.route('/databases/<int:db_id>', methods=['GET'])
@jwt_required()
def get_database(db_id):
    database = Database.query.get(db_id)
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    return jsonify(database.to_dict()), 200

@sql_lab_bp.route('/databases/<int:db_id>', methods=['PUT'])
@jwt_required()
def update_database(db_id):
    database = Database.query.get(db_id)
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    data = request.get_json()
    if data.get('database_name'):
        existing = Database.query.filter(
            Database.database_name == data['database_name'],
            Database.id != db_id
        ).first()
        if existing:
            return jsonify({'error': 'A database with this name already exists'}), 409
        database.database_name = data['database_name']
    if data.get('sqlalchemy_uri'):
        try:
            engine = create_engine(data['sqlalchemy_uri'])
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
        except Exception as e:
            return jsonify({'error': f'Cannot connect to database: {str(e)}'}), 400
        database.sqlalchemy_uri = data['sqlalchemy_uri']
    if 'expose_in_sqllab' in data:
        database.expose_in_sqllab = data['expose_in_sqllab']
    if 'cache_timeout' in data:
        database.cache_timeout = data.get('cache_timeout', 0)
    db.session.commit()
    return jsonify(database.to_dict()), 200

@sql_lab_bp.route('/databases/<int:db_id>', methods=['DELETE'])
@jwt_required()
def delete_database(db_id):
    database = Database.query.get(db_id)
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    db.session.delete(database)
    db.session.commit()
    return jsonify({'message': 'Database deleted'}), 200

@sql_lab_bp.route('/databases/test', methods=['POST'])
@jwt_required()
def test_database_connection():
    data = request.get_json()
    uri = data.get('sqlalchemy_uri')
    if not uri:
        return jsonify({'error': 'sqlalchemy_uri is required'}), 400
    try:
        engine = create_engine(uri)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return jsonify({'status': 'ok', 'message': 'Connection successful'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 200

@sql_lab_bp.route('/databases', methods=['POST'])
@jwt_required()
def create_database():
    data = request.get_json()
    
    if not data.get('database_name') or not data.get('sqlalchemy_uri'):
        return jsonify({'error': 'database_name and sqlalchemy_uri are required'}), 400
    
    existing = Database.query.filter_by(database_name=data['database_name']).first()
    if existing:
        return jsonify({'error': 'A database with this name already exists'}), 409
    
    database = Database(
        database_name=data['database_name'],
        sqlalchemy_uri=data['sqlalchemy_uri'],
        cache_timeout=data.get('cache_timeout', 0),
        expose_in_sqllab=data.get('expose_in_sqllab', True),
        allow_run_async=data.get('allow_run_async', False),
        allow_ctas=data.get('allow_ctas', False),
        allow_cvas=data.get('allow_cvas', False),
        allow_dml=data.get('allow_dml', False)
    )
    
    try:
        engine = create_engine(data['sqlalchemy_uri'])
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
    except Exception as e:
        return jsonify({'error': f'Cannot connect to database: {str(e)}'}), 400
    
    db.session.add(database)
    db.session.commit()
    
    return jsonify(database.to_dict()), 201

@sql_lab_bp.route('/databases/<int:db_id>/tables', methods=['GET'])
@jwt_required()
def list_tables(db_id):
    database = Database.query.get(db_id)
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    tables = database.tables.all()
    return jsonify([t.to_dict() for t in tables]), 200

@sql_lab_bp.route('/databases/<int:db_id>/preview', methods=['POST'])
@jwt_required()
def preview_table(db_id):
    database = Database.query.get(db_id)
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    data = request.get_json()
    table_name = data.get('table_name')
    schema = data.get('schema', 'public')
    limit = min(data.get('limit', 100), 500)
    if not table_name:
        return jsonify({'error': 'table_name is required'}), 400
    try:
        engine = create_engine(database.sqlalchemy_uri)
        with engine.connect() as conn:
            full_name = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'
            result = conn.execute(text(f'SELECT * FROM {full_name} LIMIT {limit}'))
            columns = list(result.keys())
            rows = [dict(r._mapping) for r in result]
            insp = inspect(engine)
            col_info = []
            try:
                cols = insp.get_columns(table_name, schema=schema or None)
                col_info = [{'name': c['name'], 'type': str(c['type'])} for c in cols]
            except Exception:
                col_info = [{'name': c, 'type': 'unknown'} for c in columns]
            return jsonify({
                'columns': col_info,
                'data': rows,
                'rowcount': len(rows),
                'table_name': table_name
            }), 200
    except Exception as e:
        return jsonify({'error': f'Preview error: {str(e)}'}), 400


# ---- Saved Queries ----

@sql_lab_bp.route('/saved_queries', methods=['GET'])
@jwt_required()
def list_saved_queries():
    user_id = get_current_user_id()
    queries = SavedQuery.query.filter_by(user_id=user_id).order_by(SavedQuery.updated_at.desc()).all()
    return jsonify([q.to_dict() for q in queries]), 200

@sql_lab_bp.route('/saved_queries', methods=['POST'])
@jwt_required()
def create_saved_query():
    user_id = get_current_user_id()
    data = request.get_json()
    if not data.get('name') or not data.get('database_id') or not data.get('sql'):
        return jsonify({'error': 'name, database_id, and sql are required'}), 400
    sq = SavedQuery(
        name=data['name'],
        description=data.get('description'),
        database_id=data['database_id'],
        sql=data['sql'],
        schema=data.get('schema'),
        parameters=data.get('parameters', []),
        user_id=user_id,
    )
    db.session.add(sq)
    db.session.commit()
    return jsonify(sq.to_dict()), 201

@sql_lab_bp.route('/saved_queries/<int:sq_id>', methods=['GET'])
@jwt_required()
def get_saved_query(sq_id):
    sq = SavedQuery.query.get(sq_id)
    if not sq:
        return jsonify({'error': 'Saved query not found'}), 404
    return jsonify(sq.to_dict()), 200

@sql_lab_bp.route('/saved_queries/<int:sq_id>', methods=['PUT'])
@jwt_required()
def update_saved_query(sq_id):
    sq = SavedQuery.query.get(sq_id)
    if not sq:
        return jsonify({'error': 'Saved query not found'}), 404
    data = request.get_json()
    if data.get('name'): sq.name = data['name']
    if 'description' in data: sq.description = data.get('description')
    if data.get('database_id'): sq.database_id = data['database_id']
    if data.get('sql'): sq.sql = data['sql']
    if 'schema' in data: sq.schema = data.get('schema')
    if 'parameters' in data: sq.parameters = data.get('parameters')
    db.session.commit()
    return jsonify(sq.to_dict()), 200

@sql_lab_bp.route('/saved_queries/<int:sq_id>', methods=['DELETE'])
@jwt_required()
def delete_saved_query(sq_id):
    sq = SavedQuery.query.get(sq_id)
    if not sq:
        return jsonify({'error': 'Saved query not found'}), 404
    db.session.delete(sq)
    db.session.commit()
    return jsonify({'message': 'Saved query deleted'}), 200


@sql_lab_bp.route('/query', methods=['POST'])
@jwt_required()
def execute_query():
    current_user_id = get_current_user_id()
    data = request.get_json()
    
    if not data.get('database_id') or not data.get('sql'):
        return jsonify({'error': 'database_id and sql are required'}), 400
    
    sql = data['sql'].strip()
    params = data.get('params', {})
    sql, used_params = substitute_params(sql, params)
    
    valid, err = validate_sql(sql)
    if not valid:
        return jsonify({'error': err}), 400
    
    database = Database.query.get(data['database_id'])
    if not database:
        return jsonify({'error': 'Database not found'}), 404
    
    limit = min(data.get('limit', 1000), 10000)
    
    query = Query(
        client_id=str(uuid.uuid4())[:10],
        database_id=data['database_id'],
        schema=data.get('schema'),
        sql=sql,
        status='running',
        user_id=current_user_id,
        limit=limit,
        start_time=time.time(),
        tab_name=data.get('tab_name', 'SQL Lab')
    )
    
    db.session.add(query)
    db.session.commit()
    
    try:
        engine = create_engine(database.sqlalchemy_uri)
        
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            
            if result.returns_rows:
                columns = list(result.keys())
                rows = []
                for i, row in enumerate(result):
                    if i >= limit:
                        break
                    rows.append(dict(row._mapping))
                
                query.status = 'success'
                query.rows = len(rows)
                query.end_time = time.time()
                db.session.commit()
                
                return jsonify({
                    'query_id': query.id,
                    'client_id': query.client_id,
                    'status': 'success',
                    'data': rows,
                    'columns': columns,
                    'rowcount': len(rows),
                    'sql': sql,
                    'params': used_params,
                }), 200
            else:
                query.status = 'success'
                query.rows = 0
                query.end_time = time.time()
                db.session.commit()
                
                return jsonify({
                    'query_id': query.id,
                    'client_id': query.client_id,
                    'status': 'success',
                    'data': [],
                    'columns': [],
                    'rowcount': 0,
                    'message': 'Query executed successfully (no rows returned)',
                    'params': used_params,
                }), 200
                
    except SQLAlchemyError as e:
        query.status = 'failed'
        query.error_message = str(e)
        query.end_time = time.time()
        db.session.commit()
        
        return jsonify({
            'query_id': query.id,
            'client_id': query.client_id,
            'status': 'failed',
            'error': f'Query error: {str(e)}',
        }), 400
    except Exception as e:
        query.status = 'failed'
        query.error_message = str(e)
        query.end_time = time.time()
        db.session.commit()
        
        return jsonify({
            'query_id': query.id,
            'client_id': query.client_id,
            'status': 'failed',
            'error': f'Unexpected error: {str(e)}',
        }), 500

@sql_lab_bp.route('/query/<int:query_id>', methods=['GET'])
@jwt_required()
def get_query_status(query_id):
    query = Query.query.get(query_id)
    
    if not query:
        return jsonify({'error': 'Query not found'}), 404
    
    return jsonify(query.to_dict()), 200

@sql_lab_bp.route('/query/<int:query_id>/results', methods=['GET'])
@jwt_required()
def get_query_results(query_id):
    query = Query.query.get(query_id)
    
    if not query:
        return jsonify({'error': 'Query not found'}), 404
    
    if query.status == 'failed':
        return jsonify({
            'status': 'failed',
            'error': query.error_message or 'Query failed'
        }), 200
    
    if query.status != 'success':
        return jsonify({
            'status': query.status or 'running',
            'message': 'Query is still running'
        }), 200
    
    return jsonify({
        'status': query.status,
        'data': [],
        'columns': [],
        'rowcount': query.rows
    }), 200

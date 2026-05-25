from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from app.models import Chart, Table
from app import db
import re

charts_bp = Blueprint('charts', __name__)


@charts_bp.route('', methods=['GET'])
@jwt_required()
def list_charts():
    """List all charts."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    datasource_id = request.args.get('datasource_id', type=int)
    owner_id = request.args.get('owner_id', type=int)
    
    query = Chart.query
    
    if datasource_id:
        query = query.filter_by(datasource_id=datasource_id)
    
    if owner_id:
        query = query.filter_by(owner_id=owner_id)
    
    pagination = query.order_by(Chart.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    charts_data = []
    for c in pagination.items:
        d = c.to_dict()
        d['datasource_name'] = c.datasource_id if c.datasource_id else None
        charts_data.append(d)
    
    return jsonify({
        'charts': charts_data,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages
    }), 200


@charts_bp.route('/<int:chart_id>', methods=['GET'])
@jwt_required()
def get_chart(chart_id):
    """Get a specific chart."""
    chart = Chart.query.get(chart_id)
    
    if not chart:
        return jsonify({'error': 'Chart not found'}), 404
    
    d = chart.to_dict()
    d['datasource_name'] = chart.datasource_id if chart.datasource_id else None
    return jsonify(d), 200


@charts_bp.route('', methods=['POST'])
@jwt_required()
def create_chart():
    """Create a new chart."""
    current_user_id = get_current_user_id()
    data = request.get_json()
    
    if not data.get('chart_name') or not data.get('viz_type'):
        return jsonify({'error': 'chart_name and viz_type are required'}), 400
    
    chart = Chart(
        chart_name=data['chart_name'],
        viz_type=data['viz_type'],
        params=data.get('params', {}),
        query_context=data.get('query_context'),
        description=data.get('description', ''),
        cache_timeout=data.get('cache_timeout'),
        datasource_id=data.get('datasource_id'),
        datasource_type=data.get('datasource_type', 'table'),
        owner_id=current_user_id
    )
    
    db.session.add(chart)
    db.session.commit()
    
    return jsonify(chart.to_dict()), 201


@charts_bp.route('/<int:chart_id>', methods=['PUT'])
@jwt_required()
def update_chart(chart_id):
    """Update a chart."""
    current_user_id = get_current_user_id()
    chart = Chart.query.get(chart_id)
    
    if not chart:
        return jsonify({'error': 'Chart not found'}), 404
    
    # Check ownership or admin
    if chart.owner_id != current_user_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    data = request.get_json()
    
    for field in ['chart_name', 'viz_type', 'params', 'query_context', 'description', 'cache_timeout']:
        if field in data:
            setattr(chart, field, data[field])
    
    db.session.commit()
    
    return jsonify(chart.to_dict()), 200


@charts_bp.route('/<int:chart_id>', methods=['DELETE'])
@jwt_required()
def delete_chart(chart_id):
    """Delete a chart."""
    current_user_id = get_current_user_id()
    chart = Chart.query.get(chart_id)
    
    if not chart:
        return jsonify({'error': 'Chart not found'}), 404
    
    if chart.owner_id != current_user_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    db.session.delete(chart)
    db.session.commit()
    
    return jsonify({'message': 'Chart deleted'}), 200


def _build_aggregation_query(datasource_id, params):
    """Build a SQL aggregation query from chart params.

    Supports groupby (list of columns) and metrics (list of dicts with
    aggregate/column/label). Falls back to SELECT * if no aggregation config.
    """
    groupby = params.get('groupby') if isinstance(params, dict) else None
    metrics = params.get('metrics') if isinstance(params, dict) else None

    if not groupby and not metrics:
        return None

    if isinstance(groupby, str):
        groupby = [g.strip() for g in groupby.split(',') if g.strip()]

    if not isinstance(groupby, list) or not groupby:
        return None

    groupby_cols = [g for g in groupby if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', str(g))]
    if not groupby_cols:
        return None

    if not isinstance(metrics, list) or not metrics:
        return None

    agg_parts = []
    select_cols = [f'"{g}"' for g in groupby_cols]
    for m in metrics:
        if not isinstance(m, dict):
            continue
        agg = m.get('aggregate', 'COUNT').upper()
        col_def = m.get('column', {})
        col_name = col_def.get('column_name') if isinstance(col_def, dict) else col_def
        label = m.get('label', f'{agg}_{col_name}')
        safe_col = str(col_name) if col_name and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', str(col_name)) else None
        if safe_col:
            select_cols.append(f'{agg}("{safe_col}") AS "{label}"')
            agg_parts.append(f'{agg}("{safe_col}")')
        elif agg == 'COUNT' and not col_name:
            select_cols.append('COUNT(*) AS "count"')
            agg_parts.append('COUNT(*)')

    if not agg_parts:
        return None

    select_sql = ', '.join(select_cols)
    group_sql = ', '.join(f'"{g}"' for g in groupby_cols)
    return f'SELECT {select_sql} FROM "{datasource_id}" GROUP BY {group_sql} ORDER BY {agg_parts[0]} DESC'


@charts_bp.route('/<int:chart_id>/data', methods=['POST'])
@jwt_required()
def get_chart_data(chart_id):
    chart = Chart.query.get(chart_id)

    if not chart:
        return jsonify({'error': 'Chart not found'}), 404

    try:
        from sqlalchemy import inspect, text
        import pandas as pd

        from app import db as _db
        engine = _db.engine

        datasource_id = chart.datasource_id

        if not datasource_id or not isinstance(datasource_id, str):
            datasource_id = str(datasource_id) if datasource_id else None

        if not datasource_id:
            return jsonify({
                'chart_id': chart_id,
                'data': [],
                'columns': [],
                'rowcount': 0,
                'query_context': chart.query_context or chart.params
            }), 200

        valid_char = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
        if not valid_char.match(datasource_id):
            return jsonify({
                'chart_id': chart_id,
                'data': [],
                'columns': [],
                'rowcount': 0,
            }), 200

        inspector = inspect(engine)
        if datasource_id not in inspector.get_table_names():
            return jsonify({
                'chart_id': chart_id,
                'data': [],
                'columns': [],
                'rowcount': 0,
                'note': 'Source table not found'
            }), 200

        params = chart.params if isinstance(chart.params, dict) else {}
        agg_query = _build_aggregation_query(datasource_id, params)

        if agg_query:
            df = pd.read_sql(agg_query, engine)
        else:
            df = pd.read_sql(f'SELECT * FROM "{datasource_id}"', engine)

        df = df.where(pd.notna(df), None)

        return jsonify({
            'chart_id': chart_id,
            'data': df.to_dict(orient='records'),
            'columns': df.columns.tolist(),
            'rowcount': len(df),
            'query_context': chart.params
        }), 200
    except Exception as e:
        return jsonify({
            'chart_id': chart_id,
            'data': [],
            'columns': [],
            'rowcount': 0,
            'error': str(e),
            'query_context': chart.query_context or chart.params
        }), 200

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import json
import pandas as pd
import os
import uuid
import re
from datetime import datetime
from sqlalchemy import inspect, text
from app.models import UserConfig

datasets_bp = Blueprint('datasets', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

VALID_TABLE_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def get_db_engine():
    from app import db as _db
    return _db.engine

def validate_table_name(name):
    if not VALID_TABLE_RE.match(name):
        return False, 'Invalid table name. Use only letters, numbers, and underscores.'
    return True, ''

def safe_table_ref(name):
    return text(f'SELECT COUNT(*) FROM "{name}"')

def safe_drop_table(name):
    return text(f'DROP TABLE IF EXISTS "{name}"')

def safe_select(name, limit=None):
    if limit:
        return text(f'SELECT * FROM "{name}" LIMIT :lim').bindparams(lim=limit)
    return text(f'SELECT * FROM "{name}"')

@datasets_bp.route('', methods=['GET'])
@jwt_required()
def list_datasets():
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        datasets = []
        for table_name in inspector.get_table_names():
            if table_name.startswith('kaggle_') or table_name.startswith('user_'):
                valid, _ = validate_table_name(table_name)
                if not valid:
                    continue
                try:
                    columns = inspector.get_columns(table_name)
                    with engine.connect() as conn:
                        row_count = conn.execute(safe_table_ref(table_name)).scalar()
                    
                    datasets.append({
                        'id': table_name,
                        'table_name': table_name,
                        'source': 'Kaggle' if table_name.startswith('kaggle_') else 'User Upload',
                        'row_count': row_count,
                        'column_count': len(columns),
                        'columns': [{'name': c['name'], 'type': str(c['type'])} for c in columns],
                        'status': 'ready',
                        'created_at': datetime.now().isoformat(),
                    })
                except Exception:
                    continue
        
        return jsonify({'datasets': datasets})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@datasets_bp.route('/<table_name>', methods=['GET'])
@jwt_required()
def get_dataset(table_name):
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        columns = inspector.get_columns(table_name)
        with engine.connect() as conn:
            row_count = conn.execute(safe_table_ref(table_name)).scalar()
        
        return jsonify({
            'id': table_name,
            'table_name': table_name,
            'row_count': row_count,
            'column_count': len(columns),
            'columns': [{'name': c['name'], 'type': str(c['type'])} for c in columns],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@datasets_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filepath = None
    try:
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', file.filename.rsplit('.', 1)[0].lower())
        filename = f"{uuid.uuid4().hex[:8]}_{safe_name}"
        filepath = os.path.join(UPLOAD_FOLDER, filename + '_' + file.filename)
        file.save(filepath)
        
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        
        try:
            if ext == 'csv':
                df = pd.read_csv(filepath, encoding='utf-8')
            elif ext == 'tsv':
                df = pd.read_csv(filepath, sep='\t', encoding='utf-8')
            elif ext in ('xlsx', 'xls'):
                df = pd.read_excel(filepath)
            elif ext == 'parquet':
                df = pd.read_parquet(filepath)
            elif ext == 'json':
                df = pd.read_json(filepath)
            else:
                os.remove(filepath)
                return jsonify({'error': f'Unsupported file format: .{ext}. Supported: .csv, .tsv, .xlsx, .xls, .parquet, .json'}), 400
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(filepath, encoding='latin1')
            except Exception:
                os.remove(filepath)
                return jsonify({'error': 'Could not read file. Try saving as UTF-8 CSV.'}), 400
        except Exception as e:
            os.remove(filepath)
            return jsonify({'error': f'Could not parse file: {str(e)}'}), 400
        
        if df.empty:
            os.remove(filepath)
            return jsonify({'error': 'File is empty'}), 400
        
        df.columns = [re.sub(r'[^a-zA-Z0-9_]', '_', str(c).strip()) or 'column' for c in df.columns]
        
        table_name = f"user_{safe_name}_{uuid.uuid4().hex[:6]}"
        
        engine = get_db_engine()
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        
        return jsonify({
            'message': 'Dataset uploaded successfully',
            'table_name': table_name,
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': list(df.columns),
        })
    except Exception as e:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@datasets_bp.route('/import/kaggle', methods=['POST'])
@jwt_required()
def import_from_kaggle():
    data = request.get_json()
    url = data.get('url', '').strip()
    
    if not url or 'kaggle.com' not in url:
        return jsonify({'error': 'Invalid Kaggle URL. Must be like: https://www.kaggle.com/datasets/username/dataset-name'}), 400
    
    parts = url.rstrip('/').split('/')
    if 'datasets' not in parts:
        return jsonify({'error': 'URL must be a Kaggle dataset URL'}), 400
    
    idx = parts.index('datasets')
    if idx + 2 >= len(parts):
        return jsonify({'error': 'Could not extract dataset owner and name from URL'}), 400
    
    owner = parts[idx + 1]
    ds_name = parts[idx + 2]
    
    safe_owner = re.sub(r'[^a-zA-Z0-9_-]', '', owner)
    safe_ds = re.sub(r'[^a-zA-Z0-9_-]', '', ds_name)
    
    if not safe_owner or not safe_ds:
        return jsonify({'error': 'Could not parse Kaggle dataset identifiers'}), 400
    
    current_user_id = int(get_jwt_identity())
    kaggle_username = UserConfig.query.filter_by(user_id=current_user_id, config_key='kaggle_username').first()
    kaggle_key = UserConfig.query.filter_by(user_id=current_user_id, config_key='kaggle_key').first()
    
    if not kaggle_username or not kaggle_key or not kaggle_username.config_value or not kaggle_key.config_value:
        return jsonify({
            'error': 'Kaggle authentication required. Set your Kaggle API credentials in Settings page.',
            'status': 'auth_required',
        }), 401
    
    try:
        import kagglehub
        os.environ['KAGGLE_USERNAME'] = kaggle_username.config_value
        os.environ['KAGGLE_KEY'] = kaggle_key.config_value
        
        dataset_ref = f"{safe_owner}/{safe_ds}"
        download_path = kagglehub.dataset_download(dataset_ref)
        
        if not download_path or not os.path.isdir(download_path):
            return jsonify({'error': 'Kaggle download returned an invalid path'}), 502
        
        total_imported = 0
        created_tables = []
        engine = get_db_engine()
        
        data_files = []
        for root, dirs, files in os.walk(download_path):
            for f in files:
                if f.startswith('__') or f.startswith('.'):
                    continue
                ext = f.rsplit('.', 1)[-1].lower() if '.' in f else ''
                if ext in ('csv', 'tsv', 'json', 'jsonl', 'xlsx', 'xls', 'parquet'):
                    data_files.append(os.path.join(root, f))
        
        if not data_files:
            return jsonify({'error': 'No supported data files (CSV, TSV, JSON, Excel, Parquet) found in the downloaded Kaggle dataset'}), 400
        
        for file_path in data_files:
            try:
                ext = file_path.rsplit('.', 1)[-1].lower()
                if ext == 'csv':
                    df = pd.read_csv(file_path, encoding='utf-8', nrows=50000)
                elif ext == 'tsv':
                    df = pd.read_csv(file_path, sep='\t', encoding='utf-8', nrows=50000)
                elif ext == 'json':
                    df = pd.read_json(file_path)
                    if isinstance(df, dict):
                        continue
                elif ext == 'jsonl':
                    df = pd.read_json(file_path, lines=True, nrows=50000)
                elif ext in ('xlsx', 'xls'):
                    df = pd.read_excel(file_path)
                elif ext == 'parquet':
                    df = pd.read_parquet(file_path)
                else:
                    continue
                if df.empty:
                    continue
                df.columns = [re.sub(r'[^a-zA-Z0-9_]', '_', str(c).strip()) or 'column' for c in df.columns]
                for col in df.columns:
                    if df[col].dtype == 'object' and df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                        df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
                table_safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', os.path.splitext(os.path.basename(file_path))[0].lower())
                ds_safe = re.sub(r'[^a-zA-Z0-9_]', '_', safe_ds)
                base_name = f"kaggle_{ds_safe}_{table_safe_name}" if table_safe_name != ds_safe else f"kaggle_{ds_safe}"
                base_name = base_name[:58]
                table_name = base_name
                inspector = inspect(engine)
                if table_name in inspector.get_table_names():
                    for i in range(2, 100):
                        table_name = f"{base_name[:55]}_{i}"
                        if table_name not in inspector.get_table_names():
                            break
                df.to_sql(table_name, engine, if_exists='replace', index=False)
                created_tables.append({
                    'table_name': table_name,
                    'rows': len(df),
                    'columns': len(df.columns),
                })
                total_imported += len(df)
            except Exception:
                continue
        
        if not created_tables:
            return jsonify({'error': 'Could not import any data files from the dataset'}), 400
        
        return jsonify({
            'message': f'Kaggle dataset imported: {len(created_tables)} table(s), {total_imported} rows',
            'tables': created_tables,
            'total_rows': total_imported,
        })
    except Exception as e:
        err_msg = str(e).lower()
        if '403' in err_msg or 'forbidden' in err_msg or 'authentication' in err_msg or 'unauthorized' in err_msg:
            return jsonify({
                'error': 'Kaggle authentication failed. Check your API credentials in Settings.',
                'status': 'auth_failed',
            }), 403
        if '404' in err_msg or 'not found' in err_msg:
            return jsonify({'error': f'Dataset "{safe_owner}/{safe_ds}" not found on Kaggle'}), 404
        if 'timeout' in err_msg or 'timed out' in err_msg:
            return jsonify({'error': 'Kaggle download timed out. The dataset may be too large.'}), 504
        return jsonify({'error': f'Kaggle import failed: {str(e)}'}), 500

@datasets_bp.route('/<table_name>/columns', methods=['GET'])
@jwt_required()
def get_columns(table_name):
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        columns = inspector.get_columns(table_name)
        return jsonify({
            'columns': [{'name': c['name'], 'type': str(c['type'])} for c in columns]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@datasets_bp.route('/<table_name>/preview', methods=['GET'])
@jwt_required()
def preview_dataset(table_name):
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    try:
        limit = min(request.args.get('limit', 100, type=int), 5000)
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}" LIMIT {limit}', engine)
        
        if df.empty:
            return jsonify({
                'table_name': table_name,
                'columns': [],
                'data': [],
                'total_rows': 0,
            })
        
        df = df.where(pd.notna(df), None)
        
        return jsonify({
            'table_name': table_name,
            'columns': df.columns.tolist(),
            'data': df.to_dict(orient='records'),
            'total_rows': len(df),
        })
    except Exception as e:
        return jsonify({'error': f'Preview failed: {str(e)}'}), 500

@datasets_bp.route('/<table_name>', methods=['DELETE'])
@jwt_required()
def delete_dataset(table_name):
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        with engine.connect() as conn:
            conn.execute(safe_drop_table(table_name))
            conn.commit()
        return jsonify({'message': f'Dataset "{table_name}" deleted'})
    except Exception as e:
        return jsonify({'error': f'Delete failed: {str(e)}'}), 500

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
            except UnicodeDecodeError:
                try:
                    df = pd.read_csv(filepath, encoding='cp1252')
                except Exception:
                    os.remove(filepath)
                    return jsonify({'error': 'Could not read file. Try saving as UTF-8 CSV.'}), 400
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
        
        col_metadata = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            col_metadata.append({
                'name': col,
                'type': dtype,
                'null_pct': round(df[col].isna().mean() * 100, 1),
                'sample_values': df[col].dropna().head(3).tolist(),
            })
        
        chart_recommendations = []
        try:
            api_key = os.environ.get('GROQ_API_KEY')
            if api_key:
                from groq import Groq
                client = Groq(api_key=api_key)
                numeric_cols = [c for c in col_metadata if any(t in c['type'].lower() for t in ['int', 'float', 'double', 'decimal'])]
                cat_cols = [c for c in col_metadata if c['name'] not in {nc['name'] for nc in numeric_cols} and c['name'] != 'id']
                if numeric_cols and cat_cols:
                    prompt = f"""Given table '{table_name}' with columns: {json.dumps(col_metadata, indent=2)}
Recommend 3 charts. Respond ONLY in JSON array:
[{{"title":"...","chart_type":"bar|line|pie|scatter|area","x_column":"col","y_columns":["col"],"aggregation":"SUM|COUNT|AVG","reason":"..."}}]"""
                    resp = client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.2, max_tokens=1024,
                    )
                    raw = re.sub(r"```json|```", "", resp.choices[0].message.content).strip()
                    chart_recommendations = json.loads(raw) if raw.startswith('[') else []
        except Exception:
            pass
        
        return jsonify({
            'message': 'Dataset uploaded successfully',
            'table_name': table_name,
            'rows': len(df),
            'columns': len(df.columns),
            'column_names': list(df.columns),
            'column_metadata': col_metadata,
            'chart_recommendations': chart_recommendations,
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


@datasets_bp.route('/<table_name>/profile', methods=['GET'])
@jwt_required()
def profile_dataset(table_name):
    """Generate comprehensive data quality profile for a dataset."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        columns_info = []
        
        for col in df.columns:
            col_type = str(df[col].dtype)
            is_numeric = pd.api.types.is_numeric_dtype(df[col])
            is_datetime = pd.api.types.is_datetime64_any_dtype(df[col])
            
            null_count = int(df[col].isna().sum())
            null_pct = round(null_count / len(df) * 100, 2) if len(df) > 0 else 0
            unique_count = int(df[col].nunique())
            
            info = {
                'name': col,
                'type': col_type,
                'is_numeric': is_numeric,
                'is_datetime': is_datetime,
                'null_count': null_count,
                'null_pct': null_pct,
                'unique_count': unique_count,
                'unique_pct': round(unique_count / len(df) * 100, 2) if len(df) > 0 else 0,
            }
            
            if is_numeric and not df[col].isna().all():
                info.update({
                    'min': float(df[col].min()) if pd.notna(df[col].min()) else None,
                    'max': float(df[col].max()) if pd.notna(df[col].max()) else None,
                    'mean': round(float(df[col].mean()), 4) if pd.notna(df[col].mean()) else None,
                    'median': round(float(df[col].median()), 4) if pd.notna(df[col].median()) else None,
                    'std': round(float(df[col].std()), 4) if pd.notna(df[col].std()) else None,
                })
            elif not is_numeric and unique_count <= 20:
                top_vals = df[col].value_counts().head(10)
                info['top_values'] = [{'value': str(k), 'count': int(v)} for k, v in top_vals.items()]
            
            columns_info.append(info)
        
        return jsonify({
            'table_name': table_name,
            'row_count': len(df),
            'column_count': len(df.columns),
            'columns': columns_info,
            'duplicate_rows': int(df.duplicated().sum()),
            'memory_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        })
    except Exception as e:
        return jsonify({'error': f'Profile failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/duplicate', methods=['POST'])
@jwt_required()
def duplicate_dataset(table_name):
    """Create a copy of a dataset for editing."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json() or {}
    new_name = data.get('name', f'{table_name}_copy')
    new_name = re.sub(r'[^a-zA-Z0-9_]', '_', new_name)[:58]
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        if new_name in inspector.get_table_names():
            for i in range(2, 100):
                candidate = f'{new_name}_{i}'
                if candidate not in inspector.get_table_names():
                    new_name = candidate
                    break
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        df.to_sql(new_name, engine, if_exists='replace', index=False)
        
        return jsonify({
            'message': 'Dataset duplicated',
            'table_name': new_name,
            'rows': len(df),
        })
    except Exception as e:
        return jsonify({'error': f'Duplicate failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/rename-column', methods=['POST'])
@jwt_required()
def rename_column(table_name):
    """Rename a column in the dataset."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    old_name = data.get('old_name', '')
    new_name = data.get('new_name', '')
    
    if not old_name or not new_name:
        return jsonify({'error': 'old_name and new_name are required'}), 400
    
    new_name = re.sub(r'[^a-zA-Z0-9_]', '_', new_name.strip())
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        
        if old_name not in df.columns:
            return jsonify({'error': f'Column "{old_name}" not found'}), 404
        
        df.rename(columns={old_name: new_name}, inplace=True)
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': f'Column renamed to "{new_name}"', 'columns': list(df.columns)})
    except Exception as e:
        return jsonify({'error': f'Rename failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/drop-columns', methods=['POST'])
@jwt_required()
def drop_columns(table_name):
    """Drop one or more columns from the dataset."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    columns = data.get('columns', [])
    
    if not columns:
        return jsonify({'error': 'columns list is required'}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        cols_to_drop = [c for c in columns if c in df.columns]
        
        if not cols_to_drop:
            return jsonify({'error': 'No valid columns to drop'}), 400
        
        df.drop(columns=cols_to_drop, inplace=True)
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': f'Dropped {len(cols_to_drop)} columns', 'columns': list(df.columns)})
    except Exception as e:
        return jsonify({'error': f'Drop failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/cast-column', methods=['POST'])
@jwt_required()
def cast_column(table_name):
    """Change the data type of a column."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    column = data.get('column', '')
    new_type = data.get('type', '')
    
    if not column or not new_type:
        return jsonify({'error': 'column and type are required'}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        
        if column not in df.columns:
            return jsonify({'error': f'Column "{column}" not found'}), 404
        
        type_map = {
            'integer': 'Int64',
            'float': 'Float64',
            'string': 'string',
            'boolean': 'boolean',
            'datetime': 'datetime64[ns]',
            'date': 'datetime64[ns]',
        }
        
        target_type = type_map.get(new_type.lower(), new_type)
        
        if new_type.lower() in ('integer', 'float'):
            df[column] = pd.to_numeric(df[column], errors='coerce')
            if new_type.lower() == 'integer':
                df[column] = df[column].astype('Int64')
            else:
                df[column] = df[column].astype('Float64')
        elif new_type.lower() == 'datetime':
            df[column] = pd.to_datetime(df[column], errors='coerce')
        elif new_type.lower() == 'boolean':
            df[column] = df[column].astype('boolean')
        else:
            df[column] = df[column].astype(str)
        
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': f'Column "{column}" cast to {new_type}'})
    except Exception as e:
        return jsonify({'error': f'Cast failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/fill-nulls', methods=['POST'])
@jwt_required()
def fill_nulls(table_name):
    """Fill missing values in columns."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    fills = data.get('fills', [])
    
    if not fills:
        return jsonify({'error': 'fills list is required'}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        
        for fill in fills:
            col = fill.get('column')
            strategy = fill.get('strategy', 'value')
            value = fill.get('value')
            
            if col not in df.columns:
                continue
            
            if strategy == 'value':
                df[col] = df[col].fillna(value)
            elif strategy == 'mean' and pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].mean())
            elif strategy == 'median' and pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            elif strategy == 'mode':
                mode_val = df[col].mode()
                if len(mode_val) > 0:
                    df[col] = df[col].fillna(mode_val[0])
            elif strategy == 'forward':
                df[col] = df[col].fillna(method='ffill')
            elif strategy == 'backward':
                df[col] = df[col].fillna(method='bfill')
            elif strategy == 'drop':
                df = df.dropna(subset=[col])
        
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': 'Nulls filled', 'rows': len(df)})
    except Exception as e:
        return jsonify({'error': f'Fill nulls failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/filter', methods=['POST'])
@jwt_required()
def filter_rows(table_name):
    """Apply row filters to the dataset."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    filters = data.get('filters', [])
    save_as = data.get('save_as', None)
    
    if not filters:
        return jsonify({'error': 'filters list is required'}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        mask = pd.Series([True] * len(df))
        
        for f in filters:
            col = f.get('column')
            op = f.get('operator', '==')
            value = f.get('value')
            
            if col not in df.columns:
                continue
            
            if op == '==':
                mask &= df[col] == value
            elif op == '!=':
                mask &= df[col] != value
            elif op == '>':
                mask &= df[col] > value
            elif op == '<':
                mask &= df[col] < value
            elif op == '>=':
                mask &= df[col] >= value
            elif op == '<=':
                mask &= df[col] <= value
            elif op == 'contains':
                mask &= df[col].astype(str).str.contains(str(value), case=False, na=False)
            elif op == 'in':
                mask &= df[col].isin(value) if isinstance(value, list) else df[col] == value
            elif op == 'notnull':
                mask &= df[col].notna()
            elif op == 'isnull':
                mask &= df[col].isna()
        
        df_filtered = df[mask]
        
        if save_as:
            save_as = re.sub(r'[^a-zA-Z0-9_]', '_', save_as)[:58]
            if save_as in inspector.get_table_names():
                for i in range(2, 100):
                    candidate = f'{save_as}_{i}'
                    if candidate not in inspector.get_table_names():
                        save_as = candidate
                        break
            df_filtered.to_sql(save_as, engine, if_exists='replace', index=False)
            return jsonify({
                'message': f'Filtered dataset saved as "{save_as}"',
                'table_name': save_as,
                'original_rows': len(df),
                'filtered_rows': len(df_filtered),
            })
        else:
            df_filtered.to_sql(table_name, engine, if_exists='replace', index=False)
            return jsonify({
                'message': 'Filters applied',
                'original_rows': len(df),
                'filtered_rows': len(df_filtered),
            })
    except Exception as e:
        return jsonify({'error': f'Filter failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/derive', methods=['POST'])
@jwt_required()
def derive_column(table_name):
    """Create a new derived/calculated column."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    new_col = data.get('name', '')
    expression = data.get('expression', '')
    
    if not new_col or not expression:
        return jsonify({'error': 'name and expression are required'}), 400
    
    new_col = re.sub(r'[^a-zA-Z0-9_]', '_', new_col.strip())
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        
        if new_col in df.columns:
            return jsonify({'error': f'Column "{new_col}" already exists'}), 400
        
        import numpy as np
        expr = re.sub(r'\{([^}]+)\}', r'df["\1"]', expression)
        
        df[new_col] = eval(expr, {'df': df, 'pd': pd, 'np': np}, {})
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': f'Derived column "{new_col}" created', 'columns': list(df.columns)})
    except Exception as e:
        return jsonify({'error': f'Derive failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/deduplicate', methods=['POST'])
@jwt_required()
def deduplicate(table_name):
    """Remove duplicate rows from the dataset."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json() or {}
    subset = data.get('subset', None)
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        original_count = len(df)
        
        if subset and all(c in df.columns for c in subset):
            df = df.drop_duplicates(subset=subset)
        else:
            df = df.drop_duplicates()
        
        df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({
            'message': 'Duplicates removed',
            'original_rows': original_count,
            'clean_rows': len(df),
            'removed': original_count - len(df),
        })
    except Exception as e:
        return jsonify({'error': f'Deduplicate failed: {str(e)}'}), 500


@datasets_bp.route('/<table_name>/sort', methods=['POST'])
@jwt_required()
def sort_dataset(table_name):
    """Sort the dataset by columns."""
    valid, err = validate_table_name(table_name)
    if not valid:
        return jsonify({'error': err}), 400
    
    data = request.get_json()
    sort_by = data.get('sort_by', [])
    
    if not sort_by:
        return jsonify({'error': 'sort_by list is required'}), 400
    
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            return jsonify({'error': 'Dataset not found'}), 404
        
        df = pd.read_sql(f'SELECT * FROM "{table_name}"', engine)
        
        columns = [s.get('column') for s in sort_by if s.get('column') in df.columns]
        ascending = [s.get('ascending', True) for s in sort_by if s.get('column') in df.columns]
        
        if columns:
            df = df.sort_values(by=columns, ascending=ascending)
            df.to_sql(table_name, engine, if_exists='replace', index=False)
        
        return jsonify({'message': 'Dataset sorted'})
    except Exception as e:
        return jsonify({'error': f'Sort failed: {str(e)}'}), 500

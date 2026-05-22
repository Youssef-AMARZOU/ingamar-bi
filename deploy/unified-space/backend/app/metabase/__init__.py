from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from app.models import UserConfig, Chart, Table, db
import requests
import json
import os

metabase_bp = Blueprint('metabase', __name__)

DEFAULT_MB_URL = 'http://localhost:3001'

VIZ_TYPE_MAP = {
    'bar': 'bar',
    'line': 'line',
    'pie': 'pie',
    'area': 'area',
    'scatter': 'scatter',
    'table': 'table',
    'combo': 'bar',
    'waterfall': 'bar',
    'row': 'bar',
    'smartscalar': 'line',
    'progress': 'bar',
    'funnel': 'bar',
    'gauge': 'bar',
    'pivot': 'table',
    'map': 'table',
}


def get_mb_config(user_id):
    configs = UserConfig.query.filter(
        UserConfig.user_id == user_id,
        UserConfig.config_key.in_(['mb_api_key', 'mb_url'])
    ).all()
    result = {c.config_key: c.config_value for c in configs}
    # Docker networking: resolve localhost to container name
    url = result.get('mb_url', DEFAULT_MB_URL)
    if 'localhost' in url or '127.0.0.1' in url:
        url = url.replace('localhost', 'metabase').replace('127.0.0.1', 'metabase')
        if ':3001' in url:
            url = url.replace(':3001', ':3000')
        elif url.endswith(':3000') or ':3000/' in url:
            pass
        else:
            url = url.rstrip('/') + ':3000'
        result['mb_url'] = url
    return result


def get_mb_table_map(user_id):
    """Build a mapping of Metabase table IDs -> INGAMAR table names."""
    mb_config = get_mb_config(user_id)
    api_key = mb_config.get('mb_api_key')
    mb_url = mb_config.get('mb_url', DEFAULT_MB_URL)
    if not api_key:
        return {}

    try:
        r = requests.get(f'{mb_url}/api/table', headers={'X-API-KEY': api_key}, timeout=10)
        if r.status_code != 200:
            return {}
        mb_tables = r.json() if isinstance(r.json(), list) else r.json().get('data', [])
    except Exception:
        return {}

    # Map Metabase table names to INGAMAR table names (they should match)
    result = {}
    for mt in mb_tables:
        mb_id = mt.get('id')
        mb_name = mt.get('name')
        if mb_id and mb_name:
            result[str(mb_id)] = mb_name
            result[mb_id] = mb_name
    return result


def extract_table_name_from_query(dataset_query, table_map):
    """Extract the table name from a Metabase dataset_query."""
    if not isinstance(dataset_query, dict):
        return None

    # Try stages format (newer Metabase)
    stages = dataset_query.get('stages', [])
    if stages:
        source_table = stages[0].get('source-table')
        if source_table:
            name = table_map.get(source_table)
            if name:
                return name

    # Try query format (older Metabase)
    query = dataset_query.get('query', {})
    source_table = query.get('source-table') or dataset_query.get('source-table')
    if source_table:
        return table_map.get(source_table)

    # Try native query
    native = dataset_query.get('native', {})
    if native:
        sql = native.get('query', '')
        for name in table_map.values():
            if name and f'"{name}"' in sql or f'{name}' in sql.split():
                return name
    return None


def fetch_question_data(mb_url, api_key, question_id):
    """Fetch the result data for a Metabase question."""
    # Try the JSON export endpoint first (returns aggregated data as list of dicts)
    r = requests.post(
        f'{mb_url}/api/card/{question_id}/query/json',
        headers={'X-API-KEY': api_key},
        timeout=30,
    )
    if r.status_code == 200:
        try:
            body = r.json()
            if isinstance(body, list) and body:
                # List of dicts - extract columns from first row keys
                if isinstance(body[0], dict):
                    cols = list(body[0].keys())
                    rows = [list(row.values()) for row in body]
                    return {'data': {'columns': cols, 'rows': rows}}
                # Plain list of values
                card = requests.get(
                    f'{mb_url}/api/card/{question_id}',
                    headers={'X-API-KEY': api_key},
                    timeout=10,
                ).json()
                cols = [m.get('name', f'col_{i}')
                        for i, m in enumerate(card.get('result_metadata', []))]
                return {'data': {'columns': cols, 'rows': body}}
            if isinstance(body, dict):
                return body
            return {'data': {'columns': [], 'rows': body if isinstance(body, list) else []}}
        except Exception:
            pass

    # Fallback: POST with parameters
    r = requests.post(
        f'{mb_url}/api/card/{question_id}/query',
        headers={'X-API-KEY': api_key, 'Content-Type': 'application/json'},
        json={'parameters': []},
        timeout=30,
    )
    if r.status_code in (200, 202):
        body = r.json()
        if isinstance(body, dict):
            return body
        return {'data': {'columns': [], 'rows': body if isinstance(body, list) else []}}
    return None


@metabase_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync_from_metabase():
    current_user_id = get_current_user_id()
    mb_config = get_mb_config(current_user_id)
    api_key = mb_config.get('mb_api_key')
    mb_url = mb_config.get('mb_url', DEFAULT_MB_URL)

    if not api_key:
        return jsonify({'error': 'Metabase API key not configured. Go to Settings to set it up.'}), 400

    try:
        # Fetch all questions from Metabase
        r = requests.get(f'{mb_url}/api/card', headers={'X-API-KEY': api_key}, timeout=15)
        if r.status_code != 200:
            return jsonify({'error': f'Failed to fetch Metabase questions: {r.status_code} {r.text[:200]}'}), 502
        questions = r.json() if isinstance(r.json(), list) else r.json().get('data', [])

        table_map = get_mb_table_map(current_user_id)
        imported = 0
        skipped = 0
        errors = []

        for q in questions:
            q_id = q.get('id')
            q_name = q.get('name', 'Unnamed')
            q_desc = q.get('description') or ''
            q_display = q.get('display', 'bar')
            dataset_query = q.get('dataset_query', {})

            # Extract table name
            table_name = extract_table_name_from_query(dataset_query, table_map)
            if not table_name:
                skipped += 1
                continue

            # Find or create the INGAMAR Table entry
            table = Table.query.filter_by(table_name=table_name).first()
            if not table:
                skipped += 1
                continue

            # Check if already imported (by name + datasource)
            existing = Chart.query.filter_by(
                chart_name=f'[MB] {q_name}',
                datasource_id=table.id,
            ).first()
            if existing:
                # Update existing chart params on re-sync
                existing.params = {
                    'groupby': [],
                    'metrics': [],
                    'rowLimit': 20,
                }
                existing.description = q_desc
                existing.viz_type = VIZ_TYPE_MAP.get(q_display, 'bar')
                db.session.commit()
                skipped += 1
                continue

            # Skip params for imported Metabase charts — they'll show raw data
            # until the user uses AI analysis to create proper aggregations.
            # Metabase column names (e.g. 'avg', 'Gender') rarely match actual
            # PostgreSQL column names (e.g. 'productivity_score', 'gender').
            groupby_cols = []
            metrics = []

            viz_type = VIZ_TYPE_MAP.get(q_display, 'bar')

            chart = Chart(
                chart_name=f'[MB] {q_name}',
                viz_type=viz_type,
                params={
                    'groupby': groupby_cols,
                    'metrics': metrics,
                    'rowLimit': 20,
                },
                description=q_desc,
                datasource_id=table.id,
                datasource_type='table',
                owner_id=current_user_id,
            )
            db.session.add(chart)
            imported += 1

        db.session.commit()

        return jsonify({
            'message': f'Imported {imported} charts from Metabase',
            'imported': imported,
            'skipped': skipped,
            'total': len(questions),
            'errors': errors[:5],
        }), 200

    except requests.exceptions.ConnectionError:
        return jsonify({'error': f'Cannot reach Metabase at {mb_url}. Make sure it is running.'}), 502
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@metabase_bp.route('/status', methods=['GET'])
@jwt_required()
def metabase_status():
    current_user_id = get_current_user_id()
    mb_config = get_mb_config(current_user_id)
    api_key = mb_config.get('mb_api_key')
    mb_url = mb_config.get('mb_url', DEFAULT_MB_URL)

    if not api_key:
        return jsonify({
            'configured': False,
            'message': 'Metabase API key not configured',
        })

    try:
        r = requests.get(f'{mb_url}/api/user/current', headers={'X-API-KEY': api_key}, timeout=10)
        if r.status_code == 200:
            user = r.json()
            return jsonify({
                'configured': True,
                'connected': True,
                'user': user.get('common_name', '?'),
                'url': mb_url,
            })
        return jsonify({
            'configured': True,
            'connected': False,
            'message': f'API returned {r.status_code}',
            'url': mb_url,
        })
    except requests.exceptions.ConnectionError:
        return jsonify({
            'configured': True,
            'connected': False,
            'message': f'Cannot reach {mb_url}',
            'url': mb_url,
        })

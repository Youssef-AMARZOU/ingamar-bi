from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from app.models import Chart, Metric, Table, UserConfig, db
from sqlalchemy import inspect
import requests
import json
import os
import re

ai_bp = Blueprint('ai', __name__)

DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1'
DEFAULT_MODEL = 'openai/gpt-4o-mini'
# Local fallback: set endpoint=http://host.docker.internal:11434/v1, model=llama3.2:3b for Ollama
LOCAL_MODEL_TIMEOUT = 300

def get_db_engine():
    from sqlalchemy import create_engine
    database_url = os.environ.get('INGAMAR_DB_URI', 'postgresql+psycopg2://ingamar:ingamar@db:5432/ingamar')
    return create_engine(database_url)

def get_user_ai_config(user_id):
    configs = UserConfig.query.filter(
        UserConfig.user_id == user_id,
        UserConfig.config_key.in_(['ai_api_key', 'ai_api_endpoint', 'ai_model'])
    ).all()
    result = {c.config_key: c.config_value for c in configs}
    return result

def get_numeric_columns(table_name):
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        numeric_types = ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision', 'float', 'float4', 'float8', 'int', 'int4', 'int8', 'serial', 'bigserial']
        return [c['name'] for c in columns if str(c['type']).lower() in numeric_types or 'int' in str(c['type']).lower() or 'float' in str(c['type']).lower() or 'numeric' in str(c['type']).lower() or 'decimal' in str(c['type']).lower()]
    except Exception:
        return []

def get_categorical_columns(table_name):
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        string_types = ['character varying', 'varchar', 'character', 'char', 'text', 'string']
        return [c['name'] for c in columns if str(c['type']).lower() in string_types or 'char' in str(c['type']).lower() or 'text' in str(c['type']).lower()]
    except Exception:
        return []

def build_schema_context(dataset_id):
    try:
        engine = get_db_engine()
        inspector = inspect(engine)
        columns = inspector.get_columns(dataset_id)
        numeric_cols = get_numeric_columns(dataset_id)
        categorical_cols = get_categorical_columns(dataset_id)
        sample_data = []
        column_stats = {}
        try:
            import pandas as pd
            df = pd.read_sql(f'SELECT * FROM "{dataset_id}" LIMIT 5', engine)
            sample_data = df.to_dict(orient='records')
            # Compute stats for numeric columns
            for col in numeric_cols:
                if col in df.columns:
                    try:
                        full_df = pd.read_sql(f'SELECT "{col}" FROM "{dataset_id}"', engine)
                        column_stats[col] = {
                            'min': float(full_df[col].min()) if full_df[col].notna().any() else None,
                            'max': float(full_df[col].max()) if full_df[col].notna().any() else None,
                            'avg': float(full_df[col].mean()) if full_df[col].notna().any() else None,
                            'null_count': int(full_df[col].isna().sum()),
                        }
                    except Exception:
                        pass
            # Compute value counts for categorical columns
            for col in categorical_cols:
                if col in df.columns:
                    try:
                        full_df = pd.read_sql(f'SELECT "{col}" FROM "{dataset_id}"', engine)
                        vc = full_df[col].value_counts()
                        column_stats[col] = {
                            'unique_values': len(vc),
                            'null_count': int(full_df[col].isna().sum()),
                            'top_values': vc.head(5).to_dict(),
                        }
                    except Exception:
                        pass
        except Exception:
            pass
        return {
            'table_name': dataset_id,
            'total_rows': len(pd.read_sql(f'SELECT COUNT(*) as cnt FROM "{dataset_id}"', get_db_engine())) if sample_data else 'unknown',
            'columns': [{'name': c['name'], 'type': str(c['type'])} for c in columns],
            'numeric_columns': numeric_cols,
            'categorical_columns': categorical_cols,
            'sample_rows': sample_data,
            'column_stats': column_stats,
        }
    except Exception as e:
        return {'table_name': dataset_id, 'error': str(e)}

SYSTEM_PROMPT = """You are a SENIOR DATA SCIENTIST for a premium BI platform. Given a dataset schema with statistics and a user request, deliver PROFESSIONAL, ACTIONABLE insights.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

ANALYSIS METHODOLOGY - Think like a lead data scientist:
1. EXPLORE: Profile all columns — distributions, missing values, ranges, unique counts
2. DETECT: Identify correlations (numeric-numeric), segment differences (categorical-numeric), outliers, trends
3. PRIORITIZE: Select the 2-4 findings with highest business impact — don't show everything
4. RECOMMEND: For each finding, explain the pattern, quantify the effect, and state the business implication

DESCRIPTION GUIDELINES (shown as chart caption/legend):
Each description must include: (a) what the chart shows, (b) the key numerical finding, (c) the insight/implication.
Bad: "Average salary by department."
Good: "Engineering has the highest average salary ($92K), 41% above Marketing ($65K). The gap suggests market-driven compensation for technical roles, which may impact hiring and retention strategies."

CHART SELECTION RULES:
- bar: Compare categories (rankings, top-N, group differences)
- line: Time-series trends, sequential progression, growth rates
- pie: ONLY for 2-5 categories showing part-of-whole (avoid otherwise)
- scatter: Correlation between 2 numeric variables (add trend interpretation)
- area: Cumulative trends, volume over time, stacked composition
- heatmap: Multi-dimensional cross-tabulation, correlation matrix, density grids
- table: Exact values, row-level detail, drill-down reference

ANALYTICAL PATTERNS TO APPLY:
- For numeric columns: report mean, median, range, missing %, distribution shape
- For categorical columns: report value counts, top categories, uniqueness ratio
- For correlations: identify the strongest positive/negative relationships
- For segments: compare numeric metrics across categorical groups
- For outliers: flag extreme values and assess their impact

JSON format:
{
  "message": "Executive analysis summary (2-3 sentences in English)",
  "suggestions": [
    {
      "type": "chart",
      "title": "Short insight-driven title",
      "description": "Chart legend/explanation that helps the user read this visualization (1-3 sentences, include specific values if available)",
      "config": {
        "chart_name": "Title",
        "viz_type": "bar",
        "datasource_id": "<table_name>",
        "datasource_type": "table",
        "description": "Same detailed legend text for display",
        "params": {
          "groupby": ["category_column"],
          "metrics": [{"label":"Metric Name","expressionType":"SIMPLE","aggregate":"AVG","column":{"column_name":"numeric_col"}}],
          "rowLimit": 20
        }
      }
    },
    {
      "type": "metric",
      "title": "KPI Name",
      "description": "What this KPI measures, current value context, and why it matters",
      "config": {
        "metric_name": "KPI Name",
        "metric_type": "aggregator",
        "expression": "AVG(column_name) or COUNT(*) or SUM(column_name)",
        "table_id": "<table_name>",
        "description": "Business definition and interpretation"
      }
    }
  ]
}

CRITICAL RULES:
- groupby MUST be an array of strings, e.g. ["department"]
- metrics MUST be an array of objects
- Use actual column names from the schema (not display names)
- For KPIs: AVG for rating/score columns, SUM for count/revenue columns, COUNT(*) for frequency
- Suggest 2-4 items total (mix of charts and KPIs)
- EVERY suggestion must answer "so what?" — state the business implication
- description MUST be a complete chart caption with specific numbers and the takeaway
- Prefer bar over pie unless the data is genuinely a composition (parts adding to 100%)
- When a categorical column has high cardinality (>10 unique values), group or filter to top-N
- If numeric columns have skewed distributions, note the skew in the description"""

def call_llm(api_key, endpoint, model, messages):
    url = f"{endpoint.rstrip('/')}/chat/completions"
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ingamar.local',
        'X-Title': 'INGAMAR BI',
    }
    # Detect local endpoint (Ollama, LocalAI, etc.) for different timeout and options
    is_local = 'host.docker.internal' in endpoint or 'localhost' in endpoint or '127.0.0.1' in endpoint
    payload = {
        'model': model,
        'messages': messages,
        'temperature': 0.1 if is_local else 0.3,
        'max_tokens': 4000,
    }
    if not is_local:
        # Remote APIs like OpenRouter support structured JSON mode
        payload['response_format'] = {'type': 'json_object'}
    timeout = LOCAL_MODEL_TIMEOUT if is_local else 60
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    except requests.exceptions.ConnectionError:
        if is_local:
            raise Exception(f'Cannot reach local model at {endpoint}. Make sure Ollama is running: ollama serve')
        raise Exception(f'Cannot reach AI endpoint at {endpoint}')
    if resp.status_code != 200:
        raise Exception(f'LLM API returned {resp.status_code}: {resp.text[:200]}')
    data = resp.json()
    content = data['choices'][0]['message']['content']
    # Robust JSON extraction: try direct parse first, then fallback to regex
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            return json.loads(match.group())
        raise Exception(f'LLM did not return valid JSON. Response: {content[:200]}')

@ai_bp.route('/analyze', methods=['POST'])
@jwt_required()
def analyze():
    data = request.get_json()
    message = data.get('message', '')
    dataset_id = data.get('dataset_id')
    columns = data.get('columns', [])

    current_user_id = get_current_user_id()
    ai_config = get_user_ai_config(current_user_id)
    api_key = ai_config.get('ai_api_key')

    if not api_key:
        numeric_cols = get_numeric_columns(dataset_id) if dataset_id else []
        categorical_cols = get_categorical_columns(dataset_id) if dataset_id else []
        col_info = f' with {len(columns)} columns' if columns else ''
        if numeric_cols:
            col_info += f' (numeric: {", ".join(numeric_cols[:3])})'
        if categorical_cols:
            col_info += f' (categorical: {", ".join(categorical_cols[:3])})'

        return jsonify({
            'message': f'I can see your dataset{col_info}. To get AI-powered suggestions, please set up your AI API key in Settings (click your profile -> Settings -> AI API).',
            'suggestions': [],
        })

    try:
        endpoint = ai_config.get('ai_api_endpoint', DEFAULT_ENDPOINT)
        model = ai_config.get('ai_model', DEFAULT_MODEL)

        schema = build_schema_context(dataset_id) if dataset_id else {}

        user_prompt = f"User request: {message}\n\n"
        if schema:
            user_prompt += f"Dataset schema:\n{json.dumps(schema, indent=2)}\n\n"
        if columns:
            user_prompt += f"Available columns: {', '.join(columns)}\n\n"
        user_prompt += "Respond with ONLY valid JSON in the specified format."

        messages = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt},
        ]

        result = call_llm(api_key, endpoint, model, messages)

        return jsonify({
            'message': result.get('message', "Here are my suggestions:"),
            'suggestions': result.get('suggestions', []),
        })

    except Exception as e:
        return jsonify({
            'message': f'AI analysis failed: {str(e)}. Check your API key and endpoint in Settings.',
            'suggestions': [],
        })

@ai_bp.route('/metric', methods=['POST'])
@jwt_required()
def create_metric():
    current_user_id = get_current_user_id()
    data = request.get_json()

    try:
        table_id = data.get('table_id')

        if table_id and isinstance(table_id, str):
            table = Table.query.filter_by(table_name=table_id).first()
            if not table:
                table = Table(
                    table_name=table_id,
                    database_id=1,
                    description=f'Auto-created for {table_id}',
                )
                db.session.add(table)
                db.session.flush()
            table_id = table.id

        metric = Metric(
            metric_name=data['metric_name'],
            metric_type=data.get('metric_type', 'aggregator'),
            expression=data['expression'],
            table_id=table_id,
            description=data.get('description', ''),
            d3format=data.get('d3format'),
        )

        db.session.add(metric)
        db.session.commit()

        return jsonify({
            'message': 'Metric created successfully',
            'id': metric.id,
            'metric': metric.metric_name,
        }), 201
    except Exception as e:
        db.session.rollback()
        if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
            return jsonify({'error': 'Metric with this name already exists'}), 409
        return jsonify({'error': str(e)}), 500

def normalize_chart_config(data):
    """Fix common LLM output issues in chart config."""
    params = data.get('params', {})
    if isinstance(params, dict):
        if isinstance(params.get('groupby'), str):
            params['groupby'] = [g.strip() for g in params['groupby'].split() if g.strip()]
        if params.get('metrics') == '' or params.get('metrics') is None:
            params['metrics'] = [{'label': 'Count', 'expressionType': 'SIMPLE', 'aggregate': 'COUNT'}]
        if isinstance(params.get('metrics'), str):
            params['metrics'] = [{'label': 'Count', 'expressionType': 'SIMPLE', 'aggregate': 'COUNT'}]
        data['params'] = params
    valid_viz = ['bar', 'line', 'pie', 'area', 'scatter', 'heatmap', 'table']
    if data.get('viz_type') not in valid_viz:
        data['viz_type'] = 'bar'
    return data


@ai_bp.route('/chart', methods=['POST'])
@jwt_required()
def create_chart():
    current_user_id = get_current_user_id()
    data = request.get_json()
    data = normalize_chart_config(data)

    try:
        datasource_id = data.get('datasource_id')

        if datasource_id and isinstance(datasource_id, str):
            table = Table.query.filter_by(table_name=datasource_id).first()
            if not table:
                table = Table(
                    table_name=datasource_id,
                    database_id=1,
                    description=f'Auto-created for {datasource_id}',
                )
                db.session.add(table)
                db.session.flush()
            datasource_id = table.id

        chart = Chart(
            chart_name=data['chart_name'],
            viz_type=data['viz_type'],
            params=data.get('params', {}),
            query_context=data.get('query_context'),
            description=data.get('description', ''),
            cache_timeout=data.get('cache_timeout'),
            datasource_id=datasource_id,
            datasource_type=data.get('datasource_type', 'table'),
            owner_id=current_user_id
        )

        db.session.add(chart)
        db.session.commit()

        return jsonify({
            'message': 'Chart created successfully',
            'id': chart.id,
            'chart_name': chart.chart_name,
            'viz_type': chart.viz_type,
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

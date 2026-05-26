from flask import Blueprint, jsonify

mcp_bp = Blueprint('mcp', __name__)


@mcp_bp.route('/mcp/tools', methods=['GET'])
def list_tools():
    return jsonify({
        'tools': [
            {
                'name': 'list_datasets',
                'description': 'List all available datasets/tables in the database',
                'input_schema': {'type': 'object', 'properties': {}},
            },
            {
                'name': 'get_dataset_schema',
                'description': 'Get column names and types for a dataset',
                'input_schema': {
                    'type': 'object',
                    'properties': {
                        'table_name': {'type': 'string', 'description': 'Name of the table/dataset'},
                    },
                    'required': ['table_name'],
                },
            },
            {
                'name': 'query_data',
                'description': 'Run a natural language query on a dataset, returns SQL + data',
                'input_schema': {
                    'type': 'object',
                    'properties': {
                        'question': {'type': 'string', 'description': 'Natural language question'},
                        'table_name': {'type': 'string', 'description': 'Name of the table/dataset'},
                    },
                    'required': ['question', 'table_name'],
                },
            },
            {
                'name': 'detect_anomalies',
                'description': 'Detect anomalies in time series data',
                'input_schema': {
                    'type': 'object',
                    'properties': {
                        'table': {'type': 'string', 'description': 'Table name'},
                        'date_column': {'type': 'string', 'description': 'Date column'},
                        'value_column': {'type': 'string', 'description': 'Value column'},
                    },
                    'required': ['table', 'date_column', 'value_column'],
                },
            },
            {
                'name': 'recommend_chart',
                'description': 'Recommend best chart type for a dataset',
                'input_schema': {
                    'type': 'object',
                    'properties': {
                        'table': {'type': 'string', 'description': 'Table name'},
                    },
                    'required': ['table'],
                },
            },
        ]
    })

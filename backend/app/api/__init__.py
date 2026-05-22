from flask import Blueprint

api_bp = Blueprint('api', __name__)


@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return {'status': 'ok', 'service': 'INGAMAR'}, 200


@api_bp.route('/version', methods=['GET'])
def version():
    """Get API version."""
    return {
        'version': '1.0.0',
        'name': 'INGAMAR',
        'full_name': 'INGAMAR by AMARZOU'
    }, 200

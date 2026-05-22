from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.auth import get_current_user_id
from app.models import Dashboard, Chart
from app import db

dashboards_bp = Blueprint('dashboards', __name__)


@dashboards_bp.route('', methods=['GET'])
@jwt_required()
def list_dashboards():
    """List all dashboards."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    owner_id = request.args.get('owner_id', type=int)
    
    query = Dashboard.query
    
    if owner_id:
        query = query.filter_by(owner_id=owner_id)
    
    pagination = query.order_by(Dashboard.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'dashboards': [d.to_dict() for d in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages
    }), 200


@dashboards_bp.route('/<int:dashboard_id>', methods=['GET'])
@jwt_required()
def get_dashboard(dashboard_id):
    """Get a specific dashboard with full details."""
    dashboard = Dashboard.query.get(dashboard_id)
    
    if not dashboard:
        return jsonify({'error': 'Dashboard not found'}), 404
    
    result = dashboard.to_dict()
    result['position_json'] = dashboard.position_json
    result['css'] = dashboard.css
    result['json_metadata'] = dashboard.json_metadata

    positions = dashboard.positions.all()
    chart_ids = []
    for pos in positions:
        if pos.chart_id:
            chart_ids.append(pos.chart_id)
    result['chart_ids'] = chart_ids

    charts_data = []
    for pos in positions:
        if pos.chart_id:
            chart = Chart.query.get(pos.chart_id)
            if chart:
                d = chart.to_dict()
                d['position'] = pos.position_json
                charts_data.append(d)
    result['charts'] = charts_data
    
    return jsonify(result), 200


@dashboards_bp.route('', methods=['POST'])
@jwt_required()
def create_dashboard():
    """Create a new dashboard."""
    current_user_id = get_current_user_id()
    data = request.get_json()
    
    if not data.get('dashboard_title'):
        return jsonify({'error': 'dashboard_title is required'}), 400
    
    dashboard = Dashboard(
        dashboard_title=data['dashboard_title'],
        position_json=data.get('position_json', '{}'),
        description=data.get('description', ''),
        css=data.get('css', ''),
        json_metadata=data.get('json_metadata', {}),
        slug=data.get('slug'),
        owner_id=current_user_id
    )
    
    db.session.add(dashboard)
    db.session.commit()
    
    return jsonify(dashboard.to_dict()), 201


@dashboards_bp.route('/<int:dashboard_id>', methods=['PUT'])
@jwt_required()
def update_dashboard(dashboard_id):
    """Update a dashboard."""
    current_user_id = get_current_user_id()
    dashboard = Dashboard.query.get(dashboard_id)
    
    if not dashboard:
        return jsonify({'error': 'Dashboard not found'}), 404
    
    if dashboard.owner_id != current_user_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    data = request.get_json()
    
    for field in ['dashboard_title', 'position_json', 'description', 'css', 'json_metadata', 'slug']:
        if field in data:
            setattr(dashboard, field, data[field])
    
    db.session.commit()
    
    return jsonify(dashboard.to_dict()), 200


@dashboards_bp.route('/<int:dashboard_id>', methods=['DELETE'])
@jwt_required()
def delete_dashboard(dashboard_id):
    """Delete a dashboard."""
    current_user_id = get_current_user_id()
    dashboard = Dashboard.query.get(dashboard_id)
    
    if not dashboard:
        return jsonify({'error': 'Dashboard not found'}), 404
    
    if dashboard.owner_id != current_user_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    db.session.delete(dashboard)
    db.session.commit()
    
    return jsonify({'message': 'Dashboard deleted'}), 200


@dashboards_bp.route('/<int:dashboard_id>/charts', methods=['POST'])
@jwt_required()
def add_chart_to_dashboard(dashboard_id):
    """Add a chart to a dashboard."""
    current_user_id = get_current_user_id()
    dashboard = Dashboard.query.get(dashboard_id)
    
    if not dashboard:
        return jsonify({'error': 'Dashboard not found'}), 404
    
    if dashboard.owner_id != current_user_id:
        return jsonify({'error': 'Not authorized'}), 403
    
    data = request.get_json()
    chart_id = data.get('chart_id')
    position = data.get('position', {})
    
    chart = Chart.query.get(chart_id)
    if not chart:
        return jsonify({'error': 'Chart not found'}), 404
    
    from app.models import DashboardPosition
    dashboard_position = DashboardPosition(
        dashboard_id=dashboard_id,
        chart_id=chart_id,
        type='CHART',
        position_json=position
    )
    
    db.session.add(dashboard_position)
    db.session.commit()
    
    return jsonify({'message': 'Chart added to dashboard'}), 201

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.models import User, Role, UserConfig
from app import db
from datetime import datetime

auth_bp = Blueprint('auth', __name__)


def get_current_user_id():
    """Get current user ID as integer from JWT token."""
    return int(get_jwt_identity())


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 409
    
    user = User(
        username=data['username'],
        email=data['email'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', '')
    )
    user.set_password(data['password'])
    
    # Assign default role (Viewer)
    default_role = Role.query.filter_by(name='Viewer').first()
    if default_role:
        user.roles.append(default_role)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'message': 'User registered successfully',
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login and get JWT tokens."""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing credentials'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token."""
    current_user_id = get_current_user_id()
    access_token = create_access_token(identity=str(current_user_id))
    
    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/config', methods=['GET', 'PUT'])
@jwt_required()
def user_config():
    """Get or update user configuration (e.g. Kaggle API keys)."""
    current_user_id = get_current_user_id()
    
    if request.method == 'GET':
        keys = request.args.getlist('key')
        configs = UserConfig.query.filter_by(user_id=current_user_id)
        if keys:
            configs = configs.filter(UserConfig.config_key.in_(keys))
        result = {c.config_key: c.config_value for c in configs.all()}
        return jsonify(result), 200
    
    # PUT - update config
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Expected JSON object with config key-value pairs'}), 400
    
    for key, value in data.items():
        config = UserConfig.query.filter_by(user_id=current_user_id, config_key=key).first()
        if config:
            config.config_value = str(value) if value is not None else None
        else:
            config = UserConfig(user_id=current_user_id, config_key=key, config_value=str(value) if value is not None else None)
            db.session.add(config)
    
    db.session.commit()
    return jsonify({'message': 'Config updated'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information."""
    current_user_id = get_current_user_id()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """List all users (Admin only)."""
    current_user_id = get_current_user_id()
    current_user = User.query.get(current_user_id)
    
    if not current_user.is_superuser:
        return jsonify({'error': 'Admin access required'}), 403
    
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


@auth_bp.route('/users/<int:user_id>/roles', methods=['PUT'])
@jwt_required()
def assign_roles(user_id):
    """Assign roles to a user (Admin only)."""
    current_user_id = get_current_user_id()
    current_user = User.query.get(current_user_id)
    
    if not current_user.is_superuser:
        return jsonify({'error': 'Admin access required'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    role_names = data.get('roles', [])
    
    # Clear existing roles
    user.roles = []
    
    # Add new roles
    for role_name in role_names:
        role = Role.query.filter_by(name=role_name).first()
        if role:
            user.roles.append(role)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Roles updated',
        'user': user.to_dict()
    }), 200

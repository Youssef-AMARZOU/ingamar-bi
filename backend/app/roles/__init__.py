from app import db
from app.models import Role

ROLES_DEFINITION = [
    {
        'name': 'Admin',
        'description': 'Full system access and user management',
        'permissions': [
            'all_database_access',
            'all_datasource_access',
            'all_chart_access',
            'all_dashboard_access',
            'all_query_access',
            'can_manage_users',
            'can_manage_roles',
            'can_manage_databases',
            'can_manage_contributions',
            'can_access_sql_lab',
            'can_export_data',
            'can_import_data',
            'can_configure_system',
        ]
    },
    {
        'name': 'Data Engineer',
        'description': 'Database connections, datasets, and SQL Lab access',
        'permissions': [
            'can_access_database',
            'can_manage_datasets',
            'can_access_sql_lab',
            'can_run_queries',
            'can_create_ctas',
            'can_create_cvas',
            'can_view_chart',
            'can_view_dashboard',
            'can_export_data',
            'can_manage_contributions',
        ]
    },
    {
        'name': 'Analyst',
        'description': 'Create charts, dashboards, and explore data',
        'permissions': [
            'can_access_database',
            'can_view_datasets',
            'can_create_chart',
            'can_edit_chart',
            'can_delete_chart',
            'can_create_dashboard',
            'can_edit_dashboard',
            'can_delete_dashboard',
            'can_view_chart',
            'can_view_dashboard',
            'can_explore_data',
            'can_export_data',
            'can_submit_contribution',
        ]
    },
    {
        'name': 'Contributor',
        'description': 'Create and modify own assets, submit for review',
        'permissions': [
            'can_access_database',
            'can_view_datasets',
            'can_create_chart',
            'can_edit_own_chart',
            'can_create_dashboard',
            'can_edit_own_dashboard',
            'can_view_chart',
            'can_view_dashboard',
            'can_explore_data',
            'can_submit_contribution',
            'can_view_own_contributions',
        ]
    },
    {
        'name': 'Reviewer',
        'description': 'Approve or reject contributions from contributors',
        'permissions': [
            'can_access_database',
            'can_view_datasets',
            'can_view_chart',
            'can_view_dashboard',
            'can_review_contributions',
            'can_approve_contributions',
            'can_reject_contributions',
            'can_merge_contributions',
            'can_comment_contributions',
        ]
    },
    {
        'name': 'Viewer',
        'description': 'Read-only access to dashboards and charts',
        'permissions': [
            'can_view_chart',
            'can_view_dashboard',
            'can_view_datasets',
        ]
    },
]


def init_roles():
    """Initialize default roles in the database."""
    try:
        for role_def in ROLES_DEFINITION:
            existing = Role.query.filter_by(name=role_def['name']).first()
            if not existing:
                role = Role(
                    name=role_def['name'],
                    description=role_def['description'],
                    permissions=role_def['permissions']
                )
                db.session.add(role)
        
        db.session.commit()
    except Exception:
        db.session.rollback()
        pass


def get_role_by_name(name):
    """Get a role by its name."""
    return Role.query.filter_by(name=name).first()


def has_permission(user, permission):
    """Check if a user has a specific permission."""
    if user.is_superuser:
        return True
    
    for role in user.roles:
        if permission in role.permissions:
            return True
    
    return False


def require_permission(permission):
    """Decorator to require a specific permission."""
    from functools import wraps
    from flask import jsonify
    from flask_jwt_extended import verify_jwt_in_request
    from flask_jwt_extended import get_jwt_identity
    from app.models import User
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            current_user_id = int(get_jwt_identity())
            user = User.query.get(current_user_id)
            
            if not user or not has_permission(user, permission):
                return jsonify({'error': 'Permission denied'}), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    
    return decorator

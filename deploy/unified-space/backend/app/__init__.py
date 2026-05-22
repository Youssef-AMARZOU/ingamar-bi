import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app(config_name=None):
    app = Flask(__name__)
    
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Register blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    from app.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    
    from app.charts import charts_bp
    app.register_blueprint(charts_bp, url_prefix='/api/v1/charts')
    
    from app.dashboards import dashboards_bp
    app.register_blueprint(dashboards_bp, url_prefix='/api/v1/dashboards')
    
    from app.sql_lab import sql_lab_bp
    app.register_blueprint(sql_lab_bp, url_prefix='/api/v1/sql_lab')
    
    from app.datasets import datasets_bp
    app.register_blueprint(datasets_bp, url_prefix='/api/v1/datasets')
    
    from app.ai import ai_bp
    app.register_blueprint(ai_bp, url_prefix='/api/v1/ai')
    
    from app.metabase import metabase_bp
    app.register_blueprint(metabase_bp, url_prefix='/api/v1/metabase')
    
    # Initialize roles and default user
    with app.app_context():
        from app.roles import init_roles, seed_default_user
        init_roles()
        seed_default_user()
    
    return app
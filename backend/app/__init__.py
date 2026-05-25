import os
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')

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
    
    from app.ml import ml_bp
    app.register_blueprint(ml_bp, url_prefix='/api/v1/ml')
    
    # Serve frontend SPA (catch-all for non-API routes)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def frontend(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        full_path = os.path.join(STATIC_DIR, path) if path else STATIC_DIR
        if path and os.path.isfile(full_path):
            return send_from_directory(STATIC_DIR, path)
        return send_from_directory(STATIC_DIR, 'index.html')
    
    # Initialize roles and default user
    with app.app_context():
        from app.roles import init_roles, seed_default_user
        init_roles()
        seed_default_user()
    
    return app

import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('INGAMAR_SECRET_KEY', 'dev-secret-key-change-in-production-make-it-longer-than-32-chars-for-security')
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('INGAMAR_DB_URI', 'sqlite:///ingamar.db')
    REDIS_URI = os.environ.get('INGAMAR_REDIS_URI', 'redis://localhost:6379/0')
    CELERY_BROKER_URL = os.environ.get('INGAMAR_CELERY_BROKER_URI', 'redis://localhost:6379/0')
    CELERY_RESULT_BACKEND = os.environ.get('INGAMAR_CELERY_RESULT_BACKEND_URI', 'redis://localhost:6379/0')
    
    # JWT
    JWT_SECRET_KEY = os.environ.get('INGAMAR_JWT_SECRET_KEY', 'jwt-secret-key-change-in-production-make-it-longer-than-32-chars')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # CORS
    CORS_ORIGINS = os.environ.get('INGAMAR_CORS_ORIGINS', '*').split(',')
    
    # Upload
    UPLOAD_FOLDER = os.environ.get('INGAMAR_UPLOAD_FOLDER', '/tmp/ingamar/uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    
    # Cache
    CACHE_DEFAULT_TIMEOUT = 86400  # 24 hours
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Feature Flags
    ENABLE_DASHBOARD_CROSS_FILTERS = True
    ENABLE_TEMPLATE_PROCESSING = True
    ENABLE_JAVASCRIPT_CHARTS = False
    ENABLE_DASHBOARD_NATIVE_FILTERS = True
    
    # Branding
    APP_NAME = 'INGAMAR'
    APP_ICON = '/static/assets/logo.png'
    APP_FAVICON = '/static/assets/favicon.ico'
    APP_NAME_FULL = 'INGAMAR by AMARZOU'
    
    # Security
    CSRF_ENABLED = True
    WTF_CSRF_ENABLED = True
    
    # SQL Lab
    SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60  # 1 hour
    SQLLAB_DEFAULT_DBID = None
    
    # Results
    ROW_LIMIT = 5000
    VIZ_ROW_LIMIT = 10000
    
    # Email
    SMTP_HOST = os.environ.get('INGAMAR_SMTP_HOST', 'localhost')
    SMTP_PORT = int(os.environ.get('INGAMAR_SMTP_PORT', 25))
    SMTP_USER = os.environ.get('INGAMAR_SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('INGAMAR_SMTP_PASSWORD', '')
    SMTP_MAIL_FROM = os.environ.get('INGAMAR_SMTP_MAIL_FROM', 'ingamar@localhost')
    
    # Thumbnails
    ENABLE_THUMBNAILS = True
    THUMBNAIL_CACHE_CONFIG = {
        'CACHE_TYPE': 'SimpleCache',
        'CACHE_DEFAULT_TIMEOUT': 300,
    }

class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False
    
class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

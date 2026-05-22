from datetime import datetime
from app import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    avatar = db.Column(db.String(256))
    is_active = db.Column(db.Boolean, default=True)
    is_superuser = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    roles = db.relationship('Role', secondary='user_roles', backref='users', lazy='dynamic')
    charts = db.relationship('Chart', backref='owner', lazy='dynamic')
    dashboards = db.relationship('Dashboard', backref='owner', lazy='dynamic')
    submitted_contributions = db.relationship('Contribution', foreign_keys='Contribution.submitter_id', backref='submitter', lazy='dynamic')
    reviewed_contributions = db.relationship('Contribution', foreign_keys='Contribution.reviewer_id', backref='reviewer', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_role(self, role_name):
        return self.roles.filter_by(name=role_name).first() is not None
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'avatar': self.avatar,
            'is_active': self.is_active,
            'roles': [r.name for r in self.roles],
            'created_at': self.created_at.isoformat()
        }


class Role(db.Model):
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    description = db.Column(db.String(256))
    permissions = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'permissions': self.permissions
        }


class UserRole(db.Model):
    __tablename__ = 'user_roles'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), primary_key=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)


class Database(db.Model):
    __tablename__ = 'databases'
    
    id = db.Column(db.Integer, primary_key=True)
    database_name = db.Column(db.String(256), unique=True, nullable=False)
    sqlalchemy_uri = db.Column(db.String(1024), nullable=False)
    encrypted_password = db.Column(db.LargeBinary)
    cache_timeout = db.Column(db.Integer, default=0)
    expose_in_sqllab = db.Column(db.Boolean, default=True)
    allow_run_async = db.Column(db.Boolean, default=False)
    allow_ctas = db.Column(db.Boolean, default=False)
    allow_cvas = db.Column(db.Boolean, default=False)
    allow_dml = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    tables = db.relationship('Table', backref='database', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'database_name': self.database_name,
            'expose_in_sqllab': self.expose_in_sqllab,
            'allow_run_async': self.allow_run_async,
            'created_at': self.created_at.isoformat()
        }


class Table(db.Model):
    __tablename__ = 'tables'
    
    id = db.Column(db.Integer, primary_key=True)
    database_id = db.Column(db.Integer, db.ForeignKey('databases.id'), nullable=False)
    table_name = db.Column(db.String(256), nullable=False)
    main_dttm_col = db.Column(db.String(256))
    description = db.Column(db.Text)
    default_endpoint = db.Column(db.Text)
    offset = db.Column(db.Integer, default=0)
    cache_timeout = db.Column(db.Integer)
    schema = db.Column(db.String(256))
    sql = db.Column(db.Text)
    params = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    columns = db.relationship('Column', backref='table', lazy='dynamic')
    metrics = db.relationship('Metric', backref='table', lazy='dynamic')
    
    __table_args__ = (db.UniqueConstraint('database_id', 'table_name', 'schema'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'table_name': self.table_name,
            'database_id': self.database_id,
            'description': self.description,
            'schema': self.schema,
            'created_at': self.created_at.isoformat()
        }


class Column(db.Model):
    __tablename__ = 'columns'
    
    id = db.Column(db.Integer, primary_key=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=False)
    column_name = db.Column(db.String(256), nullable=False)
    type = db.Column(db.String(32))
    groupby = db.Column(db.Boolean, default=True)
    filterable = db.Column(db.Boolean, default=True)
    description = db.Column(db.Text)
    expression = db.Column(db.Text)
    is_dttm = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('table_id', 'column_name'),)


class Metric(db.Model):
    __tablename__ = 'metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=False)
    metric_name = db.Column(db.String(256), nullable=False)
    metric_type = db.Column(db.String(32), default='aggregator')
    expression = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    d3format = db.Column(db.String(128))
    warning_text = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('table_id', 'metric_name'),)


class Chart(db.Model):
    __tablename__ = 'charts'
    
    id = db.Column(db.Integer, primary_key=True)
    chart_name = db.Column(db.String(256), nullable=False)
    viz_type = db.Column(db.String(256), nullable=False)
    params = db.Column(db.JSON)
    query_context = db.Column(db.JSON)
    description = db.Column(db.Text)
    cache_timeout = db.Column(db.Integer)
    certified_by = db.Column(db.String(256))
    certification_details = db.Column(db.Text)
    owners = db.Column(db.JSON)
    is_managed_externally = db.Column(db.Boolean, default=False)
    external_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    datasource_id = db.Column(db.String(256))
    datasource_type = db.Column(db.String(32))
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    dashboard_positions = db.relationship('DashboardPosition', backref='chart', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'chart_name': self.chart_name,
            'viz_type': self.viz_type,
            'params': self.params or {},
            'description': self.description,
            'datasource_id': self.datasource_id,
            'datasource_type': self.datasource_type,
            'owner_id': self.owner_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Dashboard(db.Model):
    __tablename__ = 'dashboards'
    
    id = db.Column(db.Integer, primary_key=True)
    dashboard_title = db.Column(db.String(500), nullable=False)
    position_json = db.Column(db.Text)
    description = db.Column(db.Text)
    css = db.Column(db.Text)
    json_metadata = db.Column(db.JSON)
    slug = db.Column(db.String(256), unique=True)
    certified_by = db.Column(db.String(256))
    certification_details = db.Column(db.Text)
    is_managed_externally = db.Column(db.Boolean, default=False)
    external_url = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    positions = db.relationship('DashboardPosition', backref='dashboard', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'dashboard_title': self.dashboard_title,
            'slug': self.slug,
            'description': self.description,
            'owner_id': self.owner_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class DashboardPosition(db.Model):
    __tablename__ = 'dashboard_positions'
    
    id = db.Column(db.Integer, primary_key=True)
    dashboard_id = db.Column(db.Integer, db.ForeignKey('dashboards.id'), nullable=False)
    chart_id = db.Column(db.Integer, db.ForeignKey('charts.id'))
    type = db.Column(db.String(50))
    position_json = db.Column(db.JSON)
    
    __table_args__ = (db.UniqueConstraint('dashboard_id', 'id'),)


class Contribution(db.Model):
    __tablename__ = 'contributions'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text)
    contribution_type = db.Column(db.String(64))
    content = db.Column(db.JSON)
    status = db.Column(db.String(32), default='pending')
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    submitter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    review_comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'contribution_type': self.contribution_type,
            'status': self.status,
            'submitter_id': self.submitter_id,
            'reviewer_id': self.reviewer_id,
            'created_at': self.created_at.isoformat(),
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None
        }


class Query(db.Model):
    __tablename__ = 'queries'
    
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(11), unique=True)
    database_id = db.Column(db.Integer, db.ForeignKey('databases.id'))
    schema = db.Column(db.String(256))
    sql = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(16))
    progress = db.Column(db.Integer, default=0)
    rows = db.Column(db.Integer)
    error_message = db.Column(db.Text)
    results_key = db.Column(db.String(64))
    tracking_url = db.Column(db.Text)
    start_time = db.Column(db.Float)
    end_time = db.Column(db.Float)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    tmp_table_name = db.Column(db.String(256))
    tab_name = db.Column(db.String(256))
    select_as_cta = db.Column(db.Boolean, default=False)
    cta = db.Column(db.Boolean, default=False)
    limit = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    changed_on = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'sql': self.sql,
            'status': self.status,
            'rows': self.rows,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'created_at': self.created_at.isoformat()
        }


class UserConfig(db.Model):
    __tablename__ = 'user_config'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    config_key = db.Column(db.String(128), nullable=False)
    config_value = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'config_key'),)

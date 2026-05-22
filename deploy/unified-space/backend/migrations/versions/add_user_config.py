"""Add user_config table

Revision ID: add_user_config
Revises: 02babc95f6f6
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_user_config'
down_revision = '02babc95f6f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('config_key', sa.String(length=128), nullable=False),
        sa.Column('config_value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'config_key')
    )


def downgrade():
    op.drop_table('user_config')

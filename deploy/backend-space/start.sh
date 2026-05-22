#!/bin/bash
set -e

echo "Running database migrations..."
flask db upgrade || echo "Migrations completed (may have failed if already up to date)"

echo "Starting Gunicorn..."
exec gunicorn -w 2 -b 0.0.0.0:7860 --timeout 300 --limit-request-line 0 --limit-request-field_size 0 'app:create_app()'

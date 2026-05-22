#!/bin/bash
set -e

echo "Running database migrations..."
flask db upgrade || echo "Migrations completed (may have failed if already up to date)"

echo "Starting Gunicorn on port 8088..."
gunicorn -w 2 -b 0.0.0.0:8088 --timeout 300 --limit-request-line 0 --limit-request-field_size 0 'app:create_app()' &

echo "Starting Nginx on port 7860..."
nginx -g 'daemon off;'
#!/bin/bash
# INGAMAR BI - Deployment Script
# This script builds and deploys the application

set -e

echo "🚀 Deploying INGAMAR BI..."

# Parse arguments
DEPLOY_TARGET=${1:-"local"}  # local, docker, hf

case $DEPLOY_TARGET in
    local)
        echo "📦 Building for local deployment..."
        
        # Build frontend
        echo "Building frontend..."
        cd frontend
        npm ci
        npm run build
        cd ..
        
        # Copy frontend build to backend
        echo "Copying frontend build to backend..."
        rm -rf backend/static/*
        cp -r frontend/dist/* backend/static/
        
        # Install backend dependencies
        echo "Installing backend dependencies..."
        cd backend
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        source venv/bin/activate
        pip install -r requirements.txt
        
        # Initialize database
        echo "Initializing database..."
        python -c "from app import create_app, db; app = create_app('production'); app.app_context().push(); db.create_all()"
        
        cd ..
        
        echo "✅ Build complete!"
        echo ""
        echo "To start the application:"
        echo "  cd backend"
        echo "  source venv/bin/activate"
        echo "  gunicorn -w 4 -b 0.0.0.0:5000 'app:create_app()'"
        ;;
        
    docker)
        echo "🐳 Building Docker images..."
        
        # Build backend
        echo "Building backend image..."
        docker build -t ingamar-bi-backend ./backend
        
        # Build frontend
        echo "Building frontend image..."
        docker build -t ingamar-bi-frontend ./frontend
        
        echo "✅ Docker images built!"
        echo ""
        echo "To start with Docker Compose:"
        echo "  docker-compose up -d"
        ;;
        
    hf)
        echo "☁️  Deploying to Hugging Face Space..."
        
        # Check for HF_TOKEN
        if [ -z "$HF_TOKEN" ]; then
            echo "❌ HF_TOKEN environment variable is required"
            echo "Export it with: export HF_TOKEN=your-token-here"
            exit 1
        fi
        
        # Build frontend
        echo "Building frontend..."
        cd frontend
        npm ci
        npm run build
        cd ..
        
        # Copy frontend build to backend
        echo "Copying frontend build to backend..."
        rm -rf backend/static/*
        cp -r frontend/dist/* backend/static/
        
        # Push to HF Space
        echo "Pushing to Hugging Face Space..."
        git remote add hf https://ysfmo98:${HF_TOKEN}@huggingface.co/spaces/ysfmo98/ingamar-bi-backend 2>/dev/null || true
        git push hf main:main --force
        git push hf master:master --force
        
        echo "✅ Deployment complete!"
        echo "Visit: https://ysfmo98-ingamar-bi-backend.hf.space"
        ;;
        
    *)
        echo "❌ Unknown deployment target: $DEPLOY_TARGET"
        echo "Usage: $0 [local|docker|hf]"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment successful!"

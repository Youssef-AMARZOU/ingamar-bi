#!/bin/bash
# INGAMAR BI - Development Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up INGAMAR BI development environment..."

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Backend setup
echo ""
echo "🐍 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Installing development tools..."
pip install pytest pytest-cov flake8 black isort

cd ..

# Frontend setup
echo ""
echo "⚛️  Setting up frontend..."
cd frontend

echo "Installing Node.js dependencies..."
npm install

echo "Installing development tools..."
npm install --save-dev @types/node @types/react @types/react-dom

cd ..

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p backend/instance
mkdir -p backend/uploads
mkdir -p backend/models

# Initialize database
echo ""
echo "🗄️  Initializing database..."
cd backend
source venv/bin/activate
python -c "from app import create_app, db; app = create_app('development'); app.app_context().push(); db.create_all(); print('Database initialized')"
cd ..

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file..."
    cat > .env << EOF
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
CORS_ORIGINS=http://localhost:3000
GROQ_API_KEY=your-groq-api-key-here
EOF
    echo "⚠️  Please update .env with your actual API keys"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the backend:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python run.py"
echo ""
echo "To start the frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Backend will be available at: http://localhost:5000"
echo "Frontend will be available at: http://localhost:3000"
echo ""
echo "Default login: admin / admin123"

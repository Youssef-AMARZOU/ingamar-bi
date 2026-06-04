# INGAMAR BI Documentation

Welcome to the INGAMAR BI documentation. This directory contains comprehensive guides for users, developers, and administrators.

## 📚 Documentation Index

### For Users

- [Getting Started](./user-guide/getting-started.md) - Quick start guide
- [User Guide](./user-guide/README.md) - Complete user documentation
- [Dashboard Guide](./user-guide/dashboards.md) - Creating and managing dashboards
- [Chart Guide](./user-guide/charts.md) - Building visualizations
- [SQL Lab](./user-guide/sql-lab.md) - Writing and executing SQL queries
- [AI Assistant](./user-guide/ai-assistant.md) - Using AI features

### For Developers

- [Architecture](./developer/architecture.md) - System architecture overview
- [API Reference](./developer/api-reference.md) - Complete API documentation
- [Backend Development](./developer/backend.md) - Backend development guide
- [Frontend Development](./developer/frontend.md) - Frontend development guide
- [Database Schema](./developer/database.md) - Database structure
- [Testing Guide](./developer/testing.md) - Writing and running tests

### For Administrators

- [Installation](./admin/installation.md) - Installation instructions
- [Configuration](./admin/configuration.md) - Configuration options
- [Deployment](./admin/deployment.md) - Deployment guides
- [Security](./admin/security.md) - Security best practices
- [Performance](./admin/performance.md) - Performance tuning
- [Backup & Recovery](./admin/backup.md) - Backup and recovery procedures

### Examples & Tutorials

- [Examples](../examples/README.md) - Example configurations and use cases
- [Tutorials](./tutorials/README.md) - Step-by-step tutorials

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/Youssef-AMARZOU/ingamar-bi.git
cd ingamar-bi

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python run.py

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Docker Deployment

```bash
docker-compose up -d
```

### Hugging Face Space

Visit: https://ysfmo98-ingamar-bi-backend.hf.space

Login: `admin` / `admin123`

## 📖 Key Features

### Data Visualization
- **Chart Builder**: Create charts with drag-and-drop interface
- **Dashboard Builder**: Build interactive dashboards
- **SQL Lab**: Write and execute SQL queries
- **AI Assistant**: Natural language to SQL conversion

### Machine Learning
- **ML Studio**: Train and evaluate ML models
- **Deep Learning**: Neural network training
- **Anomaly Detection**: Time series anomaly detection
- **Model Evaluation**: Cross-validation and metrics

### Data Management
- **Dataset Upload**: Upload CSV, Excel, JSON files
- **Kaggle Import**: Import datasets from Kaggle
- **Data Profiling**: Automatic data analysis
- **Data Transformation**: Clean and transform data

### Collaboration
- **Role-Based Access**: Admin, Analyst, Viewer roles
- **Saved Queries**: Share and reuse SQL queries
- **Dashboard Sharing**: Share dashboards with team
- **Comments & Annotations**: Collaborate on insights

## 🔧 Technology Stack

### Backend
- **Framework**: Flask 3.0
- **Database**: SQLAlchemy (SQLite/PostgreSQL)
- **Authentication**: JWT with Flask-JWT-Extended
- **ML**: scikit-learn, pandas, numpy
- **AI**: Groq API integration

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Ant Design 5
- **Charts**: Apache ECharts
- **State Management**: Zustand
- **Styling**: CSS custom properties (Grafana-inspired)

### Infrastructure
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Deployment**: Hugging Face Spaces
- **Version Control**: Git

## 📊 System Requirements

### Minimum
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 10 GB
- **OS**: Linux, macOS, Windows

### Recommended
- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 50+ GB SSD
- **OS**: Linux (Ubuntu 20.04+)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📝 License

This project is licensed under the GPL-2.0 License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Documentation**: Browse this documentation
- **Issues**: Report bugs on [GitHub](https://github.com/Youssef-AMARZOU/ingamar-bi/issues)
- **Discussions**: Ask questions on [GitHub Discussions](https://github.com/Youssef-AMARZOU/ingamar-bi/discussions)
- **Security**: Report vulnerabilities per [SECURITY.md](../SECURITY.md)

## 📚 Additional Resources

- [GitHub Repository](https://github.com/Youssef-AMARZOU/ingamar-bi)
- [Live Demo](https://ysfmo98-ingamar-bi-backend.hf.space)
- [Changelog](../CHANGELOG.md)
- [Roadmap](./roadmap.md)

---

**Last Updated**: June 2026

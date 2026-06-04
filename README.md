---
title: INGAMAR BI
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
app_port: 7860
---

# INGAMAR BI

[![CI](https://github.com/Youssef-AMARZOU/ingamar-bi/actions/workflows/ci.yml/badge.svg)](https://github.com/Youssef-AMARZOU/ingamar-bi/actions/workflows/ci.yml)
[![Deploy](https://github.com/Youssef-AMARZOU/ingamar-bi/actions/workflows/deploy.yml/badge.svg)](https://github.com/Youssef-AMARZOU/ingamar-bi/actions/workflows/deploy.yml)
[![License: GPL-2.0](https://img.shields.io/badge/License-GPL--2.0-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)

**A modern, enterprise-ready business intelligence platform with AI-powered analytics, machine learning, and Grafana-inspired design.**

![INGAMAR BI](./assets/logo.png)

## 🌟 Live Demo

**Try it now:** [https://ysfmo98-ingamar-bi-backend.hf.space](https://ysfmo98-ingamar-bi-backend.hf.space)

**Login:** `admin` / `admin123`

## 📖 Introduction

INGAMAR BI is a comprehensive business intelligence platform that combines traditional data visualization with modern AI and machine learning capabilities. Built with a Grafana-inspired design system, it provides an intuitive interface for exploring data, creating dashboards, and building predictive models.

Inspired by enterprise tools like Apache Superset, Grafana, and modern MLOps platforms, INGAMAR BI brings together the best of business intelligence and data science in a single, cohesive platform.

## ✨ Key Features

### Data Visualization
- **Chart Builder**: Create 20+ chart types with drag-and-drop interface
- **Dashboard Builder**: Build interactive dashboards with real-time updates
- **SQL Lab**: Write and execute SQL queries with autocomplete
- **AI Assistant**: Natural language to SQL conversion using Groq

### Machine Learning & AI
- **ML Studio**: Train and evaluate regression, classification, and clustering models
- **Deep Learning**: Neural network training with configurable architectures
- **Anomaly Detection**: Time series anomaly detection with Prophet
- **Model Evaluation**: Cross-validation, feature importance, and performance metrics

### Data Management
- **Dataset Upload**: Support for CSV, Excel, JSON, and Parquet files
- **Kaggle Integration**: Import datasets directly from Kaggle
- **Data Profiling**: Automatic data analysis and statistics
- **Data Transformation**: Clean, filter, and transform data

### Collaboration & Security
- **Role-Based Access Control**: Admin, Analyst, Viewer roles
- **JWT Authentication**: Secure token-based authentication
- **Saved Queries**: Share and reuse SQL queries
- **Dashboard Sharing**: Collaborate with team members

### Design & UX
- **Grafana-Inspired Design**: Professional dark/light themes
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live data refresh and notifications
- **Accessibility**: WCAG 2.1 compliant interface

## 🛠️ Technology Stack

### Backend
- **Framework**: Flask 3.0
- **Database**: SQLAlchemy (SQLite/PostgreSQL/MySQL)
- **Authentication**: JWT with Flask-JWT-Extended
- **ML/AI**: scikit-learn, pandas, numpy, Groq API
- **API**: RESTful with OpenAPI documentation

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Ant Design 5
- **Charts**: Apache ECharts 5
- **State Management**: Zustand
- **Styling**: CSS custom properties (Grafana design tokens)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Deployment**: Hugging Face Spaces, AWS, GCP
- **Monitoring**: Prometheus & Grafana (optional)

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/Youssef-AMARZOU/ingamar-bi.git
cd ingamar-bi

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows
pip install -r requirements.txt
python run.py

# Frontend setup (in another terminal)
cd frontend
npm install
npm run dev
```

**Access the application:**
- Backend: http://localhost:5000
- Frontend: http://localhost:3000
- Login: `admin` / `admin123`

### Docker Deployment

```bash
# Build and start with Docker Compose
docker-compose up -d

# Access at http://localhost:5000
```

### Hugging Face Space

The application is automatically deployed to Hugging Face Spaces on every push to main:

```bash
# Visit: https://ysfmo98-ingamar-bi-backend.hf.space
```

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

- **[User Guide](./docs/user-guide/README.md)** - How to use INGAMAR BI
- **[API Reference](./docs/developer/api-reference.md)** - Complete API documentation
- **[Developer Guide](./docs/developer/README.md)** - Development setup and guidelines
- **[Deployment Guide](./docs/admin/deployment.md)** - Production deployment
- **[Examples](./examples/README.md)** - Example configurations and use cases

## 🏗️ Project Structure

```
ingamar-bi/
├── backend/                    # Python Flask backend
│   ├── app/
│   │   ├── api/               # REST API endpoints
│   │   ├── auth/              # Authentication & authorization
│   │   ├── charts/            # Chart management
│   │   ├── dashboards/        # Dashboard management
│   │   ├── datasets/          # Dataset operations
│   │   ├── dl/                # Deep Learning module
│   │   ├── ml/                # Machine Learning module
│   │   ├── models/            # Database models
│   │   ├── roles/             # Role-based access control
│   │   ├── seeds/             # Sample data seeding
│   │   └── sql_lab/           # SQL editor
│   ├── config.py              # Configuration
│   ├── requirements.txt       # Python dependencies
│   └── run.py                 # Application entry point
│
├── frontend/                   # React TypeScript frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── store/             # State management (Zustand)
│   │   ├── services/          # API services
│   │   └── index.css          # Grafana-inspired styles
│   ├── package.json           # Node dependencies
│   └── vite.config.ts         # Vite configuration
│
├── docs/                       # Documentation
│   ├── user-guide/            # User documentation
│   ├── developer/             # Developer documentation
│   └── admin/                 # Administration guide
│
├── tests/                      # Test suite
├── scripts/                    # Utility scripts
├── examples/                   # Example configurations
├── .github/workflows/          # CI/CD pipelines
│
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose setup
├── SECURITY.md                 # Security policy
├── CONTRIBUTING.md             # Contribution guidelines
├── CHANGELOG.md                # Release history
└── LICENSE                     # GPL-2.0 license
```

## 🔒 Security

We take security seriously. Please see [SECURITY.md](./SECURITY.md) for:

- Reporting vulnerabilities
- Security best practices
- Supported versions
- Security features

**Key Security Features:**
- JWT authentication with token rotation
- Role-based access control (RBAC)
- SQL injection prevention
- XSS protection
- CORS configuration
- Rate limiting
- Secure password hashing (bcrypt)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- Coding standards
- Pull request process
- Testing guidelines

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pytest` for backend, `npm test` for frontend)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📊 Screenshots

### Dashboard Builder
![Dashboard Builder](./docs/screenshots/dashboard-builder.png)

### ML Studio
![ML Studio](./docs/screenshots/ml-studio.png)

### AI Assistant
![AI Assistant](./docs/screenshots/ai-assistant.png)

### SQL Lab
![SQL Lab](./docs/screenshots/sql-lab.png)

## 🎯 Roadmap

See our [Roadmap](./docs/roadmap.md) for planned features and improvements.

**Upcoming Features:**
- Real-time data streaming
- Advanced anomaly detection algorithms
- Mobile app (iOS/Android)
- Plugin system for custom visualizations
- Multi-tenant support
- Advanced RBAC with row-level security

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and notable changes.

## 📄 License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **Grafana** - Design inspiration and color palette
- **Apache Superset** - Architecture and feature inspiration
- **Ant Design** - UI component library
- **Apache ECharts** - Visualization library
- **Flask** - Web framework
- **React** - Frontend framework
- **Groq** - AI integration

## 📞 Support

- **Documentation**: [docs/](./docs)
- **Issues**: [GitHub Issues](https://github.com/Youssef-AMARZOU/ingamar-bi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Youssef-AMARZOU/ingamar-bi/discussions)
- **Security**: [SECURITY.md](./SECURITY.md)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Youssef-AMARZOU/ingamar-bi&type=Date)](https://star-history.com/#Youssef-AMARZOU/ingamar-bi&Date)

---

**Built with ❤️ by [AMARZOU](https://github.com/Youssef-AMARZOU)**

**Inspired by the best of open source: Grafana, Apache Superset, and the data science community.**

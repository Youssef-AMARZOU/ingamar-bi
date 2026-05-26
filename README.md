---
title: INGAMAR BI
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
app_port: 7860
---

# INGAMAR - Data Visualization & Exploration Platform

**By AMARZOU**

A modern, enterprise-ready business intelligence web application inspired by Apache Superset.

![INGAMAR Logo](./assets/logo.png)

## Features

- **No-code interface** for building charts quickly
- **SQL Editor** for advanced querying
- **Semantic layer** for defining custom dimensions and metrics
- **Multiple database support** (PostgreSQL, MySQL, ClickHouse, etc.)
- **Beautiful visualizations** with Apache ECharts
- **Caching layer** to optimize performance
- **Role-based access control** adapted for contributors
- **REST API** for programmatic customization
- **Cloud-native architecture**

## Tech Stack

- **Backend**: Python 3.11+, Flask, SQLAlchemy
- **Frontend**: React 18, TypeScript, Ant Design v5, Apache ECharts
- **Database**: PostgreSQL (metadata)
- **Cache**: Redis
- **Task Queue**: Celery
- **Containerization**: Docker, Docker Compose

## Roles System

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management, configuration |
| **Data Engineer** | Database connections, datasets, SQL Lab, data modeling |
| **Analyst** | Create charts, dashboards, explore data |
| **Contributor** | Create/modify own assets, submit for review |
| **Reviewer** | Approve/reject contributions, manage content quality |
| **Viewer** | Read-only access to dashboards and charts |

## Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/yourusername/ingamar.git
cd ingamar

# Start all services
docker-compose up -d

# Initialize the database
docker-compose exec ingamar superset db upgrade
docker-compose exec ingamar superset init

# Access the application
open http://localhost:8088
```

### Development Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
flask run

# Frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```
ingamar/
├── backend/                 # Python Flask backend
│   ├── app/
│   │   ├── api/            # REST API endpoints
│   │   ├── models/         # Database models
│   │   ├── roles/          # Role-based access control
│   │   ├── charts/         # Chart visualization logic
│   │   ├── dashboards/     # Dashboard management
│   │   ├── sql_lab/        # SQL editor functionality
│   │   └── auth/           # Authentication
│   ├── config.py
│   └── requirements.txt
── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # State management
│   │   └── assets/         # Static assets
│   └── package.json
├── docker/                 # Docker configurations
├── docs/                   # Documentation
└── assets/                 # Logos and branding
```

## Supported Databases

- PostgreSQL
- MySQL / MariaDB
- ClickHouse
- Apache Druid
- Snowflake
- Google BigQuery
- Microsoft SQL Server
- Oracle
- And more...

## License

Apache License 2.0

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

Built with ❤️ by AMARZOU

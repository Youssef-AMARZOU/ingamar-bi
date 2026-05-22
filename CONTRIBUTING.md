# Contributing to INGAMAR

Thank you for your interest in contributing to INGAMAR!

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
flask db upgrade
flask run
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Code Style

### Python
- Follow PEP 8
- Use type hints
- Write docstrings for public functions

### TypeScript/React
- Use functional components with hooks
- Follow the existing component structure
- Use Ant Design components

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Write tests if applicable
5. Commit your changes (`git commit -m 'Add feature'`)
6. Push to the branch (`git push origin feature/your-feature`)
7. Open a Pull Request

## Role-Based Contributions

| Role | Can Contribute |
|------|---------------|
| **Contributor** | Charts, Dashboards, Datasets |
| **Analyst** | All Contributor items + SQL queries |
| **Data Engineer** | Database connections, Data models |
| **Reviewer** | Review and approve contributions |
| **Admin** | All of the above + system configuration |

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

---
title: INGAMAR BI Backend
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# INGAMAR BI Backend

API backend for INGAMAR BI - Data Visualization Platform.

## Environment Variables

- `INGAMAR_SECRET_KEY`: Secret key for Flask
- `INGAMAR_DB_URI`: PostgreSQL connection URI
- `INGAMAR_REDIS_URI`: Redis connection URI (optional, falls back to simple cache)
- `INGAMAR_CELERY_BROKER_URI`: Celery broker URI (optional)

## API Endpoints

- `/api/auth/login` - Authentication
- `/api/charts/*` - Chart management
- `/api/dashboards/*` - Dashboard management
- `/api/datasets/*` - Dataset management

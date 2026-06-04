# API Reference

Complete API documentation for INGAMAR BI backend.

## Base URL

```
http://localhost:5000/api/v1
```

## Authentication

All API endpoints (except `/auth/login`) require JWT authentication.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@ingamar.local",
    "roles": ["admin"]
  }
}
```

### Using the Token

Include the token in the Authorization header:

```http
GET /api/v1/datasets
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints

### Health

#### Check Health
```http
GET /api/v1/health
```

**Response:**
```json
{
  "service": "INGAMAR",
  "status": "ok"
}
```

---

### Datasets

#### List Datasets
```http
GET /api/v1/datasets
```

**Response:**
```json
{
  "datasets": [
    {
      "id": "user_retail_sample",
      "table_name": "user_retail_sample",
      "source": "User Upload",
      "row_count": 500,
      "column_count": 7,
      "columns": [
        {"name": "date", "type": "DATE"},
        {"name": "category", "type": "VARCHAR"},
        {"name": "sales", "type": "INTEGER"}
      ],
      "status": "ready",
      "created_at": "2026-05-26T02:25:38"
    }
  ]
}
```

#### Get Dataset
```http
GET /api/v1/datasets/{table_name}
```

**Response:**
```json
{
  "table_name": "user_retail_sample",
  "row_count": 500,
  "column_count": 7,
  "columns": [...],
  "preview": [
    {"date": "2023-01-01", "category": "Electronics", "sales": 12345}
  ]
}
```

#### Upload Dataset
```http
POST /api/v1/datasets/upload
Content-Type: multipart/form-data

file: <binary>
name: "Sales Data"
```

#### Delete Dataset
```http
DELETE /api/v1/datasets/{table_name}
```

---

### Charts

#### List Charts
```http
GET /api/v1/charts
```

**Response:**
```json
{
  "charts": [
    {
      "id": 1,
      "chart_name": "Sales by Category",
      "viz_type": "bar",
      "datasource_id": "user_retail_sample",
      "params": {
        "groupby": ["category"],
        "metrics": [{"label": "Sales", "expressionType": "SIMPLE", "aggregate": "SUM", "column": {"column_name": "sales"}}]
      },
      "created_at": "2026-05-26T10:30:00"
    }
  ],
  "page": 1,
  "pages": 1,
  "total": 1
}
```

#### Create Chart
```http
POST /api/v1/charts
Content-Type: application/json

{
  "chart_name": "Sales by Category",
  "viz_type": "bar",
  "datasource_id": "user_retail_sample",
  "params": {
    "groupby": ["category"],
    "metrics": [{"label": "Sales", "expressionType": "SIMPLE", "aggregate": "SUM", "column": {"column_name": "sales"}}],
    "rowLimit": 20
  }
}
```

#### Get Chart
```http
GET /api/v1/charts/{id}
```

#### Update Chart
```http
PUT /api/v1/charts/{id}
Content-Type: application/json

{
  "chart_name": "Updated Name"
}
```

#### Delete Chart
```http
DELETE /api/v1/charts/{id}
```

---

### Dashboards

#### List Dashboards
```http
GET /api/v1/dashboards
```

**Response:**
```json
{
  "dashboards": [
    {
      "id": 1,
      "dashboard_title": "Sales Overview",
      "description": "Q1 2026 Sales Dashboard",
      "owner_id": 1,
      "created_at": "2026-05-26T10:30:00"
    }
  ],
  "page": 1,
  "pages": 1,
  "total": 1
}
```

#### Create Dashboard
```http
POST /api/v1/dashboards
Content-Type: application/json

{
  "dashboard_title": "Sales Overview",
  "description": "Q1 2026 Sales Dashboard",
  "position_json": "{\"CHART-1\": {\"x\": 0, \"y\": 0, \"w\": 6, \"h\": 4}}"
}
```

#### Get Dashboard
```http
GET /api/v1/dashboards/{id}
```

#### Update Dashboard
```http
PUT /api/v1/dashboards/{id}
Content-Type: application/json

{
  "dashboard_title": "Updated Title"
}
```

#### Delete Dashboard
```http
DELETE /api/v1/dashboards/{id}
```

---

### SQL Lab

#### Execute Query
```http
POST /api/v1/sql_lab/execute
Content-Type: application/json

{
  "sql": "SELECT category, SUM(sales) as total FROM user_retail_sample GROUP BY category",
  "database_id": 1
}
```

**Response:**
```json
{
  "query_id": "abc123",
  "status": "success",
  "rows": [
    {"category": "Electronics", "total": 123456},
    {"category": "Clothing", "total": 98765}
  ],
  "columns": ["category", "total"],
  "row_count": 2
}
```

#### Save Query
```http
POST /api/v1/sql_lab/save
Content-Type: application/json

{
  "name": "Sales by Category",
  "sql": "SELECT category, SUM(sales) as total FROM user_retail_sample GROUP BY category",
  "database_id": 1
}
```

#### List Saved Queries
```http
GET /api/v1/sql_lab/saved
```

---

### AI

#### Natural Language Query
```http
POST /api/v1/ai/query
Content-Type: application/json

{
  "question": "What are the total sales by category?",
  "table_name": "user_retail_sample"
}
```

**Response:**
```json
{
  "sql": "SELECT category, SUM(sales) AS total_sales FROM user_retail_sample GROUP BY category",
  "title": "Total Sales by Category",
  "data": [
    {"category": "Electronics", "total_sales": 123456}
  ],
  "chart_type": "bar",
  "explanation": "This query groups sales by product category and calculates the total for each."
}
```

#### Analyze Dataset
```http
POST /api/v1/ai/analyze
Content-Type: application/json

{
  "dataset_id": "user_retail_sample",
  "message": "Give me insights about this dataset"
}
```

**Response:**
```json
{
  "message": "Based on the analysis, here are key insights...",
  "suggestions": [
    {
      "type": "chart",
      "title": "Sales Trend",
      "config": {...}
    }
  ]
}
```

---

### ML Studio

#### List ML Datasets
```http
GET /api/v1/ml/datasets
```

**Response:**
```json
[
  {
    "table_name": "user_retail_sample",
    "row_count": 500,
    "column_count": 7,
    "numeric_columns": ["sales", "quantity", "profit"],
    "categorical_columns": ["category", "region"]
  }
]
```

#### Train Model
```http
POST /api/v1/ml/train
Content-Type: application/json

{
  "dataset": "user_retail_sample",
  "target": "sales",
  "features": ["quantity", "profit", "customer_age"],
  "model_type": "random_forest_regressor",
  "test_size": 0.2
}
```

**Response:**
```json
{
  "task": "regression",
  "model_type": "random_forest_regressor",
  "metrics": {
    "mse": 1234567.89,
    "rmse": 1111.11,
    "mae": 890.12,
    "r2_score": 0.85
  },
  "feature_importance": {
    "profit": 0.45,
    "quantity": 0.35,
    "customer_age": 0.20
  },
  "sample_predictions": [
    {"actual": 12345, "predicted": 12000}
  ]
}
```

#### List Models
```http
GET /api/v1/ml/models
```

**Response:**
```json
{
  "models": [],
  "count": 0,
  "message": "No models trained yet. Use /api/v1/ml/train to train one."
}
```

#### Correlation Analysis
```http
POST /api/v1/ml/correlation
Content-Type: application/json

{
  "dataset": "user_retail_sample"
}
```

**Response:**
```json
{
  "columns": ["sales", "quantity", "profit"],
  "correlation_matrix": [
    {"x": "sales", "y": "quantity", "value": 0.75},
    {"x": "sales", "y": "profit", "value": 0.82}
  ],
  "statistics": {
    "sales": {"mean": 25000, "std": 5000, "min": 500, "max": 50000}
  }
}
```

---

### Deep Learning

#### List DL Datasets
```http
GET /api/v1/dl/datasets
```

#### Train Neural Network
```http
POST /api/v1/dl/train
Content-Type: application/json

{
  "dataset": "user_retail_sample",
  "target": "sales",
  "features": ["quantity", "profit"],
  "architecture": [64, 32, 16],
  "epochs": 100,
  "learning_rate": 0.001
}
```

**Response:**
```json
{
  "model_id": "dl_model_123",
  "metrics": {
    "final_loss": 0.0234,
    "final_val_loss": 0.0289
  },
  "training_history": {
    "loss": [0.5, 0.3, 0.1, 0.0234],
    "val_loss": [0.6, 0.4, 0.15, 0.0289]
  }
}
```

#### List Models
```http
GET /api/v1/dl/models
```

---

### MCP Tools

#### List Tools
```http
GET /api/v1/mcp/tools
```

**Response:**
```json
{
  "tools": [
    {
      "name": "list_datasets",
      "description": "List all available datasets/tables in the database",
      "input_schema": {"type": "object", "properties": {}}
    },
    {
      "name": "query_data",
      "description": "Run a natural language query on a dataset",
      "input_schema": {
        "type": "object",
        "properties": {
          "question": {"type": "string"},
          "table_name": {"type": "string"}
        },
        "required": ["question", "table_name"]
      }
    }
  ]
}
```

---

### Anomaly Detection

#### Detect Anomalies
```http
POST /api/v1/ml/anomalies
Content-Type: application/json

{
  "table": "user_retail_sample",
  "date_column": "date",
  "value_column": "sales",
  "sensitivity": 0.95
}
```

**Response:**
```json
{
  "total_rows": 500,
  "anomaly_count": 3,
  "anomaly_rate": 0.6,
  "anomalies": [
    {
      "date": "2023-02-20",
      "actual": 250000,
      "expected": 25000,
      "expected_lower": 20000,
      "expected_upper": 30000,
      "deviation": 900.0,
      "severity": "high"
    }
  ],
  "forecast": [
    {"date": "2023-01-01", "yhat": 25000, "yhat_lower": 20000, "yhat_upper": 30000}
  ]
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "type": "ErrorType"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation error (e.g., insufficient data for ML training)
- **500 Internal Server Error**: Server error
- **501 Not Implemented**: Feature not available (e.g., Prophet not installed)

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication**: 10 requests per minute
- **Other endpoints**: 100 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1622000000
```

---

## Pagination

List endpoints support pagination:

```http
GET /api/v1/datasets?page=1&per_page=20
```

**Response:**
```json
{
  "datasets": [...],
  "page": 1,
  "pages": 5,
  "total": 100
}
```

---

## Filtering and Sorting

Some endpoints support filtering and sorting:

```http
GET /api/v1/charts?sort=created_at&order=desc&search=sales
```

---

## WebSockets

Real-time updates are available via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

---

## SDK Examples

### Python

```python
import requests

# Login
response = requests.post('http://localhost:5000/api/v1/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})
token = response.json()['access_token']

# List datasets
headers = {'Authorization': f'Bearer {token}'}
datasets = requests.get('http://localhost:5000/api/v1/datasets', headers=headers).json()

# Train ML model
response = requests.post('http://localhost:5000/api/v1/ml/train', headers=headers, json={
    'dataset': 'user_retail_sample',
    'target': 'sales',
    'features': ['quantity', 'profit']
})
print(response.json())
```

### JavaScript

```javascript
// Login
const login = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: 'admin', password: 'admin123'})
});
const {access_token} = await login.json();

// List datasets
const datasets = await fetch('http://localhost:5000/api/v1/datasets', {
  headers: {'Authorization': `Bearer ${access_token}`}
}).then(r => r.json());

// Train ML model
const training = await fetch('http://localhost:5000/api/v1/ml/train', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    dataset: 'user_retail_sample',
    target: 'sales',
    features: ['quantity', 'profit']
  })
}).then(r => r.json());
```

---

**Last Updated**: June 2026

# INGAMAR BI Examples

This directory contains example configurations, use cases, and sample data.

## Configuration Examples

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - SECRET_KEY=your-secret-key
      - DATABASE_URL=postgresql://user:pass@db:5432/ingamar
    depends_on:
      - db
  
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=ingamar
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Environment Variables

```bash
# .env.example

# Backend
FLASK_ENV=production
SECRET_KEY=your-secret-key-change-this
DATABASE_URL=sqlite:///instance/ingamar.db
JWT_SECRET_KEY=your-jwt-secret
CORS_ORIGINS=http://localhost:3000

# AI Integration
GROQ_API_KEY=your-groq-api-key

# Kaggle Integration
KAGGLE_USERNAME=your-username
KAGGLE_KEY=your-key

# Frontend
REACT_APP_API_URL=http://localhost:5000/api/v1
```

## Use Cases

### 1. Sales Analytics Dashboard

Create a comprehensive sales dashboard with:
- KPI cards showing total revenue, orders, average order value
- Time series chart showing sales trends
- Bar chart showing sales by category
- Pie chart showing sales by region
- Table showing top products

**Sample Query:**
```sql
SELECT 
  DATE(date) as sale_date,
  category,
  region,
  SUM(sales) as total_sales,
  COUNT(*) as order_count
FROM user_retail_sample
GROUP BY DATE(date), category, region
ORDER BY sale_date DESC
```

### 2. Customer Segmentation with ML

Use ML Studio to segment customers:
1. Upload customer data
2. Select features: age, purchase_frequency, total_spent
3. Choose K-Means clustering
4. Visualize clusters
5. Analyze segment characteristics

### 3. Anomaly Detection in Time Series

Detect anomalies in sales data:
1. Upload time series data
2. Use anomaly detection endpoint
3. Visualize anomalies on chart
4. Investigate root causes

**API Call:**
```bash
curl -X POST http://localhost:5000/api/v1/ml/anomalies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "sales_data",
    "date_column": "date",
    "value_column": "revenue",
    "sensitivity": 0.95
  }'
```

### 4. Natural Language Data Exploration

Use AI Assistant to explore data:
- "What are the top 5 products by sales?"
- "Show me sales trends for the last 30 days"
- "Compare sales across regions"
- "What's the average order value by category?"

### 5. Predictive Modeling

Build predictive models:
1. Upload historical data
2. Select target variable
3. Choose algorithm (Random Forest, Gradient Boosting, etc.)
4. Train model
5. Evaluate performance
6. Make predictions

## Sample Data

### Retail Sales Data

```csv
date,category,region,sales,quantity,profit,customer_age
2023-01-01,Electronics,North,12345,50,2345,35
2023-01-01,Clothing,South,8765,120,1234,28
2023-01-02,Food,East,5432,200,876,42
2023-01-02,Sports,West,9876,75,1987,31
2023-01-03,Books,North,3456,90,567,45
```

### Financial Data

```csv
date,account,transaction_type,amount,balance
2023-01-01,Checking,Deposit,5000,5000
2023-01-02,Checking,Withdrawal,-500,4500
2023-01-03,Savings,Transfer,1000,1000
2023-01-04,Checking,Deposit,3000,7500
```

### Web Analytics

```csv
timestamp,page,visitor_id,session_duration,bounce_rate
2023-01-01 10:00:00,/home,user123,120,0
2023-01-01 10:05:00,/products,user123,300,0
2023-01-01 10:10:00,/about,user456,60,1
2023-01-01 10:15:00,/contact,user789,180,0
```

## Chart Configurations

### Bar Chart

```json
{
  "chart_name": "Sales by Category",
  "viz_type": "bar",
  "datasource_id": "user_retail_sample",
  "params": {
    "groupby": ["category"],
    "metrics": [
      {
        "label": "Total Sales",
        "expressionType": "SIMPLE",
        "aggregate": "SUM",
        "column": {"column_name": "sales"}
      }
    ],
    "rowLimit": 20,
    "orderDesc": true
  }
}
```

### Line Chart

```json
{
  "chart_name": "Sales Trend",
  "viz_type": "line",
  "datasource_id": "user_retail_sample",
  "params": {
    "groupby": ["date"],
    "metrics": [
      {
        "label": "Sales",
        "expressionType": "SIMPLE",
        "aggregate": "SUM",
        "column": {"column_name": "sales"}
      }
    ],
    "time_grain": "day",
    "rowLimit": 100
  }
}
```

### Pie Chart

```json
{
  "chart_name": "Sales by Region",
  "viz_type": "pie",
  "datasource_id": "user_retail_sample",
  "params": {
    "groupby": ["region"],
    "metrics": [
      {
        "label": "Sales",
        "expressionType": "SIMPLE",
        "aggregate": "SUM",
        "column": {"column_name": "sales"}
      }
    ],
    "rowLimit": 10
  }
}
```

### Heatmap

```json
{
  "chart_name": "Correlation Heatmap",
  "viz_type": "heatmap",
  "datasource_id": "user_retail_sample",
  "params": {
    "all_columns_x": ["sales", "quantity", "profit"],
    "all_columns_y": ["sales", "quantity", "profit"],
    "metric": {
      "label": "Correlation",
      "expressionType": "SQL",
      "sqlExpression": "CORR(sales, quantity)"
    }
  }
}
```

## Dashboard Templates

### Executive Dashboard

```json
{
  "dashboard_title": "Executive Overview",
  "description": "High-level business metrics",
  "charts": [
    {
      "id": 1,
      "position": {"x": 0, "y": 0, "w": 6, "h": 2},
      "type": "kpi",
      "config": {"metric": "total_revenue"}
    },
    {
      "id": 2,
      "position": {"x": 6, "y": 0, "w": 6, "h": 2},
      "type": "kpi",
      "config": {"metric": "total_orders"}
    },
    {
      "id": 3,
      "position": {"x": 0, "y": 2, "w": 12, "h": 4},
      "type": "line",
      "config": {"chart_id": 1}
    },
    {
      "id": 4,
      "position": {"x": 0, "y": 6, "w": 6, "h": 4},
      "type": "bar",
      "config": {"chart_id": 2}
    },
    {
      "id": 5,
      "position": {"x": 6, "y": 6, "w": 6, "h": 4},
      "type": "pie",
      "config": {"chart_id": 3}
    }
  ]
}
```

## API Usage Examples

### Python

```python
import requests

# Initialize
BASE_URL = 'http://localhost:5000/api/v1'
TOKEN = 'your-token-here'
HEADERS = {'Authorization': f'Bearer {TOKEN}'}

# List datasets
datasets = requests.get(f'{BASE_URL}/datasets', headers=HEADERS).json()

# Create chart
chart = requests.post(f'{BASE_URL}/charts', headers=HEADERS, json={
    'chart_name': 'Sales by Category',
    'viz_type': 'bar',
    'datasource_id': 'user_retail_sample',
    'params': {
        'groupby': ['category'],
        'metrics': [{'label': 'Sales', 'aggregate': 'SUM', 'column': 'sales'}]
    }
}).json()

# Train ML model
model = requests.post(f'{BASE_URL}/ml/train', headers=HEADERS, json={
    'dataset': 'user_retail_sample',
    'target': 'sales',
    'features': ['quantity', 'profit'],
    'model_type': 'random_forest_regressor'
}).json()

print(f"R2 Score: {model['metrics']['r2_score']}")
```

### JavaScript

```javascript
const BASE_URL = 'http://localhost:5000/api/v1';
const TOKEN = 'your-token-here';
const HEADERS = {'Authorization': `Bearer ${TOKEN}`};

// List datasets
const datasets = await fetch(`${BASE_URL}/datasets`, {headers: HEADERS})
  .then(r => r.json());

// Create chart
const chart = await fetch(`${BASE_URL}/charts`, {
  method: 'POST',
  headers: {...HEADERS, 'Content-Type': 'application/json'},
  body: JSON.stringify({
    chart_name: 'Sales by Category',
    viz_type: 'bar',
    datasource_id: 'user_retail_sample',
    params: {
      groupby: ['category'],
      metrics: [{label: 'Sales', aggregate: 'SUM', column: 'sales'}]
    }
  })
}).then(r => r.json());

// AI query
const aiResult = await fetch(`${BASE_URL}/ai/query`, {
  method: 'POST',
  headers: {...HEADERS, 'Content-Type': 'application/json'},
  body: JSON.stringify({
    question: 'What are the top 5 products by sales?',
    table_name: 'user_retail_sample'
  })
}).then(r => r.json());

console.log(aiResult.sql);
```

## Troubleshooting

### Common Issues

**Issue**: "Not enough data to train"
**Solution**: Upload a dataset with at least 10 rows

**Issue**: "Prophet is not installed"
**Solution**: Run `pip install prophet` in the backend environment

**Issue**: "CORS error"
**Solution**: Update `CORS_ORIGINS` in backend configuration

**Issue**: "Authentication failed"
**Solution**: Check username/password, ensure token is not expired

---

**Last Updated**: June 2026

# INGAMAR BI Tests

This directory contains the test suite for INGAMAR BI.

## Test Structure

```
tests/
├── backend/
│   ├── test_auth.py          # Authentication tests
│   ├── test_datasets.py      # Dataset management tests
│   ├── test_charts.py        # Chart operations tests
│   ├── test_dashboards.py    # Dashboard tests
│   ├── test_sql_lab.py       # SQL Lab tests
│   ├── test_ml.py            # ML Studio tests
│   ├── test_dl.py            # Deep Learning tests
│   └── test_ai.py            # AI assistant tests
├── frontend/
│   ├── components/           # Component tests
│   ├── pages/                # Page tests
│   └── utils/                # Utility function tests
└── e2e/
    ├── auth.spec.ts          # Authentication E2E tests
    ├── dashboard.spec.ts     # Dashboard E2E tests
    └── chart.spec.ts         # Chart creation E2E tests
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/components/Sidebar.test.tsx

# Run in watch mode
npm test -- --watch
```

### E2E Tests

```bash
cd frontend

# Run E2E tests
npm run test:e2e

# Run specific E2E test
npx playwright test auth.spec.ts
```

## Test Coverage Requirements

- **New features**: Minimum 80% coverage
- **Bug fixes**: Include regression test
- **Critical paths**: 100% coverage required

## Writing Tests

### Backend Test Example

```python
import pytest
from app import create_app, db

@pytest.fixture
def client():
    app = create_app('testing')
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_health_endpoint(client):
    response = client.get('/api/v1/health')
    assert response.status_code == 200
    assert response.json['status'] == 'ok'

def test_login(client):
    response = client.post('/api/v1/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    assert response.status_code == 200
    assert 'access_token' in response.json
```

### Frontend Test Example

```typescript
import { render, screen } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

test('renders sidebar with navigation items', () => {
  render(<Sidebar />);
  
  expect(screen.getByText('Dashboards')).toBeInTheDocument();
  expect(screen.getByText('Charts')).toBeInTheDocument();
  expect(screen.getByText('SQL Lab')).toBeInTheDocument();
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('http://localhost:3000/dashboards');
});
```

## Continuous Integration

Tests run automatically on every push and pull request via GitHub Actions.

See `.github/workflows/ci.yml` for the CI configuration.

## Test Data

Test data is located in `tests/fixtures/`:

- `sample_data.csv` - Sample dataset for testing
- `test_config.json` - Test configuration
- `mock_responses.json` - Mock API responses

## Mocking

### Backend Mocking

```python
from unittest.mock import patch, MagicMock

@patch('app.ai.groq_service.Groq')
def test_ai_query(mock_groq):
    mock_groq.return_value.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content='{"sql": "SELECT * FROM test"}'))]
    )
    
    response = client.post('/api/v1/ai/query', json={
        'question': 'test',
        'table_name': 'test_table'
    })
    
    assert response.status_code == 200
```

### Frontend Mocking

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/v1/datasets', (req, res, ctx) => {
    return res(ctx.json({ datasets: [] }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the code does, not how it does it
2. **Use descriptive test names**: Clearly describe what is being tested
3. **Keep tests independent**: Each test should be able to run in isolation
4. **Clean up after tests**: Remove test data and reset state
5. **Test edge cases**: Include tests for error conditions and boundary values
6. **Use fixtures**: Reuse common test setup with fixtures
7. **Mock external services**: Don't make real API calls in tests
8. **Measure coverage**: Use coverage reports to find untested code

---

**Last Updated**: June 2026

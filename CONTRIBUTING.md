# Contributing to INGAMAR BI

Thank you for your interest in contributing to INGAMAR BI! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project adheres to a code of conduct that promotes respectful, inclusive, and harassment-free participation. By contributing, you agree to uphold this code.

**Expected Behavior:**
- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community

**Unacceptable Behavior:**
- Trolling, insulting/derogatory comments, personal attacks
- Public or private harassment
- Publishing others' private information without consent
- Other conduct which could be considered inappropriate

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear descriptive title**
- **Detailed steps to reproduce**
- **Expected vs actual behavior**
- **Environment details** (OS, browser, versions)
- **Screenshots or logs** if applicable
- **Additional context** that might help

### Suggesting Features

Feature suggestions are welcome! Please include:

- **Use case**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other approaches did you think about?
- **Impact**: Who benefits and how?

### Code Contributions

We welcome code contributions for:
- Bug fixes
- New features
- Performance improvements
- Documentation improvements
- Test coverage
- Security enhancements

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Git

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt
python run.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Pull Request Process

### Before Submitting

1. **Fork the repository** and create your branch from `main`
2. **Check existing issues** to avoid duplicate work
3. **Discuss major changes** in an issue first
4. **Follow coding standards** (see below)
5. **Add tests** for new functionality
6. **Update documentation** as needed
7. **Ensure all tests pass**

### Branch Naming

Use descriptive branch names:
- `feature/add-dark-mode`
- `fix/sql-injection-vulnerability`
- `docs/update-api-reference`
- `refactor/chart-rendering`

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons, etc)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add OAuth2 support

Add OAuth2 authentication provider for Google and GitHub login.

Closes #123
```

```
fix(api): prevent SQL injection in query endpoint

Sanitize user input before executing dynamic SQL queries.

Security: CVE-2026-XXXX
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings introduced
```

## Coding Standards

### Backend (Python)

- Follow PEP 8 style guide
- Use type hints for function signatures
- Maximum line length: 100 characters
- Use meaningful variable names
- Add docstrings for all public functions
- Use f-strings for string formatting

```python
def calculate_metrics(dataset_id: int, include_nulls: bool = False) -> Dict[str, float]:
    """
    Calculate statistical metrics for a dataset.
    
    Args:
        dataset_id: The ID of the dataset to analyze
        include_nulls: Whether to include null values in calculations
        
    Returns:
        Dictionary containing mean, median, std_dev, etc.
        
    Raises:
        ValueError: If dataset_id is invalid
        DatasetNotFoundError: If dataset doesn't exist
    """
    pass
```

### Frontend (TypeScript/React)

- Use TypeScript for all new code
- Follow ESLint configuration
- Use functional components with hooks
- Keep components small and focused
- Use meaningful prop names with types

```typescript
interface ChartProps {
  data: DataPoint[];
  title: string;
  type: 'bar' | 'line' | 'pie';
  onPointClick?: (point: DataPoint) => void;
}

const Chart: React.FC<ChartProps> = ({ data, title, type, onPointClick }) => {
  // Component implementation
};
```

### CSS/Styling

- Use CSS custom properties (variables)
- Follow BEM naming convention for custom classes
- Keep specificity low
- Use INGAMAR design tokens

### SQL

- Use uppercase for SQL keywords
- Use meaningful table and column names
- Add comments for complex queries
- Use parameterized queries (never concatenate user input)

## Testing Guidelines

### Test Coverage Requirements

- **New features**: Minimum 80% coverage
- **Bug fixes**: Include regression test
- **Critical paths**: 100% coverage required

### Test Types

**Unit Tests**: Test individual functions/components
```python
def test_calculate_average():
    data = [1, 2, 3, 4, 5]
    result = calculate_average(data)
    assert result == 3.0
```

**Integration Tests**: Test component interactions
```python
def test_dataset_creation_flow():
    # Create dataset
    dataset_id = create_dataset("test.csv")
    
    # Verify it exists
    dataset = get_dataset(dataset_id)
    assert dataset is not None
    
    # Clean up
    delete_dataset(dataset_id)
```

**E2E Tests**: Test complete user workflows
```typescript
test('user can create dashboard', async () => {
  await page.goto('/dashboards');
  await page.click('button:has-text("Create Dashboard")');
  await page.fill('input[name="title"]', 'My Dashboard');
  await page.click('button:has-text("Save")');
  
  await expect(page.locator('.dashboard-title')).toHaveText('My Dashboard');
});
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/auth.test.ts

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Documentation

### Code Documentation

- Add JSDoc comments for TypeScript functions
- Add docstrings for Python functions
- Document complex algorithms
- Keep comments up-to-date with code changes

### User Documentation

Update documentation in `docs/` directory:
- User guides
- API reference
- Deployment instructions
- Configuration examples

### API Documentation

Document all API endpoints with:
- HTTP method and path
- Request/response schemas
- Authentication requirements
- Example requests/responses
- Error codes

```markdown
## POST /api/v1/datasets/upload

Upload a new dataset.

**Authentication**: Required (Bearer token)

**Request**:
```json
{
  "name": "Sales Data",
  "description": "Q1 2026 sales",
  "file": "binary"
}
```

**Response** (201 Created):
```json
{
  "id": 123,
  "name": "Sales Data",
  "status": "processing"
}
```

**Errors**:
- 400: Invalid file format
- 401: Unauthorized
- 413: File too large
```

## Review Process

### What Reviewers Look For

1. **Correctness**: Does the code do what it's supposed to?
2. **Security**: Are there any security vulnerabilities?
3. **Performance**: Is the code efficient?
4. **Maintainability**: Is the code easy to understand and modify?
5. **Testing**: Are there adequate tests?
6. **Documentation**: Is the code well-documented?

### Addressing Feedback

- Respond to all comments
- Make requested changes or explain why not
- Push new commits (don't force-push during review)
- Re-request review after making changes

## Release Process

1. **Feature Freeze**: No new features, only bug fixes
2. **Testing**: Comprehensive test suite runs
3. **Documentation**: Update changelog and docs
4. **Version Bump**: Update version numbers
5. **Tag Release**: Create git tag
6. **Deploy**: Deploy to production
7. **Announce**: Release notes and announcement

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact maintainers at team@ingamar.local

## Recognition

Contributors are recognized in:
- GitHub repository contributors page
- Release notes
- Project documentation

Thank you for contributing to INGAMAR BI!

---

**Last Updated**: June 2026

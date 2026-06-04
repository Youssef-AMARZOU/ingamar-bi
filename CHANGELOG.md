# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Anomaly detection endpoint with Prophet integration
- MCP tools registry endpoint
- ML models listing endpoint
- Auto-seeding of sample retail dataset on startup
- AnomalyPanel frontend component for time series analysis

### Changed
- Improved error handling for ML training (returns 422 instead of 500)
- Enhanced AI chart endpoint validation
- Fixed ML correlation NaN values with fillna(0)
- Updated .gitignore to exclude database files

### Fixed
- ML /train endpoint now validates row count before training
- AI /chart endpoint returns proper error codes for missing fields
- Correlation analysis handles zero-variance columns correctly

## [1.0.0] - 2026-05-26

### Added
- **Frontend**
  - Professional design system with Inter font
  - Dark/light theme with CSS custom properties
  - Left-border navigation indicators
  - Panel-style cards with 2px border-radius
  - Breadcrumb navigation in header
  - INGAMAR color palette (orange, blue, green, red, yellow, purple)
  - KPI cards with top-border accent bars
  - Color-coded badges and alerts
  - Inline chart creation in DashboardBuilder
  - Deep Learning module with neural network training
  - ML Studio with regression, classification, clustering
  - AI Assistant with conversational chat interface
  - SQL Lab with query history and saved queries
  - Dataset management with upload, import, preview
  - Dashboard builder with drag-and-drop layout
  - Chart builder with multiple visualization types

- **Backend**
  - Flask REST API with JWT authentication
  - Role-based access control (RBAC)
  - SQLAlchemy ORM with SQLite/PostgreSQL support
  - Dataset upload and management
  - Chart and dashboard CRUD operations
  - SQL Lab for ad-hoc queries
  - AI integration with Groq for NL→SQL
  - ML endpoints for training, prediction, evaluation
  - DL endpoints for neural network training
  - MCP server for tool integration
  - Kaggle dataset import functionality
  - Data profiling and statistics

- **Infrastructure**
  - Docker support for containerized deployment
  - Hugging Face Space deployment
  - GitHub Actions CI/CD pipeline
  - Automatic database migrations
  - Environment-based configuration
  - CORS support for cross-origin requests

### Changed
- Migrated from separate frontend/backend deployments to unified Space
- Improved theme switching with loading guard to prevent flicker
- Enhanced error messages with actionable suggestions
- Optimized database queries for better performance
- Updated dependencies to latest stable versions

### Fixed
- Theme flash glitch on page load
- JWT token refresh memory leak
- Chart rendering issues with empty datasets
- SQL injection vulnerabilities (parameterized queries)
- Memory leaks in long-running sessions

### Security
- Added SECURITY.md with responsible disclosure policy
- Implemented rate limiting on authentication endpoints
- Added input validation and sanitization
- Enabled CORS with strict origin checking
- Implemented secure password hashing with bcrypt
- Added JWT token rotation

### Documentation
- Added comprehensive README with badges
- Created CONTRIBUTING.md with contribution guidelines
- Added SECURITY.md for vulnerability reporting
- Created CHANGELOG.md for release tracking
- Added API documentation in docs/
- Created deployment guides for various platforms

## [0.9.0] - 2026-05-20

### Added
- Initial beta release
- Basic chart creation and visualization
- Dashboard management
- User authentication
- Dataset upload functionality
- SQL query editor

### Known Issues
- Limited chart types
- No AI integration
- Basic styling only
- No mobile responsiveness

## [0.1.0] - 2026-05-15

### Added
- Project initialization
- Basic project structure
- Development environment setup

---

## Versioning

- **Major version**: Breaking changes, major new features
- **Minor version**: New features, enhancements (backward compatible)
- **Patch version**: Bug fixes, security patches

## Release Process

1. Update CHANGELOG.md with all changes
2. Bump version in package.json and setup.py
3. Create release branch
4. Run full test suite
5. Create git tag (v1.0.0)
6. Build release artifacts
7. Deploy to staging
8. Run acceptance tests
9. Deploy to production
10. Create GitHub release with notes
11. Announce release

## Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

**Note**: This changelog is manually maintained. For detailed commit history, see the git log.

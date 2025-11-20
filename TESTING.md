# Testing Infrastructure Setup

This document describes the comprehensive testing strategy implemented for SpeedCheck.

## Overview

The project now includes:
- ✅ Frontend unit tests (Jest + jsdom)
- ✅ Backend unit tests (Jest + Supertest)
- ✅ ESLint code quality checks
- ✅ GitHub Actions CI/CD pipeline
- ✅ Code coverage reporting

## Frontend Testing

### Running Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Test Structure

```
frontend/tests/
├── utils.test.js     # Utility functions (formatBytes, quality assessment)
├── config.test.js    # Configuration validation
└── state.test.js     # State management tests
```

### Coverage Targets

- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

## Backend Testing

### Running Tests

```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Test Structure

```
backend/tests/
├── basic.test.js      # Basic endpoint tests
└── enhanced.test.js   # Advanced functionality tests
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`

### Pipeline Stages

1. **Frontend Tests** - Run all frontend unit tests with coverage
2. **Backend Tests** - Run all backend unit tests with coverage
3. **Lint Check** - Verify code quality with ESLint
4. **Build Verification** - Ensure frontend builds successfully
5. **Deploy to Railway** - Auto-deploy to production (main branch only, after all tests pass)

### Setting Up CI/CD

1. **Add Railway Token to GitHub Secrets:**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add a new secret named `RAILWAY_TOKEN`
   - Get the token from Railway CLI: `railway login` then `railway whoami --token`

2. **The pipeline will automatically:**
   - Run all tests on every push
   - Generate coverage reports
   - Deploy to Railway only if all tests pass
   - Block deployment if tests fail

## Code Quality Rules

### ESLint Configuration

**Frontend (4-space indentation):**
- ES2022 features
- Module imports/exports
- Browser + Node environment
- Consistent formatting

**Backend (2-space indentation):**
- ES2022 features
- CommonJS modules
- Node + Jest environment
- Production-ready practices

### Common Rules

- Single quotes for strings
- Semicolons required
- No trailing spaces
- Unix line endings (LF)
- Prefer const over let
- No var declarations
- Arrow function spacing
- Consistent keyword spacing

## Installing Dependencies

### First Time Setup

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install
```

This will install:
- Jest and jsdom for testing
- ESLint for code quality
- Coverage tools
- Type definitions

## Writing New Tests

### Frontend Test Example

```javascript
// tests/myFeature.test.js
import { myFunction } from '../js/myModule.js';

describe('myFunction', () => {
    test('should do something', () => {
        const result = myFunction(input);
        expect(result).toBe(expected);
    });
});
```

### Backend Test Example

```javascript
// tests/myEndpoint.test.js
const request = require('supertest');
const { app } = require('../server');

describe('GET /api/myEndpoint', () => {
    test('should return data', async () => {
        const res = await request(app).get('/api/myEndpoint');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
    });
});
```

## Pre-Commit Checklist

Before committing code:

1. ✅ Run tests: `npm test`
2. ✅ Check linting: `npm run lint`
3. ✅ Fix auto-fixable issues: `npm run lint:fix`
4. ✅ Verify coverage is acceptable
5. ✅ Commit your changes

The CI pipeline will catch any issues you might have missed!

## Troubleshooting

### Tests Failing Locally

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose
```

### ESLint Errors

```bash
# Auto-fix most issues
npm run lint:fix

# Check what's still broken
npm run lint
```

### Coverage Below Threshold

If coverage drops below 70%, the tests will fail. To fix:
1. Write tests for uncovered functions
2. Remove dead code
3. Update coverage thresholds if justified

## Benefits

✅ **Catch bugs early** - Tests run on every push  
✅ **Safe refactoring** - Tests ensure nothing breaks  
✅ **Code quality** - ESLint enforces consistent style  
✅ **Deployment confidence** - Only tested code goes to production  
✅ **Documentation** - Tests serve as usage examples  
✅ **Team collaboration** - Clear quality standards  

## Next Steps

1. ✅ Matrix card border bug fixed
2. ✅ Testing infrastructure setup
3. ✅ CI/CD pipeline configured
4. 📝 Add more component tests (UI interactions)
5. 📝 Add E2E tests (Playwright/Cypress)
6. 📝 Increase coverage to 80%+
7. 📝 Update documentation to reflect v1.62.0 changes

---

**Questions?** Check the main README or open an issue on GitHub.

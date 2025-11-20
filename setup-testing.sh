#!/bin/bash

# SpeedCheck - Testing Infrastructure Setup Script
# Run this script to install all dependencies and set up testing

set -e  # Exit on error

echo "🚀 Setting up SpeedCheck Testing Infrastructure..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Install backend dependencies
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}✅ Backend dependencies installed${NC}"
echo ""

# Run backend tests
echo -e "${BLUE}🧪 Running backend tests...${NC}"
npm test
echo -e "${GREEN}✅ Backend tests passed${NC}"
echo ""

# Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd ../frontend
npm install
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
echo ""

# Run frontend tests
echo -e "${BLUE}🧪 Running frontend tests...${NC}"
npm test
echo -e "${GREEN}✅ Frontend tests passed${NC}"
echo ""

# Run linting
echo -e "${BLUE}🔍 Running ESLint checks...${NC}"
echo "Frontend:"
npm run lint || echo -e "${YELLOW}⚠️  Some linting issues found (run 'npm run lint:fix' to auto-fix)${NC}"
echo ""
echo "Backend:"
cd ../backend
npm run lint || echo -e "${YELLOW}⚠️  Some linting issues found (run 'npm run lint:fix' to auto-fix)${NC}"
cd ..
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Review TESTING.md for documentation"
echo "  2. Run 'npm test' in frontend/ or backend/ to run tests"
echo "  3. Run 'npm run lint:fix' to auto-fix code style issues"
echo "  4. Commit your changes - CI/CD will run automatically!"
echo ""
echo "CI/CD Setup:"
echo "  • GitHub Actions workflow created (.github/workflows/ci.yml)"
echo "  • Add RAILWAY_TOKEN to GitHub repository secrets for auto-deployment"
echo "  • Pipeline runs on every push to main/develop"
echo ""
echo -e "${BLUE}Happy coding! 🎉${NC}"

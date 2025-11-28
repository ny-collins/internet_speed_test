#!/bin/bash

# SpeedCheck Deployment Script
# This script helps deploy to all three environments

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    SpeedCheck Deployment Script       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command_exists railway; then
    echo -e "${RED}❌ Railway CLI not found. Install: npm install -g railway${NC}"
    exit 1
fi
if ! command_exists wrangler; then
    echo -e "${YELLOW}⚠️  Wrangler not found. Cloudflare deployment will be skipped.${NC}"
    WRANGLER_AVAILABLE=false
else
    WRANGLER_AVAILABLE=true
fi
echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo ""

# Function to deploy
deploy() {
    local target=$1
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Deploying: $target${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    case $target in
        "backend")
            cd backend
            echo -e "${YELLOW}Deploying backend to Railway...${NC}"
            railway up --service backend
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Backend deployed successfully${NC}"
                echo -e "${GREEN}   URL: https://speed-test-backend.up.railway.app${NC}"
            else
                echo -e "${RED}❌ Backend deployment failed${NC}"
                exit 1
            fi
            cd ..
            ;;
            
        "frontend-railway")
            cd frontend
            echo -e "${YELLOW}Deploying frontend to Railway...${NC}"
            railway up --service frontend
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Frontend deployed to Railway${NC}"
                echo -e "${GREEN}   URL: https://speed-test.up.railway.app${NC}"
            else
                echo -e "${RED}❌ Railway frontend deployment failed${NC}"
                exit 1
            fi
            cd ..
            ;;
            
        "frontend-cloudflare")
            if [ "$WRANGLER_AVAILABLE" = false ]; then
                echo -e "${YELLOW}⚠️  Skipping Cloudflare deployment (wrangler not available)${NC}"
                return
            fi
            cd frontend
            echo -e "${YELLOW}Deploying frontend to Cloudflare Pages...${NC}"
            wrangler pages deploy . --project-name=speed-test-ahc
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Frontend deployed to Cloudflare${NC}"
                echo -e "${GREEN}   URL: https://speed-test-ahc.pages.dev${NC}"
            else
                echo -e "${RED}❌ Cloudflare deployment failed${NC}"
                exit 1
            fi
            cd ..
            ;;
    esac
    echo ""
}

# Function to verify deployment
verify() {
    local url=$1
    local name=$2
    echo -e "${YELLOW}Verifying $name...${NC}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ $name is responding (HTTP $response)${NC}"
    else
        echo -e "${RED}❌ $name returned HTTP $response${NC}"
    fi
}

# Main menu
echo -e "${YELLOW}What would you like to deploy?${NC}"
echo "1) Backend only (Railway)"
echo "2) Frontend - Railway only"
echo "3) Frontend - Cloudflare only"
echo "4) All (Backend + Both Frontends)"
echo "5) Test/Verify deployments only"
echo "6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        deploy "backend"
        ;;
    2)
        deploy "frontend-railway"
        ;;
    3)
        deploy "frontend-cloudflare"
        ;;
    4)
        deploy "backend"
        sleep 5  # Give backend time to start
        deploy "frontend-railway"
        deploy "frontend-cloudflare"
        ;;
    5)
        echo -e "${BLUE}Testing all deployments...${NC}"
        verify "https://speed-test-backend.up.railway.app/health" "Backend"
        verify "https://speed-test.up.railway.app/" "Frontend (Railway)"
        verify "https://speed-test-ahc.pages.dev/" "Frontend (Cloudflare)"
        ;;
    6)
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    Deployment Process Complete! 🎉     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit your deployed URLs and test the speed test"
echo "2. Check browser console for any errors"
echo "3. Verify all three deployments work correctly"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo "  Backend:             https://speed-test-backend.up.railway.app"
echo "  Frontend (Railway):  https://speed-test.up.railway.app"
echo "  Frontend (Cloudflare): https://speed-test-ahc.pages.dev"
echo ""

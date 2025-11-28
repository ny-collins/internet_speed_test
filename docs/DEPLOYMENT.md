# 🚀 SpeedCheck - Deployment Guide

Comprehensive deployment documentation for SpeedCheck's distributed architecture.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Deployment URLs](#deployment-urls)
- [Quick Deploy](#quick-deploy)
- [Platform-Specific Deployment](#platform-specific-deployment)
- [Local Development](#local-development)
- [Configuration](#configuration)
- [Health Checks & Monitoring](#health-checks--monitoring)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

SpeedCheck uses a **distributed deployment strategy** with three services:

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Repository                     │
│            ny-collins/internet_speed_test               │
└────────┬──────────────────────────┬────────────────────┘
         │                          │
         │ Auto-deploy              │ Manual deploy
         ▼                          ▼
  ┌─────────────┐           ┌──────────────┐
  │   Railway   │           │  Cloudflare  │
  │  Amsterdam  │           │   Dar es     │
  │     NL      │           │   Salaam     │
  └──────┬──────┘           └──────┬───────┘
         │                         │
    ┌────┴─────┐              ┌────┴──────┐
    │ Backend  │              │ Frontend  │
    │ Frontend │              │ (Static)  │
    └──────────┘              └───────────┘
```

### Service Roles

| Service | Platform | Location | Purpose | URL |
|---------|----------|----------|---------|-----|
| **Backend API** | Railway | Amsterdam, NL | Speed test measurements | https://speed-test-backend.up.railway.app/ |
| **Frontend (Primary)** | Railway | Amsterdam, NL | UI for European users | https://speed-test.up.railway.app/ |
| **Frontend (Regional)** | Cloudflare Pages | Dar es Salaam, TZ | UI for African users | https://speed-test-ahc.pages.dev/ |

**Why This Architecture?**

1. **Single Backend in Amsterdam:**
   - Consistent baseline for speed measurements
   - Amsterdam is a major internet hub (AMS-IX)
   - Represents real-world international connectivity

2. **Dual Frontend Deployment:**
   - **Railway (Amsterdam):** Optimal for European users, co-located with backend
   - **Cloudflare (Dar es Salaam):** Fast page loads for African users via CDN edge
   - Both frontends are identical - only deployment location differs

3. **Benefits:**
   - African users: Fast UI loading (Cloudflare) + Accurate speed test (Amsterdam backend)
   - European users: Fast everything (co-located frontend and backend)
   - Consistent measurements regardless of frontend used

---

## Deployment URLs

### Production URLs

**Backend (API):**
- https://speed-test-backend.up.railway.app/
- Endpoints: `/api/download`, `/api/upload`, `/api/ping`, `/api/ping-batch`, `/api/info`, `/health`, `/metrics`

**Frontend - Railway (Primary):**
- https://speed-test.up.railway.app/
- Best for: European users, developers testing
- Pages: `/` (main), `/learn` (educational), `/404.html` (error)

**Frontend - Cloudflare Pages (Regional):**
- https://speed-test-ahc.pages.dev/
- Best for: African users, low-latency UI loading
- Same pages as Railway frontend

### GitHub Repository
- https://github.com/ny-collins/internet_speed_test

---

## Quick Deploy

### Automatic Deployment (Railway)

Both Railway services (backend + frontend) auto-deploy on push:

```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# Railway automatically deploys:
# 1. Backend: https://speed-test-backend.up.railway.app/
# 2. Frontend: https://speed-test.up.railway.app/
```

### Manual Deployment (Cloudflare Pages)

Cloudflare frontend requires manual deployment:

```bash
# Option 1: Using the deploy script
cd frontend
./deploy-cloudflare.sh

# Option 2: Direct wrangler command
cd frontend
wrangler pages deploy . --project-name=speed-test-ahc

# Option 3: Specify branch
cd frontend
wrangler pages deploy . --project-name=speed-test-ahc --branch=main
```

**Note:** Cloudflare deployment requires:
- Wrangler CLI installed: `npm install -g wrangler`
- Cloudflare authentication: `wrangler login`
- Project already created in Cloudflare Pages dashboard

---

## Platform-Specific Deployment

### Railway Deployment

**Setup (One-Time):**

1. Create Railway project: https://railway.app/new
2. Connect GitHub repository
3. Create two services from the same repo:

**Service 1: Backend**
```yaml
Name: speed-test-backend
Root Directory: /
Build Command: cd backend && npm install
Start Command: cd backend && npm start
Watch Paths: backend/**
Port: 3000
```

**Service 2: Frontend**
```yaml
Name: speed-test-frontend
Root Directory: /
Build Command: cd frontend && npm install
Start Command: cd frontend && npm start
Watch Paths: frontend/**
Port: 8080
```

**Environment Variables (Backend):**
```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
SERVER_LOCATION=Amsterdam, Netherlands
CORS_ORIGIN=*
MAX_DOWNLOAD_SIZE_MB=50
MAX_UPLOAD_SIZE_MB=50
ENABLE_METRICS=true
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
MAX_INFLIGHT_REQUESTS=100
```

**Railway Configuration Files:**
- Root: `railway.toml` or `railway.json` (if using mono-repo setup)
- Backend: `backend/railway.json`
- Frontend: `frontend/railway.json`

### Cloudflare Pages Deployment

**Setup (One-Time):**

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Create Cloudflare Pages project:
   - Go to: https://dash.cloudflare.com/
   - Navigate to Pages
   - Create new project: `speed-test-ahc`
   - Select deployment location: Africa (Dar es Salaam)

**Configuration File:**

`frontend/wrangler.toml`:
```toml
name = "speed-test-ahc"
compatibility_date = "2024-01-01"
pages_build_output_dir = "."

[env.production]
routes = [
  { pattern = "speed-test-ahc.pages.dev", zone_name = "pages.dev" }
]
```

**Deploy Command:**
```bash
cd frontend
wrangler pages deploy . --project-name=speed-test-ahc
```

**Cloudflare Deploy Script:**

`frontend/deploy-cloudflare.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Deploying to Cloudflare Pages..."
echo "📍 Target: Dar es Salaam, Tanzania"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

# Deploy
wrangler pages deploy . --project-name=speed-test-ahc

echo ""
echo "✅ Deployment complete!"
echo "🌐 Live at: https://speed-test-ahc.pages.dev/"
```

Make executable:
```bash
chmod +x frontend/deploy-cloudflare.sh
```

---

## Local Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/ny-collins/internet_speed_test.git
cd internet_speed_test

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running Development Servers

**Backend (Terminal 1):**
```bash
cd backend
npm run dev
# Runs on http://localhost:3000
# Uses nodemon for auto-restart on changes
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm start
# Runs on http://localhost:8080
# Access at: http://localhost:8080
```

**Important:** Both servers must be running simultaneously. The frontend makes API calls to the backend for speed testing.

### Development Workflow

1. **Start both servers** (backend + frontend)
2. **Open browser:** http://localhost:8080
3. **Make code changes**
4. **Backend:** Auto-restarts with nodemon
5. **Frontend:** Manually refresh browser (or use live-server)

### API Auto-Detection

The frontend automatically detects the environment:

```javascript
// frontend/main.js
let API_BASE_URL;

if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1') {
    API_BASE_URL = 'http://localhost:3000';
} else {
    API_BASE_URL = 'https://speed-test-backend.up.railway.app';
}
```

**Behavior:**
- **Local development:** Connects to `http://localhost:3000`
- **Production (Railway):** Connects to `https://speed-test-backend.up.railway.app`
- **Production (Cloudflare):** Connects to `https://speed-test-backend.up.railway.app`

### ⚠️ Important: Local Testing Limitations

**Local speed tests show unrealistic results!**

When testing against `localhost`, you'll see:
- Download/Upload: 1000+ Mbps (impossible speeds)
- Latency: <1ms (unrealistic)
- Why: Data doesn't leave your computer, bypasses all network infrastructure

**For accurate measurements:**
- Always test against production deployment
- Use Railway or Cloudflare frontend URLs
- Backend must be in Amsterdam for real international routing

---

## Configuration

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No (Railway sets automatically) |
| `NODE_ENV` | Environment mode | development | No |
| `LOG_LEVEL` | Logging level | info | No |
| `SERVER_LOCATION` | Server region label | Amsterdam, Netherlands | No |
| `CORS_ORIGIN` | Allowed CORS origins | * | No |
| `MAX_DOWNLOAD_SIZE_MB` | Max download test size | 50 | No |
| `MAX_UPLOAD_SIZE_MB` | Max upload test size | 50 | No |
| `ENABLE_RATE_LIMIT` | Enable rate limiting | true | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 | No |
| `RATE_LIMIT_MAX` | Max requests per window | 120 | No |
| `ENABLE_METRICS` | Enable Prometheus metrics | true | No |
| `MAX_INFLIGHT_REQUESTS` | Circuit breaker threshold | 100 | No |

**Setting in Railway:**
1. Go to Railway dashboard
2. Select backend service
3. Navigate to Variables tab
4. Add/edit environment variables
5. Redeploy automatically triggers

**Local Development (.env):**

Create `backend/.env`:
```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
SERVER_LOCATION=Local Development
CORS_ORIGIN=*
```

### Frontend Configuration

The frontend requires **no configuration**. API URL detection is automatic:

```javascript
// Automatic API base URL detection
window.API_BASE_URL = 
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://speed-test-backend.up.railway.app';
```

Both production frontends (Railway and Cloudflare) connect to the same Amsterdam backend.

---

## Health Checks & Monitoring

### Backend Health Checks

**Health Endpoint:**
```bash
curl https://speed-test-backend.up.railway.app/health

# Response:
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": 1701234567890
}
```

**Server Info:**
```bash
curl https://speed-test-backend.up.railway.app/api/info

# Response:
{
  "serverLocation": "Amsterdam, Netherlands",
  "maxDownloadSize": 50,
  "maxUploadSize": 50,
  "supportedTests": ["download", "upload", "ping"],
  "version": "1.62.0",
  "rateLimit": {
    "enabled": true,
    "windowMs": 60000,
    "max": 120
  }
}
```

**Prometheus Metrics:**
```bash
curl https://speed-test-backend.up.railway.app/metrics

# Returns Prometheus-formatted metrics:
# - http_requests_total
# - http_request_duration_seconds
# - http_requests_inflight
# - speedtest_download_bytes_total
# - speedtest_upload_bytes_total
```

### Frontend Health Checks

**Railway Frontend:**
```bash
curl -I https://speed-test.up.railway.app/

# Should return: 200 OK
```

**Cloudflare Frontend:**
```bash
curl -I https://speed-test-ahc.pages.dev/

# Should return: 200 OK
```

### Monitoring Dashboard

**Railway:**
- Metrics: Available in Railway dashboard
- Logs: Real-time logs in Railway service view
- Deployments: Deployment history and status

**Cloudflare:**
- Analytics: Cloudflare Pages analytics dashboard
- Edge logs: Available in Cloudflare dashboard
- Performance: Core Web Vitals tracking

---

## Troubleshooting

### Common Issues

#### Issue: Buttons Don't Respond

**Symptoms:**
- START button doesn't work
- Settings panel won't open
- No errors in console

**Solutions:**
1. Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache completely
3. Check browser console for JavaScript errors
4. Verify Lucide icons are loading (check Network tab)

---

#### Issue: Speed Tests Timeout

**Symptoms:**
- Test starts but never completes
- Gauge stuck at 0 Mbps
- "Test failed" error message

**Solutions:**
1. Check backend is running:
   ```bash
   curl https://speed-test-backend.up.railway.app/health
   ```
2. Verify CORS is enabled (should return `Access-Control-Allow-Origin: *`)
3. Check network tab for failed API requests
4. Test API directly:
   ```bash
   curl https://speed-test-backend.up.railway.app/api/info
   ```

---

#### Issue: CORS Errors

**Symptoms:**
- Console error: "blocked by CORS policy"
- API requests fail with network error
- Works locally but not in production

**Solutions:**
1. Verify backend environment variable:
   ```env
   CORS_ORIGIN=*
   ```
2. Check Railway backend logs for CORS errors
3. Ensure backend is deployed and running
4. Test with curl:
   ```bash
   curl -H "Origin: https://speed-test-ahc.pages.dev" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://speed-test-backend.up.railway.app/api/upload
   ```

---

#### Issue: Cloudflare Deployment Fails

**Symptoms:**
- `wrangler pages deploy` fails
- Authentication errors
- Project not found

**Solutions:**
1. Login again:
   ```bash
   wrangler login
   ```
2. Verify project exists:
   ```bash
   wrangler pages project list
   ```
3. Create project if missing:
   - Go to Cloudflare dashboard
   - Create Pages project: `speed-test-ahc`
4. Check wrangler.toml configuration:
   ```toml
   name = "speed-test-ahc"
   compatibility_date = "2024-01-01"
   ```

---

#### Issue: Railway Auto-Deploy Not Working

**Symptoms:**
- Push to GitHub but Railway doesn't deploy
- Old version still running
- No deployment triggered

**Solutions:**
1. Check Railway service settings:
   - Watch Paths: `backend/**` or `frontend/**`
   - Branch: `main`
2. Verify GitHub integration is connected
3. Check Railway deployment logs for errors
4. Manual trigger:
   - Railway dashboard → Service → Deployments → Deploy
5. Verify railway.json configuration:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

---

#### Issue: High Latency from Frontend to Backend

**Symptoms:**
- Slow page load times
- UI feels sluggish
- Network tab shows slow API responses

**Expected Behavior:**
- **Cloudflare → Amsterdam Backend:** 150-300ms latency (normal for Africa-Europe)
- **Railway → Amsterdam Backend:** <50ms latency (same datacenter)

**This is intentional!** The Cloudflare frontend serves UI fast (from Dar es Salaam), but speed tests intentionally connect to Amsterdam to measure real international performance.

---

#### Issue: Different Results Between Frontends

**Symptoms:**
- Railway frontend shows different speeds than Cloudflare frontend
- Inconsistent measurements

**Expected:** Results should be similar (both connect to same backend in Amsterdam)

**Possible Causes:**
1. Different network conditions at test time
2. ISP routing differences to Amsterdam
3. Network congestion

**Solutions:**
1. Run multiple tests from each frontend
2. Compare averages, not single tests
3. Test at same time of day
4. Check if ISP has different routes to Amsterdam from your location

---

### Debugging Tools

**Backend Logs (Railway):**
```bash
# View in Railway dashboard
# Or use Railway CLI:
railway logs --service backend
```

**Frontend Logs (Railway):**
```bash
railway logs --service frontend
```

**Network Debugging:**
```bash
# Test backend connectivity
curl -v https://speed-test-backend.up.railway.app/health

# Test download endpoint
curl -v https://speed-test-backend.up.railway.app/api/download?size=1

# Measure latency
ping speed-test-backend.up.railway.app

# Traceroute to Amsterdam
traceroute speed-test-backend.up.railway.app
```

**Browser DevTools:**
- Console: Check for JavaScript errors
- Network: Monitor API requests and responses
- Application: Verify Service Worker status and cache
- Performance: Profile page load and test execution

---

### Getting Help

If you encounter issues not covered here:

1. **Check logs:**
   - Railway: Service logs in dashboard
   - Browser: Console and Network tab

2. **Test backend directly:**
   ```bash
   curl https://speed-test-backend.up.railway.app/health
   curl https://speed-test-backend.up.railway.app/api/info
   ```

3. **Verify deployments:**
   - Railway: Check deployment status
   - Cloudflare: Check Pages deployment logs

4. **Create GitHub issue:**
   - Repository: https://github.com/ny-collins/internet_speed_test
   - Include: Error messages, browser console output, steps to reproduce

---

## Summary

**Deployment Checklist:**

- ✅ Backend deployed to Railway (Amsterdam)
- ✅ Frontend deployed to Railway (Amsterdam) - auto-deploys
- ✅ Frontend deployed to Cloudflare (Dar es Salaam) - manual
- ✅ Environment variables configured
- ✅ Health checks passing
- ✅ CORS enabled
- ✅ Both frontends connect to Amsterdam backend

**URLs:**
- Backend: https://speed-test-backend.up.railway.app/
- Frontend (Railway): https://speed-test.up.railway.app/
- Frontend (Cloudflare): https://speed-test-ahc.pages.dev/
- GitHub: https://github.com/ny-collins/internet_speed_test

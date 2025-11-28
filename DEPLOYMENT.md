# 🚀 SpeedCheck - Deployment Guide

## Changes Made During Restoration

### 1. Fixed Async/Await Issues in main.js
**Problem**: Dynamic imports used `.then()` callbacks causing race conditions  
**Solution**: Converted all to `async/await` pattern

**Functions Updated:**
- `startTest()` - Now properly awaits UI initialization
- `completeTest()` - Made async, awaits UI updates  
- `cleanupTest()` - Made async, awaits DOM access
- `updateHistoryUI()` - Made async, awaits chart module
- `initializeAccessibility()` - Made async, awaits DOM module

### 2. Added API Configuration
**Files Modified:**
- `frontend/index.html` - Added API_BASE_URL detection script
- `frontend/learn.html` - Added API_BASE_URL detection script

**Behavior:**
- Local (`localhost` or `127.0.0.1`): Uses `http://localhost:3000`
- Production: Falls back to `https://speed-test-backend.up.railway.app`

### 3. Removed GitHub Actions
- Deleted `.github/workflows/ci.yml` to prevent auto-deployments during debugging

---

## Deployment Instructions

### Local Testing (Already Working ✅)
```bash
# Backend (Terminal 1)
cd backend
node server.js

# Frontend (Terminal 2) 
cd frontend
node server.js

# Test at: http://localhost:8080
```

### Deploy to Railway

#### Backend Deployment
```bash
cd backend

# Link to Railway project (if not linked)
railway link

# Deploy
railway up

# Or use Railway CLI
railway service backend
railway up
```

#### Frontend Deployment (Railway)
```bash
cd frontend

# Link to Railway project
railway link

# Deploy
railway up

# Or target specific service
railway service frontend
railway up
```

### Deploy to Cloudflare Pages

```bash
cd frontend

# Deploy using Wrangler
wrangler pages deploy . --project-name=speed-test-ahc

# Or let Cloudflare auto-deploy from Git
```

**Important for Cloudflare**: The Cloudflare deployment will automatically use the Railway backend since `API_BASE_URL` is undefined on their domain (not localhost).

---

## Environment Variables

### Backend (.env)
```env
PORT=3000
NODE_ENV=development  # Change to "production" for Railway
SERVER_LOCATION=EU WEST (Amsterdam, Netherlands)
ENABLE_METRICS=true
CORS_ORIGIN=*  # Or specify: https://speed-test.up.railway.app,https://speed-test-ahc.pages.dev
```

### Frontend
No `.env` needed - API URL is auto-detected.

---

## Verification Checklist

### Before Deploying:
- [ ] Backend tests passing: `cd backend && npm test`
- [ ] Frontend tests passing: `cd frontend && npm test`
- [ ] Local speed test works end-to-end
- [ ] All console errors resolved

### After Deploying:
- [ ] Railway Backend responds: `curl https://speed-test-backend.up.railway.app/api/info`
- [ ] Railway Frontend loads: Visit https://speed-test.up.railway.app
- [ ] Cloudflare Frontend loads: Visit https://speed-test-ahc.pages.dev
- [ ] Speed test completes successfully on all deployments

---

## Rollback Plan

If deployment fails:

1. **Check Railway logs:**
   ```bash
   railway logs
   ```

2. **Check Cloudflare deployment:**
   ```bash
   wrangler pages deployment list --project-name=speed-test-ahc
   ```

3. **Revert to previous deployment:**
   - Railway: `railway rollback`
   - Cloudflare: Rollback via dashboard or redeploy previous version

---

## Current Deployment URLs

- **Railway Backend**: https://speed-test-backend.up.railway.app
- **Railway Frontend**: https://speed-test.up.railway.app
- **Cloudflare Frontend**: https://speed-test-ahc.pages.dev

---

## Monitoring

### Check Health:
```bash
# Backend health
curl https://speed-test-backend.up.railway.app/health

# API info
curl https://speed-test-backend.up.railway.app/api/info

# Test ping
curl https://speed-test-backend.up.railway.app/api/ping
```

### Metrics (if enabled):
```bash
curl https://speed-test-backend.up.railway.app/metrics
```

---

## Known Issues & Solutions

### Issue: "API_BASE_URL is not defined"
**Solution**: This is expected and correct. Production frontends use the fallback URL in `config.js`.

### Issue: CORS errors on Cloudflare
**Solution**: Verify backend `CORS_ORIGIN` includes Cloudflare domain or use `*`.

### Issue: Tests timeout
**Solution**: Check Railway backend is running and accessible. Verify rate limiting settings.

---

## Next Steps

1. ✅ Test locally - COMPLETE
2. ⏳ Deploy to Railway backend
3. ⏳ Deploy to Railway frontend  
4. ⏳ Deploy to Cloudflare Pages
5. ⏳ Verify all deployments
6. ⏳ Re-enable GitHub Actions (optional)

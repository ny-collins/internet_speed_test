# Railway Separate Services Configuration Guide

## 🏗️ Your Architecture

```
┌─────────────────────────────────────────────────┐
│         Railway Project: Refreshing upliftments │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │  Frontend Service                       │    │
│  ├────────────────────────────────────────┤    │
│  │  Repository: ny-collins/internet_speed_test  │
│  │  Root Directory: /frontend              │    │
│  │  Port: 8080                             │    │
│  │  Domain: speed-test.up.railway.app      │    │
│  │  Type: Static site                      │    │
│  └────────────────────────────────────────┘    │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │  Backend Service                        │    │
│  ├────────────────────────────────────────┤    │
│  │  Repository: ny-collins/internet_speed_test  │
│  │  Root Directory: /backend               │    │
│  │  Port: 3000                             │    │
│  │  Domain: speed-test-backend.up.railway.app  │
│  │  Type: Node.js API                      │    │
│  └────────────────────────────────────────┘    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ✅ Code Changes Applied

### Backend (`backend/server.js`)
- ✅ Removed static file serving
- ✅ Removed SPA fallback middleware
- ✅ Backend is now **API-only** - returns JSON for `/api/*` routes
- ✅ CORS configured to accept environment variable `CORS_ORIGIN`

### Frontend (`frontend/script.js`)
- ✅ Set `apiBase: 'https://speed-test-backend.up.railway.app'`
- ✅ Frontend now makes cross-origin requests to backend

### Cleanup
- ✅ Removed `railway.toml` (not needed for separate services)
- ✅ Removed `path` module import from backend

---

## 🔧 Railway Configuration Required

### **CRITICAL: Backend Environment Variables**

Go to your **Backend Service** in Railway dashboard and add:

```bash
CORS_ORIGIN=https://speed-test.up.railway.app
```

**Optional but recommended:**
```bash
NODE_ENV=production
SERVER_LOCATION=Amsterdam, Netherlands
MAX_DOWNLOAD_SIZE_MB=50
MAX_UPLOAD_SIZE_MB=50
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
ENABLE_RATE_LIMIT=true
```

### **Frontend Service Settings**

✅ **Root Directory:** `/frontend`
✅ **Build Command:** (None needed - static files)
✅ **Start Command:** (Railway auto-detects static hosting)
✅ **Port:** 8080 (or whatever Railway assigns)

### **Backend Service Settings**

✅ **Root Directory:** `/backend`
✅ **Build Command:** `npm ci`
✅ **Start Command:** `npm start`
✅ **Port:** 3000 (Express listens on PORT env var)

---

## 🧪 Testing After Deployment

### 1. Test Backend API Directly

```bash
# Test API info endpoint
curl https://speed-test-backend.up.railway.app/api/info

# Expected output (JSON):
{
  "serverLocation": "Amsterdam, Netherlands",
  "maxDownloadSize": 50,
  "maxUploadSize": 50,
  "supportedTests": ["ping", "download", "upload", "jitter"],
  "version": "1.0.3",
  "rateLimit": { "windowMs": 60000, "max": 120 }
}

# Test ping endpoint
curl https://speed-test-backend.up.railway.app/api/ping

# Expected output (JSON):
{
  "timestamp": 1234567890,
  "server": "ok"
}
```

### 2. Test Frontend

```bash
# Frontend should serve HTML
curl -I https://speed-test.up.railway.app/

# Expected:
HTTP/2 200
content-type: text/html
```

### 3. Test CORS (Most Important!)

```bash
# Simulate browser request with Origin header
curl -H "Origin: https://speed-test.up.railway.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://speed-test-backend.up.railway.app/api/info -v

# Look for in response headers:
# access-control-allow-origin: https://speed-test.up.railway.app
```

### 4. Test in Browser

1. Open https://speed-test.up.railway.app/
2. Open DevTools Console (F12)
3. Look for these messages:

**✅ Success:**
```
[App] Initializing SpeedCheck...
[DOM] All elements queried and cached
[Gauge] Using CSS-based circular progress gauge
[Server] Info fetched: { serverLocation: "...", ... }
[App] Initialization complete
```

**❌ CORS Error (means CORS_ORIGIN not set):**
```
Access to fetch at 'https://speed-test-backend.up.railway.app/api/info' 
from origin 'https://speed-test.up.railway.app' has been blocked by CORS policy
```

---

## 🚨 Common Issues & Solutions

### Issue 1: CORS Error in Browser Console

**Symptom:**
```
Access to fetch ... has been blocked by CORS policy
```

**Solution:**
1. Go to Railway Backend Service → Variables
2. Add: `CORS_ORIGIN=https://speed-test.up.railway.app`
3. Redeploy backend service

### Issue 2: API Returns 404

**Symptom:**
```
[Server] Failed to fetch info: 404 Not Found
```

**Solution:**
- Verify backend is running: Check Railway backend logs
- Verify backend URL is correct in frontend code
- Test backend URL directly with curl

### Issue 3: Frontend Shows Blank Page

**Symptom:**
White screen, no content

**Solution:**
1. Check Railway frontend logs for errors
2. Verify `/frontend` directory has `index.html`
3. Check Railway frontend root directory setting

### Issue 4: Backend Crashes on Start

**Symptom:**
Railway backend service keeps restarting

**Solution:**
1. Check Railway backend logs for error messages
2. Verify `backend/package.json` has correct start script
3. Verify all dependencies are in `package.json`
4. Check Railway backend root directory is `/backend`

---

## 📊 Deployment Flow

### When you push to GitHub:

```
GitHub Push
    ↓
Railway Detects Change
    ↓
┌───────────────────┬───────────────────┐
│  Frontend Service │  Backend Service  │
│                   │                   │
│  1. Pull repo     │  1. Pull repo     │
│  2. Read /frontend│  2. Read /backend │
│  3. Serve static  │  3. npm ci        │
│     files         │  4. npm start     │
│  4. Deploy to     │  5. Deploy to     │
│     port 8080     │     port 3000     │
└───────────────────┴───────────────────┘
    ↓                       ↓
    Frontend URL            Backend URL
    (Users visit)           (API calls)
```

---

## 🎯 Benefits of This Setup

### ✅ **Flexibility**
- Update frontend without touching backend
- Update backend without frontend redeploy
- Different deployment schedules

### ✅ **Scaling**
- Scale frontend and backend independently
- Frontend can be CDN-cached
- Backend can handle more resources

### ✅ **Development**
- Separate concerns
- Easier debugging
- Clear boundaries

### ✅ **Cost Efficiency**
- Frontend uses static hosting (cheap)
- Backend only runs when needed
- Can optimize each service separately

---

## 🔍 Monitoring

### Frontend Service
- Check Railway logs for static file serving errors
- Monitor domain SSL certificate
- Check for 404s on static assets

### Backend Service
- Monitor API response times
- Check error logs for crashes
- Monitor memory/CPU usage
- Watch rate limit hits

---

## 📝 Quick Checklist

Before declaring success, verify:

- [ ] Backend service has `CORS_ORIGIN` environment variable set
- [ ] Frontend service deploys successfully from `/frontend` directory
- [ ] Backend service deploys successfully from `/backend` directory
- [ ] `curl https://speed-test-backend.up.railway.app/api/info` returns JSON
- [ ] `curl https://speed-test.up.railway.app/` returns HTML
- [ ] Browser console shows `[Server] Info fetched: {...}` (not "Failed to fetch")
- [ ] Speed test runs without errors
- [ ] No CORS errors in browser console

---

## 🚀 Next Steps

1. **Push the changes** (already done! ✅)
2. **Wait for Railway to deploy both services** (2-3 minutes each)
3. **Set CORS_ORIGIN** in backend Railway service
4. **Test the API endpoint** with curl
5. **Test in browser** and check console

---

## 💡 Pro Tips

### Use Environment Variables for Flexibility

In `frontend/script.js`, you could also use:
```javascript
apiBase: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://speed-test-backend.up.railway.app'
```

This allows local development without changing code!

### Monitor Both Services

Set up Railway notifications for:
- Deployment failures
- Service crashes
- High resource usage

### Keep Dependencies Minimal

Backend dependencies:
- Only API-related packages
- No frontend build tools

Frontend:
- Pure static files
- No build process needed
- Faster deployments

---

**Status:** Configuration complete! ✅  
**Action Required:** Set `CORS_ORIGIN` environment variable in Railway backend service  
**ETA:** Both services will redeploy in 2-3 minutes after push

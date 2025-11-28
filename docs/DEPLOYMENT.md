# 🚀 SpeedCheck - Deployment Guide

## Quick Deploy

**Automatic (GitHub → Railway):**
```bash
git push  # Auto-deploys both backend and frontend to Railway
```

**Manual (Cloudflare Pages):**
```bash
cd frontend
wrangler pages deploy . --project-name=speed-test
```

**Or use the deploy script:**
```bash
./deploy.sh
```

---

## Local Development

```bash
# Backend (Terminal 1)
cd backend
npm start

# Frontend (Terminal 2)
cd frontend
npm start

# Open: http://localhost:8080
```

The frontend auto-detects localhost and connects to `http://localhost:3000`.

---

## Configuration

### Backend Environment Variables

Railway automatically sets `PORT` and `NODE_ENV`. Additional variables in `backend/.env`:

```env
SERVER_LOCATION=EU WEST (Amsterdam, Netherlands)
ENABLE_METRICS=true
CORS_ORIGIN=*
MAX_DOWNLOAD_SIZE_MB=50
MAX_UPLOAD_SIZE_MB=50
```

### Frontend

No configuration needed. API URL auto-detects:
- Local: `http://localhost:3000`
- Production: `https://speed-test-backend.up.railway.app`

---

## Deployment URLs

- **Backend**: https://speed-test-backend.up.railway.app
- **Frontend (Railway)**: https://speed-test.up.railway.app
- **Frontend (Cloudflare)**: https://speed-test-ahc.pages.dev

## Health Checks

```bash
# Backend
curl https://speed-test-backend.up.railway.app/health
curl https://speed-test-backend.up.railway.app/api/info

# Frontends
curl -I https://speed-test.up.railway.app/
curl -I https://speed-test-ahc.pages.dev/
```

## Troubleshooting

**Issue**: Buttons don't respond  
**Solution**: Clear browser cache or hard refresh (Ctrl+Shift+R)

**Issue**: Tests timeout  
**Solution**: Check backend is running: `curl https://speed-test-backend.up.railway.app/health`

**Issue**: CORS errors  
**Solution**: Verify `CORS_ORIGIN=*` in Railway backend environment variables

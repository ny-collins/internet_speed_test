# Railway Backend Deployment Checklist

## Environment Variables Required

Set these in your Railway project dashboard:

```env
NODE_ENV=production
CORS_ORIGIN=*
SERVER_LOCATION=Railway EU-West (Amsterdam, Netherlands)
MAX_DOWNLOAD_SIZE_MB=50
MAX_UPLOAD_SIZE_MB=50
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
ENABLE_METRICS=true
LOG_LEVEL=info
MAX_INFLIGHT_REQUESTS=100
```

## Critical: CORS Configuration

**⚠️ IMPORTANT:** Railway must have `CORS_ORIGIN=*` set to allow requests from:
- Cloudflare Pages frontend
- Railway frontend
- Local development

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Railway Auto-Deploy**
   - Railway watches the `main` branch
   - Builds from `/backend` directory
   - Uses `npm start` command

3. **Verify Deployment**
   ```bash
   curl https://speed-test-backend.up.railway.app/health
   curl https://speed-test-backend.up.railway.app/api/info
   ```

4. **Check Logs**
   - Go to Railway dashboard
   - View deployment logs
   - Look for: "Speed test server running on port XXXX"

## Common Issues

### 500 Error on /api/info
**Cause:** Missing environment variables or config validation failure
**Fix:** Ensure all required env vars are set in Railway dashboard

### CORS Error
**Cause:** `CORS_ORIGIN` not set or restrictive
**Fix:** Set `CORS_ORIGIN=*` in Railway environment variables

### Module Not Found
**Cause:** `package.json` dependencies not installed
**Fix:** Railway should run `npm install` automatically. Check build logs.

## Testing Backend

```bash
# Health check
curl https://speed-test-backend.up.railway.app/health

# Server info
curl https://speed-test-backend.up.railway.app/api/info

# Test connection
curl https://speed-test-backend.up.railway.app/api/test

# Metrics (if enabled)
curl https://speed-test-backend.up.railway.app/metrics
```

## Performance Monitoring

- **Metrics**: Available at `/metrics` (Prometheus format)
- **Logs**: Use Railway dashboard or `railway logs`
- **Health**: Monitor `/health` endpoint for uptime

## Production Best Practices

✅ Set `NODE_ENV=production`
✅ Enable rate limiting (`ENABLE_RATE_LIMIT=true`)
✅ Use `CORS_ORIGIN=*` for public API
✅ Enable metrics (`ENABLE_METRICS=true`)
✅ Set appropriate `LOG_LEVEL` (info or warn in production)
✅ Configure restart policy in `railway.json`

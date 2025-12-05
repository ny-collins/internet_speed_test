# Deployment Guide

## Frontend Configuration

### Environment Variables

The frontend server requires the following environment variable:

**`API_URL`** (Required for production)
- **Purpose**: Backend API endpoint URL for CSP `connect-src` directive
- **Default**: `https://speed-test-backend.up.railway.app`
- **Local Dev**: `http://localhost:3000`
- **Staging**: Your staging backend URL

**Example `.env` file:**
```bash
PORT=8080
API_URL=https://your-backend.example.com
```

### Why This Matters

The Content Security Policy (CSP) restricts which domains the browser can make API calls to. Without the correct `API_URL`:
- The app will fail to fetch server info
- Speed tests will be blocked by CSP violations
- Users will see "Finding optimal server..." indefinitely

### Deployment Platforms

#### Railway (Auto-Deploy)
1. Set environment variable in Railway dashboard:
   - Variable: `API_URL`
   - Value: Your backend URL (e.g., `https://speed-test-backend.up.railway.app`)

2. Railway will automatically:
   - Build the frontend
   - Inject the environment variable at runtime
   - Deploy with correct CSP

#### Cloudflare Pages (Manual Deploy, Nairobi, Kenya)
1. Build locally with the correct API_URL:
   ```bash
   export API_URL=https://your-backend.example.com
   npm run build:css
   npm run build
   ```

2. Deploy:
   ```bash
   cd frontend
   wrangler pages deploy public --project-name=speed-test
   ```

**Note**: Cloudflare Pages is static-only, so CSP is set via `_headers` file instead of server.js. Update `frontend/public/_headers` with your backend URL.

## Backend Configuration

### Environment Variables

See `backend/.env.example` for all available options.

**Key variables:**
- `PORT`: Server port (default: 3000)
- `MAX_DOWNLOAD_SIZE_MB`: Maximum download test size
- `MAX_UPLOAD_SIZE_MB`: Maximum upload test size
- `MAX_INFLIGHT_REQUESTS`: Circuit breaker limit (per replica)
- `SERVER_LOCATION`: Display name for server location

### Horizontal Scaling Note

The circuit breaker (`MAX_INFLIGHT_REQUESTS`) is **per-instance**. If you deploy 3 replicas with a limit of 100, the effective total is 300 concurrent requests.

For true distributed rate limiting, use Redis or a shared state service.

## Testing Deployment

After deploying both frontend and backend:

1. **Open browser console** (F12)
2. **Check for CSP errors**:
   - Should see no `Content-Security-Policy` violations
   - Network tab should show successful API calls

3. **Verify server info**:
   - Text should update from "Finding optimal server..." to your actual server location
   - If it doesn't, check `API_URL` environment variable

4. **Run a test**:
   - Click "START" button
   - Should see gauge update with real speeds
   - Check mini-graphs appear in download/upload cards

## Troubleshooting

### "Finding optimal server..." never updates
- **Cause**: CSP blocking API calls or incorrect `API_URL`
- **Fix**: Check browser console for CSP errors, verify `API_URL` matches backend

### Start button not clickable
- **Cause**: JavaScript initialization failed
- **Fix**: Check browser console for errors, ensure `splitLayout` element exists

### Tests fail immediately
- **Cause**: Backend unreachable or CORS issues
- **Fix**: Verify backend is running, check CORS settings in `backend/server.js`

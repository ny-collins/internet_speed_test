# 🚨 URGENT: Railway Backend CORS Configuration Required

## Problem
The backend is returning 500 errors when accessed from the frontend because the `CORS_ORIGIN` environment variable is not set in Railway.

## Immediate Fix Required

### Go to Railway Dashboard:
1. Navigate to: https://railway.app/dashboard
2. Select your **backend** project/service
3. Go to **Variables** tab
4. Add this environment variable:

```
CORS_ORIGIN=*
```

### Why This is Needed:
- Without `CORS_ORIGIN` set, the backend defaults to checking allowed origins
- When an origin is provided, it tries to validate against an undefined list
- This causes a 500 error and blocks all frontend requests

## Verification After Setting:

Test with curl:
```bash
curl -H "Origin: https://speed-test.up.railway.app" https://speed-test-backend.up.railway.app/api/info
```

Should return:
- Status: `200 OK`
- Header: `access-control-allow-origin: *`
- JSON response with server info

## Alternative: Specific Origins

If you want to restrict origins instead of allowing all, set:
```
CORS_ORIGIN=https://speed-test.up.railway.app,https://speed-test-ahc.pages.dev
```

(Comma-separated list of allowed origins)

## Current Issue:
✅ Backend code is correct
✅ CORS middleware is configured
❌ Railway environment variable is missing
❌ Frontend cannot communicate with backend

## Priority: CRITICAL
Without this, your application is completely non-functional.

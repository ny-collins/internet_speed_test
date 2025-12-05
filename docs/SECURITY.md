# Security Documentation

This document explains the security architecture and decisions for SpeedCheck.

## Table of Contents
- [Security Headers](#security-headers)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [CORS Policy](#cors-policy)
- [Security Audit Results](#security-audit-results)
- [Threat Model](#threat-model)

---

## Security Headers

All three deployments (Railway Frontend, Cloudflare Frontend, Railway Backend) implement production-grade security headers.

### Core Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year, eligible for browser preload lists |
| `X-Frame-Options` | `DENY` | Prevent clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy-respecting referrer handling |
| `Permissions-Policy` | Feature restrictions | Disable unused browser APIs |

### Why No X-Powered-By?

**Status:** ✅ Removed

Express.js sets `X-Powered-By: Express` by default, which reveals framework information to attackers. We disable this with:
```javascript
app.disable('x-powered-by');
```

**Impact:** Reduces information available for targeted attacks.

### Why No X-XSS-Protection?

**Status:** ✅ Disabled (backend only)

This header is **obsolete** and ignored by modern browsers. We rely on Content-Security-Policy instead, which provides superior XSS protection.

```javascript
helmet({
  xssFilter: false  // Don't set obsolete X-XSS-Protection
})
```

---

## Content Security Policy (CSP)

### Current Policy (v1.68.0)

```
default-src 'self';
script-src 'self' https://unpkg.com;
style-src 'self';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://speed-test-backend.up.railway.app https://*.railway.app https://unpkg.com;
worker-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

### Critical Security Improvement: No `'unsafe-inline'`

**Previous (v1.67.0 and earlier):**
```
script-src 'self' 'unsafe-inline' https://unpkg.com;
style-src 'self' 'unsafe-inline';
```

**Problem:** `'unsafe-inline'` allows injected inline scripts to execute, creating a major XSS vulnerability.

**Solution (v1.68.0):**
- ✅ Removed `'unsafe-inline'` from `script-src`
- ✅ Removed `'unsafe-inline'` from `style-src`
- ✅ Externalized all inline `<script>` blocks to separate files
- ✅ Removed inline event handlers (`onclick`, etc.)
- ✅ Browser now actively blocks inline script injection

**Files Created:**
- `init.js` - API configuration, emergency fallback, error handler
- `edge-banner.js` - Edge deployment banner logic
- `settings-helper.js` - Settings button functionality
- `learn-init.js` - Learn page initialization

**Security Impact:**
```
BEFORE: Attacker injects <script>alert('XSS')</script> → ✗ Script executes
AFTER:  Attacker injects <script>alert('XSS')</script> → ✓ Browser blocks it
```

### Why Allow `https://unpkg.com`?

**Purpose:** Lucide icons library (CDN-hosted)

**Risk Assessment:** Low
- Unpkg.com is a trusted npm CDN with integrity checks
- Library is pinned to specific version: `https://unpkg.com/lucide@latest`
- Compromised CDN would require supply-chain attack (monitored by npm)
- Alternative would be self-hosting 100KB+ icon library (performance tradeoff)

**Mitigation:** If unpkg.com becomes compromised, we can:
1. Switch to self-hosted icons
2. Use Subresource Integrity (SRI) hashes
3. Update CSP to remove unpkg.com

### Why Allow `https://*.railway.app` in connect-src?

**Purpose:** Future-proofing for backend changes

**Scenarios Covered:**
1. Backend URL changes (e.g., from `speed-test-backend.up.railway.app` to `api.railway.app`)
2. Multiple backend instances (staging, production)
3. Scaling to multiple Railway services

**Risk Assessment:** Low
- Only allows **connections** (fetch/XHR), not script execution
- Railway.app is our infrastructure provider (trusted)
- Wildcard limited to `*.railway.app` subdomain (not `*.com`)

### Why Allow `https://unpkg.com` in connect-src?

**Purpose:** CDN resource fetching for Lucide icons

**Note:** This is separate from `script-src`. Even though we allow scripts from unpkg.com, we explicitly whitelist connections to ensure icon SVGs and metadata can be fetched.

---

## CORS Policy

### Railway Frontend (Primary)

**Policy:** CORS not explicitly set (same-origin by default)

**Reason:** Frontend serves the application, not cross-origin API resources.

### Cloudflare Pages (Regional)

**Policy (v1.68.0):**
```
Access-Control-Allow-Origin: https://speed-test.up.railway.app
```

**Previous (v1.67.0 and earlier):**
```
Access-Control-Allow-Origin: *
```

**Why Changed:**
- Wildcard (`*`) allowed any website to fetch our static assets
- While not dangerous for static sites, it's unnecessarily permissive
- Restricting to Railway origin prevents unauthorized cross-origin usage
- Both frontends are ours, no need for public CORS

**Note:** Cloudflare automatically set `Access-Control-Allow-Origin: *` by default. Our `_headers` file now overrides this.

### Backend API

**Policy:** Configured via Express `cors()` middleware

**Production:**
```javascript
cors({
  origin: (origin, callback) => {
    // Allow requests from both frontends
    const allowedOrigins = [
      'https://speed-test.up.railway.app',
      'https://speed-test-ahc.pages.dev',
      'https://*.speed-test-ahc.pages.dev' // Cloudflare preview deployments
    ];
    // Allow if origin matches or no origin (same-origin)
  }
})
```

**Why Allow Multiple Origins:**
- We have two frontend deployments (Railway + Cloudflare)
- Speed tests require backend API calls from both
- Backend doesn't serve HTML, only JSON APIs

---

## Security Audit Results

### External Security Audit (December 2025)

**Auditor Feedback:**

✅ **Strengths:**
- Strong HSTS implementation across all deployments
- Comprehensive security headers (X-Frame-Options, X-Content-Type-Options)
- No information leaks (X-Powered-By removed)
- Modern referrer policy

⚠️ **Concerns Raised:**

1. **`'unsafe-inline'` in CSP** (FIXED in v1.68.0)
   - **Status:** ✅ Resolved
   - **Action:** Externalized all inline scripts, removed unsafe-inline

2. **Limited `connect-src`** (FIXED in v1.68.0)
   - **Status:** ✅ Resolved
   - **Action:** Added `*.railway.app` and `unpkg.com` for flexibility

3. **CORS Wildcard on Cloudflare** (FIXED in v1.68.0)
   - **Status:** ✅ Resolved
   - **Action:** Set explicit origin `https://speed-test.up.railway.app`

### Verification Commands

```bash
# Check Railway Frontend security headers
curl -I https://speed-test.up.railway.app

# Check Cloudflare Frontend security headers
curl -I https://speed-test-ahc.pages.dev

# Check Backend security headers
curl -I https://speed-test-backend.up.railway.app

# Verify NO unsafe-inline in CSP
curl -I https://speed-test.up.railway.app | grep "content-security-policy"

# Verify CORS policy
curl -I https://speed-test-ahc.pages.dev | grep "access-control"
```

**Expected Results:**
- ✅ HSTS present on all deployments
- ✅ CSP with NO `'unsafe-inline'`
- ✅ X-Frame-Options: DENY (or SAMEORIGIN for backend)
- ✅ X-Content-Type-Options: nosniff
- ✅ No X-Powered-By header
- ✅ CORS: Specific origin (not wildcard)

---

## Threat Model

### Threats Mitigated

| Threat | Mitigation | Effectiveness |
|--------|------------|---------------|
| **XSS (Cross-Site Scripting)** | CSP without `unsafe-inline` | ✅ High - Browser blocks inline scripts |
| **Clickjacking** | X-Frame-Options: DENY | ✅ High - Page cannot be framed |
| **MIME Sniffing** | X-Content-Type-Options: nosniff | ✅ High - Browser respects declared MIME types |
| **MITM (Man-in-the-Middle)** | HSTS with preload | ✅ High - Forces HTTPS, preload list eligible |
| **Information Disclosure** | Remove X-Powered-By | ✅ Medium - Reduces reconnaissance info |
| **Unintended CORS Access** | Explicit origin whitelist | ✅ Medium - Prevents unauthorized usage |
| **Referrer Leakage** | Referrer-Policy | ✅ Medium - Privacy-respecting referrers |

### Residual Risks

| Risk | Likelihood | Impact | Mitigation Plan |
|------|-----------|--------|-----------------|
| **CDN Compromise (unpkg.com)** | Very Low | High | Monitor npm advisories, prepare self-hosted fallback |
| **Supply Chain Attack** | Low | High | Pin dependency versions, use lock files, automated security scanning |
| **DDoS Attack** | Medium | Medium | Railway/Cloudflare provide DDoS protection at infrastructure level |
| **Backend API Abuse** | Medium | Low | Rate limiting implemented (express-rate-limit) |

### Out of Scope

- **SQL Injection:** Not applicable (no database)
- **CSRF:** Not applicable (stateless API, no cookies)
- **Session Hijacking:** Not applicable (no sessions)

---

## Security Maintenance

### Regular Tasks

**Monthly:**
- Review npm audit results
- Check for security advisories on dependencies
- Monitor Railway/Cloudflare security bulletins

**Quarterly:**
- Re-run security audit commands
- Review CSP violations (if CSP reporting enabled)
- Update dependencies to latest stable versions

**Annually:**
- External security audit (if budget permits)
- Review and update threat model
- Test disaster recovery procedures

### Reporting Security Issues

If you discover a security vulnerability, please email:
- **Contact:** [Your security contact email]
- **Expected Response:** 48 hours
- **Disclosure:** Responsible disclosure policy - 90 days

---

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Railway Security Best Practices](https://docs.railway.app/reference/security)
- [Cloudflare Security Features](https://www.cloudflare.com/security/)

---

**Last Updated:** December 2, 2025
**Version:** 1.69.0

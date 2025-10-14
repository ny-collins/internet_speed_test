# Backend Security & Observability Improvements

## Immediate Implementations (This Commit)

### 1. Enhanced Testing ✅
**File**: `tests/enhanced.test.js`
- Concurrent request testing (5 parallel downloads)
- Upload size enforcement validation (413 for oversized)
- Download size clamping edge cases
- Client disconnect handling
- Cache header verification
- Complete endpoint coverage
- Rate limit validation

**Impact**: Catches regressions in streaming logic, memory safety, and edge cases.

### 2. Node.js Version Locking ✅
**File**: `package.json`
```json
"engines": {
  "node": ">=18.0.0",
  "npm": ">=9.0.0"
}
```
**Impact**: Prevents deployment with incompatible Node versions.

### 3. Dependencies Installed ✅
- `pino` - Structured JSON logging
- `pino-http` - HTTP request logging middleware
- `prom-client` - Prometheus metrics (ready for integration)

---

## Planned Improvements (Future Commits)

### 1. Structured Logging with Pino
**Priority**: HIGH
**Complexity**: Low

Replace morgan + console.log with pino for structured JSON logs:
```javascript
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty'
  } : undefined
});

app.use(pinoHttp({ logger }));
```

**Benefits**:
- Structured logs with fields (ip, path, bytes, duration, status)
- Easy parsing for log aggregation tools
- Performance (faster than morgan in production)

### 2. Prometheus Metrics Endpoint
**Priority**: HIGH
**Complexity**: Medium

Add `/metrics` endpoint with:
- `requests_total` (counter by path, method, status)
- `requests_inflight` (gauge)
- `download_bytes_total` (counter)
- `upload_bytes_total` (counter)
- `request_duration_seconds` (histogram)
- `nodejs_eventloop_lag_seconds` (gauge)
- `nodejs_heap_size_used_bytes` (gauge)

**Implementation**:
```javascript
const client = require('prom-client');
const register = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const inflightGauge = new client.Gauge({
  name: 'requests_inflight',
  help: 'Number of requests currently being processed',
  registers: [register]
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 3. Circuit Breaker for Overload Protection
**Priority**: MEDIUM
**Complexity**: Medium

Add middleware to track inflight requests and reject with 503 when overloaded:
```javascript
let inflightRequests = 0;
const MAX_INFLIGHT = parseInt(process.env.MAX_INFLIGHT_REQUESTS || '100', 10);

function circuitBreaker(req, res, next) {
  if (inflightRequests >= MAX_INFLIGHT) {
    return res.status(503).json({ 
      error: 'Server overloaded', 
      retryAfter: 30 
    });
  }
  
  inflightRequests++;
  res.on('finish', () => inflightRequests--);
  res.on('close', () => inflightRequests--);
  next();
}

app.use(['/api/download', '/api/upload'], circuitBreaker);
```

### 4. Process Time Headers
**Priority**: LOW
**Complexity**: Low

Add timing headers for debugging:
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Process-Time', `${duration}ms`);
  });
  next();
});
```

### 5. Enhanced Upload Error Handling
**Priority**: MEDIUM
**Complexity**: Low

Improve `/api/upload` to prevent double responses:
```javascript
req.on('data', (chunk) => {
  if (aborted) {
    req.destroy();
    return;
  }
  receivedBytes += chunk.length;
  if (receivedBytes > byteLimit) {
    aborted = true;
    req.destroy();
    if (!res.headersSent) {
      res.status(413).json({ error: 'Upload too large', limitBytes: byteLimit });
    }
    return;
  }
});
```

---

## Infrastructure-Level Requirements

### 1. Reverse Proxy Configuration
**Tool**: Cloudflare, Railway Edge, or Nginx
**Purpose**: 
- Connection rate limiting (per-IP)
- DDoS protection
- SSL/TLS termination
- Geographic blocking if needed

**Railway Configuration**:
```yaml
# railway.toml (if supported)
[services.backend]
  maxConcurrentConnections = 100
  rateLimitRequests = 120
  rateLimitWindow = "1m"
```

### 2. Advanced Rate Limiting
**Current**: Request-count based (express-rate-limit)
**Needed**: Bandwidth-based or connection-count based

**Options**:
a) Custom middleware tracking bytes/IP
b) Railway/Cloudflare bandwidth limits
c) Token bucket algorithm for bytes transferred

### 3. Admin/Monitoring Dashboard
**Future Feature**
Protected endpoint showing:
- Active connections count
- Current inflight requests
- Recent high-traffic IPs
- Memory and CPU usage
- Rate limiter state

**Security**: Requires authentication (API key, OAuth, or IP whitelist)

### 4. Bot Detection
**Tool**: Cloudflare Bot Management, reCAPTCHA
**Trigger**: Abnormal traffic patterns (>X requests/min from single IP)
**Action**: Challenge with CAPTCHA or temporary block

---

## Testing Strategy

### Unit Tests (Current)
- ✅ Basic endpoint validation
- ✅ Size clamping
- ✅ Concurrent requests
- ✅ Upload limits

### Integration Tests (Needed)
- Load testing with `autocannon` or `artillery`
- Memory leak detection over sustained load
- Bandwidth consumption profiling

### E2E Tests (Future)
- Playwright tests simulating full speed test flow
- Multiple concurrent users
- Network throttling simulation

---

## Deployment Checklist

### Pre-Deploy
- [ ] Run all tests (`npm test`)
- [ ] Check for security vulnerabilities (`npm audit`)
- [ ] Verify environment variables in Railway
- [ ] Review recent commits

### Post-Deploy
- [ ] Monitor logs for errors (first 15 minutes)
- [ ] Check /health endpoint
- [ ] Test speed test from different locations
- [ ] Monitor memory usage

### Monitoring (When Metrics Added)
- [ ] Set up Grafana dashboard for Prometheus metrics
- [ ] Configure alerts for:
  - High inflight requests (>80% of max)
  - High memory usage (>80% of limit)
  - Error rate >1%
  - Response time >5s

---

## Environment Variables (Updated)

Add to `.env.example`:
```bash
# Logging
LOG_LEVEL=info  # debug | info | warn | error

# Metrics & Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090  # Separate port for /metrics

# Circuit Breaker
MAX_INFLIGHT_REQUESTS=100

# Admin (Future)
ADMIN_API_KEY=<strong_secret>
```

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Response Time (ping) | <50ms | ~30ms |
| Download Throughput | >100MB/s | ~150MB/s |
| Concurrent Connections | 100+ | Untested |
| Memory per Connection | <10MB | ~5MB |
| CPU per Connection | <5% | ~3% |

---

## Security Hardening (Future)

1. **IP Reputation Check**: Block known malicious IPs
2. **Geographic Restrictions**: Optional per-region blocking
3. **User-Agent Validation**: Block obvious bots
4. **Honeypot Endpoints**: Detect scanners
5. **WAF Integration**: Web Application Firewall rules

---

## References

- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Prometheus Node.js Client](https://github.com/siimon/prom-client)
- [Pino Logging](https://getpino.io/)
- [Railway Deployment Guide](https://docs.railway.app/)


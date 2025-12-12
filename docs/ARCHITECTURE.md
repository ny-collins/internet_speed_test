# SpeedCheck Architecture

Complete system architecture and component interactions for SpeedCheck internet speed test application.

**Last Updated:** December 12, 2025

---

## System Overview

### Distributed Architecture

```
┌────────────────────┬─────────────────┐
│   Nairobi (CFP)    │  Amsterdam (RW) │
│   Frontend Edge    │  Frontend + API │
└────────┬───────────┴────────┬────────┘
         │                    │
         └────────────────────┘
              Backend API
         Amsterdam (Railway)
```

**Three-Service Deployment:**

1. **Backend API** (Amsterdam, Railway)
   - Single source for speed measurements
   - Express.js with pre-generated buffers
   - Endpoints: /api/download, /api/upload, /api/ping, /api/info

2. **Frontend Primary** (Amsterdam, Railway)
   - Express static server with 404 handling
   - Co-located with backend for minimal latency
   - PWA support with custom service worker

3. **Frontend Regional** (Nairobi, Cloudflare Pages)
   - CDN edge delivery for African users
   - Static hosting on Cloudflare network
   - 3× faster page load vs Amsterdam

**Why Two Frontends?**
- UI delivery separated from measurement logic
- Fast page loads from local edge
- Consistent measurements to Amsterdam backend
- 14ms vs 180ms TTFB for African users

---

## Test Flow

### Complete Sequence (~25 seconds)

```
1. Initialization
   └─ Fetch /api/info (server location, limits)

2. Latency Test (3s)
   ├─ POST /api/ping-batch (10 measurements)
   └─ Calculate avg/min/max

3. Jitter Test (0.8s)
   └─ Standard deviation of latency samples

4. Download Test (10s)
   ├─ 4 parallel threads × GET /api/download?size=50MB
   ├─ Monitor bytes/100ms
   └─ Calculate: (totalBytes × 8) / 10s / 1M = Mbps

5. Upload Test (10s)
   ├─ 4 parallel threads × POST /api/upload
   ├─ Track xhr.upload.onprogress
   └─ Calculate: (totalBytes × 8) / 10s / 1M = Mbps
```

### Fixed-Duration Testing (v1.60.0+)

**Philosophy:** Measure data transferred in 10 seconds, not time to transfer fixed data.

**Benefits:**
- Consistent 10s duration (was 60+ seconds)
- No UI freezing
- Measures current network capacity
- Simpler, more maintainable code

---

## Measurement Components

### 1. Latency (Ping)

```
POST /api/ping-batch { count: 10 }
→ Server responds with 10 timestamped measurements
→ Calculate RTT: responseTime - requestTime
→ Statistics: avg, min, max
```

### 2. Jitter

```
σ = √(Σ(sample - μ)² / n)
```
- Low (<10ms): Stable connection
- Medium (10-50ms): Some variation
- High (>50ms): Unstable

### 3. Download Speed

**Multi-threaded Process:**
```javascript
4 threads × fetch /api/download?size=50
→ ReadableStream processing
→ Count bytes every 100ms
→ Stop at 10s
→ Speed = (totalBytes × 8) / 10 / 1M Mbps
```

**Why 4 threads?** Modern connections need multiple streams to saturate bandwidth.

### 4. Upload Speed

**XMLHttpRequest with Progress:**
```javascript
4 threads × XHR POST 10MB blob
→ Track xhr.upload.onprogress
→ Count bytes every 100ms
→ Stop at 10s
→ Speed = (totalBytes × 8) / 10 / 1M Mbps
```

**Why XHR not fetch?** `XMLHttpRequest.upload.onprogress` enables accurate upload tracking.

### 5. TCP Slow Start Compensation (v1.65.0)

**Problem:** TCP starts slow and ramps up, artificially inflating results.

**Solution:** Byte tracking during 2-second warm-up:
```javascript
warmupBytes = bytesAt2000ms
postWarmupBytes = totalBytes - warmupBytes
effectiveDuration = totalDuration - 2.0s
speed = (postWarmupBytes × 8) / effectiveDuration / 1M
```

### 6. Bufferbloat Detection (v1.65.0)

**Loaded Latency Measurement:**
```javascript
// Concurrent pings during download/upload
while (testRunning) {
  ping /api/ping
  measure RTT under load
  await 500ms
}
→ Compare idle vs loaded latency
→ Detect router buffer congestion
```

---

## Web Workers Architecture

### Problem Solved

Heavy download/upload processing blocked main thread:
- Frozen UI during tests
- Unable to cancel mid-test
- Poor experience on slower devices

### Solution

```
Main Thread (UI)              Workers (Computation)
├─ User interactions         ├─ download-worker.js
├─ Gauge updates             ├─ upload-worker.js
├─ Test orchestration        └─ Byte counting
└─ Message handling
```

**Communication:**
```javascript
// Main → Worker
worker.postMessage({ action: 'start', config: {...} })

// Worker → Main
worker.postMessage({ type: 'progress', speed: 8.39 })
```

**Benefits:**
- UI remains responsive (60fps)
- Real-time progress updates
- Instant test cancellation
- Smooth animations

---

## UI Architecture

### Main Page Layout

**Desktop (>768px):**
```
┌───────────┬───────────────────┐
│   Gauge   │  Results Grid 2×2 │
│  (45fr)   │      (55fr)       │
│           ├─────────┬─────────┤
│  START    │Download │ Upload  │
│  Button   │+ Graph  │+ Graph  │
│  360px    ├─────────┴─────────┤
│           │ Ping    │ Jitter  │
│           │ (inline)│ (inline)│
└───────────┴───────────────────┘
```

**Mobile (≤768px):** Stacked layout with gauge on top.

**Components:**
- **Gauge Section:** Circular 360px button with live speed value
- **Speed Cards:** Download/Upload with mini-graphs (prominent)
- **Secondary Metrics:** Ping/Jitter inline display (compact)
- **Variance Graph:** Real-time canvas with bufferbloat indicator

### Learn Center

**Article Layout with Sticky Sidebar:**
```
Desktop (>1024px):
┌──────────┬───────────────┐
│ Sidebar  │    Article    │
│ (280px)  │  (max 800px)  │
│ sticky   │               │
└──────────┴───────────────┘

Mobile (≤1024px): Sidebar moves to bottom
```

**Features:**
- 6 educational articles (5-10 min reads)
- Auto-generated TOC from headings
- Reading time estimates
- Prev/Next navigation cards
- Breadcrumb trail

---

## Progressive Web App (PWA)

### Service Worker Lifecycle

```
1. Installation
   └─ Cache assets (HTML, CSS, JS, icons)

2. Activation
   ├─ Delete old caches
   └─ Take control of clients

3. Fetch Interception
   ├─ Cache first (offline support)
   └─ Network fallback for APIs
```

### Update Mechanism

- Automatic checks every 60s
- Update banner with "Update Now" button
- Background install, user-triggered activation
- Page reload after update

---

## API Endpoints

### GET /api/info
Server information and configuration.

**Response:**
```json
{
  "name": "SpeedCheck Speed Test Server",
  "location": "EU WEST (Amsterdam, Netherlands)",
  "maxDownloadSize": 50,
  "maxUploadSize": 20,
  "version": "1.69.1"
}
```

### POST /api/ping-batch
Batch latency measurement (10 pings).

**Request:** `{ "count": 10 }`

### GET /api/download
Stream random data for download test.

**Params:** `?size=50&chunk=512&t=timestamp`

### POST /api/upload
Receive upload data for speed test.

**Body:** Binary data (application/octet-stream)

---

## Configuration

### Frontend (config.js)

```javascript
{
  apiBase: 'https://speed-test-backend.up.railway.app',
  threads: { download: 4, upload: 4 },
  duration: { 
    download: { max: 20, min: 8, default: 10 },
    upload: { max: 20, min: 8, default: 10 }
  },
  uploadSize: 20,      // MB
  downloadSize: 50,    // MB
  updateInterval: 100, // ms (auto-adjusts)
  stability: {
    varianceThreshold: 0.30  // 30%
  },
  warmupDuration: 2.0  // seconds
}
```

### Backend (config/index.js)

```javascript
{
  port: 3000,
  maxDownloadSizeMB: 50,
  maxUploadSizeMB: 20,
  rateLimit: {
    windowMs: 60000,  // 1 minute
    max: 120          // requests
  },
  maxInflightRequests: 100,  // Circuit breaker
  serverLocation: 'EU WEST (Amsterdam, Netherlands)'
}
```

---

## Performance Optimizations

### Progressive Enhancement
Device-aware update intervals:
- High-end: 50ms (8+ cores, 8GB+ RAM)
- Mid-range: 100ms (4 cores, 4GB RAM)
- Low-end: 200ms (2 cores, 2GB RAM)

### Idle Task Scheduling
Non-critical monitoring via `requestIdleCallback`:
- Memory checks during browser idle
- Frame drop detection
- Performance logging

### Pre-allocated Buffers
Backend generates 1MB random buffers at startup:
- Eliminates crypto.randomBytes() blocking
- Instant response to download requests
- 10× faster than on-demand generation

### Reusable Upload Chunks
Frontend builds 10MB blob once:
- 64KB chunks reused across threads
- Memory: 40MB+ → 64KB (99.4% reduction)
- Faster test startup

---

## Security

### Rate Limiting
- 120 requests/minute per IP
- Circuit breaker at 100 concurrent
- 413 for oversized uploads

### Input Validation
```javascript
// Size limits
if (size > 50 || size < 1) return 400

// Upload size
if (contentLength > MAX_UPLOAD) return 413
```

### Headers (v1.68.0)
- HSTS with preload
- CSP without `unsafe-inline`
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Removed X-Powered-By

### CORS
```javascript
origin: [
  'https://speed-test.up.railway.app',
  'https://speed-test-ahc.pages.dev'
]
```

---

## Monitoring

### Metrics (/metrics endpoint)
- Request rates per endpoint
- Response times (p50, p95, p99)
- Bytes transferred
- Circuit breaker status
- Inflight request count

### Logging (Pino)
- JSON in production
- Pretty-print in development
- Levels: INFO, WARN, ERROR

---

## Design Decisions

### Why 10 Seconds?
- 5s: Too short for stability
- 15s: Users get impatient
- 10s: 95% accuracy, 4× faster than 60s

### Why Amsterdam?
- Central European hub (AMS-IX)
- Excellent global connectivity
- Railway datacenter availability

### Why 4 Threads?
- Single thread may not saturate connection
- Industry standard: 4-8 threads
- Balances accuracy and server load

### Why Fixed Duration?
- Consistent user experience
- No 60+ second waits
- Measures current capacity
- Simpler code

---

## Error Handling

### Network Failures
- AbortController for clean shutdown
- Retry logic for transient failures
- Graceful degradation

### Edge Cases
- Zero bytes: Show "Connection failed"
- Mid-test cancel: Abort all threads
- Division by zero: Guards in calculations

---

For version history, see [CHANGELOG.md](CHANGELOG.md).  
For design rationale, see [DESIGN.md](DESIGN.md).  
For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

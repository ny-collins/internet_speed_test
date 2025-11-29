# SpeedCheck Functionality

This document explains how SpeedCheck works internally - the architecture, measurement logic, and component interactions.

## Table of Contents

- [System Architecture](#system-architecture)
- [Test Flow](#test-flow)
- [Measurement Components](#measurement-components)
- [Web Workers Architecture](#web-workers-architecture)
- [Progressive Web App (PWA)](#progressive-web-app-pwa)
- [API Endpoints](#api-endpoints)

---

## System Architecture

### High-Level Overview

```
                    ┌────────────────────────────────────────┐
                    │         GitHub Repository              │
                    │   ny-collins/internet_speed_test       │
                    └────────┬───────────────────┬───────────┘
                             │                   │
                    ┌────────▼────────┐ ┌────────▼──────────┐
                    │  Railway        │ │  Cloudflare Pages │
                    │  Auto-Deploy    │ │  Manual Deploy    │
                    └────────┬────────┘ └────────┬──────────┘
                             │                   │
        ┌────────────────────┼───────────────────┘
        │                    │
        │              ┌─────▼──────┐
        │              │  Backend   │
        │              │  API       │
        │              │  Amsterdam │
        │              │  Railway   │
        │              └─────▲──────┘
        │                    │
   ┌────▼─────┐         ┌───┴────┐
   │ Frontend │         │Frontend│
   │ Railway  │         │Cloudfl.│
   │Amsterdam │         │Dar es  │
   │(Primary) │         │Salaam  │
   └──────────┘         └────────┘
```

### Distributed Deployment Strategy

SpeedCheck uses a **tri-service architecture** with geographic distribution:

**1. Backend API (Amsterdam, Netherlands - Railway)**
- **URL:** https://speed-test-backend.up.railway.app/
- **Purpose:** Single source of truth for speed measurements
- **Location:** Fixed in Amsterdam, Netherlands (EU West)
- **Endpoints:** `/api/download`, `/api/upload`, `/api/ping`, `/api/ping-batch`, `/api/info`
- **Deployment:** Automatic on git push to main branch
- **Why Amsterdam?**
  - Central European internet hub (AMS-IX)
  - Excellent global connectivity
  - Represents real-world international routing
  - Consistent baseline for all measurements

**2. Frontend - Primary (Amsterdam, Netherlands - Railway)**
- **URL:** https://speed-test.up.railway.app/
- **Purpose:** Primary user interface for European users
- **Type:** Express.js static file server with 404 handling
- **Co-location Benefit:** Minimal latency between UI and backend
- **Deployment:** Automatic on git push to main branch
- **Features:** Custom 404 page, clean URL routing, PWA support

**3. Frontend - Regional (Nairobi, Kenya - Cloudflare Pages)**
- **URL:** https://speed-test-ahc.pages.dev/
- **Purpose:** Optimized UI delivery for African users
- **Type:** Static site hosting on Cloudflare's CDN edge network
- **Location:** Deployed to Nairobi edge location
- **Deployment:** Manual via `wrangler pages deploy` or `./deploy-cloudflare.sh`
- **Benefits:**
  - Faster initial page load for African users (reduced TTFB)
  - Lower latency for static asset delivery
  - Still connects to Amsterdam backend for consistent measurements

### Why Two Frontend Deployments?

**Problem:** Users in Africa accessing the Amsterdam-hosted frontend experience:
- High Time to First Byte (TTFB) - 200-400ms just to load the page
- Slow static asset loading (HTML, CSS, JS, images)
- Poor perceived performance despite fast internet connection

**Solution:** Deploy identical frontend to Cloudflare Pages with African edge location:
- **UI Loading:** Served from Nairobi (fast, <50ms TTFB)
- **Speed Testing:** Still connects to Amsterdam backend (accurate international measurements)
- **Result:** Fast page load + Real-world speed test

**Key Insight:** The frontend is *just the interface* - separating UI delivery from measurement logic allows geographic optimization without compromising test accuracy.

### Components

**Frontend (Both Deployments)**:
- **Static Files**: HTML, CSS, JavaScript
- **Service Worker**: Offline caching, PWA functionality (`sw.js`)
- **Main Logic**: Speed test orchestration in `main.js` (2,124 lines)
- **Modular Architecture**: Separate JS modules (11 files) and CSS files (7 files)
- **API Detection**: Automatically connects to Amsterdam backend regardless of frontend location

**Backend (Single Deployment)**:
- **Express Server**: RESTful API endpoints for download/upload/ping
- **Configuration**: Centralized in `config/index.js`
- **Observability**: Pino logging, Prometheus metrics (optional)
- **Performance**: Circuit breaker, rate limiting, streaming upload/download
- **Security**: Helmet.js, CORS, request size limits

---

## Test Flow

### Complete Test Sequence

```
┌─► Initialization
│     ├─ Fetch server info (/api/info)
│     ├─ Check service worker status
│     └─ Prepare UI
│
├─► Latency Test (3 seconds)
│     ├─ Send 10 ping requests to /api/ping-batch
│     ├─ Measure round-trip time
│     └─ Calculate average, min, max
│
├─► Jitter Test (0.8 seconds)
│     ├─ Analyze latency variance
│     ├─ Calculate standard deviation
│     └─ Display jitter value
│
├─► Download Test (10 seconds)
│     ├─ Launch 4 parallel threads
│     ├─ Each fetches /api/download?size=50MB
│     ├─ Monitor bytes received every 100ms
│     ├─ Stop at 10 seconds
│     └─ Calculate: (total bytes × 8) / 10 / 1M = Mbps
│
└─► Upload Test (10 seconds)
      ├─ Launch 4 parallel threads
      ├─ Each POSTs 10MB to /api/upload
      ├─ Monitor bytes sent every 100ms
      ├─ Stop at 10 seconds
      └─ Calculate: (total bytes × 8) / 10 / 1M = Mbps
```

### Total Time: ~25 seconds

- Latency: ~3s
- Jitter: ~0.8s
- Download: 10s
- Upload: 10s
- Overhead: ~1-2s (UI updates, calculations)

---

## Measurement Components

### 1. Latency Measurement

**Endpoint**: `/api/ping-batch`

**Process**:
```javascript
1. Send POST to /api/ping-batch with count=10
2. Server responds with 10 measurements containing:
   - id, timestamp, nonce (for verification)
3. Client receives response
4. Calculate round-trip time: responseTime - requestTime
5. Repeat for all 10 measurements
6. Calculate statistics:
   - Average latency
   - Min/Max latency
   - Used for jitter calculation
```

**Why batch?**
- More efficient than 10 separate requests
- Server can generate all data at once
- Reduces connection overhead

### 2. Jitter Measurement

**Formula**: Standard deviation of latency samples

**Process**:
```javascript
1. Take latency samples from ping test
2. Calculate mean: μ = (Σ samples) / n
3. Calculate variance: σ² = Σ(sample - μ)² / n
4. Calculate std dev: σ = √(σ²)
5. Jitter = σ (in milliseconds)
```

**Interpretation**:
- Low jitter (< 10ms): Stable connection
- Medium jitter (10-50ms): Some variation
- High jitter (> 50ms): Unstable, gaming/VoIP affected

### 3. Download Measurement

**Endpoint**: `/api/download?size=50&chunk=512`

**Multi-threaded Process**:
```javascript
// 4 threads run in parallel
for (let i = 0; i < 4; i++) {
    downloadThread(i)
}

downloadThread(id):
    1. Fetch /api/download?size=50&chunk=512
    2. Get ReadableStream from response.body
    3. Read chunks in loop:
       while (!aborted) {
           chunk = await reader.read()
           byteCounter += chunk.length
       }
    4. Continue until test aborted (10 seconds)
```

**Monitor Loop** (runs concurrently):
```javascript
while (isRunning && elapsed < 10s) {
    totalBytes = sum(all_thread_bytes)
    currentSpeed = (totalBytes × 8) / elapsed / 1M
    updateGauge(currentSpeed)
    await sleep(100ms)
}
```

**Why multi-threaded?**
- Modern connections have high bandwidth
- Single thread might not saturate the connection
- 4 threads = industry standard for accuracy

### 4. Upload Measurement

**Endpoint**: `/api/upload`

**Process**:
```javascript
// Build reusable 10MB blob
const blob = new Blob([...reusedChunks], { type: 'application/octet-stream' })

// 4 threads upload in parallel
for (let i = 0; i < 4; i++) {
    uploadThread(i, blob)
}

uploadThread(id, blob):
    1. Create XMLHttpRequest (for progress tracking)
    2. Setup xhr.upload.onprogress handler
    3. POST blob to /api/upload
    4. Track bytes sent via event.loaded
    5. Continue until test aborted (10 seconds)
```

**Why XHR instead of fetch?**
- `fetch` doesn't support upload progress tracking
- `XMLHttpRequest.upload.onprogress` gives accurate byte counts
- Critical for real-time gauge updates

### 5. Speed Calculation

**Formula** (used for both download and upload):

```javascript
Speed (Mbps) = (totalBytes × 8) / duration / 1_000_000

Where:
- totalBytes: Sum of all thread byte counters
- ×8: Convert bytes to bits
- duration: Elapsed time in seconds (10s)
- ÷1_000_000: Convert bits to megabits
```

**Example**:
```
totalBytes = 10,485,760 bytes (10 MB)
duration = 10 seconds

Speed = (10,485,760 × 8) / 10 / 1,000,000
     = 83,886,080 / 10 / 1,000,000
     = 8,388,608 / 1,000,000
     = 8.39 Mbps
```

### 6. Stability Detection

**Purpose**: Detect when speed has stabilized, allow early exit.

**Algorithm**:
```javascript
1. Collect speed samples every 500ms
2. Once we have 10+ samples:
   - Take last 10 samples
   - Calculate coefficient of variation: CV = σ / μ
   - If CV < 0.05 (5% variation):
     → Speed is stable, can stop early
3. Otherwise, continue until max duration (10s)
```

**Why early exit?**
- Faster tests on stable connections
- No need to wait full 10s if speed stabilized at 5s
- Improves UX without sacrificing accuracy

---

## Web Workers Architecture

### Problem Solved

**Main Thread Blocking**: Heavy computation during speed tests (downloading/uploading large files, real-time calculations) was blocking the UI thread, causing:
- Unresponsive interface during tests
- Frozen progress bars and gauges
- Unable to cancel tests mid-execution
- Poor user experience on slower devices

### Solution: Dedicated Web Workers

**Architecture Overview**:
```
Main Thread (UI)                    Web Workers (Computation)
├── User interactions              ├── download-worker.js
├── UI updates                     ├── upload-worker.js
├── Test orchestration             └── Shared utilities
└── Worker message handling
```

**Worker Communication**:
```javascript
// Main thread → Worker
worker.postMessage({
    action: 'start-download',
    config: { threads: 4, duration: 10000 }
});

// Worker → Main thread
worker.postMessage({
    type: 'progress',
    data: { bytesReceived: 10485760, speedMbps: 8.39 }
});
```

### Download Worker (`js/worker.js`)

**Responsibilities**:
- Manage 4 parallel download threads
- Stream processing and byte counting
- Real-time speed calculations
- Progress reporting every 100ms

**Key Features**:
```javascript
// Pre-allocated buffer for efficiency
const buffer = new ArrayBuffer(512 * 1024); // 512KB chunks

// Stream processing loop
while (!aborted && performance.now() - startTime < duration) {
    const { done, value } = await reader.read();
    if (done) break;
    
    bytesReceived += value.length;
    // Report progress to main thread
}
```

### Upload Worker (`js/worker.js`)

**Responsibilities**:
- Manage 4 parallel upload threads
- XMLHttpRequest progress tracking
- Byte counting and speed calculations
- Error handling and recovery

**Key Features**:
```javascript
// Reusable blob creation (10MB)
const blob = new Blob([buffer], { type: 'application/octet-stream' });

// Progress tracking
xhr.upload.onprogress = (event) => {
    bytesSent = event.loaded;
    // Report to main thread
};
```

### Performance Benefits

**Before Web Workers**:
- UI thread blocked during 20+ second tests
- Unable to interact with interface
- Progress updates delayed by computation

**After Web Workers**:
- UI remains responsive throughout tests
- Real-time progress updates
- Ability to cancel tests immediately
- Smooth animations and interactions

### Implementation Details

**Worker Lifecycle**:
```javascript
1. Create worker: new Worker('js/worker.js')
2. Send config: postMessage({ action: 'configure', ... })
3. Start test: postMessage({ action: 'start-download' })
4. Receive progress: onmessage = handleProgress
5. Stop test: postMessage({ action: 'stop' })
6. Terminate: worker.terminate()
```

**Error Handling**:
- Workers catch and report errors to main thread
- Automatic cleanup on test completion
- Graceful degradation if workers unavailable

---

## Progressive Web App (PWA)

### Service Worker Lifecycle

```
┌─► Installation
│     ├─ Cache critical assets
│     │   • index.html
│     │   • main.js?v=1.60.0
│     │   • main.css?v=1.60.0
│     │   • icons, fonts
│     └─ Skip waiting (activate immediately)
│
├─► Activation
│     ├─ Delete old caches
│     ├─ Take control of all clients
│     └─ Notify main thread
│
└─► Fetch Interception
      ├─ Try cache first (offline support)
      ├─ Fall back to network
      └─ Update cache if needed
```

### Update Mechanism

**Automatic checks**:
- Every 60 seconds while app is open
- On page load
- On focus (user returns to tab)

**Update flow**:
```
1. Service worker detects new version
2. Install new worker in background
3. Show update banner to user
4. User clicks "Update Now"
5. Send SKIP_WAITING message to new worker
6. New worker activates
7. Page reloads with new version
```

### Offline Support

**Cached resources**:
- All HTML pages (index.html, learn.html, 404.html)
- All CSS/JS with version query strings
- Icons and fonts
- Error pages

**Network-first resources**:
- API endpoints (/api/*)
- External CDN resources (Lucide icons)

---

## API Endpoints

### GET /api/info

**Purpose**: Server information and configuration

**Response**:
```json
{
  "name": "SpeedCheck Speed Test Server",
  "location": "EU WEST (Amsterdam, Netherlands)",
  "maxDownloadSize": 50,
  "maxUploadSize": 50,
  "version": "1.62.0",
  "rateLimit": {
    "windowMs": 60000,
    "max": 100
  }
}
```

### POST /api/ping-batch

**Purpose**: Batch latency measurement

**Request**:
```json
{
  "count": 10
}
```

**Response**:
```json
{
  "measurements": [
    { "id": 0, "timestamp": 1697481234567, "nonce": "a1b2c3d4" },
    { "id": 1, "timestamp": 1697481234568, "nonce": "e5f6g7h8" },
    ...
  ],
  "serverTime": 1697481234567,
  "count": 10
}
```

### GET /api/download

**Purpose**: Stream random data for download test

**Query Parameters**:
- `size` (number): MB to download (max 50)
- `chunk` (number): KB per chunk (default 512)
- `t` (number): Timestamp (cache buster)

**Response**: Binary stream of random data

**Example**:
```
GET /api/download?size=50&chunk=512&t=1697481234567
```

### POST /api/upload

**Purpose**: Receive upload data for speed test

**Request**: Binary data (application/octet-stream)

**Response**:
```json
{
  "received": 10485760,
  "message": "Upload received successfully"
}
```

---

## Configuration

### Frontend Config (main.js)

```javascript
CONFIG = {
  apiBase: 'https://speed-test-backend.up.railway.app',
  
  threads: {
    download: 4,
    upload: 4
  },
  
  duration: {
    download: { max: 10, min: 5, default: 10 },
    upload: { max: 10, min: 5, default: 10 }
  },
  
  updateInterval: 100,  // ms between gauge updates
  
  stability: {
    sampleCount: 10,
    threshold: 0.05  // 5% coefficient of variation
  }
}
```

### Backend Config (config/index.js)

```javascript
{
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  maxDownloadSizeMB: 50,
  maxUploadSizeMB: 50,
  
  rateLimit: {
    enabled: true,
    windowMs: 60000,  // 1 minute
    max: 100          // requests per window
  },
  
  maxInflightRequests: 1000,
  serverLocation: 'EU WEST (Amsterdam, Netherlands)',
  
  metrics: {
    enabled: true
  }
}
```

---

## Error Handling

### Network Failures

**Download/Upload abort**:
- All threads use AbortController
- Clean shutdown on error or user cancellation
- UI shows last valid measurement

**API unavailable**:
- Graceful degradation (show cached server info)
- Retry logic for transient failures
- User-friendly error messages

### Edge Cases

**Zero bytes transferred**:
- Check: `if (totalBytes === 0)` → Show "Connection failed"
- Log error for debugging
- Don't calculate speed (avoid division issues)

**Test cancelled mid-way**:
- Abort all threads immediately
- Clear progress UI
- Reset state for next test

---

## Performance Optimizations

For detailed performance optimization information including recent improvements (progressive enhancement, idle task scheduling, frame monitoring), see **[TECHNICAL_NOTES.md](TECHNICAL_NOTES.md)**.

### Legacy Optimizations

**Reusable Upload Chunks**: Pre-generated 64KB random chunks reused across threads (10× faster startup)

**RequestAnimationFrame**: Smooth 60fps gauge updates without UI blocking

**Byte Counter Objects**: Shared counter objects avoid message passing overhead

---

## Security

### Rate Limiting

**Backend** (express-rate-limit):
- 100 requests per minute per IP
- Prevents abuse/DOS
- Configurable via environment

### Input Validation

**Download size**:
```javascript
if (size > 50 || size < 1) {
    return res.status(400).json({ error: 'Invalid size' })
}
```

**Upload size**:
```javascript
if (req.headers['content-length'] > MAX_UPLOAD) {
    return res.status(413).json({ error: 'Payload too large' })
}
```

### CORS

**Configured for frontend origin**:
```javascript
cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
})
```

---

## Monitoring & Observability

### Metrics Tracked

**Request volume**:
- Total requests
- Requests per endpoint
- Success/error rates

**Performance**:
- Response times (p50, p95, p99)
- Active connections
- Bytes transferred

### Logging

**Levels**:
- INFO: Normal operations
- WARN: Recoverable issues
- ERROR: Failures requiring attention

**Example logs**:
```
[INFO] Server started on port 3000
[INFO] Download request: size=50MB client=1.2.3.4
[WARN] Rate limit exceeded for 5.6.7.8
[ERROR] Database connection failed
```

---

---

## Technical Notes & Design Decisions

### Speed Measurement Methodology

Internet speed is fundamentally measured by observing data transfer over time:

```
Speed (Mbps) = (Bytes Transferred × 8) / Duration (seconds) / 1,000,000
```

#### The Two Approaches

**1. Test-to-Completion (v1.05.1 and earlier)**
- Transfer a fixed amount of data (e.g., 50 MB)
- Measure how long it takes
- **Problem**: Tests could take 60+ seconds on slow connections

**2. Fixed-Duration Testing (v1.60.0 and later)**
- Run test for exactly 10 seconds
- Measure how much data transferred
- **Benefit**: Consistent test duration regardless of connection speed

### Why We Changed (v1.05.1 → v1.60.0)

In v1.05.1, users experienced upload tests taking 60+ seconds with UI appearing frozen. The monitor loop would exit at 8 seconds but threads continued uploading for another 50+ seconds.

**The Solution**: Fixed duration testing measures **current network capacity** in a consistent 10-second window.

**Benefits:**
- ✅ Fast tests (10s vs. 60s)
- ✅ Consistent duration
- ✅ No UI freezing
- ✅ Simpler code (removed 60+ lines)
- ✅ Still accurate (measures current speed)

### Known Discrepancies

**Speed Varies Between Tests**: Internet speed is not constant - network conditions change second-to-second. This is not a bug, it's reality.

**Different Results from Other Tools**: We measure speed to Amsterdam over 10 seconds. Others might measure to different locations over different durations. All tools are "correct" - they're measuring different things.

**Upload Faster Than Download**: Upload and download use different network paths and can have different speeds. Server capacity, ISP prioritization, and network routing all affect this.

### Design Decision History

**Why 4 Threads?** Modern connections can saturate with multiple streams. Single thread might not fully utilize bandwidth. Industry standard is 4-8 threads.

**Why 10 Seconds?** 5 seconds is too short (unstable connections don't stabilize), 15 seconds is too long (users get impatient). 10 seconds provides 95% accuracy vs. 60s tests, but 4× faster.

**Why Amsterdam Server?** Central European location with good connectivity, low latency to major internet exchanges, and Railway.app datacenter availability.

**Why Not WebRTC P2P?** Requires two users online simultaneously, complex NAT traversal, security concerns, and unreliable peer connections. Client-server model is more reliable and consistent.

### Performance Optimization Notes

**Abort at 10 Seconds**: Clean shutdown prevents hanging connections, ensures accurate measurement, and frees resources.

**Reuse Upload Chunks**: Upload test builds blob once and reuses it - faster test startup, less memory usage, browser optimization with single blob in memory.

---

## Conclusion

SpeedCheck prioritizes:
1. **User experience**: Fast, predictable tests
2. **Accuracy**: Measures current network speed accurately
3. **Simplicity**: Clean, maintainable code

When making design decisions, we optimize for these principles in that order. If a feature sacrifices UX for marginal accuracy gains, we reject it.

See `CHANGELOG.md` for version history.

# Design Decisions & Rationale

This document explains the "why" behind SpeedCheck's technical choices, trade-offs, and architectural decisions.

**Last Updated:** December 12, 2025

---

## Test Methodology

### Fixed-Duration Testing

**Decision:** Run tests for exactly 10 seconds instead of completing full file transfers.

**Problem Solved:**
- v1.05.1: Tests took 60+ seconds with frozen UI
- Monitor loop exited at 8s but threads continued for 50+ seconds
- Users experienced unresponsive interface

**Rationale:**
```
Speed = (Bytes Transferred × 8) / Duration / 1,000,000
```

We measure how much data transfers in 10 seconds, not how long a fixed amount takes. This provides:
- **Consistent UX**: Every test takes exactly 10 seconds
- **Current Capacity**: Measures sustained network speed
- **No Freezing**: Tests complete predictably
- **95% Accuracy**: Comparable to 60-second tests

**Trade-offs:**
- May not reach absolute peak on very fast connections
- Better represents real-world sustained performance
- Industry standard methodology

### Why 10 Seconds?

| Duration | Pros | Cons |
|----------|------|------|
| 5s | Fast | Too short for stability |
| 10s | ✅ Optimal balance | — |
| 15s | High accuracy | Users get impatient |
| 60s | Maximum accuracy | Unacceptable wait time |

**Decision:** 10 seconds provides 95% accuracy with 4× faster completion.

### Why 4 Threads?

**Rationale:**
- Single thread: May not saturate connection bandwidth
- 2 threads: Improvement but still underutilized
- **4 threads: Industry standard** (Ookla, Fast.com, Google Fiber use 4-8)
- 8+ threads: Diminishing returns, higher server load

**Balances:**
- Connection saturation
- Server resource usage
- Measurement accuracy
- Client device capability

---

## Architecture Decisions

### Why Amsterdam Server?

**Location Requirements:**
- Central European hub (AMS-IX - Amsterdam Internet Exchange)
- Excellent global connectivity
- Major peering point for transatlantic and Asian routes
- Railway.app datacenter availability

**Trade-offs Considered:**
- US East: Better for Americas, worse for Europe/Asia
- Singapore: Better for Asia, worse for Americas/Europe
- Amsterdam: **Best global compromise**

**Real Impact:**
- EU: 5-30ms latency
- Americas: 80-120ms latency
- Asia: 150-250ms latency
- Africa: 180-300ms latency

### Why Two Frontends?

**Problem:** Users in Africa experienced:
- 200-400ms TTFB just to load the page
- Slow CSS/JS delivery
- Poor perceived performance despite fast internet

**Solution:** Dual deployment strategy

```
UI Delivery (Fast)          Measurement (Accurate)
Nairobi Cloudflare ────────► Amsterdam Backend
   14ms TTFB                    180ms latency test
```

**Benefits:**
- Fast page loads (Cloudflare edge)
- Accurate measurements (consistent Amsterdam endpoint)
- Best of both worlds
- 3× faster for African users

**Philosophy:** Separate UI delivery from measurement logic.

### Why Web Workers?

**Problem:** Main thread blocked during tests:
- Frozen UI for 10+ seconds
- Unable to cancel mid-test
- Frame drops on slower devices
- Poor user experience

**Solution:**
```
Main Thread (UI)              Workers (Computation)
├─ Gauge animations          ├─ Stream processing
├─ User interactions         ├─ Byte counting
├─ Button clicks             ├─ Speed calculations
└─ Progress updates          └─ Data handling
```

**Benefits:**
- Smooth 60fps UI
- Instant cancellation
- Real-time updates
- Works on low-end devices

**Cost:** Additional complexity (worth it for UX improvement).

---

## Measurement Accuracy

### TCP Slow Start Compensation

**Problem:** TCP connections start slow and ramp up, artificially inflating results.

**Naive Approach:**
```javascript
// WRONG: Time subtraction
speed = totalBytes / (duration - 2.0)
// Assumes linear ramp-up (incorrect)
```

**Our Approach:**
```javascript
// CORRECT: Byte tracking
warmupBytes = bytesAt2000ms
postWarmupBytes = totalBytes - warmupBytes
effectiveDuration = totalDuration - 2.0
speed = postWarmupBytes / effectiveDuration
```

**Why Better:**
- Tracks actual bytes transferred during warm-up
- Handles non-linear TCP behavior
- Professional-grade accuracy
- Matches industry standards

### Bufferbloat Detection

**Concept:** Router buffer overflow causing latency spikes under load.

**Traditional Tests:** Only measure idle latency (incomplete picture).

**Our Approach:** Concurrent ping during download/upload

**Implementation:**
```javascript
// Measure latency WHILE testing speed
while (speedTestRunning) {
  ping server
  record RTT under load
  await 500ms
}

compare: idleLatency vs loadedLatency
```

**Benefits:**
- Detects bufferbloat
- Real-world performance assessment
- Identifies quality of service issues
- Doesn't interfere with speed measurements

---

## UI/UX Decisions

### Split Layout Design

**Desktop Strategy:**
```
┌───────────┬──────────────┐
│   Gauge   │   Results    │
│   (45fr)  │    (55fr)    │
└───────────┴──────────────┘
```

**Rationale:**
- Fractional units (45fr/55fr) scale better than fixed pixels
- Gauge visible during scroll
- Results hierarchy: Download/Upload > Ping/Jitter
- Desktop screen real estate utilized efficiently

**Why 45:55 not 50:50?**
- Results area needs more space for 2×2 grid
- Gauge doesn't need exact half
- Visual balance > mathematical equality

### Gauge Transparency

**Decision:** Remove gauge background, border, shadow.

**Rationale:**
- Blends seamlessly with page
- Reduces visual clutter
- Start button remains prominent
- Modern, minimal aesthetic

**Alternative Considered:** Frosted glass effect (rejected as too heavy).

### Physics-Aware Analysis

**Problem:** Quality badges ("Good", "Fair", "Poor") were:
- Subjective and arbitrary
- Context-independent
- Discouraging for international users
- Not educational

**Solution:** Educational explanations using physics:

```javascript
// Speed-of-light minimum
minLatency = (distance / 200000) * 1000

// Context-aware explanation
if (distance > 1000) {
  "Testing over ${distance}km introduces ${minLatency}ms 
   minimum theoretical delay (speed of light). Your ${actual}ms 
   includes routing overhead, which is reasonable for 
   international connections."
}
```

**Benefits:**
- Removes judgment
- Adds understanding
- Sets realistic expectations
- Distance-aware context

**Example Impact:**
- Kenya → Amsterdam: 150ms is physics-limited, not "poor"
- Local server: 150ms would indicate a problem
- Same number, different meaning

### Variance Graph Design

**Why Canvas not SVG?**

| Consideration | Canvas | SVG |
|---------------|--------|-----|
| Performance | ✅ Fast | ❌ Slow at 10fps |
| Memory | ✅ Low | ❌ Higher |
| Redraw | ✅ Simple clearRect() | ❌ DOM manipulation |
| Control | ✅ Pixel-level | — |

**Decision:** Canvas for real-time updates.

**Graph History:** Originally limited to 50 samples (recent data only). Changed to compress all samples horizontally - users see complete test progression.

---

## Performance Optimizations

### Progressive Enhancement

**Device Detection:**
```javascript
cores = navigator.hardwareConcurrency
memory = navigator.deviceMemory

if (cores ≥ 8 && memory ≥ 8) updateInterval = 50ms
else if (cores ≥ 4 && memory ≥ 4) updateInterval = 100ms
else updateInterval = 200ms
```

**Rationale:**
- High-end: Maximize responsiveness (50ms)
- Mid-range: Balance (100ms)
- Low-end: Prevent UI blocking (200ms)

**Alternative Considered:** Fixed 100ms for all (rejected - wastes high-end capability).

### Idle Task Scheduling

**Decision:** Use `requestIdleCallback` for non-critical monitoring.

```javascript
scheduleIdleTask(() => {
  recordMemoryUsage()
  detectFrameDrops()
  logPerformanceMetrics()
})
```

**Rationale:**
- Monitoring shouldn't block tests
- Browser schedules during idle time
- No impact on user experience
- Safari fallback: setTimeout with low priority

### Pre-allocated Buffers

**Backend Problem:** `crypto.randomBytes(1MB)` blocked event loop for 2-3 seconds.

**Solution:** Generate once at startup:
```javascript
const BUFFER = crypto.randomBytes(1024 * 1024) // Startup
// Reuse for all requests - instant response
```

**Impact:**
- 2000ms → 1ms response time
- Better server responsiveness
- No per-request CPU spike

**Trade-off:** 1MB memory per backend instance (negligible).

---

## Security Decisions

### CSP without `unsafe-inline`

**v1.67.0 Problem:** CSP allowed inline scripts (`'unsafe-inline'`).

**Risk:**
```html
<!-- Attacker injects -->
<script>steal_data()</script>
<!-- Would execute! -->
```

**v1.68.0 Solution:** Externalize all scripts, remove `unsafe-inline`.

**Cost:** Created 4 new JS files (init.js, edge-banner.js, settings-helper.js, learn-init.js).

**Benefit:** Browser now blocks ALL inline script injection attempts.

### Why Allow unpkg.com?

**Usage:** Lucide icons library (CDN-hosted).

**Risk Assessment:**
- Trusted npm CDN
- Version-pinned
- Supply chain risk monitored by npm
- Alternative: Self-host 100KB+ icons (performance trade-off)

**Decision:** Trust unpkg.com for developer convenience.

**Mitigation:** Can switch to self-hosted if CDN compromised.

---

## CSS Architecture

### Why Modular CSS?

**Structure:**
```
css/
├── vars.css         # Design tokens
├── base.css         # Resets, typography
├── layout.css       # Grid systems
├── components.css   # Reusable UI
├── pages/
│   ├── home.css     # Split layout + gauge
│   └── learn.css    # Article styles
├── utils.css        # Utilities
└── main.css         # Output bundle
```

**Benefits:**
- Clear file purposes
- Easy to locate styles
- Maintainable as project grows
- pages/ folder scales to multiple pages

**Alternative Considered:** Single CSS file (rejected - too large to navigate).

---

## Learn Center Design

### Article vs Card Layout

**v1.66.0:** Card grid (learning paths metaphor)
**v1.67.0:** Article layout with sidebar

**Why Change?**
- Card layout: Disconnected reading experience
- No clear navigation between topics
- Users returned to hub to switch articles
- Limited space for metadata

**Article Benefits:**
- Continuous reading flow
- Persistent navigation (sticky sidebar)
- Professional documentation appearance
- Better content discovery

**Sidebar Components:**
1. **Article List**: All pages with reading times
2. **On This Page**: Auto-generated TOC
3. **Back Link**: Quick exit to speed test

**Mobile:** Sidebar moves to bottom (content-first).

---

## Known Limitations

### Speed Varies Between Tests

**Not a Bug:** Network conditions change constantly.

**Factors:**
- Server load
- ISP throttling
- Routing changes
- Congestion
- Time of day

**Design Decision:** Show variance graph to visualize stability, don't hide reality.

### Different Results from Other Tools

**Expected:** Different servers, durations, methodologies.

**Example:**
- Ookla: Nearest server, 8 threads, 15s
- Fast.com: Netflix CDN, 3 threads, 10s
- SpeedCheck: Amsterdam, 4 threads, 10s

**All correct:** They measure different things.

### Upload Faster Than Download (Sometimes)

**Possible Reasons:**
- ISP prioritization
- Server capacity limits
- Different network paths
- Asymmetric connection design (DSL, cable)

**Not a Bug:** Real network behavior.

---

## Future Considerations

### WebRTC P2P Testing

**Pros:**
- Direct peer-to-peer measurement
- No server costs
- Distributed testing

**Cons:**
- NAT traversal complexity
- Requires two users online
- Security concerns
- Unreliable peer connections

**Decision:** Stick with client-server (reliability > novelty).

### Advanced Metrics

**Potential:**
- Packet loss detection
- MTU path discovery
- Route visualization
- Multi-server testing

**Trade-off:** Complexity vs user value.

**Philosophy:** Optimize for simplicity and core use case.

---

## Design Principles

1. **UX First**: User experience > marginal accuracy gains
2. **Simplicity**: Complex features must justify their existence
3. **Transparency**: Show real data, explain limitations
4. **Education**: Empower users with knowledge
5. **Performance**: 60fps, fast loads, responsive
6. **Security**: Secure by default, defense in depth

When in doubt: Choose simplicity.

---

For implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).  
For version history, see [CHANGELOG.md](CHANGELOG.md).  
For deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

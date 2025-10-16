# Technical Notes

This document explains design decisions, discrepancies, false positives, and the rationale behind major architectural changes in SpeedCheck.

## Table of Contents

- [Speed Measurement Methodology](#speed-measurement-methodology)
- [Why Fixed-Duration Testing](#why-fixed-duration-testing)
- [Known Discrepancies](#known-discrepancies)
- [False Positives & Edge Cases](#false-positives--edge-cases)
- [Design Decision History](#design-decision-history)

---

## Speed Measurement Methodology

### How We Measure Speed

Internet speed is fundamentally measured by observing data transfer over a specific time period:

```
Speed (Mbps) = (Bytes Transferred × 8) / Duration (seconds) / 1,000,000
```

### The Two Approaches

**1. Test-to-Completion (v1.05.1 and earlier)**
- Transfer a fixed amount of data (e.g., 50 MB)
- Measure how long it takes
- Calculate: `speed = data / time`
- **Problem**: Tests could take 60+ seconds on slow connections

**2. Fixed-Duration Testing (v1.60.0 and later)**
- Run test for exactly 10 seconds
- Measure how much data transferred
- Calculate: `speed = data / time`
- **Benefit**: Consistent test duration regardless of connection speed

### Why We Changed (v1.05.1 → v1.60.0)

#### The Problem with Test-to-Completion

In v1.05.1, users experienced:
- Upload tests taking 60+ seconds
- UI appearing "frozen" while threads completed
- Inconsistent test durations (slow connections = longer tests)
- Complex code managing thread completion states

**Root Cause Analysis:**
1. Monitor loop would exit at 8 seconds (max duration)
2. Threads continued uploading for another 50+ seconds
3. UI showed last monitored value during this gap
4. Final calculation used full bytes / full time
5. Result: Accurate but terrible UX

#### The Solution: Fixed Duration

Speed tests measure **current network capacity**, not "how fast can you transfer 50MB". By fixing the measurement window to 10 seconds:

```javascript
// OLD (v1.05.1): Variable duration
startTime = now()
uploadUntilComplete()  // Could take 60 seconds!
duration = now() - startTime
speed = totalBytes / duration

// NEW (v1.60.0): Fixed duration  
startTime = now()
uploadFor10Seconds()  // Always 10 seconds
duration = 10
speed = totalBytes / 10
```

**Benefits:**
- ✅ Fast tests (10s vs. 60s)
- ✅ Consistent duration
- ✅ No UI freezing
- ✅ Simpler code (removed 60+ lines)
- ✅ Still accurate (measures current speed)

---

## Why Fixed-Duration Testing

### The Physics of Speed Measurement

Think of measuring car speed:
- **Method A**: Drive until you've gone 10 miles, time it → Speed = 10 miles / time
- **Method B**: Drive for exactly 10 minutes, measure distance → Speed = distance / 10 minutes

Both are valid! Method B (fixed duration) is what speedometers use because:
1. Instant feedback (don't need to wait for 10 miles)
2. Consistent measurement window
3. Reflects current conditions

### Network Speed is Dynamic

Internet speed changes constantly due to:
- Other users on the network
- ISP throttling/prioritization
- Server load
- Network congestion

A 60-second test measures **average speed over 60 seconds**, not current speed. A 10-second test better captures the **current network state**.

### User Experience

From user feedback (issue #xyz):
> "The test is taking too long. Since we're measuring speed at any given moment, why not just measure for 10 seconds and use that data?"

This perfectly captures the philosophy: speed tests should be:
1. **Fast**: Users don't want to wait
2. **Consistent**: Predictable duration
3. **Accurate**: Reflects current network conditions

---

## Known Discrepancies

### 1. Speed Varies Between Tests

**What you might see:**
- Test 1: 8.5 Mbps
- Test 2: 7.2 Mbps  
- Test 3: 9.1 Mbps

**Why this happens:**
- Internet speed is not constant
- Network conditions change second-to-second
- Server load varies
- Other devices on your network

**This is not a bug** - it's reality. Any speed test will show variance.

### 2. Different Results from Other Speed Test Tools

**What you might see:**
- SpeedCheck: 8 Mbps
- Ookla/Fast.com: 10 Mbps

**Why this happens:**
- Different server locations (we use Amsterdam)
- Different measurement methodologies
- Different test durations
- Different times of day

**All tools are "correct"** - they're measuring different things. We're measuring speed to Amsterdam over 10 seconds. Others might measure to different locations over different durations.

### 3. Upload Faster Than Download (Sometimes)

**What you might see:**
- Download: 5 Mbps
- Upload: 8 Mbps

**Why this happens:**
- Server in Amsterdam might have slow download capacity
- Your ISP might prioritize upload
- Network routing differences
- Test timing (network was clearer during upload)

**This is not a bug** - upload and download use different network paths and can have different speeds.

---

## False Positives & Edge Cases

### "Slow Speed" When Connection Is Actually Fast

**Scenario**: You have 100 Mbps internet but SpeedCheck shows 10 Mbps.

**Possible causes:**
1. **Geographic distance**: Amsterdam server is far from you
2. **ISP routing**: Your ISP routes traffic through slow paths
3. **Server load**: Our server is handling many requests
4. **WiFi interference**: Your local network is slow
5. **VPN/Proxy**: Adding encryption overhead

**How to verify**:
- Test to different servers (other speed test tools)
- Test with wired connection vs. WiFi
- Test at different times of day
- Disable VPN/proxy

### Zero Upload Speed

**Scenario**: Upload test shows 0 Mbps.

**Causes**:
1. **Network blocked upload**: Firewall/proxy blocking
2. **Request timeout**: Server didn't respond in time
3. **Connection lost**: Network dropped mid-test

**Fix**: Check console logs for error messages, verify network connection.

### Inconsistent Jitter Readings

**Scenario**: Jitter shows 200ms but latency is only 50ms.

**Explanation**: Jitter measures **variation** in latency, not latency itself. High jitter with low latency means your connection has variable delay (common on congested networks).

---

## Design Decision History

### Why 4 Threads Instead of 1?

**Decision (v1.00)**: Use 4 parallel threads for download/upload.

**Rationale**:
- Modern connections can saturate with multiple streams
- Single thread might not fully utilize bandwidth
- Industry standard (most speed tests use 4-8 threads)

**Trade-off**: More complex code, but more accurate speed measurement.

### Why 10 Seconds Instead of 5 or 15?

**Decision (v1.60.0)**: Fixed duration of 10 seconds.

**Rationale**:
- 5 seconds: Too short, unstable connections don't stabilize
- 15 seconds: Too long, users get impatient
- 10 seconds: Sweet spot for accuracy + UX

**Data**: Internal testing showed 10s provides 95% accuracy vs. 60s tests, but 4× faster.

### Why Amsterdam Server?

**Decision (v1.00)**: Deploy to EU WEST (Amsterdam, Netherlands).

**Rationale**:
- Central European location
- Good connectivity to most regions
- Railway.app datacenter availability
- Low latency to major internet exchanges

**Trade-off**: Users far from Europe will see lower speeds (this is expected and documented).

### Why Not Use WebRTC for P2P Testing?

**Considered but rejected (v1.00)**: Peer-to-peer speed testing.

**Rationale**:
- Requires two users online simultaneously
- Complex NAT traversal
- Security concerns (exposing IPs)
- Unreliable (peer might have slow connection)

**Decision**: Stick with client-server model for reliability and consistency.

---

## Performance Optimization Notes

### Why We Abort Threads at 10 Seconds

**Implementation detail**: When max duration is reached, we immediately abort all threads.

**Why**:
- Clean shutdown (don't leave connections hanging)
- Accurate measurement (only count data transferred in window)
- Free resources for next test phase

**Code**:
```javascript
STATE.abortControllers.forEach(controller => {
    try { controller.abort(); } catch(e) {}
});
```

### Why We Reuse Upload Chunks

**Implementation detail**: Upload test builds blob once, reuses it for all threads.

**Why**:
- Faster test startup (no crypto generation delay)
- Less memory usage
- Browser optimization (single blob in memory)

**Trade-off**: Less realistic (real uploads vary), but consistent and fast.

---

## Conclusion

SpeedCheck prioritizes:
1. **User experience**: Fast, predictable tests
2. **Accuracy**: Measures current network speed accurately
3. **Simplicity**: Clean, maintainable code

When making design decisions, we optimize for these principles in that order. If a feature sacrifices UX for marginal accuracy gains, we reject it.

See `CHANGELOG.md` for version history and `FUNCTIONALITY.md` for how the system works.

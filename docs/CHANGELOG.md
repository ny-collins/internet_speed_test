# Changelog

All notable changes to SpeedCheck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.66.0] - 2025-12-02

### Added

**🎨 Desktop UI Overhaul (Phase 1):**
- **Two-Column Layout**: Implemented 45/55 split with sticky gauge column and hierarchical results matrix
  - Gauge remains visible during scroll for continuous test monitoring
  - Download/Upload cards emphasized (larger size, 3rem font, 180px height)
  - Latency/Jitter cards compact (2rem font) for space efficiency
  - Desktop breakpoints: 1024px, 1440px (max-width 1600px), 1600px+

- **Real-time Variance Graph**: Canvas-based speed visualization with bufferbloat detection
  - 50-sample rolling buffer collecting data every 100ms (5 seconds of history)
  - Real-time plotting with grid lines, filled area, and smooth line rendering
  - Statistics display: Average, Min, Max speeds during test
  - Variance percentage calculation: (range/average) × 100
  - Quality indicator with color-coded stability levels:
    - 🟢 Excellent (<10% variance) - Stable connection
    - 🟡 Good (10-20% variance) - Minor fluctuations
    - 🟠 Fair (20-30% variance) - Noticeable instability
    - 🔴 Poor (>30% variance) - Significant bufferbloat/congestion
  - High-DPI canvas rendering for crisp visuals on retina displays
  - Auto-show during download/upload tests, persists after completion

- **Quality Badge System**: Visual performance indicators on metric cards
  - **Latency badges**: 🟢 Great (<50ms), 🟡 Good (50-100ms), 🟠 Fair (100-200ms), 🔴 Poor (>200ms)
  - **Jitter badges**: 🟢 Great (<10ms), 🟡 Good (10-30ms), 🟠 Fair (30-50ms), 🔴 Poor (>50ms)
  - Automatic display after test completion with proper color coding
  - Hidden by default, revealed with results for clean initial state

- **Contextual Latency Information**: Smart recommendations based on measured latency
  - <20ms: "Excellent for competitive gaming and real-time applications"
  - <50ms: "Great for gaming, video calls, and streaming"
  - <100ms: "Good for most online activities and video calls"
  - <200ms: "Fair for casual browsing and standard streaming"
  - ≥200ms: "May experience delays in real-time applications"
  - Appears below latency card after test completion

- **Interactive Accordion Footer**: Six expandable information sections
  - How It Works, Measurement Accuracy, Privacy & Data, Connection Quality, Troubleshooting, About
  - Smooth expand/collapse animations with chevron rotation
  - Aria-expanded attributes for accessibility
  - Single-section-open behavior (optional multi-open supported)
  - Click-to-expand interface with visual feedback

- **Enhanced Start Button**: 340px circular gradient button
  - Matches gauge diameter for visual consistency
  - Larger font sizes (3rem value, 1.5rem label)
  - Enhanced pulse animation and ripple effects
  - Improved hover states and accessibility

### Improved

**UI/UX Architecture:**
- **State Management**: Added `varianceGraph` state with 50-sample buffer and active tracking
- **Modular CSS**: Renamed `features.css` to `gauge.css` for clearer component organization
- **Display Logic**: Integrated variance tracking into download/upload test flows
  - `startVarianceTracking()` called at test start
  - `updateVarianceGraph()` called every 100ms with raw speed data
  - `stopVarianceTracking()` called at test completion
  - Graph persists after test for analysis of final results

**Reset & Cleanup:**
- `clearResultsDisplay()` now properly hides quality badges, latency context, and variance graph
- `resetVarianceGraph()` clears canvas and resets stats to waiting state
- Clean state management prevents stale data between consecutive tests

### Technical

**Canvas Implementation:**
- Device pixel ratio scaling for high-DPI displays
- Efficient redraw with `clearRect()` for smooth animations
- Grid line rendering for visual reference
- Filled area under line graph for better data visualization
- Real-time stats calculation (min/max/avg/variance)

**Performance:**
- Variance graph updates throttled to 100ms (10 updates/second)
- Rolling buffer prevents unbounded memory growth
- RequestAnimationFrame for smooth UI updates
- Non-blocking Canvas operations on main thread

**Accessibility:**
- Accordion ARIA attributes (aria-expanded, role="button")
- Canvas aria-label for screen reader context
- Quality badges with semantic color coding
- Keyboard navigation support maintained

**File Structure:**
- `frontend/css/gauge.css` (renamed from features.css)
- `frontend/css/layout.css` (two-column grid, results matrix)
- `frontend/css/components.css` (variance graph, badges, accordion)
- `frontend/js/state.js` (variance graph state)
- `frontend/js/ui.js` (graph drawing, badges, context)
- `frontend/js/events.js` (accordion handlers)

## [1.65.0] - 2025-11-29

### Added

**🔬 Professional-Grade Measurement Accuracy:**
- **TCP Slow Start Compensation**: Implemented scientific warm-up logic using byte tracking instead of time subtraction
  - Tracks `warmupBytes` during initial 2-second period to accurately exclude TCP slow start penalty
  - Calculates `postWarmupBytes` for precise speed measurements after network ramp-up
  - Eliminates artificial speed inflation from connection establishment overhead

- **Bufferbloat Detection**: Added loaded latency measurement during active transfers
  - `measureLoadedLatency()` function performs concurrent ping testing during download/upload
  - Measures network buffer congestion under load for comprehensive connection quality analysis
  - Asynchronous implementation prevents UI blocking during concurrent measurements

**⚡ Performance & Responsiveness:**
- **Asynchronous Completion Handling**: Prevents UI freezing during test completion
  - Loaded latency measurement runs concurrently without blocking main thread
  - Smooth progress indicator animations with proper timing based on test duration
  - Enhanced user experience with responsive interface during intensive operations

### Improved

**Measurement Engine:**
- **Byte-Accurate Warm-up Logic**: Scientific approach using actual data transfer tracking
  - Replaces heuristic time subtraction with precise byte counting during warm-up period
  - Ensures consistent, professional-grade speed measurements across all network conditions
  - Maintains accuracy for both short and long test durations

### Fixed

**Critical Bug Fixes:**
- **Race Condition Resolution**: Fixed completion logic race condition causing 0 Mbps results
  - Moved completion message sending from individual worker wrappers to shared `monitorLoop` function
  - Ensures tests complete properly before reporting results
  - Eliminates premature test termination with zero-speed results

- **Cancellation Logic Fix**: Resolved broken test cancellation functionality
  - Updated `monitorLoop` to check `abortSignal.aborted` in addition to `isRunningRef.value`
  - Prevents monitoring loop from continuing after user cancels test
  - Ensures immediate test termination when abort signal is received

- **ES Module Integration**: Fixed Web Worker instantiation for modern browsers
  - Added `{ type: 'module' }` option to Web Worker constructors in `test-download.js` and `test-upload.js`
  - Enables proper loading of ES module-based worker files
  - Prevents `SyntaxError: Cannot use import statement outside a module` runtime errors

- **Code Quality Improvements**: Enhanced maintainability and performance
  - Removed unused imports and variables across worker files
  - Cleaned up linting issues for production-ready codebase
  - Optimized memory usage in worker message handling

**🎨 Accessibility & User Experience Enhancements:**
- **Reduced Motion Support**: Added `@media (prefers-reduced-motion: reduce)` for all animations
  - Disables shimmer skeleton animations for users with motion sensitivity
  - Respects system accessibility preferences for 404 page animations
  - Improves usability for users with vestibular disorders

- **Touch Target Optimization**: Increased minimum touch targets to 44px (WCAG/Apple guidelines)
  - Updated `.btn-icon-small` from 40px to 44px for better mobile accessibility
  - Ensures comfortable tapping on touch devices without accidental activation

- **Gradient Contrast Fallbacks**: Added solid color fallbacks for gradient text and buttons
  - `.logo-text` and `.btn-primary` now have fallback colors when gradients fail
  - Maintains readability for users with visual impairments or unsupported browsers

- **Mobile UX Improvements**: Enhanced scrolling behavior and text wrapping
  - Added `overscroll-behavior: contain` to settings panel and help modal
  - Prevents unwanted page scrolling when reaching modal content boundaries
  - Added `word-break: break-word` and `hyphens: auto` to footer text for narrow screens

- **Visual Consistency**: Unified empty state indicators across the application
  - Changed gauge reset from "0" to "—" to match other empty states
  - Provides clearer distinction between "no data" and actual zero measurements

- **Layout Stability**: Fixed Cumulative Layout Shift (CLS) in sparkline rendering
  - Changed from `display: none` to `visibility: hidden` for sparkline container
  - Prevents layout jumps when sparkline appears/disappears during tests

- **Modal Aesthetics**: Added backdrop blur effects for modern visual appeal
  - Applied `backdrop-filter: blur(4px)` to all modal overlays
  - Enhances focus and depth perception in modal interfaces

## [1.64.0] - 2025-11-29

### Added

**🚀 Production-Grade Architecture:**
- **Web Workers Implementation**: Moved heavy download/upload stream processing to dedicated workers
  - Prevents main thread blocking for smooth 60fps UI during speed tests
  - Separates data processing from UI rendering for optimal performance
  - Eliminates frame drops and stuttering on low-end devices

- **Comprehensive Audit System**: 11-phase automated monitoring and health checks
  - Phase 1-5: Core functionality (latency, infrastructure, security, caching)
  - Phase 6-11: Advanced testing (performance, SSL, network protocols, load testing, error handling, frontend optimization)
  - Automated geographic verification and performance validation

- **Dual Geographic Deployment**: Optimized global performance
  - Nairobi, Kenya deployment (Cloudflare Pages) for African users (14ms latency)
  - Amsterdam, Netherlands deployment (Railway) for global users (180ms latency)
  - 3x performance improvement for East African users

**🛡️ Security & Reliability Enhancements:**
- **CORS Security Hardening**: 403 Forbidden responses for unauthorized origins
- **Preflight Caching**: 24-hour CORS preflight cache eliminates repeated handshake delays
- **Security Headers**: Comprehensive header validation (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- **SSL Certificate Validation**: Automated Let's Encrypt certificate monitoring

**⚡ Performance Optimizations:**
- **Backend CPU Efficiency**: Pre-generated 1MB random buffers eliminate crypto.randomBytes() blocking
- **Memory Management**: Reusable upload blobs prevent garbage collection pauses
- **Idle Task Scheduling**: Non-critical monitoring moved to requestIdleCallback
- **Progressive Enhancement**: Device-aware performance tuning (50-200ms intervals)

### Improved

**System Monitoring & Observability:**
- **Cold Start Analysis**: Railway serverless cold start performance monitoring
- **Load Testing**: Concurrent request handling and rate limiting validation
- **Error Handling**: Comprehensive edge case testing (timeouts, invalid methods, large payloads)
- **Network Protocol Testing**: IPv6 support, HTTP/2 validation, compression verification

**Documentation & Deployment:**
- **Comprehensive Documentation**: Updated all docs with new architecture and audit system
- **Deployment Verification**: Automated location verification (NBO tag confirmation)
- **Health Check Automation**: One-command system validation with detailed reporting

### Fixed

**Architecture Issues:**
- **Main Thread Blocking**: Resolved UI freezing during speed tests via Web Workers
- **Geographic Optimization**: Corrected deployment locations (Nairobi vs Dar es Salaam)
- **CORS Performance**: Eliminated 150ms handshake delay on repeated tests

## [1.63.0] - 2025-11-29

### Fixed

**Critical Module Import Bug:**
- **UI module reference error**: Fixed `ReferenceError: ui is not defined` in `startTest` function
  - Root cause: UI functions imported as named imports but called as `ui.functionName()`
  - Fixed by calling imported functions directly: `showGauge()`, `clearResultsDisplay()`, `setProgress(0)`
  - Resolves console error preventing speed tests from starting

**Speed Measurement Accuracy:**
- **Timing discrepancy in speed calculations**: Fixed download/upload speed showing different values in console vs UI
  - Root cause: Final speed calculated after test threads continued running post-duration
  - Fixed by capturing `finalBytes` and `finalDuration` at exact moment test should end
  - Ensures console and UI display identical, accurate speed measurements
  - Applied to both download and upload tests, including early termination scenarios

**Sparkline Rendering Bug:**
- **SVG path NaN coordinates**: Fixed `Error: <path> attribute d: Expected number, "MNaN,30"`
  - Root cause: Sparkline attempted to draw with only 1 data point (division by zero in coordinate calculation)
  - Fixed by hiding sparkline until at least 2 data points are available
  - Prevents console errors during latency testing

### Added

**Performance Optimizations:**
- **Progressive enhancement**: Device capability detection for optimal update intervals (50-200ms based on CPU cores and memory)
- **RequestIdleCallback integration**: Non-critical memory monitoring scheduled during browser idle periods
- **Frame drop detection**: Real-time UI performance monitoring using requestAnimationFrame
- **Main thread protection**: Idle task scheduling prevents UI blocking during speed tests
- **Backend CPU optimization**: Pre-generated 1MB random buffer eliminates crypto.randomBytes() blocking

**Security Improvements:**
- **PWA update banner security**: Replaced dynamic HTML injection with pre-defined secure banner
- **XSS prevention**: Eliminated potential injection vulnerabilities in update notifications

### Improved

**Learn Page Enhancements:**
- **Professional navigation**: Added sticky table of contents with smooth scrolling
- **Enhanced visual design**: Improved typography, callout boxes, section separators
- **Responsive layout**: Mobile-optimized navigation and content flow
- **Accessibility**: Proper ARIA labels and keyboard navigation support

---

## [1.62.0] - 2025-10-16

### Fixed

**Code Quality & Performance:**
- **State cleanup consistency**: Added `STATE.cancelling = false` to finally block
  - Ensures state is always reset even on exceptions
  - Prevents stuck cancelling state
- **Stability calculation bug**: Fixed inconsistent sample window usage
  - Monitor loops now pass all samples to `isSpeedStable()`
  - Function correctly analyzes last 10 samples (not just 5)
  - Improves reliability of early termination detection

### Improved

**Performance Optimizations:**
- **DOM update efficiency**: Only update `textContent` if value actually changed
  - Applied to gauge value, gauge phase, and matrix cards
  - Prevents unnecessary style recalculation and repaints
- **CSS GPU acceleration**: Added `will-change` and `translateZ(0)` to `.gauge-progress`
  - Enables hardware acceleration for smoother animations
  - Reduces animation jank during gauge updates

**Code Organization:**
- **Magic numbers extracted**: Created `GAUGE_SCALES` constant array
  - Replaced cascading if statements with loop
  - Easier to modify scale breakpoints
- **Dead code removal**: 
  - Removed unused `supportsStreamingUpload()` function (31 lines)
  - Removed unused `STATE.gaugeChart` property
  - Cleaner codebase with less confusion

---

## [1.61.0] - 2025-10-16

### Fixed

**Critical Bug Fixes:**
- **Division-by-zero guards**: Added guards in speed calculations to prevent `Infinity` results
  - Validates duration and totalBytes before calculation
  - Throws error with clear message if data is invalid
- **Unhandled promise rejections**: Added `.catch()` handlers to all thread promises
  - Download and upload threads now handle errors gracefully
  - Failed threads return partial data instead of crashing
- **XSS prevention**: Sanitized history display using DOM manipulation
  - Replaced `innerHTML` with `createElement` and `textContent`
  - Prevents potential HTML injection from corrupted localStorage
- **Rate limiting**: Added 10-second cooldown between tests
  - Prevents spam-clicking the start button
  - Shows countdown message for remaining seconds
- **Memory optimization**: Service Worker update checks now pause when tab is inactive
  - Uses Page Visibility API to stop/start interval
  - Reduces memory pressure on inactive tabs
  - Checks immediately when tab becomes visible again

### Improved

**Code Quality:**
- Better error handling throughout application
- Improved security posture with XSS prevention
- More efficient resource usage with visibility-aware SW updates

---

## [1.60.1] - 2025-10-16

### Fixed

**Promise Handler Safety:**
- Added `finished` guard to upload thread promise handlers
- Prevents double-resolve when abort fires during onload/onerror
- Pattern: `if (finished) return; finished = true;` before each resolve()
- Ensures promise resolves exactly once in all race conditions
- No functional change to behavior, improves resilience

---

## [1.60.0] - 2025-10-16

### 🚀 Major Release: Fixed-Duration Testing & Complete Application Refinement

This major release represents a fundamental architectural shift to fixed-duration testing, eliminating the UI "freeze" issue and providing fast, accurate, and consistent test results. It also includes all critical bug fixes, quality improvements, and code cleanup developed during the refinement process.

### Changed

**Test Methodology - Fixed Duration:**
- **Download test**: Exactly 10 seconds (previously ~60 seconds)
- **Upload test**: Exactly 10 seconds (previously ~60 seconds)
- **Total test time**: ~25 seconds (vs. ~120 seconds before)
- Tests stop at max duration and measure bytes transferred during that period
- Provides consistent, predictable test duration every time
- CONFIG defaults updated to 10 seconds for both download and upload

**UI/UX Improvements:**
- Eliminated "freeze" appearance during upload/download
- Smooth gauge updates throughout entire test
- No value flashing between measurements
- Settings panel default updated to 10 seconds
- Beautiful gradient update banner with slide-down animation
- "Update Now" and "Later" buttons for user control

### Fixed

**Critical Measurement Issues:**
- Fixed upload speed calculations (transmissionEndTime vs. response time)
- Fixed download speed calculations (actual completion time)
- Removed race conditions in monitor loop
- Fixed duplicate gauge updates causing value conflicts
- Server location banner now shows correct location (was "Unknown")
- Upload speed drop issue (prevents 7 Mbps → 1.3 Mbps drop)
- Real-time display bug - Speed gauge now updates every 100ms during test

**Critical PWA Bugs:**
- PWA update mechanism - Moved `newWorker` and `updateAvailable` to global STATE.pwa object
  - Update Now button now correctly sends SKIP_WAITING message
  - Fixes broken PWA update functionality
- Offline caching - Updated ASSETS_TO_CACHE with versioned file names
  - Fixes silent pre-caching failure and broken offline mode

### Improved

**Stability Detection:**
- Analyze longer window (up to 10 samples instead of 5)
- More reliable detection, less sensitive to single bad intervals
- Enhanced logging shows analysis window size

**Service Worker:**
- Periodic update checks every 60 seconds
- Automatic page reload after update activation
- Better user experience with controlled updates

### Added

**Version Management Automation:**
- Created `build-version.js` script for automatic version synchronization
- Reads version from `package.json` (single source of truth)
- Updates `sw.js` (CACHE_NAME + versioned assets)
- Updates `index.html` and `learn.html` (CSS + JS version queries)
- Railway automatically runs script during build phase
- Eliminates manual sync errors and forgotten updates

**Deployment Architecture:**
- Added `railway.json` for proper build/deploy separation
- Build phase: `npm run build` (version sync)
- Start phase: `npm start` (server only)
- Follows platform best practices

**npm Configuration:**
- Added `.npmrc` files to frontend and backend
- Suppresses npm warnings in deployment logs
- Cleaner Railway deployment output

### Removed

**Code Cleanup (~273 lines total):**
- Thread completion tracking complexity (~88 lines)
- Post-loop gauge updates (monitor loop is now sole source of truth)
- "Finishing phase" logic (no longer needed with fixed duration)
- Deleted `uploadWithStreaming()` - deprecated due to slow crypto generation (~95 lines)
- Deleted `uploadWithFallback()` - deprecated for better cross-browser support (~75 lines)
- Deleted `sendChunkXHR()` - helper only used by fallback (~15 lines)
- Removed unused `result-schema.json` documentation file
- Removed 5 obsolete documentation files

**Package.json Cleanup:**
- Separated build and start scripts
- Start script now only runs server (clean separation of concerns)
- Build script handles version synchronization

### Documentation

**New Comprehensive Documentation:**
- `docs/TECHNICAL_NOTES.md` - Design decisions, discrepancies, and rationale (293 lines)
- `docs/FUNCTIONALITY.md` - Complete system architecture and internal workings (576 lines)
- Updated `docs/CHANGELOG.md` - Full version history with detailed release notes (296 lines)

**Documentation Structure:**
- Consolidated from 7 files to 3 focused, comprehensive documents
- Removed obsolete review response and clarification files
- Main README.md updated with badges linking to all documentation

### Technical Details

**Why Fixed Duration?**
Speed is measured by observing data transfer over a specific time period. By controlling the measurement window (10 seconds), we get:
- More consistent results across different connection speeds
- Faster tests without waiting for full file transfers
- Simpler, more maintainable code
- Accurate representation of current network speed

**Philosophy:**
> "Speed is measured by taking a small chunk of time and seeing how many packets are transferred."

This release embodies this principle, moving from "test-to-completion" to "fixed-duration" testing.

See `docs/TECHNICAL_NOTES.md` for detailed technical rationale and `docs/FUNCTIONALITY.md` for complete system architecture.

### Performance

- Total test time reduced by 80% (~120s → ~25s)
- Reduced `main.js` file size by ~2.5KB (gzipped) due to code cleanup
- Faster initial page load
- More efficient Railway deployments
- Cleaner, more maintainable codebase

---

## [1.05.0] - 2025-10-15

### 🚀 Major Release: Production Observability & Upload Optimization

This release focuses on production-grade backend improvements and fixing critical upload speed measurement issues.

### Added

**Backend Observability Stack:**
- Structured logging with Pino (JSON in production, pretty-printed in development)
- Prometheus metrics endpoint (`/metrics`) tracking:
  - Request rates and durations by method/path/status
  - Inflight request count
  - Download/upload bytes transferred
  - Circuit breaker status
- Circuit breaker protection (503 when inflight requests > 100)
- Request performance tracking with X-Process-Time header
- Comprehensive error logging with context

**Frontend Diagnostics:**
- Enhanced error logging with detailed context
- Smart streaming support detection with feature testing
- Console logging for debugging upload issues
- Upload generation time tracking

### Changed

**Upload Speed Measurement (BREAKING FIX):**
- Switched from ReadableStream to XHR with `upload.onprogress` for accurate network tracking
- Eliminated slow crypto generation by using reusable 64KB chunk approach
- Fixed crypto.getRandomValues 65KB limit (was trying to generate 256KB chunks)
- Upload generation time reduced from 20+ seconds to <1 second
- Memory usage reduced by 99.4% (40MB+ → 64KB per thread)
- Upload speeds now realistic and comparable to download speeds

**Backend Body Parsing:**
- Skip JSON body parsing for `/api/upload` endpoint to enable true streaming
- Prevents Express from buffering entire upload in memory
- Allows req.on('data') streaming to work correctly

**Documentation:**
- Comprehensive README update with new features
- Added all environment variables for backend configuration
- Updated API endpoints documentation with metrics endpoint
- Added v1.05.0 changelog with detailed improvements
- Updated technical features section with backend observability details

### Fixed

- Upload speed showing unrealistic values (55 Mbps vs 5.77 Mbps download)
- Crypto.getRandomValues errors exceeding 65536 byte limit
- REUSABLE_UPLOAD_CHUNK using 256KB instead of 64KB
- Backend body parsing interfering with streaming uploads
- Missing progress tracking for actual network transmission
- Slow upload test due to synchronous data generation

### Performance

- **Upload generation time:** 20+ seconds → <1 second
- **Memory per thread:** 40MB+ → 64KB (99.4% reduction)
- **Upload accuracy:** Now measures network speed, not memory allocation speed
- **Backend efficiency:** Stream processing without memory buffering

### Testing

- All 14 backend tests passing
- Production deployment verified on Railway
- Upload/download speeds showing realistic, comparable values
- AbortController cleanup preventing memory leaks
- Race condition guards preventing double-resolve/reject

---

## [1.04.1] - 2025-10-14

### Added
- PWA support with multi-format icons (SVG + PNG fallbacks)
- Learn page screenshot to documentation

### Changed
- Optimized Express routing (removed redundant explicit routes)
- Applied DRY principle to theme icon updates

### Fixed
- Sitemap.xml (removed 404.html for better SEO)

### Removed
- Redundant files for better organization

---

## [1.03.0] - 2025-10-13

### Added
- Comprehensive `/learn` educational page explaining networking concepts
- Real-time progress border animations during measurements
- Custom 404 error page
- Enhanced SEO with updated sitemap

### Changed
- Complete code cleanup (removed verbose comments)
- Refined favicon matching header icon
- Enhanced README with technical documentation

---

## [1.02.0] - 2025-10-12

### Added
- Dark/light theme toggle with system preference detection
- Enhanced gauge visualization
- Configurable test settings
- Mobile responsive improvements

---

## [1.01.0] - 2025-10-11

### Added
- Initial release
- Core speed testing functionality (download, upload, latency, jitter)
- Pure CSS circular gauge
- Basic metrics display
- Multi-threaded testing
- Real-time progress updates

---

## Future Plans

### Service Worker Update UX
- Add SW update detection in registration handler
- Show reload prompt when new version available
- Improve PWA update experience

### Automated Testing & CI
- Add Jest unit tests for logic
- Add Playwright E2E tests for user flow
- Add Lighthouse CI for performance/accessibility
- Automated testing on PR and deployment

### Additional Features
- Historical results comparison
- Export results as JSON/CSV
- Share results via URL
- More detailed jitter analysis
- Network path visualization

---

[1.05.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.04.1...v1.05.0
[1.04.1]: https://github.com/ny-collins/internet_speed_test/compare/v1.03.0...v1.04.1
[1.03.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.02.0...v1.03.0
[1.02.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.01.0...v1.02.0
[1.01.0]: https://github.com/ny-collins/internet_speed_test/releases/tag/v1.01.0
# Changelog

All notable changes to SpeedCheck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.60.0] - 2025-10-16

### 🚀 Major Release: Fixed-Duration Testing & Measurement Accuracy

This release completely overhauls the speed measurement logic to provide fast, accurate, and consistent test results.

### Changed

**Test Methodology - Fixed Duration:**
- **Download test**: Exactly 10 seconds (previously ~60 seconds)
- **Upload test**: Exactly 10 seconds (previously ~60 seconds)
- **Total test time**: ~25 seconds (vs. ~120 seconds before)
- Tests stop at max duration and measure bytes transferred during that period
- Provides consistent, predictable test duration every time

**UI/UX Improvements:**
- Eliminated "freeze" appearance during upload/download
- Smooth gauge updates throughout entire test
- No value flashing between measurements
- Settings panel default updated to 10 seconds

### Fixed

**Measurement Accuracy:**
- Fixed upload speed calculations (transmissionEndTime vs. response time)
- Fixed download speed calculations (actual completion time)
- Removed race conditions in monitor loop
- Fixed duplicate gauge updates causing value conflicts
- Server location banner now shows correct location (was "Unknown")

### Removed

- Thread completion tracking complexity (~60 lines)
- Post-loop gauge updates (monitor loop is now sole source of truth)
- "Finishing phase" logic (no longer needed with fixed duration)

### Technical Details

**Why Fixed Duration?**
Speed is measured by observing data transfer over a specific time period. By controlling the measurement window (10 seconds), we get:
- More consistent results across different connection speeds
- Faster tests without waiting for full file transfers
- Simpler, more maintainable code
- Accurate representation of current network speed

See `docs/TECHNICAL_NOTES.md` for detailed technical rationale.

---

## [1.05.1] - 2025-10-15

### 🔧 Maintenance Release: Critical Bug Fixes & Code Quality

This release addresses critical PWA bugs discovered through code review and improves deployment architecture.

### Fixed

**Critical PWA Bugs:**
- PWA update mechanism - Moved `newWorker` and `updateAvailable` to global STATE.pwa object
  - Update Now button now correctly sends SKIP_WAITING message
  - Fixes broken PWA update functionality
- Offline caching - Updated ASSETS_TO_CACHE with versioned file names
  - Changed `/main.js` to `/main.js?v=1.05.0`
  - Changed `/main.css` to `/main.css?v=1.05.0`
  - Fixes silent pre-caching failure and broken offline mode
- Upload speed drop issue - Enhanced XHR upload progress tracking
  - Added `xhr.upload.onloadend` to mark transmission complete
  - Skip zero-progress intervals in speed sample collection
  - Prevents screen freeze and speed drop from 7 Mbps to 1.3 Mbps
- Real-time display bug - Speed gauge now updates every 100ms during test
  - Shows instantaneous speed early, rolling average once stable
  - Fixes em dash (—) appearing until test completes

### Improved

**Stability Detection:**
- Analyze longer window (up to 10 samples instead of 5)
- More reliable detection, less sensitive to single bad intervals
- Enhanced logging shows analysis window size

**Service Worker Update UX:**
- Beautiful gradient update banner with slide-down animation
- "Update Now" and "Later" buttons for user control
- Periodic update checks every 60 seconds
- Automatic page reload after update activation

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

**Code Cleanup (~185 lines):**
- Deleted `uploadWithStreaming()` - deprecated due to slow crypto generation
- Deleted `uploadWithFallback()` - deprecated for better cross-browser support
- Deleted `sendChunkXHR()` - helper only used by fallback
- Removed unused `result-schema.json` documentation file

**Package.json Cleanup:**
- Separated build and start scripts
- Start script now only runs server (clean separation of concerns)
- Build script handles version synchronization

### Documentation

- `docs/CODE_REVIEW_RESPONSE.md` - Detailed fixes for critical bugs
- `docs/CODE_REVIEW_CLARIFICATION.md` - Project structure clarifications
- `docs/BUILD_SCRIPT.md` - Version management automation guide
- Updated workflow documentation for new architecture

### Performance

- Reduced `main.js` file size by ~1.8KB (gzipped) due to code cleanup
- Faster initial page load
- More efficient Railway deployments

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
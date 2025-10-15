# Changelog

All notable changes to SpeedCheck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

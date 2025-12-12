# Changelog

All notable changes to SpeedCheck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.69.0] - 2025-12-05

### Changed
- Split layout ratio from 320px fixed to 45:55 fractional units for better balance
- Secondary metrics (ping/jitter) moved to compact inline display below speed cards
- Gauge container increased from 280px to 360px for better visual impact
- Start button changed to 100% width with aspect-ratio 1:1

### Removed
- Quality badge system ("Good", "Fair", "Poor") eliminated as subjective and context-dependent

### Added
- Physics-aware analysis system with speed-of-light calculations and routing context
- Complete graph history visualization with horizontal compression (removed 50-sample limit)

### Fixed
- JavaScript selectors updated for new secondary metrics layout
- Eslint compliance achieved (quote consistency, trailing whitespace, unused variables)
- CSS conflicts resolved between components.css and main.css

## [1.68.0] - 2025-12-02

### Security
- **CRITICAL:** Removed `'unsafe-inline'` from CSP (major XSS vulnerability fix)
- Extracted all inline scripts to external files (init.js, edge-banner.js, settings-helper.js, learn-init.js)
- Future-proof `connect-src` with `*.railway.app` and `unpkg.com`
- Removed X-Powered-By header across all deployments
- Added comprehensive HSTS, CSP, and Permissions-Policy headers

### Added
- Immutable caching for versioned assets (1-year max-age)
- No-cache policy for HTML to ensure fresh content

## [1.67.0] - 2025-12-02

### Added
- Catmull-Rom spline smoothing for real-time speed graph (quadratic Bézier curves)
- Responsive canvas handling with resize listeners
- Learn Center article-based layout with sticky sidebar navigation
- Auto-generated table of contents from H2/H3 headings
- Reading time estimates (5-10 minutes)
- Prev/Next navigation cards for article progression

### Fixed
- Syntax error in `updateHistoryUI` function
- Selector safety for tray cards using `data-metric` attributes
- Page loader stuck at "Loading future insights..." message

## [1.66.0] - 2025-12-02

### Added
- Two-column desktop layout (45/55 split) with sticky gauge column
- Real-time variance graph with bufferbloat detection
- Quality badge system for latency and jitter
- Contextual latency recommendations
- Interactive accordion footer (6 expandable sections)
- Enhanced start button (340px circular gradient)

### Improved
- Variance tracking with 50-sample rolling buffer (100ms intervals)
- High-DPI canvas rendering for retina displays
- State management for variance graph

## [1.65.0] - 2025-11-29

### Added
- TCP slow start compensation using byte tracking
- Bufferbloat detection with loaded latency measurement
- Asynchronous completion handling

### Fixed
- Race condition causing 0 Mbps results
- Broken test cancellation functionality
- ES module integration for Web Workers
- Reduced motion support for accessibility
- Touch target optimization (44px minimum)

## [1.64.0] - 2025-11-29

### Added
- Web Workers implementation for stream processing
- Comprehensive 11-phase audit system
- Dual geographic deployment (Amsterdam + Nairobi)
- CORS security hardening with 24-hour preflight caching
- Pre-generated buffers for CPU efficiency

### Improved
- Cold start analysis and load testing
- Network protocol testing (IPv6, HTTP/2)
- Documentation and deployment verification

## [1.63.0] - 2025-11-29

### Fixed
- Module import bug (`ui is not defined`)
- Speed calculation timing discrepancy
- Sparkline rendering bug (NaN coordinates)

### Added
- Progressive enhancement with device capability detection
- RequestIdleCallback integration for memory monitoring
- Frame drop detection
- PWA update banner security improvements

## [1.62.0] - 2025-10-16

### Fixed
- State cleanup consistency in finally block
- Stability calculation sample window usage

### Improved
- DOM update efficiency (only update if value changed)
- CSS GPU acceleration for gauge animations
- Code organization (extracted magic numbers)

## [1.61.0] - 2025-10-16

### Fixed
- Division-by-zero guards in speed calculations
- Unhandled promise rejections with `.catch()` handlers
- XSS prevention with DOM manipulation
- Rate limiting (10-second cooldown between tests)
- Memory optimization with Page Visibility API

## [1.60.1] - 2025-10-16

### Fixed
- Promise handler safety with `finished` guard
- Double-resolve prevention in upload thread

## [1.60.0] - 2025-10-16

### Changed
- Fixed-duration testing (10 seconds per test vs. 60 seconds)
- Total test time reduced to ~25 seconds (was ~120 seconds)

### Fixed
- Upload/download speed calculations
- Duplicate gauge updates
- Server location banner
- PWA update mechanism

### Added
- Version management automation (`build-version.js`)
- Deployment architecture with `railway.json`
- npm configuration with `.npmrc`

### Removed
- Thread completion tracking complexity (~88 lines)
- Deprecated upload methods (~185 lines)
- 5 obsolete documentation files

## [1.05.0] - 2025-10-15

### Added
- Structured logging with Pino
- Prometheus metrics endpoint (`/metrics`)
- Circuit breaker protection
- Request performance tracking

### Changed
- Upload speed measurement switched to XHR with `upload.onprogress`
- Reusable 64KB chunk approach (was 256KB)
- Memory usage reduced by 99.4% (40MB+ → 64KB)

### Fixed
- Upload speed showing unrealistic values
- Crypto.getRandomValues 65KB limit error
- Backend body parsing interfering with streaming

## [1.04.1] - 2025-10-14

### Added
- PWA support with multi-format icons
- Learn page screenshot

### Changed
- Optimized Express routing
- Applied DRY principle to theme updates

## [1.03.0] - 2025-10-13

### Added
- Comprehensive `/learn` educational page
- Real-time progress border animations
- Custom 404 error page
- Enhanced SEO with sitemap

## [1.02.0] - 2025-10-12

### Added
- Dark/light theme toggle
- Enhanced gauge visualization
- Configurable test settings
- Mobile responsive improvements

## [1.01.0] - 2025-10-11

### Added
- Initial release with core speed testing functionality
- Pure CSS circular gauge
- Multi-threaded testing
- Real-time progress updates

---

## Future Plans

- Service Worker update detection with reload prompt
- Jest unit tests and Playwright E2E tests
- Lighthouse CI for performance/accessibility
- Historical results comparison
- Export results as JSON/CSV
- Share results via URL
- Network path visualization

---

[1.69.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.68.0...v1.69.0
[1.68.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.67.0...v1.68.0
[1.67.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.66.0...v1.67.0
[1.66.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.65.0...v1.66.0
[1.65.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.64.0...v1.65.0
[1.64.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.63.0...v1.64.0
[1.63.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.62.0...v1.63.0
[1.62.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.61.0...v1.62.0
[1.61.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.60.1...v1.61.0
[1.60.1]: https://github.com/ny-collins/internet_speed_test/compare/v1.60.0...v1.60.1
[1.60.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.05.0...v1.60.0
[1.05.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.04.1...v1.05.0
[1.04.1]: https://github.com/ny-collins/internet_speed_test/compare/v1.03.0...v1.04.1
[1.03.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.02.0...v1.03.0
[1.02.0]: https://github.com/ny-collins/internet_speed_test/compare/v1.01.0...v1.02.0
[1.01.0]: https://github.com/ny-collins/internet_speed_test/releases/tag/v1.01.0

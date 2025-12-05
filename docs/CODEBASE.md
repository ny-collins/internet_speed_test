# Codebase Architecture Documentation

**Last Updated:** 4 December 2025  
**Project:** SpeedCheck - Internet Speed Test Application  
**Purpose:** Complete reference for file organization, dependencies, and data flow

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Core JavaScript Files](#core-javascript-files)
4. [Test Modules](#test-modules)
5. [Web Workers](#web-workers)
6. [UI & Visualization](#ui--visualization)
7. [CSS Architecture](#css-architecture)
8. [HTML Pages](#html-pages)
9. [Utilities & Helpers](#utilities--helpers)
10. [Data Flow](#data-flow)
11. [State Management](#state-management)
12. [Configuration System](#configuration-system)
13. [Dependency Graph](#dependency-graph)

---

## Project Overview

SpeedCheck is a web-based internet speed test application that measures:
- **Download Speed** (Mbps) - Multi-threaded with Web Workers
- **Upload Speed** (Mbps) - Multi-threaded with Web Workers  
- **Latency** (ms) - Ping time to test server
- **Jitter** (ms) - Latency variability
- **Loaded Latency** (ms) - Bufferbloat detection during active transfers

**Key Features:**
- Latency-based thread optimization (1-4 threads based on connection quality)
- Progressive Web App (PWA) with offline support
- Real-time visualization (gauge, mini-graphs, sparklines)
- Test history with trend charts
- Responsive design (desktop & mobile)
- Accessibility (ARIA, keyboard navigation, screen reader support)

---

## Directory Structure

```
frontend/public/
├── index.html                    # Main speed test page
├── learn.html                    # Learning hub page
├── 404.html                      # Error page
├── robots.txt                    # Search engine crawling rules
├── sitemap.xml                   # SEO sitemap
├── sw.js                         # Service Worker (PWA)
│
├── assets/                       # Images & icons
│   ├── favicon.svg
│   ├── favicon-192x192.png
│   ├── favicon-512x512.png
│   ├── social-preview.png        # Open Graph image
│   └── learn_page.png            # Learn page preview
│
├── css/                          # Stylesheets
│   ├── vars.css                  # Design tokens (colors, spacing, typography)
│   ├── base.css                  # Reset & typography
│   ├── layout.css                # Grid systems & page structure
│   ├── components.css            # Reusable UI components
│   ├── pages.css                 # Page-specific styles
│   ├── utils.css                 # Utility classes
│   └── pages/
│       ├── home.css              # Split layout + gauge (merged stage-tray.css + gauge.css)
│       └── learn.css             # Learn page styles (merged all learn/*.css)
│
└── js/                           # JavaScript modules
    ├── app.js                    # Main entry point (orchestrates initialization)
    ├── config.js                 # Configuration constants
    ├── state.js                  # Global application state
    ├── dom.js                    # DOM element references
    ├── engine.js                 # Event handlers & UI controllers
    ├── ui.js                     # UI rendering & animations
    ├── utils.js                  # Utility functions
    ├── chart.js                  # History chart rendering
    ├── worker.js                 # Service Worker registration
    ├── worker-utils.js           # Shared worker utilities
    │
    ├── modules/                  # Test modules
    │   ├── latency.js            # Latency & jitter measurement
    │   ├── download.js           # Download speed test
    │   └── upload.js             # Upload speed test
    │
    └── workers/                  # Web Workers (background threads)
        ├── download.worker.js    # Download test worker
        └── upload.worker.js      # Upload test worker
```

---

## Core JavaScript Files

### 1. **app.js** - Main Entry Point
**Purpose:** Application orchestrator and initialization  
**Responsibilities:**
- DOMContentLoaded event handler
- Initialize PWA, theme, icons
- Query DOM elements
- Register test functions
- Setup event listeners
- Load configuration and history
- Fetch server info
- Initialize accessibility
- Run speed tests (latency → download → upload)
- Handle test results and history

**Key Functions:**
- `initializeApp()` - Bootstrap the application
- `optimizeThreadCount()` - Adjust thread count based on latency (>200ms = 1 thread, 100-200ms = 2, <100ms = 4)
- `startTest()` - Execute full test sequence
- `cancelTest()` - Abort ongoing tests
- `retryTest()` - Re-run last test
- `saveTestResult()` - Persist results to localStorage
- `loadHistory()` - Load past test results
- `fetchServerInfo()` - Get server location/info from backend

**Dependencies:**
- Imports: dom.js, engine.js, worker.js, ui.js, utils.js, chart.js, modules/*.js, config.js, state.js
- Called by: DOMContentLoaded event
- Calls: All other modules

**Exports:** None (entry point only)

---

### 2. **config.js** - Configuration System
**Purpose:** Centralized application configuration  
**Responsibilities:**
- Define test parameters (threads, duration, stability thresholds)
- Performance tuning based on device capabilities
- API endpoint configuration
- UI animation constants
- Accessibility settings

**Key Configuration Objects:**
```javascript
CONFIG = {
  threads: { download: 4, upload: 4, min: 1, max: 8 },
  duration: {
    download: { min: 8s, max: 20s, default: 15s },  // Optimized for high-latency links
    upload: { min: 8s, max: 20s, default: 15s }
  },
  stability: {
    sampleCount: 5,               // Min samples before stability check
    checkWindow: 10,              // Analyze last 10 samples
    varianceThreshold: 0.30       // 30% variance (TCP over international links)
  },
  warmupDuration: 2.0,            // Exclude TCP slow-start data
  updateInterval: 50-200ms,       // Dynamic based on device performance
  apiBase: 'https://speed-test-backend.up.railway.app'
}
```

**Dynamic Optimization:**
- `getOptimalUpdateInterval()` - Adjusts UI update frequency based on:
  - `navigator.hardwareConcurrency` (CPU cores)
  - `navigator.deviceMemory` (RAM)
  - Low-end: 200ms, Mid-range: 100ms, High-end: 50ms

**Dependencies:** None  
**Exports:** CONFIG (read-only configuration object)  
**Used by:** All modules that need configuration

---

### 3. **state.js** - Global State Management
**Purpose:** Single source of truth for application state  
**Responsibilities:**
- Track test execution status
- Store test results
- Manage abort controllers
- Track UI state (gauge, charts, animations)
- PWA update management
- Performance monitoring

**State Structure:**
```javascript
STATE = {
  testing: false,                   // Is a test running?
  cancelling: false,                // Is test being cancelled?
  currentPhase: 'idle',             // 'latency', 'download', 'upload'
  gaugeElement: null,               // Reference to gauge SVG/element
  lastMaxScale: 100,                // Last gauge scale (for smooth transitions)
  testResults: {
    download: null,                 // { speed, confidence, stability, ... }
    upload: null,
    latency: null,                  // { average, min, max, median, jitter, ... }
    jitter: null
  },
  abortControllers: [],             // Track AbortControllers for cancellation
  serverInfo: null,                 // Server location/info
  history: [],                      // Past test results (localStorage)
  rafId: null,                      // requestAnimationFrame ID
  performance: {                    // Performance monitoring
    monitoring: false,
    lastCheck: 0,
    blockWarnings: 0,
    maxBlockTime: 0
  },
  pwa: {                            // PWA update state
    updateAvailable: false,
    newWorker: null
  },
  varianceGraph: {                  // Mini-graph tracking
    samples: [],
    maxSamples: 50,
    active: false,
    animations: { ... }
  }
}
```

**Dependencies:** None  
**Exports:** STATE (mutable state object)  
**Used by:** All modules that need shared state

---

### 4. **dom.js** - DOM Element References
**Purpose:** Centralized DOM element cache  
**Responsibilities:**
- Define DOM element references
- Query and cache elements on initialization
- Prevent repeated DOM queries (performance)

**Element Categories:**
- Theme & Settings (toggle switches, panels)
- Test Controls (start, cancel, retry buttons)
- Gauge Elements (circle, progress, value, phase)
- Results Display (cards, matrix, mini-graphs)
- Server Info (location, limits)
- Progress & Status (bars, timers)
- History (list, clear, export)
- Accessibility (ARIA live regions)

**Key Functions:**
- `queryDOMElements()` - Query and cache all DOM references (called once on init)

**Dependencies:** None  
**Exports:** DOM (object with element references), queryDOMElements()  
**Used by:** app.js (initialization), ui.js (updates), engine.js (event handlers)

---

### 5. **engine.js** - Event Handlers & Controllers
**Purpose:** UI event handling and interaction logic  
**Responsibilities:**
- Theme toggling (dark/light mode)
- Settings panel management
- Test control event handlers
- Keyboard shortcuts
- Tab navigation
- Accordion functionality
- Modal management
- Configuration updates

**Key Functions:**
- `registerTestFunctions()` - Register test callbacks (avoids circular dependencies)
- `initializeEventListeners()` - Attach all DOM event listeners
- `toggleTheme()` - Switch between dark/light theme (persist to localStorage)
- `toggleSettings()` - Show/hide settings panel
- `updateSettingValue()` - Update config value and UI
- `saveSettings()` - Persist settings to localStorage
- `resetSettings()` - Restore default configuration
- `handleKeyboardShortcuts()` - Handle keyboard commands (Space, R, C, etc.)
- `initializeTabNavigation()` - Setup sidebar tab switching
- `initializeAccordion()` - Setup collapsible sections

**Dependencies:**
- Imports: dom.js, config.js, state.js, ui.js
- Receives: Test function callbacks from app.js

**Exports:** All event handler functions  
**Used by:** app.js (registers callbacks), dom.js (attaches listeners)

---

### 6. **utils.js** - Utility Functions
**Purpose:** Reusable helper functions  
**Responsibilities:**
- Async utilities (sleep, idle task scheduling)
- Data formatting (bytes, speed, latency)
- Quality assessment (speed/latency quality ratings)
- Error handling (user-friendly error messages)
- Network info (connection type detection)
- Loaded latency measurement (bufferbloat)
- Performance monitoring

**Key Functions:**
- `sleep(ms)` - Promise-based delay
- `scheduleIdleTask()` / `cancelIdleTask()` - Non-blocking task scheduling
- `formatBytes(bytes)` - Human-readable size (B, KB, MB, GB)
- `getSpeedQuality(speed, type)` - 'Excellent', 'Good', 'Average', 'Slow'
- `getSpeedContext(speed, type)` - Usage context ('4K streaming', 'Video calls', etc.)
- `getLatencyQuality(latency)` - Latency quality rating
- `getJitterQuality(jitter)` - Jitter quality rating
- `getFriendlyError(error)` - Convert technical errors to user-friendly messages
- `getConnectionType()` - Detect connection type (WiFi, 4G, etc.)
- `measureLoadedLatency()` - Measure latency during active data transfer (detects bufferbloat)
- `performanceMonitor` - Track UI thread blocking and memory usage

**Dependencies:** None  
**Exports:** All utility functions  
**Used by:** All modules that need data formatting or utilities

---

## Test Modules

### 7. **modules/latency.js** - Latency Measurement
**Purpose:** Measure ping latency and jitter  
**Responsibilities:**
- Send 10 ping requests to `/api/ping`
- Calculate average, min, max, median latency
- Detect and remove statistical outliers
- Calculate jitter (latency variability)
- Update UI with sparkline graph
- Calculate confidence score

**Test Flow:**
1. Send 10 GET requests to `/api/ping` (cache: 'no-store')
2. Record round-trip time for each request
3. Filter outliers (>2 std deviations from median)
4. Calculate statistics (avg, min, max, median)
5. Calculate jitter (mean absolute deviation)
6. Update result cards and progress bar (0-25%)

**Key Functions:**
- `measureLatency()` - Main latency test function
- `removeOutliers()` - Statistical outlier removal
- `calculateMedian()` - Median calculation
- `calculateJitter()` - Mean absolute deviation
- `calculateJitterStats()` - Min/max/median jitter
- `calculateLatencyConfidence()` - Confidence scoring

**Dependencies:**
- Imports: config.js, state.js, utils.js, ui.js
- API: `/api/ping` endpoint

**Exports:** measureLatency()  
**Used by:** app.js (test sequence)

---

### 8. **modules/download.js** - Download Test (Web Worker)
**Purpose:** Measure download speed using Web Workers  
**Responsibilities:**
- Create Web Worker for background download processing
- Download data from `/api/download` endpoint
- Track bytes transferred and speed
- Calculate smoothed speed (exponential moving average)
- Update gauge and progress bar in real-time
- Detect speed stability (early termination if stable)
- Measure loaded latency concurrently
- Calculate confidence score

**Test Flow:**
1. Create download.worker.js instance
2. Send 'start_download' message with config and thread count
3. Worker spawns N threads downloading data
4. Worker posts 'progress_update' messages every 500ms
5. Main thread updates UI (throttled to 100ms)
6. Test runs until stable or max duration reached
7. Worker posts 'download_complete' with final results
8. Loaded latency measured concurrently

**Key Functions:**
- `measureDownload()` - Main download test orchestrator
- Handles worker messages: `progress_update`, `download_complete`, `download_error`
- Updates gauge, mini-graph, progress bar, result card

**Worker Communication:**
```javascript
// Outbound (main → worker)
worker.postMessage({
  type: 'start_download',
  config: CONFIG,
  threadCount: 4
});

// Inbound (worker → main)
worker.onmessage = ({ type, currentSpeed, speed, stability, confidence, ... })
```

**Dependencies:**
- Imports: config.js, state.js, utils.js, ui.js
- Worker: workers/download.worker.js
- API: `/api/download` endpoint

**Exports:** measureDownload()  
**Used by:** app.js (test sequence)

---

### 9. **modules/upload.js** - Upload Test (Web Worker)
**Purpose:** Measure upload speed using Web Workers  
**Responsibilities:**
- Create Web Worker for background upload processing
- Upload data to `/api/upload` endpoint
- Track bytes transferred and speed
- Calculate smoothed speed (exponential moving average)
- Update gauge and progress bar in real-time
- Detect speed stability (early termination if stable)
- Measure loaded latency concurrently
- Calculate confidence score

**Test Flow:**
1. Create upload.worker.js instance
2. Send 'start_upload' message with config and thread count
3. Worker spawns N threads uploading random data
4. Worker posts 'progress_update' messages every 500ms
5. Main thread updates UI (throttled to 100ms)
6. Test runs until stable or max duration reached
7. Worker posts 'upload_complete' with final results
8. Loaded latency measured concurrently

**Key Functions:**
- `measureUpload()` - Main upload test orchestrator
- Handles worker messages: `progress_update`, `upload_complete`, `upload_error`
- Updates gauge, mini-graph, progress bar, result card

**Worker Communication:**
```javascript
// Outbound (main → worker)
worker.postMessage({
  type: 'start_upload',
  config: CONFIG,
  threadCount: 4
});

// Inbound (worker → main)
worker.onmessage = ({ type, currentSpeed, speed, stability, confidence, ... })
```

**Dependencies:**
- Imports: config.js, state.js, utils.js, ui.js
- Worker: workers/upload.worker.js
- API: `/api/upload` endpoint

**Exports:** measureUpload()  
**Used by:** app.js (test sequence)

---

## Web Workers

### 10. **workers/download.worker.js** - Download Worker
**Purpose:** Offload download test processing to background thread  
**Responsibilities:**
- Spawn multiple download threads (HTTP streams)
- Track bytes transferred and elapsed time
- Calculate speed samples every 500ms
- Detect speed stability (variance threshold)
- Exclude warm-up period from final calculation
- Calculate confidence score based on stability and sample count
- Handle test cancellation (AbortController)

**Architecture:**
- Runs in separate thread (no main thread blocking)
- Communicates via postMessage/onmessage
- Uses shared `monitorLoop` from worker-utils.js

**Test Execution:**
1. Receive 'start_download' message
2. Initialize abort controller and timing
3. Spawn N fetch streams to `/api/download`
4. Monitor progress every 500ms:
   - Calculate interval speed: `(intervalBytes * 8) / intervalDuration / 1,000,000` Mbps
   - Store speed samples
   - Check stability (variance < threshold)
   - Post progress update to main thread
5. On completion or stability:
   - Calculate final speed (exclude warm-up period)
   - Calculate stability percentage
   - Calculate confidence score
   - Post 'download_complete' message

**Stability Detection:**
```javascript
// Check last 10 samples for variance
const variance = samples.reduce((sum, speed) => {
  const diff = (speed - avg) / avg;
  return sum + (diff * diff);
}, 0) / samples.length;

return variance < 0.30;  // 30% variance threshold
```

**Dependencies:**
- Imports: worker-utils.js (monitorLoop)
- API: `/api/download` endpoint

**Exports:** Worker self (runs autonomously)  
**Used by:** modules/download.js

---

### 11. **workers/upload.worker.js** - Upload Worker
**Purpose:** Offload upload test processing to background thread  
**Responsibilities:**
- Generate random data for upload
- Spawn multiple upload threads (HTTP POSTs)
- Track bytes transferred and elapsed time
- Calculate speed samples every 500ms
- Detect speed stability (variance threshold)
- Exclude warm-up period from final calculation
- Calculate confidence score based on stability and sample count
- Handle test cancellation (AbortController)

**Architecture:**
- Runs in separate thread (no main thread blocking)
- Communicates via postMessage/onmessage
- Uses shared `monitorLoop` from worker-utils.js
- Generates random ArrayBuffer data (10MB chunks)

**Test Execution:**
1. Receive 'start_upload' message
2. Initialize abort controller and timing
3. Generate random data chunks (10MB each)
4. Spawn N fetch POSTs to `/api/upload`
5. Monitor progress every 500ms:
   - Calculate interval speed: `(intervalBytes * 8) / intervalDuration / 1,000,000` Mbps
   - Store speed samples
   - Check stability (variance < threshold)
   - Post progress update to main thread
6. On completion or stability:
   - Calculate final speed (exclude warm-up period)
   - Calculate stability percentage
   - Calculate confidence score
   - Post 'upload_complete' message

**Data Generation:**
```javascript
// Generate random binary data for upload
const data = new ArrayBuffer(10 * 1024 * 1024);  // 10MB
const view = new Uint8Array(data);
crypto.getRandomValues(view);
```

**Dependencies:**
- Imports: worker-utils.js (monitorLoop)
- API: `/api/upload` endpoint

**Exports:** Worker self (runs autonomously)  
**Used by:** modules/upload.js

---

### 12. **worker-utils.js** - Shared Worker Utilities
**Purpose:** Shared utilities for Web Workers  
**Responsibilities:**
- Provide reusable monitor loop for speed tracking
- Centralize interval speed calculation logic
- Handle timing and sample management

**Key Functions:**
- `monitorLoop()` - Periodic monitoring function for workers
  - Calculates interval speed every 500ms
  - Tracks bytes transferred since last check
  - Returns: `{ currentSpeed, totalSpeed, samples, ... }`

**Dependencies:** None  
**Exports:** monitorLoop()  
**Used by:** download.worker.js, upload.worker.js

---

## UI & Visualization

### 13. **ui.js** - UI Rendering & Animations
**Purpose:** All UI updates, animations, and visualization  
**Responsibilities:**
- Gauge rendering and updates
- Result card updates
- Progress bar animation
- Phase indicators (latency, download, upload)
- Mini-graph rendering (download/upload speed curves)
- Sparkline charts (jitter)
- Number animations (smooth counting)
- Matrix card highlighting
- History display
- Confidence indicators
- Test context information

**Key Functions:**

**Gauge:**
- `buildMainGauge()` - Initialize gauge (CSS-based)
- `showGauge()` / `hideGauge()` - Toggle gauge visibility
- `updateGauge(speed, phase)` - Update gauge value and rotation (conic-gradient)
- `resetGauge()` - Reset gauge to initial state

**Progress:**
- `setProgress(percent)` - Update progress bar (0-100%)
- `updatePhaseUI(phase, state)` - Update phase indicators ('idle', 'active', 'complete')
- `startCountdown(seconds)` / `hideCountdown()` - Timer display

**Results:**
- `updateResultCard(metric, data)` - Update download/upload/latency/jitter cards
- `updateMatrixCardLive(phase, speed)` - Real-time speed display during test
- `clearResultsDisplay()` - Clear all result cards

**Animations:**
- `animateNumber(element, from, to, duration)` - Smooth number counting
- `highlightTrayCard(metric)` - Highlight active measurement card
- `clearTrayHighlights()` - Remove card highlights

**Graphs:**
- `startSpeedCurve(type)` / `stopSpeedCurve()` - Mini-graph lifecycle
- `updateSpeedCurve(speed)` - Add data point to mini-graph
- `resetSpeedCurve()` - Clear mini-graph
- `drawMiniGraph(canvas, samples)` - Render mini-graph on canvas
- `drawSparkline(samples)` - Render jitter sparkline

**History:**
- `displayHistoryStats()` - Show test history section
- `updateHistoryStats()` - Update history statistics
- `updateTestContext(metric, speed)` - Show usage context ('4K streaming', etc.)

**Confidence:**
- `showConfidenceIndicator(metric, confidence)` - Show confidence bar (50-100%)
- `showMeasurementInfoButton(metric)` - Show info button

**Accessibility:**
- `announceToScreenReader(message)` - ARIA live region updates
- `showStatus(message, type)` - Status toast notifications

**Dependencies:**
- Imports: dom.js, state.js, config.js, utils.js
- Uses: requestAnimationFrame for smooth animations

**Exports:** All UI functions (40+ functions)  
**Used by:** app.js, modules/*.js (all test modules)

---

### 14. **chart.js** - History Chart Rendering
**Purpose:** Canvas-based mini-chart for test history  
**Responsibilities:**
- Render download/upload speed trends
- Draw smooth lines with gradients
- Handle high-DPI displays (devicePixelRatio)
- Responsive resizing
- Empty state display

**Chart Features:**
- Smooth cubic Bézier curves
- Gradient area fills
- Axis lines
- Responsive to container size
- Last 20 data points displayed
- Blue line = Download, Purple line = Upload

**Key Functions:**
- `drawHistoryChart(historyData)` - Main rendering function
- `drawSmoothLine(ctx, data, metric, ...)` - Draw smooth curve with gradient
- `drawEmptyState(ctx, width, height)` - Show "No history yet" message

**Dependencies:**
- Uses: HTML5 Canvas API
- No imports (standalone)

**Exports:** drawHistoryChart()  
**Used by:** app.js (after saving results, on window resize)

---

### 15. **worker.js** - Service Worker Registration
**Purpose:** PWA service worker lifecycle management  
**Responsibilities:**
- Register service worker (/sw.js)
- Check for updates periodically (60s interval)
- Pause update checks when page hidden
- Show update banner when new version available
- Handle service worker updates (install, activate)

**Update Flow:**
1. Register service worker on app load
2. Check for updates every 60 seconds
3. On update found:
   - Set `STATE.pwa.updateAvailable = true`
   - Store new worker reference
   - Show update banner with "Update Now" button
4. On "Update Now" click:
   - Post 'SKIP_WAITING' message to new worker
   - Reload page to activate new version

**Key Functions:**
- `registerServiceWorker()` - Initialize PWA
- Handles: `updatefound`, `controllerchange` events
- Manages: Update interval based on page visibility

**Dependencies:**
- Imports: state.js
- Registers: /sw.js

**Exports:** registerServiceWorker()  
**Used by:** app.js (initialization)

---

## CSS Architecture

### 16. **css/vars.css** - Design Tokens
**Purpose:** Centralized CSS variables (design system)  
**Defines:**
- Colors (light/dark theme)
  - Background: `--color-bg-primary`, `--color-bg-elevated`
  - Text: `--color-text-primary`, `--color-text-secondary`
  - Brand: `--color-primary`, `--color-accent`
  - Status: `--color-success`, `--color-warning`, `--color-danger`
- Spacing scale (0.25rem - 4rem)
- Typography (font families, sizes, weights)
- Border radius (0.25rem - 2rem)
- Shadows (sm, md, lg, xl)
- Transitions (150ms - 300ms)

**Theme Switching:**
```css
[data-theme="dark"] {
  --color-bg-primary: #0f172a;
  --color-text-primary: #f1f5f9;
  /* ... */
}
```

**Line Count:** ~200 lines  
**Used by:** All CSS files (variables referenced throughout)

---

### 17. **css/base.css** - Reset & Typography
**Purpose:** Normalize browser defaults, typography base styles  
**Defines:**
- CSS reset (box-sizing, margin, padding)
- Body styles (font-family, color, background)
- Typography (headings, paragraphs, links)
- Scroll behavior (smooth scrolling)
- Focus styles (keyboard navigation)

**Line Count:** ~150 lines  
**Used by:** All pages (base layer)

---

### 18. **css/layout.css** - Grid Systems & Structure
**Purpose:** Page layout, grid systems, responsive design  
**Defines:**
- `.app-container` - Main content wrapper (max-width: 1200px)
- Header layout
- Footer layout
- Responsive breakpoints:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- Split layout grid (320px gauge | 1fr cards)
- Cards grid (2×2 matrix)

**Key Classes:**
- `.split-layout` - Main test interface layout
- `.gauge-section` - Left sidebar with gauge
- `.cards-section` - Right grid with result cards
- `.cards-grid` - 2×2 grid for measurement cards

**Line Count:** ~250 lines  
**Used by:** index.html, learn.html

---

### 19. **css/components.css** - Reusable Components
**Purpose:** Button styles, cards, modals, tooltips, badges  
**Defines:**
- Buttons (`.btn-primary`, `.btn-secondary`, `.btn-ghost`)
- Cards (`.card`, `.tray-card`, `.matrix-card`)
- Modals (`.modal`, `.modal-overlay`)
- Tooltips (`.tooltip`)
- Badges (`.badge`, `.badge-success`, `.badge-warning`)
- Form inputs (`.input`, `.select`, `.checkbox`)
- Loading spinners
- Toast notifications

**Line Count:** ~300 lines  
**Used by:** All pages (shared components)

---

### 20. **css/pages/home.css** - Speed Test Page
**Purpose:** Split layout, gauge, result cards (merged stage-tray.css + gauge.css)  
**Defines:**
- Split layout (320px gauge | 1fr cards)
- Circular gauge styles:
  - `.gauge-container` - Wrapper
  - `.gauge-circle` - Base circle with gradient border
  - `.gauge-progress` - Animated conic-gradient progress
  - `.gauge-inner` - Center content (value, phase)
- Mini-graphs:
  - `.mini-graph` - Canvas container (80px height)
  - Responsive scaling (devicePixelRatio)
- Result cards:
  - `.tray-card` - Measurement card with animated border
  - `.matrix-number` - Large speed value
  - `.matrix-label` - Metric label
  - `.confidence-indicator` - Confidence bar
- Progress animations (conic-gradient rotation)

**Key Features:**
- 270° gauge rotation (3/4 circle)
- Smooth number animations
- Real-time border progress animation
- Mini-graph canvas rendering

**Line Count:** ~1090 lines (merged from 2 files)  
**Used by:** index.html (main test page)

---

### 21. **css/pages/learn.css** - Learn Hub Page
**Purpose:** Learn page styles (merged all learn/*.css files)  
**Defines:**
- Article cards
- Hero sections
- Content blocks
- Code snippets
- Image styles
- Navigation breadcrumbs

**Line Count:** ~400 lines (merged from 4 files)  
**Used by:** learn.html, learn/*.html

---

### 22. **css/utils.css** - Utility Classes
**Purpose:** Single-purpose utility classes  
**Defines:**
- Display: `.hidden`, `.flex`, `.grid`
- Spacing: `.m-0`, `.p-2`, `.gap-4`
- Text: `.text-center`, `.text-bold`, `.text-sm`
- Colors: `.bg-primary`, `.text-success`
- Accessibility: `.sr-only` (screen reader only)

**Line Count:** ~100 lines  
**Used by:** All pages (utility layer)

---

## HTML Pages

### 23. **index.html** - Main Speed Test Page
**Purpose:** Primary speed test interface  
**Structure:**
- `<head>` - Meta tags, Open Graph, Twitter Card, favicon, CSS links
- Header - Logo, theme toggle
- Split Layout:
  - Left: Circular gauge, start button
  - Right: 2×2 result cards (download, upload, latency, jitter)
- Settings panel (sidebar)
- History section (chart, list)
- Footer - Server info, links

**Key Elements:**
- `#splitLayout` - Main container
- `#gaugeCircle` - Gauge visualization
- `.tray-card` - Result cards (download, upload, latency, jitter)
- `#settingsPanel` - Configuration panel
- `#historyChart` - Canvas for history chart

**Scripts:**
- `/js/init.js` - API base URL configuration
- `/js/settings-helper.js` - Settings management
- `/js/app.js` - Main application entry point (ES module)

**Line Count:** ~645 lines  
**Dependencies:** All CSS files, all JS modules

---

### 24. **learn.html** - Learning Hub
**Purpose:** Educational content hub (link to learn articles)  
**Structure:**
- Hero section - Title, description
- Article cards (5 topics):
  - Speed Test Basics
  - Testing Methodology
  - Technical Concepts
  - Troubleshooting & Best Practices
  - Future of Speed Testing
- Quick navigation
- CTA button (back to test)

**Key Elements:**
- `.article-link-card` - Clickable article cards
- Links to `learn/*.html` pages

**Scripts:**
- `/js/learn-init.js` - Learn page initialization
- `/js/shared.js` - Theme toggle, PWA install, Lucide icons

**Line Count:** ~243 lines  
**Dependencies:** /css/main.css

---

### 25. **learn/*.html** - Learn Article Pages
**Pages:**
- `basics.html` - Speed test fundamentals
- `methodology.html` - Why test from Amsterdam
- `technical.html` - Latency, bandwidth, TCP, HTTP/2
- `troubleshooting.html` - Common issues, best practices
- `future.html` - Upcoming features, WebTransport

**Structure:**
- Header navigation
- Article content (headings, paragraphs, lists, code blocks)
- Sidebar (quick links, related articles)
- Footer

**Line Count:** ~400-600 lines per page  
**Dependencies:** /css/main.css, /css/learn-shared.css, /css/pages/learn.css

---

## Utilities & Helpers

### 26. **js/init.js** - API Configuration
**Purpose:** Set API base URL before app loads  
**Responsibilities:**
- Define global `API_BASE_URL` variable
- Detect localhost for development (fallback to Railway)
- Emergency fallback if API_BASE_URL not set
- Used by config.js to set backend endpoint
- Allows easy environment switching (dev/prod)

**Code:**
```javascript
window.API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : (window.API_BASE_URL || 'https://speed-test-backend.up.railway.app');
```

**Line Count:** ~15 lines  
**Used by:** config.js (reads global variable)

---

### 27. **js/settings-helper.js** - Settings Management
**Purpose:** Load/save user settings from localStorage  
**Responsibilities:**
- Load settings on page load
- Apply saved thread count, duration
- Sync with config.js

**Line Count:** ~50 lines  
**Used by:** index.html (script tag)

---

### 28. **shared.js** - Content Page Initialization
**Purpose:** Lightweight initialization for non-test pages (learn.html)  
**Responsibilities:**
- Initialize theme
- Register service worker
- Initialize icons (Lucide)
- Hide page loader

**Line Count:** ~32 lines  
**Used by:** learn.html (ES module)

---

### 29. **edge-banner.js** - Edge Deployment Banner
**Purpose:** Show banner when accessing Cloudflare Pages deployment  
**Responsibilities:**
- Detect if URL contains "pages.dev"
- Show informational banner about Africa-optimized edge server
- Link to Railway production server

**Line Count:** ~50 lines  
**Used by:** index.html (script tag)

---

### 30. **learn-init.js** - Learn Page Initialization
**Purpose:** Initialize learn hub page  
**Responsibilities:**
- Hide page loader
- Initialize icons
- Setup article card animations

**Line Count:** ~30 lines  
**Used by:** learn.html (script tag)

---

### 31. **sw.js** - Service Worker
**Purpose:** PWA offline support, cache management  
**Responsibilities:**
- Cache static assets (HTML, CSS, JS, images)
- Serve from cache when offline
- Update cache on new version
- Skip waiting on update

**Caching Strategy:**
- Cache-first for static assets
- Network-first for API calls
- Precache essential files

**Version:** Updated by build-version.js  
**Line Count:** ~200 lines  
**Used by:** Browser (registered by worker.js)

---

## Data Flow

### Test Execution Flow

```
User clicks "Start Test"
    ↓
app.js → startTest()
    ↓
1. LATENCY TEST
   modules/latency.js → measureLatency()
    ├─ Fetch /api/ping (10 times)
    ├─ Calculate avg, min, max, median, jitter
    ├─ Update UI (gauge, cards, progress 0-25%)
    └─ Return latency results
    ↓
2. OPTIMIZE THREAD COUNT (based on latency)
   app.js → optimizeThreadCount()
    ├─ High latency (>200ms) → 1 thread, 15s duration, 40% variance
    ├─ Medium latency (100-200ms) → 2 threads, 12s duration, 35% variance
    └─ Low latency (<100ms) → 4 threads, 8s duration, 30% variance
    ↓
3. DOWNLOAD TEST
   modules/download.js → measureDownload()
    ├─ Create download.worker.js
    ├─ Worker spawns N download threads
    ├─ Worker monitors progress every 500ms
    ├─ Main thread updates UI every 100ms (throttled)
    ├─ Concurrent loaded latency measurement
    ├─ Test runs until stable or max duration
    ├─ Calculate final speed (exclude warmup)
    ├─ Update UI (gauge, cards, progress 25-60%)
    └─ Return download results
    ↓
4. UPLOAD TEST
   modules/upload.js → measureUpload()
    ├─ Create upload.worker.js
    ├─ Worker generates random data
    ├─ Worker spawns N upload threads
    ├─ Worker monitors progress every 500ms
    ├─ Main thread updates UI every 100ms (throttled)
    ├─ Concurrent loaded latency measurement
    ├─ Test runs until stable or max duration
    ├─ Calculate final speed (exclude warmup)
    ├─ Update UI (gauge, cards, progress 60-100%)
    └─ Return upload results
    ↓
5. SAVE RESULTS
   app.js → saveTestResult()
    ├─ Store in STATE.history
    ├─ Persist to localStorage
    ├─ Update history UI
    ├─ Draw history chart
    └─ Show retry button
```

### UI Update Flow

```
Worker (background thread)
    ↓ postMessage({ type: 'progress_update', currentSpeed: 45.2 })
modules/download.js → worker.onmessage
    ↓ Throttle (100ms)
ui.js → updateGauge(speed, phase)
    ↓ requestAnimationFrame
DOM Update:
    ├─ Gauge rotation (conic-gradient)
    ├─ Gauge value (textContent)
    ├─ Matrix card live value
    ├─ Mini-graph canvas
    └─ Progress bar width
```

---

## State Management

### State Lifecycle

**Initialization:**
```javascript
// On page load
STATE.testing = false;
STATE.currentPhase = null;
STATE.testResults = { download: null, upload: null, latency: null, jitter: null };
```

**During Test:**
```javascript
// Test start
STATE.testing = true;
STATE.currentPhase = 'latency';
STATE.abortControllers = [new AbortController()];

// Latency complete
STATE.testResults.latency = { average: 45, min: 40, max: 60, jitter: 5 };
STATE.currentPhase = 'download';

// Download complete
STATE.testResults.download = { speed: 29.77, confidence: 95, stability: 98 };
STATE.currentPhase = 'upload';

// Upload complete
STATE.testResults.upload = { speed: 18.5, confidence: 92, stability: 96 };
STATE.testing = false;
STATE.currentPhase = null;
```

**Cancellation:**
```javascript
// User clicks "Cancel"
STATE.cancelling = true;
STATE.abortControllers.forEach(ac => ac.abort());
STATE.abortControllers = [];
STATE.testing = false;
STATE.cancelling = false;
```

---

## Configuration System

### Dynamic Configuration

**Device-Based Optimization:**
```javascript
// Low-end device (2 cores, 2GB RAM)
CONFIG.updateInterval = 200;  // Slower UI updates

// High-end device (8+ cores, 8+ GB RAM)
CONFIG.updateInterval = 50;  // Faster UI updates
```

**Latency-Based Optimization:**
```javascript
// High latency (>200ms) - Kenya to Amsterdam
CONFIG.threads.download = 1;
CONFIG.duration.download.min = 15;
CONFIG.stability.varianceThreshold = 0.40;

// Low latency (<100ms) - Local server
CONFIG.threads.download = 4;
CONFIG.duration.download.min = 8;
CONFIG.stability.varianceThreshold = 0.30;
```

**User Settings (localStorage):**
- Thread count (1-8)
- Max duration (8-20 seconds)
- Theme preference (light/dark)

---

## Dependency Graph

### Import Hierarchy

```
app.js (entry point)
├─ dom.js
├─ config.js
├─ state.js
├─ engine.js
│  ├─ dom.js
│  ├─ config.js
│  ├─ state.js
│  └─ ui.js
├─ worker.js
│  └─ state.js
├─ ui.js
│  ├─ dom.js
│  ├─ state.js
│  ├─ config.js
│  └─ utils.js
├─ utils.js (no deps)
├─ chart.js (no deps)
├─ modules/latency.js
│  ├─ config.js
│  ├─ state.js
│  ├─ utils.js
│  └─ ui.js
├─ modules/download.js
│  ├─ config.js
│  ├─ state.js
│  ├─ utils.js
│  ├─ ui.js
│  └─ workers/download.worker.js
│     └─ worker-utils.js
└─ modules/upload.js
   ├─ config.js
   ├─ state.js
   ├─ utils.js
   ├─ ui.js
   └─ workers/upload.worker.js
      └─ worker-utils.js
```

### Zero-Dependency Modules
- `config.js` - No imports
- `state.js` - No imports
- `dom.js` - No imports
- `utils.js` - No imports
- `chart.js` - No imports
- `worker-utils.js` - No imports

### Core Dependencies (used by most modules)
- `config.js` - Configuration constants
- `state.js` - Application state
- `utils.js` - Utility functions
- `ui.js` - UI updates

---

## File Statistics

**Total Files:** 38 files  
**Total Lines of Code:**
- JavaScript: ~8,500 lines
- CSS: ~4,000 lines
- HTML: ~3,000 lines

**Module Size Breakdown:**
- Largest JS: `ui.js` (~1,470 lines)
- Largest CSS: `pages/home.css` (~1,090 lines)
- Largest HTML: `index.html` (~645 lines)

**Test Modules:**
- `latency.js`: ~212 lines
- `download.js`: ~204 lines
- `upload.js`: ~208 lines
- `download.worker.js`: ~175 lines
- `upload.worker.js`: ~180 lines

---

## Circular Dependency Prevention

**Problem:** `app.js` needs to call test functions, but test modules need `app.js` imports  
**Solution:** Function registration pattern

```javascript
// app.js
import { registerTestFunctions } from './engine.js';

function startTest() { /* ... */ }
function cancelTest() { /* ... */ }

registerTestFunctions(startTest, cancelTest);

// engine.js
let startTestFn;
let cancelTestFn;

export function registerTestFunctions(start, cancel) {
  startTestFn = start;
  cancelTestFn = cancel;
}

DOM.startTest.addEventListener('click', () => startTestFn());
```

---

## Performance Optimizations

1. **Web Workers** - Offload download/upload to background threads
2. **requestAnimationFrame** - Throttle UI updates to 60fps
3. **Idle Task Scheduling** - Non-critical tasks (memory monitoring)
4. **DOM Caching** - Query elements once, reuse references
5. **CSS Variables** - Dynamic theming without JS
6. **Conic Gradient** - Hardware-accelerated gauge animation
7. **Canvas DPI Scaling** - Sharp charts on retro displays
8. **Exponential Moving Average** - Smooth speed display
9. **Progressive Enhancement** - Adaptive update intervals based on device

---

## Accessibility Features

1. **ARIA Live Regions** - Screen reader announcements
2. **Keyboard Navigation** - All controls keyboard accessible
3. **Focus Styles** - Visible focus indicators
4. **Semantic HTML** - Proper heading hierarchy
5. **Alt Text** - Images have descriptive alt text
6. **Color Contrast** - WCAG AA compliant
7. **Reduced Motion** - Respects `prefers-reduced-motion`
8. **Screen Reader Only** - `.sr-only` utility class

---

## Testing

**Test Files:** `frontend/tests/*.test.js`
- `config.test.js` - Configuration validation
- `state.test.js` - State management
- `utils.test.js` - Utility functions
- `ui.test.js` - UI rendering
- `main.test.js` - Integration tests

**Test Framework:** Jest (ESM mode)  
**Test Coverage:** 65 tests passing ✅

---

## Build & Deployment

**Build Scripts:**
- `build-css.sh` - Concatenate CSS source files into /css/main.css
- `build-version.js` - Inject version into files (sw.js, index.html)

**Deployment Targets:**
- **Railway** (Europe) - Production server
- **Cloudflare Pages** (Africa regional, Nairobi, Kenya) - Edge-optimized CDN

**Version Management:**
- Version stored in `package.json`
- Injected into HTML `?v=X.XX.X` query params
- Service worker cache updated on version change

---

## Future Enhancements

1. **WebTransport** - Replace HTTP/2 for lower latency
2. **More Test Servers** - Regional server selection
3. **Advanced Graphs** - Real-time speed curves, latency distribution
4. **Bandwidth Scheduler** - Test at scheduled times
5. **Export Results** - CSV/JSON export
6. **Compare Tests** - Side-by-side result comparison
7. **Dark/Light Theme Auto** - Follow system preference
8. **Notification API** - Alert when test completes

---

**End of Documentation**

*This document provides a complete reference for the SpeedCheck codebase. Use it to understand file purposes, dependencies, and data flow. Update this document when adding new features or refactoring code.*

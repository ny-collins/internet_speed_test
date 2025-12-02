# SpeedCheck <img src="frontend/favicon.svg" alt="⚡" width="32" height="32" style="vertical-align: middle;">

> Test your real-world international internet speed with production-grade performance

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://speed-test.up.railway.app/)
[![Regional Demo](https://img.shields.io/badge/africa-optimized-blue)](https://speed-test-ahc.pages.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Audit System](https://img.shields.io/badge/audit-comprehensive-green)](#audit-system)

**[🚀 Try it live](https://speed-test.up.railway.app/)** • **[🌍 Africa-Optimized](https://speed-test-ahc.pages.dev/)** • **[📚 Learn More](https://speed-test.up.railway.app/learn)**

## 🎯 What Makes SpeedCheck Different?

SpeedCheck measures your **real-world international connectivity** with a **distributed global architecture**:

| Feature | SpeedCheck | Traditional Speed Tests |
|---------|------------|------------------------|
| **Server Location** | Amsterdam, Netherlands (Primary) + Nairobi, Kenya (Regional) | Nearest server |
| **What It Measures** | Real international performance with geographic optimization | Local network capacity |
| **Architecture** | Production-grade with Web Workers, comprehensive audit system | Basic client-side testing |
| **Use Case** | Global content streaming, international calls, CDN performance | Local ISP testing |

## ✨ Key Features

- **⚡ Real-time Testing** - Live gauge with download, upload, latency & jitter using Web Workers
- **🎯 Measurement Quality** - Confidence scoring (0-100%) with detailed quality indicators
- **📊 Transparent Metrics** - Sample counts, outlier detection, measurement methodology visible
- **🌍 Geographic Context** - Distance calculation, network type detection, server location display
- **📈 History & Statistics** - Local storage with averages, trends, and test count (privacy-focused)
- **🛠️ PWA Support** - Add to home screen for app-like experience with background sync
- **🔒 Zero Dependencies** - Pure vanilla JavaScript, fast loading, secure by design
- **📚 Comprehensive Audit** - Built-in monitoring system for performance & security validation
- **🎓 Educational Content** - Learn page explaining internet concepts and performance metrics
- **♿ Accessibility** - Screen reader support, ARIA labels, keyboard navigation
- **🔬 Scientific Accuracy** - TCP slow start compensation with statistical outlier removal (MAD)
- **💎 Visual Polish** - Smooth animations, loading skeletons, button interactions, tabular numbers
- **🌐 Dual Deployment** - Europe (Railway) + Africa (Cloudflare) for optimized global access

## 🚀 Quick Start

### 🌐 Live Demos
- **Europe/Asia/Americas**: **[speed-test.up.railway.app](https://speed-test.up.railway.app/)**
- **Africa Optimized**: **[speed-test-ahc.pages.dev](https://speed-test-ahc.pages.dev/)**

### 🔍 Run System Audit
```bash
# Comprehensive health check (11 test phases)
./audit.sh
```

### 💻 Local Development

```bash
# Clone repository
git clone https://github.com/ny-collins/internet_speed_test.git
cd internet_speed_test

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run locally
cd backend && npm run dev  # API server on :3000
cd ../frontend && npm start  # Frontend on :8080
```

**⚠️ Important:** Test against live deployments for accurate results. Local testing shows unrealistic speeds.

## 🏗️ Architecture

SpeedCheck uses a **production-grade distributed architecture** with Web Workers for optimal performance:

### System Components
- **Frontend:** Pure HTML/CSS/JS with Web Workers for heavy computation
- **Backend:** Node.js + Express API with pre-generated buffers for CPU efficiency
- **Deployment:** Railway (EU West) + Cloudflare Pages (Africa regional)
- **Audit System:** Comprehensive 11-phase monitoring and health checks

### Performance Optimizations
- **🧵 Web Workers**: Heavy stream processing off main thread prevents UI blocking
- **⚡ Progressive Enhancement**: Device-aware update intervals (50-200ms)
- **🧠 Memory Management**: Pre-allocated buffers prevent GC pauses during tests
- **🎯 Idle Task Scheduling**: Non-critical monitoring during browser idle periods
- **🔄 Request Caching**: 24-hour CORS preflight caching for instant repeated tests

### Geographic Distribution
```
┌─────────────────┐    ┌─────────────────┐
│   Nairobi       │    │   Amsterdam     │
│   (Cloudflare)  │◄──►│   (Railway)     │
│   Frontend      │    │   Backend       │
│   14ms latency  │    │   180ms latency │
└─────────────────┘    └─────────────────┘
         ▲                       ▲
         │ 3x faster for         │ Global users
         │ African users         │
```

## 🔍 Audit System

SpeedCheck includes a comprehensive **11-phase audit system** for production monitoring:

```bash
./audit.sh  # Run complete system health check
```

**Audit Coverage:**
- ✅ **Geographical Latency** - User perspective performance
- ✅ **Infrastructure Forensics** - Cloudflare location verification
- ✅ **Backend Handshake Analysis** - Connection overhead measurement
- ✅ **Security & CORS Compliance** - Access control validation
- ✅ **Cache Optimization** - Preflight caching verification
- ✅ **Performance Deep Dive** - Response consistency & cold starts
- ✅ **Security Headers & SSL** - Certificate & header validation
- ✅ **Network & Protocol Tests** - IPv6, HTTP/2, compression
- ✅ **Load & Stress Testing** - Concurrent requests & rate limiting
- ✅ **Error Handling & Edge Cases** - Robustness validation
- ✅ **Frontend Specific Tests** - SEO, caching, page optimization

## 📚 Documentation

- **[Technical Notes](docs/TECHNICAL_NOTES.md)** - Design decisions & performance optimizations
- **[Functionality](docs/FUNCTIONALITY.md)** - System architecture & API details
- **[Changelog](docs/CHANGELOG.md)** - Version history & release notes

## 📋 Recent Updates

### v1.65.0 (Current)
- 🔬 **Scientific Measurement Accuracy** - TCP slow start compensation with byte tracking for professional-grade results
- 📈 **Bufferbloat Detection** - Loaded latency measurement during active transfers for network quality analysis
- ⚡ **Enhanced Responsiveness** - Asynchronous completion handling prevents UI freezing during test results
- 🐛 **Critical Bug Fixes** - Race condition resolution, cancellation logic fix, ES module integration

### v1.64.0
- 🚀 **Production-Grade Architecture** - Web Workers implementation for smooth 60fps UI during speed tests
- 📊 **Comprehensive Audit System** - 11-phase automated monitoring and health checks
- 🌍 **Geographic Optimization** - Dual deployment: Europe (Railway) + Africa (Cloudflare)

### v1.63.0
- ⚡ **Performance Optimizations** - Progressive enhancement, idle task scheduling, frame monitoring
- 🛡️ **Security Improvements** - PWA update banner security fix
- 🔧 **Critical Bug Fixes** - Module imports, speed calculations, sparkline rendering

## 🎨 Recent Enhancements (v1.0.0)

### Phase 1-5 Implementation Complete

**Measurement Quality Visibility**
- Confidence scoring (0-100%) for all test types (download/upload/latency)
- Color-coded indicators: High (≥85%), Medium (70-84%), Low (50-69%), Very Low (<50%)
- Detailed modals with sample counts, outlier info, and methodology
- 5-factor confidence calculation for speed tests, 3-factor for latency

**Geographic Context**
- Real-time distance calculation to Amsterdam server
- Network type detection (WiFi, 4G, etc.) via Network Information API
- Test context panel with server location, distance, connection, timestamp
- Geolocation integration with Great Circle distance formula

**Local History & Statistics**
- localStorage-based history (50 test limit)
- Privacy notice: "History stored locally on this device only"
- Aggregate statistics: average download/upload/latency, test count
- Chart visualization with export/clear functionality

**Learn Page Integration**
- Tooltip helper functions for contextual education
- Smooth navigation from results to learning content
- Enhanced accessibility and mobile responsiveness

**Visual Polish**
- Tabular numerals for consistent number display
- Smooth number counting animations with easing
- Button ripple effects and micro-interactions
- Loading skeletons with shimmer animations
- Professional tooltip system with positioning
- Pulse animations for loading states

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete implementation details.

## 🤝 Contributing

We welcome contributions! See [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 📚 Documentation
- **[Technical Notes](docs/TECHNICAL_NOTES.md)** - Design decisions & performance optimizations
- **[Functionality](docs/FUNCTIONALITY.md)** - System architecture & API details
- **[Changelog](docs/CHANGELOG.md)** - Version history & release notes

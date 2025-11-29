# SpeedCheck <img src="frontend/favicon.svg" alt="⚡" width="32" height="32" style="vertical-align: middle;">

> Test your real-world international internet speed

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://speed-test.up.railway.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

**[🚀 Try it live](https://speed-test.up.railway.app/)** • **[📚 Learn More](https://speed-test.up.railway.app/learn)**

## 🎯 What Makes SpeedCheck Different?

Unlike traditional speed tests that use nearby servers, SpeedCheck measures your **real-world international connectivity** by testing against a server in **Amsterdam, Netherlands**.

| Feature | SpeedCheck | Traditional Speed Tests |
|---------|------------|------------------------|
| **Server Location** | Amsterdam, Netherlands (Fixed) | Nearest server |
| **What It Measures** | Real international performance | Local network capacity |
| **Use Case** | Global content streaming, international calls | Local ISP testing |

## ✨ Key Features

- **Real-time Testing** - Live gauge with download, upload, latency & jitter
- **Mobile Responsive** - Works perfectly on all devices
- **PWA Support** - Add to home screen for app-like experience
- **Zero Dependencies** - Pure vanilla JavaScript, fast loading
- **Secure & Private** - No data logging or tracking
- **Educational Content** - Learn page explaining internet concepts

## 🚀 Quick Start

### Live Demo
Visit **[speed-test.up.railway.app](https://speed-test.up.railway.app/)** - no installation required!

### Local Development

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

**⚠️ Important:** Test against the live deployment for accurate results. Local testing shows unrealistic speeds.

## 🏗️ Architecture

- **Frontend:** Pure HTML/CSS/JS with progressive enhancement
- **Backend:** Node.js + Express API in Amsterdam, Netherlands
- **Deployment:** Railway (EU West) + Cloudflare Pages (Africa regional)

## 📚 Documentation

- **[Technical Notes](docs/TECHNICAL_NOTES.md)** - Design decisions & performance optimizations
- **[Functionality](docs/FUNCTIONALITY.md)** - System architecture & API details
- **[Changelog](docs/CHANGELOG.md)** - Version history & release notes

## 📋 Recent Updates

### v1.63.0 (Current)
- ⚡ **Performance Optimizations** - Progressive enhancement, idle task scheduling, frame monitoring
- 🛡️ **Security Improvements** - PWA update banner security fix
- 🔧 **Critical Bug Fixes** - Module imports, speed calculations, sparkline rendering

### v1.62.0
- 🛡️ **Security Hardening** - XSS prevention, rate limiting, error handling
- ⚡ **Fixed-Duration Testing** - Consistent 10-second tests, better accuracy

## 🤝 Contributing

We welcome contributions! See [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 📚 Documentation

- **[Technical Notes](docs/TECHNICAL_NOTES.md)** - Design decisions & performance optimizations
- **[Functionality](docs/FUNCTIONALITY.md)** - System architecture & API details
- **[Changelog](docs/CHANGELOG.md)** - Version history & release notes

## 📋 Recent Updates

### v1.63.0 (Current)
- ⚡ **Performance Optimizations** - Progressive enhancement, idle task scheduling, frame monitoring
- 🛡️ **Security Improvements** - PWA update banner security fix
- 🔧 **Critical Bug Fixes** - Module imports, speed calculations, sparkline rendering

### v1.62.0
- 🛡️ **Security Hardening** - XSS prevention, rate limiting, error handling
- ⚡ **Fixed-Duration Testing** - Consistent 10-second tests, better accuracy

## 🤝 Contributing

We welcome contributions! See [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License


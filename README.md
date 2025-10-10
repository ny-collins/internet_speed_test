# SpeedCheck ⚡

> Test your connection speed to Europe

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://speed-test.up.railway.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

**[🚀 Try it live](https://speed-test.up.railway.app/)**

---

## 🎯 What Makes SpeedCheck Different?

Most internet speed tests use **nearby servers** to show you optimal speeds - but that's not how you actually use the internet. SpeedCheck measures your **real-world international connectivity** by testing your connection to a server in **Amsterdam, Netherlands**.

### SpeedCheck vs Other Speed Tests

| Feature | SpeedCheck | Traditional Speed Tests |
|---------|------------|------------------------|
| **Server Location** | Amsterdam, Netherlands (Fixed) | Automatically selects nearest server |
| **What It Measures** | Real international performance | Idealized local network speed |
| **Use Case** | Streaming European content, international browsing, video calls abroad | Local network capacity testing |
| **Distance Impact** | Reflects actual routing and latency | Minimizes distance to show best case |
| **Real-World Accuracy** | Shows speeds you'll actually experience for global content | Shows theoretical maximum speeds |

### When to Use SpeedCheck

✅ **Use SpeedCheck when:**
- You want to know your actual speed to European servers
- You're troubleshooting international streaming (Netflix, BBC iPlayer, sports streams)
- You need to understand your latency for international video conferencing
- You're curious about undersea cable and intercontinental routing performance

❌ **Use traditional speed tests when:**
- You want to test your ISP's maximum local bandwidth
- You're troubleshooting issues with your local network equipment
- You need to verify you're getting the speeds promised by your ISP contract

---

## 🌍 Why Europe?

Our server is hosted in **Amsterdam, Netherlands** - a major internet hub with excellent global connectivity. Testing to a fixed European location provides:

- **Consistent baseline** for comparing results over time
- **Real-world international routing** through undersea cables and continental networks
- **Meaningful metrics** for accessing global content hosted in Europe or routed through European CDNs
- **Distance-based performance** that reflects actual usage patterns for international content

**Physical Reality:** Internet signals don't travel instantly. Light moves at 300,000 km/s, but internet data travels slower through fiber optic cables. Distance creates unavoidable latency - SpeedCheck shows you this reality.

---

## 📊 Understanding Your Results

### Download Speed
How fast you can receive data from European servers. Important for streaming video, downloading files, and loading web pages hosted internationally.

### Upload Speed
How fast you can send data to European servers. Critical for video conferencing, uploading files to cloud storage, and online gaming.

### Ping (Latency)
The round-trip time for a signal to reach Amsterdam and return. **Lower is better.** Physics limits this based on distance - expect 150-300ms from Africa, 100-200ms from Middle East, 10-50ms from Europe.

### Jitter
How consistent your connection is. **Lower is better.** High jitter causes stuttering in video calls and unstable streaming. Good connections have jitter under 20ms.

---

## ✨ Features

- ⚡ **Real-time Updates** - Live speed measurements during test
- 📱 **Mobile Responsive** - Seamless experience on all devices
- 🌓 **Dark/Light Theme** - Automatic system preference detection
- 🎨 **Pure CSS Gauge** - Beautiful 270° arc progress indicator (no dependencies)
- 📊 **Comprehensive Metrics** - Download, Upload, Ping, Jitter
- ⚙️ **Configurable Tests** - Adjust parallel connections and test duration
- 🔒 **Secure & Private** - No data logging, no tracking
- 📚 **Educational Content** - Learn about internet connectivity and routing

---

## 🔧 Technical Architecture

### Frontend
- **Pure HTML/CSS/JavaScript** - No frameworks, fast loading
- **CSS Conic Gradient Gauge** - Smooth animated progress indicator
- **Multi-threaded Testing** - Parallel connections for accurate speed measurement
- **Responsive Design** - Mobile-first approach
- **Lucide Icons** - Clean, modern iconography

### Backend
- **Node.js + Express 5.1.0**
- **Railway Hosting** - Amsterdam, Netherlands deployment
- **REST API** - Optimized endpoints for speed testing
- **Efficient Binary Transfer** - Uncompressed data streams for accuracy
- **Security** - Helmet.js, rate limiting, CORS protection

### API Endpoints

- `GET /api/ping` - Single ping round-trip time
- `POST /api/ping-batch` - Multiple pings for jitter calculation
- `GET /api/download?size=MB` - Download speed test (uncompressed)
- `POST /api/upload` - Upload speed test with streaming
- `GET /api/info` - Server metadata and configuration
- `GET /api/test` - Connectivity check
- `GET /health` - Health status

---

## 🚀 Deployment

This application is deployed on **Railway** with automatic deployments from the main branch. The server location is **fixed to Amsterdam, Netherlands** to ensure consistent testing conditions across all users.

**Live URL:** https://speed-test.up.railway.app/

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `SERVER_LOCATION` | Server region label | Amsterdam, Netherlands |
| `CORS_ORIGIN` | Allowed CORS origins | * |
| `MAX_DOWNLOAD_SIZE_MB` | Maximum download test size | 50 |
| `MAX_UPLOAD_SIZE_MB` | Maximum upload test size | 50 |
| `ENABLE_RATE_LIMIT` | Enable rate limiting | true |

---

## ⚠️ Important Note on Local Development

**Running SpeedCheck locally is not recommended for accurate testing.** If you run the server on your local machine (`localhost`), you'll see unrealistically high speeds (often 1000+ Mbps) because:

- ❌ **No network distance** - Data doesn't leave your computer
- ❌ **No routing overhead** - Bypasses all internet infrastructure  
- ❌ **No ISP throttling** - No real internet connection involved
- ❌ **Perfect conditions** - Not representative of actual internet performance

**The value of SpeedCheck comes from testing against a real server in Amsterdam.** Local testing defeats the purpose of measuring international connectivity.

### For Development

If you want to explore the code or contribute:

```bash
# Clone the repository
git clone https://github.com/ny-collins/internet_speed_test.git
cd internet_speed_test

# Install backend dependencies
cd backend
npm install

# Start backend (for development only)
npm run dev

# Serve frontend (separate terminal)
cd ../frontend
npx http-server -p 8080
```

**Important:** Test against the [live deployed version](https://speed-test.up.railway.app/) rather than localhost for meaningful measurements.

---

## 📖 What This Project Teaches

This project demonstrates real-world internet concepts:

1. **Internet Geography** - Distance matters; signals can't travel faster than physics allows
2. **Network Routing** - Connection quality depends on multiple hops, undersea cables, and ISP routing
3. **CDN Reality** - Content hosted far away will always be slower than local content
4. **Real-world Performance** - Benchmarks with nearby servers don't reflect actual usage
5. **Latency vs Bandwidth** - High bandwidth doesn't help if latency is high (critical for gaming/calls)
6. **Network Congestion** - Time of day and routing affects international speeds
7. **Jitter & Stability** - Consistent connections matter more than peak speeds for real-time apps

---

## 🎓 Use Cases

### For Users
- ✅ Test if your connection can handle 4K streaming from European services
- ✅ Troubleshoot international video conference quality
- ✅ Understand why European websites feel slower than local ones
- ✅ Compare your actual international speeds with ISP promises

### For Developers
- 💻 Learn multi-threaded speed testing implementation
- 💻 Study responsive web design patterns
- 💻 Understand internet routing and latency concepts
- 💻 See pure CSS gauge implementation without dependencies

### For Network Engineers
- 🔧 Baseline international routing performance
- 🔧 Debug ISP peering and routing issues
- 🔧 Measure undersea cable capacity impact
- 🔧 Analyze time-of-day congestion patterns

---

## 🤝 Contributing

While local development isn't useful for speed testing, contributions are welcome for:

- 🎨 UI/UX improvements
- 📚 Additional educational content
- ⚡ Performance optimizations
- ♿ Accessibility enhancements
- 📝 Documentation updates

Please ensure any speed measurement changes are tested against the live deployed version.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌐 Related Resources

- [Understanding Internet Routing](https://www.cloudflare.com/learning/network-layer/what-is-routing/)
- [How Undersea Cables Work](https://www.submarinecablemap.com/)
- [Content Delivery Networks Explained](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/)
- [Latency vs Bandwidth](https://www.cloudflare.com/learning/performance/glossary/what-is-latency/)

---

**Made with ⚡ to show real internet performance, not just marketing numbers.**

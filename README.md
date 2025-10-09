# Internet Speed Test

A full-stack web application to measure Download Speed, Upload Speed, Ping (Latency), and Jitter. Built with a lightweight Express backend and a static frontend (HTML/CSS/JS) focused on clarity, responsiveness, and performance measurement accuracy.

## Features
- Download, upload, ping, and jitter measurements
- Progressive, per-phase execution with independent error handling
- Dark/light theme with system preference detection
- Dynamic server info fetch (`/api/info`)
- Security enhancements: Helmet, selective compression (disabled for raw download), configurable CORS
- Rate limiting (configurable / optional)
- Resilient upload generation (chunked `getRandomValues`)

## Technology Stack
Backend: Node.js + Express, Helmet, express-rate-limit, Morgan, Compression
Frontend: Vanilla HTML/CSS/JS, Lucide icons

## API Endpoints (Summary)
- `GET /api/ping` – Single ping RTT
- `POST /api/ping-batch` – Multiple timestamped pings (jitter calculation)
- `GET /api/download?size=MB` – Random data stream (uncompressed) up to max
- `POST /api/upload` – Streaming upload sink; returns calculated throughput
- `GET /api/info` – Server metadata (limits, location, version, rate limit details)
- `GET /api/test` – Simple connectivity check
- `GET /health` – Health status

## Environment Variables (Backend)
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (Railway injects automatically) | 3000 |
| `NODE_ENV` | `development` or `production` | development |
| `SERVER_LOCATION` | Human-readable server region label | Unknown |
| `CORS_ORIGIN` | Single origin or comma-separated list, `*` for dev | * |
| `MAX_DOWNLOAD_SIZE_MB` | Max allowed download test size | 50 |
| `MAX_UPLOAD_SIZE_MB` | Advisory max upload size | 50 |
| `ENABLE_RATE_LIMIT` | Enable basic rate limiting | true |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | 60000 |
| `RATE_LIMIT_MAX` | Max requests per window for limited endpoints | 120 |

## Local Development
1. Clone repository
2. `cd backend && npm install`
3. Copy `.env.example` to `.env` and adjust values.
4. Start backend: `npm run dev`
5. Serve frontend (any static server) e.g.:
   ```bash
   # From project root
   npx http-server ./frontend -p 8080
   ```
6. Open `http://localhost:8080` — frontend will auto-target `http://localhost:3000/api`.

## Deployment (Railway Example)
Backend service variables: set those listed above (omit PORT unless needed). Frontend static deployment requires no secrets; ensure `CORS_ORIGIN` includes frontend origin.

## Performance & Accuracy Notes
- Download endpoint avoids compression to reflect raw throughput.
- Single-threaded tests may under-report very high (>500 Mbps) connections; future enhancement: multi-stream parallel fetch.
- Jitter is standard deviation of a small ping sample; consider adding percentile metrics for deeper diagnostics.

## Planned / Potential Enhancements
- Multi-stream download/upload tests
- Historical result storage + export / share
- Accessibility improvements (ARIA roles, live regions)
- Test result visualization (charts)
- Automated test suite (backend + frontend harness)

## Contributing
Open to refinements and feature additions. Please discuss major changes first.

## License
MIT

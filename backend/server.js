require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_DOWNLOAD_SIZE_MB = parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '50', 10);
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);
const ENABLE_RATE_LIMIT = (process.env.ENABLE_RATE_LIMIT || 'true').toLowerCase() === 'true';
const ENABLE_METRICS = (process.env.ENABLE_METRICS || 'true').toLowerCase() === 'true';
const MAX_INFLIGHT_REQUESTS = parseInt(process.env.MAX_INFLIGHT_REQUESTS || '100', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ========================================
// LOGGING
// ========================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  }
});

// ========================================
// METRICS
// ========================================

const register = new client.Registry();

if (ENABLE_METRICS) {
  client.collectDefaultMetrics({ register });

  const requestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
    registers: [register]
  });

  const requestsInflight = new client.Gauge({
    name: 'http_requests_inflight',
    help: 'Number of HTTP requests currently being processed',
    registers: [register]
  });

  const downloadBytesTotal = new client.Counter({
    name: 'download_bytes_total',
    help: 'Total bytes transferred in downloads',
    registers: [register]
  });

  const uploadBytesTotal = new client.Counter({
    name: 'upload_bytes_total',
    help: 'Total bytes received in uploads',
    registers: [register]
  });

  const requestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
  });

  app.locals.metrics = {
    requestsTotal,
    requestsInflight,
    downloadBytesTotal,
    uploadBytesTotal,
    requestDuration
  };
}

// ========================================
// INFLIGHT REQUEST TRACKING
// ========================================

let inflightCount = 0;

function trackInflight(req, res, next) {
  if (ENABLE_METRICS) {
    app.locals.metrics.requestsInflight.inc();
  }
  inflightCount++;

  const cleanup = () => {
    if (ENABLE_METRICS) {
      app.locals.metrics.requestsInflight.dec();
    }
    inflightCount--;
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
}

function circuitBreaker(req, res, next) {
  if (inflightCount >= MAX_INFLIGHT_REQUESTS) {
    logger.warn({ inflightCount, maxAllowed: MAX_INFLIGHT_REQUESTS }, 'Circuit breaker triggered');
    return res.status(503).json({
      error: 'Service temporarily overloaded',
      retryAfter: 30
    });
  }
  next();
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(httpLogger);

app.use(trackInflight);

app.use((req, res, next) => {
  const start = Date.now();
  
  // Override writeHead to add process time header before response starts
  const originalWriteHead = res.writeHead;
  res.writeHead = function(...args) {
    res.setHeader('X-Process-Time', `${Date.now() - start}ms`);
    return originalWriteHead.apply(this, args);
  };
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    if (ENABLE_METRICS) {
      const path = req.route?.path || req.path;
      app.locals.metrics.requestsTotal.inc({
        method: req.method,
        path,
        status: res.statusCode
      });
      app.locals.metrics.requestDuration.observe({
        method: req.method,
        path,
        status: res.statusCode
      }, duration);
    }
  });
  next();
});

const allowedOrigins = CORS_ORIGIN === '*' ? '*' : new Set(CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / curl
    if (allowedOrigins === '*' || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/api/download')) return false;
    return compression.filter(req, res);
  }
}));

if (ENABLE_RATE_LIMIT) {
  const standardLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(['/api/ping', '/api/ping-batch', '/api/info', '/api/test'], standardLimiter);
}
app.use(express.json());

// ========================================
// METRICS ENDPOINT
// ========================================

if (ENABLE_METRICS) {
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (err) {
      logger.error({ err }, 'Error generating metrics');
      res.status(500).end();
    }
  });
}

// ========================================
// API ENDPOINTS
// ========================================

app.get('/api/ping', (req, res) => {
  const timestamp = Date.now();
  res.json({ 
    timestamp,
    server: 'ok'
  });
});

app.get('/api/download', circuitBreaker, (req, res) => {
  let sizeInMB = parseInt(req.query.size, 10) || 5;
  if (sizeInMB < 1) sizeInMB = 1;
  if (sizeInMB > MAX_DOWNLOAD_SIZE_MB) sizeInMB = MAX_DOWNLOAD_SIZE_MB; // clamp
  const sizeInBytes = sizeInMB * 1024 * 1024;
  // Optional chunk size (KB) parameter for performance tuning
  let chunkKB = parseInt(req.query.chunk, 10);
  if (isNaN(chunkKB) || chunkKB < 16) chunkKB = 64; // min 16KB
  if (chunkKB > 1024) chunkKB = 1024; // cap 1MB chunks to avoid huge memory use
  const chunkSize = chunkKB * 1024;
  // Using crypto random bytes per chunk; streaming directly to response
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', sizeInBytes);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  let sent = 0;
  let clientDisconnected = false;
  
  // Track client disconnect
  req.on('close', () => {
    clientDisconnected = true;
    logger.debug({ sent, sizeInBytes }, 'Client disconnected during download');
  });
  
  const sendChunk = () => {
    if (clientDisconnected || sent >= sizeInBytes) {
      if (sent >= sizeInBytes) {
        // Track successful download bytes
        if (ENABLE_METRICS) {
          app.locals.metrics.downloadBytesTotal.inc(sizeInBytes);
        }
        res.end();
      }
      return;
    }
    
    const remainingBytes = sizeInBytes - sent;
    const currentChunkSize = Math.min(chunkSize, remainingBytes);
    const chunk = crypto.randomBytes(currentChunkSize);
    
    const canContinue = res.write(chunk);
    sent += currentChunkSize;
    
    if (canContinue) {
      // Continue immediately if buffer isn't full
      setImmediate(sendChunk);
    } else {
      // Wait for drain event if buffer is full
      res.once('drain', sendChunk);
    }
  };
  
  sendChunk();
});

app.post('/api/upload', circuitBreaker, (req, res) => {
  const startTime = Date.now();
  let receivedBytes = 0;
  const byteLimit = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  let aborted = false;
  let clientDisconnected = false;

  // Track client disconnect
  req.on('close', () => {
    clientDisconnected = true;
    if (!aborted && !res.headersSent) {
      logger.debug({ receivedBytes, byteLimit }, 'Client disconnected during upload');
    }
  });

  req.on('data', (chunk) => {
    if (aborted || clientDisconnected) return;
    receivedBytes += chunk.length;
    if (receivedBytes > byteLimit) {
      aborted = true;
      logger.warn({ receivedBytes, byteLimit }, 'Upload size exceeded limit');
      req.destroy();
      return res.status(413).json({ error: 'Upload too large', limitBytes: byteLimit });
    }
  });

  req.on('end', () => {
    if (aborted || clientDisconnected) return; // already responded or disconnected
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds
    const speedMbps = (receivedBytes * 8) / (duration * 1000000);
    
    // Track successful upload bytes
    if (ENABLE_METRICS) {
      app.locals.metrics.uploadBytesTotal.inc(receivedBytes);
    }
    
    res.json({
      success: true,
      receivedBytes,
      durationMs: endTime - startTime,
      speedMbps: Math.round(speedMbps * 100) / 100
    });
  });

  req.on('error', (err) => {
    if (aborted || clientDisconnected) return;
    logger.error({ err, receivedBytes }, 'Upload error');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

app.post('/api/ping-batch', (req, res) => {
  let { count = 10 } = req.body || {};
  count = parseInt(count, 10);
  if (isNaN(count) || count < 1) count = 1;
  if (count > 100) count = 100; // clamp to prevent abuse
  const measurements = [];
  for (let i = 0; i < count; i++) {
    measurements.push({ id: i, timestamp: Date.now(), nonce: crypto.randomBytes(8).toString('hex') });
  }
  res.json({ measurements, serverTime: Date.now(), count });
});

app.get('/api/info', (req, res) => {
  res.json({
    serverLocation: process.env.SERVER_LOCATION || 'Unknown',
    maxDownloadSize: MAX_DOWNLOAD_SIZE_MB,
    maxUploadSize: MAX_UPLOAD_SIZE_MB,
    supportedTests: ['ping', 'download', 'upload', 'jitter'],
    version: '1.04.0',
    rateLimit: ENABLE_RATE_LIMIT ? { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX } : null
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Connection successful',
    clientIp: req.ip,
    timestamp: Date.now()
  });
});

// ========================================
// ERROR HANDLERS
// ========================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ========================================
// SERVER START
// ========================================

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Speed test server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server location: ${process.env.SERVER_LOCATION || 'Unknown'}`);
    console.log(`CORS Origin(s): ${CORS_ORIGIN}`);
    console.log(`Max download size: ${MAX_DOWNLOAD_SIZE_MB}MB`);
  });
}

process.on('SIGTERM', () => {
  if (!server) return process.exit(0);
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app };
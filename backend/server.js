const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const config = require('./config');

const app = express();

app.set('trust proxy', 1);

const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, _err) => {
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

const register = new client.Registry();

if (config.metrics.enabled) {
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

let inflightCount = 0;

function trackInflight(req, res, next) {
  if (config.metrics.enabled) {
    app.locals.metrics.requestsInflight.inc();
  }
  inflightCount++;

  const cleanup = () => {
    if (config.metrics.enabled) {
      app.locals.metrics.requestsInflight.dec();
    }
    inflightCount--;
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
}

function circuitBreaker(req, res, next) {
  if (inflightCount >= config.maxInflightRequests) {
    logger.warn({ inflightCount, maxAllowed: config.maxInflightRequests }, 'Circuit breaker triggered');
    return res.status(503).json({
      error: 'Service temporarily overloaded',
      retryAfter: 30
    });
  }
  next();
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(httpLogger);

app.use(trackInflight);

app.use((req, res, next) => {
  const start = Date.now();

  const originalWriteHead = res.writeHead;
  res.writeHead = function(...args) {
    res.setHeader('X-Process-Time', `${Date.now() - start}ms`);
    return originalWriteHead.apply(this, args);
  };

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    if (config.metrics.enabled) {
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

// CORS Configuration
if (config.corsOrigin === '*') {
  app.use(cors());
} else {
  const allowedOrigins = new Set(config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
    exposedHeaders: ['Content-Length', 'Content-Type']
  }));
}

app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/api/download')) return false;
    return compression.filter(req, res);
  }
}));

if (config.rateLimit.enabled) {
  const standardLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
  });
  app.use(['/api/ping', '/api/ping-batch', '/api/info', '/api/test'], standardLimiter);
}

app.use((req, res, next) => {
  if (req.path === '/api/upload') {
    return next();
  }
  express.json()(req, res, next);
});

if (config.metrics.enabled) {
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

app.get('/api/ping', (req, res) => {
  const timestamp = Date.now();
  res.json({
    timestamp,
    server: 'ok'
  });
});

app.get('/api/download', circuitBreaker, (req, res) => {
  const sizeParam = req.query.size;
  if (sizeParam !== undefined && (isNaN(parseInt(sizeParam, 10)) || parseInt(sizeParam, 10) < 0)) {
    return res.status(400).json({ error: 'Invalid size parameter. Must be a positive number.' });
  }

  const chunkParam = req.query.chunk;
  if (chunkParam !== undefined && (isNaN(parseInt(chunkParam, 10)) || parseInt(chunkParam, 10) < 0)) {
    return res.status(400).json({ error: 'Invalid chunk parameter. Must be a positive number.' });
  }

  let sizeInMB = parseInt(req.query.size, 10) || 5;
  if (sizeInMB < 1) sizeInMB = 1;
  if (sizeInMB > config.maxDownloadSizeMB) sizeInMB = config.maxDownloadSizeMB;
  const sizeInBytes = sizeInMB * 1024 * 1024;
  let chunkKB = parseInt(req.query.chunk, 10);
  if (isNaN(chunkKB) || chunkKB < 16) chunkKB = 64;
  if (chunkKB > 1024) chunkKB = 1024;
  const chunkSize = chunkKB * 1024;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', sizeInBytes);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let sent = 0;
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    logger.debug({ sent, sizeInBytes }, 'Client disconnected during download');
  });

  const sendChunk = () => {
    if (clientDisconnected || sent >= sizeInBytes) {
      if (sent >= sizeInBytes) {
        if (config.metrics.enabled) {
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
      setImmediate(sendChunk);
    } else {
      res.once('drain', sendChunk);
    }
  };

  sendChunk();
});

app.post('/api/upload', circuitBreaker, (req, res) => {
  const startTime = Date.now();
  let receivedBytes = 0;
  const byteLimit = config.maxUploadSizeMB * 1024 * 1024;
  let aborted = false;
  let clientDisconnected = false;

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
    if (aborted || clientDisconnected) return;
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const speedMbps = (receivedBytes * 8) / (duration * 1000000);

    if (config.metrics.enabled) {
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
  const countNum = parseInt(count, 10);

  if (isNaN(countNum) || countNum < 0) {
    return res.status(400).json({ error: 'Invalid count parameter. Must be a positive number.' });
  }

  count = countNum;
  if (count < 1) count = 1;
  if (count > 100) count = 100;
  const measurements = [];
  for (let i = 0; i < count; i++) {
    measurements.push({ id: i, timestamp: Date.now(), nonce: crypto.randomBytes(8).toString('hex') });
  }
  res.json({ measurements, serverTime: Date.now(), count });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'SpeedCheck Speed Test Server',
    location: config.serverLocation,
    maxDownloadSize: config.maxDownloadSizeMB,
    maxUploadSize: config.maxUploadSizeMB,
    version: '1.62.0',
    rateLimit: config.rateLimit.enabled ? { windowMs: config.rateLimit.windowMs, max: config.rateLimit.max } : null
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    downloadSize: config.maxDownloadSizeMB,
    uploadSize: config.maxUploadSizeMB,
    serverLocation: config.serverLocation
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    ip: req.ip
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Connection successful',
    clientIp: req.ip,
    timestamp: Date.now()
  });
});

// Global error handler - must include CORS headers
app.use((err, req, res, _next) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  // Ensure CORS headers are sent even on errors
  if (config.corsOrigin === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    const allowedOrigins = new Set(config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean));
    if (req.headers.origin && allowedOrigins.has(req.headers.origin)) {
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

let server;
if (require.main === module) {
  server = app.listen(config.port, () => {
    console.log(`Speed test server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Server location: ${config.serverLocation}`);
    console.log(`CORS Origin(s): ${config.corsOrigin}`);
    console.log(`Max download size: ${config.maxDownloadSizeMB}MB`);
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

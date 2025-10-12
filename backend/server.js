require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_DOWNLOAD_SIZE_MB = parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '50', 10); // safety cap
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10); // for info endpoint (advisory)
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // default 1 min
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '120', 10); // requests per window
const ENABLE_RATE_LIMIT = (process.env.ENABLE_RATE_LIMIT || 'true').toLowerCase() === 'true';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ========================================
// MIDDLEWARE
// ========================================

app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API responses
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
// API ENDPOINTS
// ========================================

app.get('/api/ping', (req, res) => {
  const timestamp = Date.now();
  res.json({ 
    timestamp,
    server: 'ok'
  });
});

app.get('/api/download', (req, res) => {
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
  
  const sendChunk = () => {
    if (sent >= sizeInBytes) {
      res.end();
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

app.post('/api/upload', (req, res) => {
  const startTime = Date.now();
  let receivedBytes = 0;
  const byteLimit = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    receivedBytes += chunk.length;
    if (receivedBytes > byteLimit) {
      aborted = true;
      req.destroy();
      return res.status(413).json({ error: 'Upload too large', limitBytes: byteLimit });
    }
  });

  req.on('end', () => {
    if (aborted) return; // already responded
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds
    const speedMbps = (receivedBytes * 8) / (duration * 1000000);
    res.json({
      success: true,
      receivedBytes,
      durationMs: endTime - startTime,
      speedMbps: Math.round(speedMbps * 100) / 100
    });
  });

  req.on('error', (err) => {
    if (aborted) return;
    console.error('Upload error:', err);
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
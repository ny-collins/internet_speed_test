require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const crypto = require('crypto');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_DOWNLOAD_SIZE_MB = parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '50', 10); // safety cap
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10); // for info endpoint (enforced via raw limit below if desired)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGIN === '*' || origin === CORS_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(compression());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

// (Removed unused pingStore to reduce memory footprint)

/**
 * Ping endpoint - measures latency
 * Returns minimal data for accurate RTT measurement
 */
app.get('/api/ping', (req, res) => {
  const timestamp = Date.now();
  res.json({ 
    timestamp,
    server: 'ok'
  });
});

/**
 * Download endpoint - provides data for download speed testing
 * Generates random data of specified size
 */
app.get('/api/download', (req, res) => {
  // Default to 5MB, allow customization via query param
  let sizeInMB = parseInt(req.query.size, 10) || 5;
  if (sizeInMB < 1) sizeInMB = 1;
  if (sizeInMB > MAX_DOWNLOAD_SIZE_MB) sizeInMB = MAX_DOWNLOAD_SIZE_MB; // clamp
  const sizeInBytes = sizeInMB * 1024 * 1024;
  
  // Generate random data for download
  // Using crypto for better randomness distribution
  const chunks = [];
  const chunkSize = 64 * 1024; // 64KB chunks
  const numChunks = Math.ceil(sizeInBytes / chunkSize);
  
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

/**
 * Upload endpoint - receives data for upload speed testing
 * Measures time to receive data from client
 */
app.post('/api/upload', (req, res) => {
  const startTime = Date.now();
  let receivedBytes = 0;
  
  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
  });
  
  req.on('end', () => {
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
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  });
});

/**
 * Multi-ping endpoint for jitter calculation
 * Allows batch ping measurements for statistical analysis
 */
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

/**
 * Server info endpoint
 * Provides server location and capabilities
 */
app.get('/api/info', (req, res) => {
  res.json({
    serverLocation: process.env.SERVER_LOCATION || 'Unknown',
    maxDownloadSize: MAX_DOWNLOAD_SIZE_MB, // MB
    maxUploadSize: MAX_UPLOAD_SIZE_MB, // MB (advisory)
    supportedTests: ['ping', 'download', 'upload', 'jitter'],
    version: '1.0.1'
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

/**
 * Simple endpoint to test connection
 */
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Connection successful',
    clientIp: req.ip,
    timestamp: Date.now()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Speed test server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server location: ${process.env.SERVER_LOCATION || 'Unknown'}`);
  console.log(`CORS Origin: ${CORS_ORIGIN}`);
  console.log(`Max download size: ${MAX_DOWNLOAD_SIZE_MB}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

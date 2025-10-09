require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

// Store ping measurements temporarily (in production, use Redis)
const pingStore = new Map();

// Clean up old ping measurements every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of pingStore.entries()) {
    if (value.timestamp < fiveMinutesAgo) {
      pingStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
  const sizeInMB = parseInt(req.query.size) || 5;
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
  const { count = 10, sessionId } = req.body;
  const measurements = [];
  
  // Return current server timestamp for each ping
  for (let i = 0; i < count; i++) {
    measurements.push({
      id: i,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex')
    });
  }
  
  res.json({
    measurements,
    serverTime: Date.now()
  });
});

/**
 * Server info endpoint
 * Provides server location and capabilities
 */
app.get('/api/info', (req, res) => {
  res.json({
    serverLocation: process.env.SERVER_LOCATION || 'Unknown',
    maxDownloadSize: 50, // MB
    maxUploadSize: 50, // MB
    supportedTests: ['ping', 'download', 'upload', 'jitter'],
    version: '1.0.0'
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
app.listen(PORT, () => {
  console.log(`Speed test server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server location: ${process.env.SERVER_LOCATION || 'Unknown'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

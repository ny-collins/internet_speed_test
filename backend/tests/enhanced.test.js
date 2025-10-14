const request = require('supertest');
const { app } = require('../server');

describe('API Enhanced Test Suite', () => {
  
  // ========================================
  // CONCURRENT REQUESTS
  // ========================================
  
  test('Handles concurrent download requests', async () => {
    const concurrentRequests = 5;
    const promises = Array.from({ length: concurrentRequests }, () =>
      request(app).get('/api/download?size=1')
    );
    
    const results = await Promise.all(promises);
    
    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/octet-stream');
    });
  }, 15000);
  
  // ========================================
  // UPLOAD SIZE ENFORCEMENT
  // ========================================
  
  test('Rejects oversized uploads with 413', async () => {
    // Create buffer larger than MAX_UPLOAD_SIZE_MB (default 50MB)
    const oversizeData = Buffer.alloc(51 * 1024 * 1024); // 51MB
    
    try {
      const res = await request(app)
        .post('/api/upload')
        .send(oversizeData)
        .set('Content-Type', 'application/octet-stream');
      
      // If we get a response, it should be 413
      expect(res.status).toBe(413);
      expect(res.body).toHaveProperty('error');
    } catch (error) {
      // Connection reset is also acceptable behavior for oversized uploads
      // Server destroys the connection when limit is exceeded
      expect(error.code).toMatch(/ECONNRESET|EPIPE/);
    }
  }, 30000);
  
  test('Accepts valid upload size', async () => {
    const validData = Buffer.alloc(1 * 1024 * 1024); // 1MB
    
    const res = await request(app)
      .post('/api/upload')
      .send(validData)
      .set('Content-Type', 'application/octet-stream');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('receivedBytes');
    expect(res.body.receivedBytes).toBeGreaterThan(0);
  }, 10000);
  
  // ========================================
  // DOWNLOAD SIZE CLAMPING
  // ========================================
  
  test('Clamps download size to maximum allowed', async () => {
    const res = await request(app).get('/api/download?size=999');
    
    expect(res.status).toBe(200);
    const contentLength = parseInt(res.header['content-length'], 10);
    expect(contentLength).toBeLessThanOrEqual(50 * 1024 * 1024);
  }, 15000);
  
  test('Respects minimum download size (1MB)', async () => {
    const res = await request(app).get('/api/download?size=0');
    
    expect(res.status).toBe(200);
    const contentLength = parseInt(res.header['content-length'], 10);
    expect(contentLength).toBeGreaterThanOrEqual(1 * 1024 * 1024);
  });
  
  // ========================================
  // CLIENT DISCONNECT HANDLING
  // ========================================
  
  test('Handles client disconnect gracefully', async () => {
    const req = request(app).get('/api/download?size=10');
    
    // Abort request mid-stream
    setTimeout(() => req.abort(), 100);
    
    try {
      await req;
    } catch (error) {
      // Request aborted - this is expected behavior
      expect(error.code).toMatch(/ECONNRESET|ABORTED/);
    }
  });
  
  // ========================================
  // ENDPOINT AVAILABILITY
  // ========================================
  
  test('Health endpoint returns uptime', async () => {
    const res = await request(app).get('/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });
  
  test('Info endpoint returns complete metadata', async () => {
    const res = await request(app).get('/api/info');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('serverLocation');
    expect(res.body).toHaveProperty('maxDownloadSize');
    expect(res.body).toHaveProperty('maxUploadSize');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('supportedTests');
    expect(Array.isArray(res.body.supportedTests)).toBe(true);
  });
  
  // ========================================
  // CACHE HEADERS
  // ========================================
  
  test('Download endpoint has no-cache headers', async () => {
    const res = await request(app).get('/api/download?size=1');
    
    expect(res.status).toBe(200);
    expect(res.header['cache-control']).toMatch(/no-cache|no-store/);
  });
  
  // ========================================
  // ERROR HANDLING
  // ========================================
  
  test('Returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/nonexistent');
    
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
  
  test('Ping batch respects count limits', async () => {
    const res = await request(app)
      .post('/api/ping-batch')
      .send({ count: 150 }); // Try to exceed limit
    
    expect(res.status).toBe(200);
    expect(res.body.measurements.length).toBeLessThanOrEqual(100);
  });
});
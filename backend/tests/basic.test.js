const request = require('supertest');
const { app } = require('../server');

describe('API basic endpoints', () => {
  test('GET /api/info returns server info', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('serverLocation');
    expect(res.body).toHaveProperty('maxDownloadSize');
  });

  test('GET /api/ping returns timestamp', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
  });

  test('Download size clamp works', async () => {
    // Request something larger than max to ensure clamp (assuming max 50)
    const res = await request(app).get('/api/download?size=999');
    expect(res.status).toBe(200);
    // Content-Length should be <= 50MB
    const len = parseInt(res.header['content-length'], 10);
    expect(len).toBeLessThanOrEqual(50 * 1024 * 1024);
  });
});

/**
 * Unit tests for configuration
 */

import { CONFIG } from '../js/config.js';

describe('CONFIG', () => {
    test('has correct thread configuration', () => {
        expect(CONFIG.threads).toBeDefined();
        expect(CONFIG.threads.download).toBe(4);
        expect(CONFIG.threads.upload).toBe(4);
        expect(CONFIG.threads.min).toBe(1);
        expect(CONFIG.threads.max).toBe(8);
    });

    test('has correct duration configuration', () => {
        expect(CONFIG.duration).toBeDefined();
        expect(CONFIG.duration.download.min).toBe(3.5);
        expect(CONFIG.duration.download.max).toBe(10);
        expect(CONFIG.duration.download.default).toBe(10);
        expect(CONFIG.duration.upload.min).toBe(3);
        expect(CONFIG.duration.upload.max).toBe(10);
        expect(CONFIG.duration.upload.default).toBe(10);
    });

    test('has correct stability configuration', () => {
        expect(CONFIG.stability).toBeDefined();
        expect(CONFIG.stability.sampleCount).toBe(5);
        expect(CONFIG.stability.checkWindow).toBe(10);
        expect(CONFIG.stability.varianceThreshold).toBe(0.05);
    });

    test('has correct performance configuration', () => {
        expect(CONFIG.updateInterval).toBe(100);
        expect(CONFIG.rafThrottle).toBe(16);
    });

    test('has correct data transfer configuration', () => {
        expect(CONFIG.chunkSize).toBe(512);
        expect(CONFIG.uploadSize).toBe(10);
        expect(CONFIG.downloadSize).toBe(50);
    });

    test('has valid API base URL', () => {
        expect(CONFIG.apiBase).toBeDefined();
        expect(typeof CONFIG.apiBase).toBe('string');
        expect(CONFIG.apiBase).toMatch(/^https?:\/\//);
    });

    test('has correct animation duration', () => {
        expect(CONFIG.animationDuration).toBe(350);
    });

    test('thread min is less than max', () => {
        expect(CONFIG.threads.min).toBeLessThan(CONFIG.threads.max);
    });

    test('default thread count is within min-max range', () => {
        expect(CONFIG.threads.download).toBeGreaterThanOrEqual(CONFIG.threads.min);
        expect(CONFIG.threads.download).toBeLessThanOrEqual(CONFIG.threads.max);
        expect(CONFIG.threads.upload).toBeGreaterThanOrEqual(CONFIG.threads.min);
        expect(CONFIG.threads.upload).toBeLessThanOrEqual(CONFIG.threads.max);
    });

    test('duration min is less than max', () => {
        expect(CONFIG.duration.download.min).toBeLessThan(CONFIG.duration.download.max);
        expect(CONFIG.duration.upload.min).toBeLessThan(CONFIG.duration.upload.max);
    });

    test('stability variance threshold is positive', () => {
        expect(CONFIG.stability.varianceThreshold).toBeGreaterThan(0);
    });

    test('chunk and file sizes are positive', () => {
        expect(CONFIG.chunkSize).toBeGreaterThan(0);
        expect(CONFIG.uploadSize).toBeGreaterThan(0);
        expect(CONFIG.downloadSize).toBeGreaterThan(0);
    });
});

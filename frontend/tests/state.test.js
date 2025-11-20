/**
 * Unit tests for state management
 */

import { STATE } from '../js/state.js';

describe('STATE', () => {
    // Save initial state
    let initialState;
    
    beforeEach(() => {
        initialState = JSON.parse(JSON.stringify(STATE));
        // Reset state before each test
        STATE.testing = false;
        STATE.cancelling = false;
        STATE.currentPhase = null;
        STATE.lastTestTime = 0;
        STATE.abortControllers = [];
        STATE.testResults = {
            download: null,
            upload: null,
            latency: null,
            jitter: null
        };
    });

    test('has correct initial testing flags', () => {
        expect(STATE.testing).toBe(false);
        expect(STATE.cancelling).toBe(false);
        expect(STATE.currentPhase).toBe(null);
    });

    test('has test results structure', () => {
        expect(STATE.testResults).toBeDefined();
        expect(STATE.testResults).toHaveProperty('download');
        expect(STATE.testResults).toHaveProperty('upload');
        expect(STATE.testResults).toHaveProperty('latency');
        expect(STATE.testResults).toHaveProperty('jitter');
    });

    test('has abort controllers array', () => {
        expect(STATE.abortControllers).toBeDefined();
        expect(Array.isArray(STATE.abortControllers)).toBe(true);
        expect(STATE.abortControllers.length).toBe(0);
    });

    test('has server info property', () => {
        expect(STATE).toHaveProperty('serverInfo');
    });

    test('has history array', () => {
        expect(STATE.history).toBeDefined();
        expect(Array.isArray(STATE.history)).toBe(true);
    });

    test('has performance monitoring structure', () => {
        expect(STATE.performance).toBeDefined();
        expect(STATE.performance).toHaveProperty('monitoring');
        expect(STATE.performance).toHaveProperty('lastCheck');
        expect(STATE.performance).toHaveProperty('blockWarnings');
        expect(STATE.performance).toHaveProperty('maxBlockTime');
        expect(STATE.performance.monitoring).toBe(false);
    });

    test('has PWA update management', () => {
        expect(STATE.pwa).toBeDefined();
        expect(STATE.pwa).toHaveProperty('updateAvailable');
        expect(STATE.pwa).toHaveProperty('newWorker');
        expect(STATE.pwa.updateAvailable).toBe(false);
    });

    test('can update testing flag', () => {
        STATE.testing = true;
        expect(STATE.testing).toBe(true);
        
        STATE.testing = false;
        expect(STATE.testing).toBe(false);
    });

    test('can update current phase', () => {
        STATE.currentPhase = 'latency';
        expect(STATE.currentPhase).toBe('latency');
        
        STATE.currentPhase = 'download';
        expect(STATE.currentPhase).toBe('download');
        
        STATE.currentPhase = null;
        expect(STATE.currentPhase).toBe(null);
    });

    test('can add abort controllers', () => {
        const controller1 = new AbortController();
        const controller2 = new AbortController();
        
        STATE.abortControllers.push(controller1);
        expect(STATE.abortControllers.length).toBe(1);
        
        STATE.abortControllers.push(controller2);
        expect(STATE.abortControllers.length).toBe(2);
    });

    test('can store test results', () => {
        STATE.testResults.download = { speed: 50.5, bytesTransferred: 1000000 };
        expect(STATE.testResults.download).toEqual({ speed: 50.5, bytesTransferred: 1000000 });
        
        STATE.testResults.latency = { average: 45.2, min: 40, max: 50 };
        expect(STATE.testResults.latency).toEqual({ average: 45.2, min: 40, max: 50 });
    });

    test('can track last test time', () => {
        const now = Date.now();
        STATE.lastTestTime = now;
        expect(STATE.lastTestTime).toBe(now);
    });

    test('has correct gauge property', () => {
        expect(STATE).toHaveProperty('gaugeElement');
        expect(STATE).toHaveProperty('lastMaxScale');
        expect(STATE.lastMaxScale).toBe(100);
    });

    test('has RAF ID property', () => {
        expect(STATE).toHaveProperty('rafId');
        expect(STATE.rafId).toBe(null);
    });
});

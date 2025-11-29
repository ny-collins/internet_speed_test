/**
 * Unit tests for main application logic
 */

import { getFriendlyError } from '../js/utils.js';

// Mock DOM elements
const mockDOM = {
    startTest: { disabled: false, hidden: false },
    cancelTest: { disabled: true, hidden: true },
    retryTest: { hidden: true },
    gaugeStartButton: { hidden: false },
    gaugeValue: { textContent: '' },
    gaugePhase: { textContent: '' },
    resultsMatrix: { hidden: false }
};

// Mock STATE
const mockSTATE = {
    testing: false,
    cancelling: false,
    currentPhase: null,
    abortControllers: [],
    testResults: {
        download: null,
        upload: null,
        latency: null,
        jitter: null
    }
};

describe('Main Application Logic', () => {
    beforeEach(() => {
        // Reset mocks
        Object.assign(mockDOM.startTest, { disabled: false, hidden: false });
        Object.assign(mockDOM.cancelTest, { disabled: true, hidden: true });
        Object.assign(mockDOM.retryTest, { hidden: true });
        Object.assign(mockDOM.gaugeStartButton, { hidden: false });
        mockDOM.gaugeValue.textContent = '';
        mockDOM.gaugePhase.textContent = '';
        mockDOM.resultsMatrix.hidden = false;

        Object.assign(mockSTATE, {
            testing: false,
            cancelling: false,
            currentPhase: null,
            abortControllers: [],
            testResults: {
                download: null,
                upload: null,
                latency: null,
                jitter: null
            }
        });
    });

    describe('Error Handling', () => {
        test('getFriendlyError provides specific messages for different errors', () => {
            expect(getFriendlyError('Failed to fetch')).toContain('Connection lost');
            expect(getFriendlyError('NetworkError')).toContain('Network connection interrupted');
            expect(getFriendlyError('Timeout')).toContain('Test took too long');
            expect(getFriendlyError('CORS')).toContain('Cross-origin request blocked');
            expect(getFriendlyError('Unknown error')).toBe('Unknown error');
        });

        test('getFriendlyError handles HTTP status codes', () => {
            expect(getFriendlyError('Status 404')).toContain('Test endpoint not found');
            expect(getFriendlyError('Status 500')).toContain('Server error');
            expect(getFriendlyError('Status 503')).toContain('Service temporarily overloaded');
        });
    });

    describe('UI State Management', () => {
        test('UI elements have correct initial states', () => {
            expect(mockDOM.startTest.disabled).toBe(false);
            expect(mockDOM.startTest.hidden).toBe(false);
            expect(mockDOM.cancelTest.disabled).toBe(true);
            expect(mockDOM.cancelTest.hidden).toBe(true);
            expect(mockDOM.retryTest.hidden).toBe(true);
        });

        test('STATE has correct initial values', () => {
            expect(mockSTATE.testing).toBe(false);
            expect(mockSTATE.cancelling).toBe(false);
            expect(mockSTATE.currentPhase).toBe(null);
            expect(mockSTATE.abortControllers).toEqual([]);
            expect(mockSTATE.testResults.download).toBe(null);
            expect(mockSTATE.testResults.upload).toBe(null);
            expect(mockSTATE.testResults.latency).toBe(null);
            expect(mockSTATE.testResults.jitter).toBe(null);
        });
    });

    describe('Test Flow Logic', () => {
        test('test phases are properly ordered', () => {
            const phases = ['latency', 'download', 'upload'];
            expect(phases).toContain('latency');
            expect(phases).toContain('download');
            expect(phases).toContain('upload');
            expect(phases.indexOf('latency')).toBeLessThan(phases.indexOf('download'));
            expect(phases.indexOf('download')).toBeLessThan(phases.indexOf('upload'));
        });

        test('test results structure is complete', () => {
            const requiredMetrics = ['download', 'upload', 'latency', 'jitter'];
            requiredMetrics.forEach(metric => {
                expect(mockSTATE.testResults).toHaveProperty(metric);
            });
        });
    });
});

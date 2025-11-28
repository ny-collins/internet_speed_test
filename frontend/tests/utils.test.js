/**
 * Unit tests for utility functions
 */

import { formatBytes, getSpeedQuality, getLatencyQuality, getJitterQuality, sleep } from '../js/utils.js';

describe('formatBytes', () => {
    test('formats 0 bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    test('formats bytes correctly', () => {
        expect(formatBytes(100)).toBe('100 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    test('formats kilobytes correctly', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(10240)).toBe('10 KB');
    });

    test('formats megabytes correctly', () => {
        expect(formatBytes(1048576)).toBe('1 MB');
        expect(formatBytes(5242880)).toBe('5 MB');
        expect(formatBytes(10485760)).toBe('10 MB');
    });

    test('formats gigabytes correctly', () => {
        expect(formatBytes(1073741824)).toBe('1 GB');
        expect(formatBytes(5368709120)).toBe('5 GB');
    });

    test('handles decimal places correctly', () => {
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(1587200)).toBe('1.51 MB');
    });
});

describe('getSpeedQuality', () => {
    describe('download speed', () => {
        test('returns Excellent for speeds >= 100 Mbps', () => {
            expect(getSpeedQuality(100, 'download')).toBe('Excellent');
            expect(getSpeedQuality(150, 'download')).toBe('Excellent');
            expect(getSpeedQuality(500, 'download')).toBe('Excellent');
        });

        test('returns Good for speeds 50-99 Mbps', () => {
            expect(getSpeedQuality(50, 'download')).toBe('Good');
            expect(getSpeedQuality(75, 'download')).toBe('Good');
            expect(getSpeedQuality(99, 'download')).toBe('Good');
        });

        test('returns Average for speeds 25-49 Mbps', () => {
            expect(getSpeedQuality(25, 'download')).toBe('Average');
            expect(getSpeedQuality(30, 'download')).toBe('Average');
            expect(getSpeedQuality(49, 'download')).toBe('Average');
        });

        test('returns Slow for speeds < 25 Mbps', () => {
            expect(getSpeedQuality(24, 'download')).toBe('Slow');
            expect(getSpeedQuality(10, 'download')).toBe('Slow');
            expect(getSpeedQuality(1, 'download')).toBe('Slow');
        });
    });

    describe('upload speed', () => {
        test('returns Excellent for speeds >= 50 Mbps', () => {
            expect(getSpeedQuality(50, 'upload')).toBe('Excellent');
            expect(getSpeedQuality(100, 'upload')).toBe('Excellent');
        });

        test('returns Good for speeds 25-49 Mbps', () => {
            expect(getSpeedQuality(25, 'upload')).toBe('Good');
            expect(getSpeedQuality(40, 'upload')).toBe('Good');
            expect(getSpeedQuality(49, 'upload')).toBe('Good');
        });

        test('returns Average for speeds 10-24 Mbps', () => {
            expect(getSpeedQuality(10, 'upload')).toBe('Average');
            expect(getSpeedQuality(15, 'upload')).toBe('Average');
            expect(getSpeedQuality(24, 'upload')).toBe('Average');
        });

        test('returns Slow for speeds < 10 Mbps', () => {
            expect(getSpeedQuality(9, 'upload')).toBe('Slow');
            expect(getSpeedQuality(5, 'upload')).toBe('Slow');
            expect(getSpeedQuality(1, 'upload')).toBe('Slow');
        });
    });
});

describe('getLatencyQuality', () => {
    test('returns Excellent for latency <= 20ms', () => {
        expect(getLatencyQuality(10)).toBe('Excellent');
        expect(getLatencyQuality(20)).toBe('Excellent');
    });

    test('returns Good for latency 21-50ms', () => {
        expect(getLatencyQuality(21)).toBe('Good');
        expect(getLatencyQuality(35)).toBe('Good');
        expect(getLatencyQuality(50)).toBe('Good');
    });

    test('returns Average for latency 51-100ms', () => {
        expect(getLatencyQuality(51)).toBe('Average');
        expect(getLatencyQuality(75)).toBe('Average');
        expect(getLatencyQuality(100)).toBe('Average');
    });

    test('returns High for latency > 100ms', () => {
        expect(getLatencyQuality(101)).toBe('High');
        expect(getLatencyQuality(200)).toBe('High');
        expect(getLatencyQuality(500)).toBe('High');
    });
});

describe('getJitterQuality', () => {
    test('returns Excellent for jitter <= 5ms', () => {
        expect(getJitterQuality(0)).toBe('Excellent');
        expect(getJitterQuality(3)).toBe('Excellent');
        expect(getJitterQuality(5)).toBe('Excellent');
    });

    test('returns Good for jitter 6-15ms', () => {
        expect(getJitterQuality(6)).toBe('Good');
        expect(getJitterQuality(10)).toBe('Good');
        expect(getJitterQuality(15)).toBe('Good');
    });

    test('returns Average for jitter 16-30ms', () => {
        expect(getJitterQuality(16)).toBe('Average');
        expect(getJitterQuality(20)).toBe('Average');
        expect(getJitterQuality(30)).toBe('Average');
    });

    test('returns Unstable for jitter > 30ms', () => {
        expect(getJitterQuality(31)).toBe('Unstable');
        expect(getJitterQuality(50)).toBe('Unstable');
        expect(getJitterQuality(100)).toBe('Unstable');
    });
});

describe('sleep', () => {
    test('resolves after specified milliseconds', async () => {
        const start = Date.now();
        await sleep(100);
        const end = Date.now();
        const elapsed = end - start;

        // Allow some timing variance (within 50ms)
        expect(elapsed).toBeGreaterThanOrEqual(90);
        expect(elapsed).toBeLessThan(150);
    });

    test('returns a Promise', () => {
        const result = sleep(1);
        expect(result).toBeInstanceOf(Promise);
    });
});

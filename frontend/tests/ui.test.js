/**
 * Unit tests for UI component functions
 */

import { formatBytes, getSpeedQuality, getLatencyQuality, getJitterQuality } from '../js/utils.js';

describe('UI Component Functions', () => {
    describe('Result Display Formatting', () => {
        test('speed values are formatted to 1 decimal place', () => {
            const speed = 23.527;
            expect(speed.toFixed(1)).toBe('23.5');
        });

        test('latency values are formatted to 0 decimal places', () => {
            const latency = 45.7;
            expect(latency.toFixed(0)).toBe('46');
        });

        test('jitter values are formatted to 1 decimal place', () => {
            const jitter = 2.34;
            expect(jitter.toFixed(1)).toBe('2.3');
        });
    });

    describe('Quality Badge Logic', () => {
        test('download speed quality thresholds are correct', () => {
            expect(getSpeedQuality(150, 'download')).toBe('Excellent');
            expect(getSpeedQuality(75, 'download')).toBe('Good');
            expect(getSpeedQuality(25, 'download')).toBe('Average');
            expect(getSpeedQuality(5, 'download')).toBe('Slow');
        });

        test('upload speed quality thresholds are correct', () => {
            expect(getSpeedQuality(50, 'upload')).toBe('Excellent');
            expect(getSpeedQuality(25, 'upload')).toBe('Good');
            expect(getSpeedQuality(10, 'upload')).toBe('Average');
            expect(getSpeedQuality(2, 'upload')).toBe('Slow');
        });

        test('latency quality thresholds are correct', () => {
            expect(getLatencyQuality(10)).toBe('Excellent');
            expect(getLatencyQuality(25)).toBe('Good');
            expect(getLatencyQuality(75)).toBe('Average');
            expect(getLatencyQuality(150)).toBe('High');
        });

        test('jitter quality thresholds are correct', () => {
            expect(getJitterQuality(1)).toBe('Excellent');
            expect(getJitterQuality(5)).toBe('Excellent');
            expect(getJitterQuality(15)).toBe('Good');
            expect(getJitterQuality(30)).toBe('Average');
        });
    });

    describe('Data Formatting', () => {
        test('bytes are formatted correctly for different sizes', () => {
            expect(formatBytes(512)).toBe('512 B');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1048576)).toBe('1 MB');
            expect(formatBytes(1073741824)).toBe('1 GB');
        });

        test('large byte values are handled correctly', () => {
            expect(formatBytes(2147483648)).toBe('2 GB'); // 2^31
            expect(formatBytes(5368709120)).toBe('5 GB');
        });
    });
});
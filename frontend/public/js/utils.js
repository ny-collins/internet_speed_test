
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function scheduleIdleTask(callback, timeout = 5000) {
    if ('requestIdleCallback' in window) {
        return requestIdleCallback(callback, { timeout });
    } else {
        return setTimeout(callback, 0);
    }
}

export function cancelIdleTask(id) {
    if ('cancelIdleCallback' in window) {
        cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getSpeedQuality(speed, type) {
    if (type === 'download') {
        if (speed >= 100) return 'Excellent';
        if (speed >= 50) return 'Good';
        if (speed >= 25) return 'Average';
        return 'Slow';
    } else {
        if (speed >= 50) return 'Excellent';
        if (speed >= 25) return 'Good';
        if (speed >= 10) return 'Average';
        return 'Slow';
    }
}

export function getSpeedContext(speed, type) {
    if (type === 'download') {
        if (speed >= 100) return '✓ 4K streaming<br>✓ Large downloads';
        if (speed >= 50) return '✓ HD streaming<br>✓ Video calls';
        if (speed >= 25) return '✓ SD streaming<br>✓ Basic browsing';
        return '⚠ Slow browsing<br>⚠ Buffering likely';
    } else {
        if (speed >= 50) return '✓ 4K uploads<br>✓ Live streaming';
        if (speed >= 25) return '✓ HD video calls<br>✓ File sharing';
        if (speed >= 10) return '✓ Video calls<br>✓ Basic uploads';
        return '⚠ Slow uploads<br>⚠ Limited quality';
    }
}

export function getLatencyQuality(latency) {
    if (latency <= 20) return 'Excellent';
    if (latency <= 50) return 'Good';
    if (latency <= 100) return 'Average';
    return 'High';
}

export function getJitterQuality(jitter) {
    if (jitter <= 5) return 'Excellent';
    if (jitter <= 15) return 'Good';
    if (jitter <= 30) return 'Average';
    return 'Unstable';
}

export function getFriendlyError(errorMessage) {
    const errors = {
        'Failed to fetch': 'Connection lost. Check your internet connection and try again.',
        'Network request failed': 'Unable to reach test server. Check if a firewall or VPN is blocking the connection.',
        'NetworkError': 'Network connection interrupted. Please check your connection and retry.',
        'The user aborted a request': 'Test was cancelled.',
        'Download test cancelled': 'Test was cancelled.',
        'Upload test cancelled': 'Test was cancelled.',
        'Timeout': 'Test took too long. Your connection may be very slow or unstable.',
        'Load failed': 'Failed to connect to server. Please try again.',
        'Type error': 'An unexpected error occurred. Please refresh the page and try again.',
        'Invalid download measurement': 'Download test produced invalid results. This may indicate network issues.',
        'Invalid upload measurement': 'Upload test produced invalid results. This may indicate network issues.',
        'CORS': 'Cross-origin request blocked. Please check your browser settings.',
        '403': 'Access forbidden. The test server may be temporarily unavailable.',
        '404': 'Test endpoint not found. The service may be under maintenance.',
        '500': 'Server error. Please try again in a few moments.',
        '502': 'Bad gateway. The test server is temporarily unavailable.',
        '503': 'Service temporarily overloaded. Please try again later.',
        'Circuit breaker': 'Server is temporarily busy. Please wait a moment and try again.'
    };

    const statusMatch = errorMessage.match(/Status (\d+)/);
    if (statusMatch) {
        const statusCode = statusMatch[1];
        const statusError = errors[statusCode];
        if (statusError) return statusError;
    }

    for (const [key, message] of Object.entries(errors)) {
        if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
            return message;
        }
    }

    return errorMessage || 'An unexpected error occurred. Please try again.';
}

export function getConnectionType() {
    if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
        return 'Unknown';
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = connection.effectiveType || connection.type || 'unknown';

    const types = {
        'slow-2g': 'Slow 2G',
        '2g': '2G',
        '3g': '3G',
        '4g': '4G/LTE',
        'wifi': 'WiFi',
        'ethernet': 'Ethernet',
        'unknown': 'Unknown'
    };

    return types[type] || 'Unknown';
}


export async function measureLoadedLatency(config, abortController, durationMs = 10000) {
    const samples = [];
    const startTime = performance.now();
    const endTime = startTime + durationMs;

    while (performance.now() < endTime && !abortController.signal.aborted) {
        try {
            const pingStart = performance.now();
            
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
            
            const combinedSignal = AbortSignal.any ? 
                AbortSignal.any([abortController.signal, timeoutController.signal]) :
                abortController.signal;
            
            await fetch(`${config.apiBase}/api/ping?t=${Date.now()}`, {
                signal: combinedSignal,
                cache: 'no-store',
                method: 'HEAD' // Use HEAD to minimize data transfer
            });
            
            clearTimeout(timeoutId);
            const pingDuration = performance.now() - pingStart;
            samples.push(pingDuration);

            await sleep(500);
        } catch (error) {
            if (error.name === 'AbortError') break;
            console.warn('[Loaded Latency] Ping failed:', error.message);
        }
    }

    if (samples.length === 0) return null;

    const average = samples.reduce((a, b) => a + b, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const jitter = calculateJitter(samples);

    return {
        average,
        min,
        max,
        jitter,
        sampleCount: samples.length,
        samples
    };
}

function calculateJitter(samples) {
    if (samples.length < 2) return 0;

    let totalJitter = 0;
    for (let i = 1; i < samples.length; i++) {
        totalJitter += Math.abs(samples[i] - samples[i - 1]);
    }

    return totalJitter / (samples.length - 1);
}


export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            testStartTime: null,
            testEndTime: null,
            memoryUsage: [],
            networkRequests: 0,
            errors: [],
            threadBlocks: 0,
            threadBlockTime: 0,
            lastFrameTime: null
        };
        this.enabled = false;
        this.frameCallback = null;
    }

    enable() {
        this.enabled = true;
        this.startFrameMonitoring();
    }

    disable() {
        this.enabled = false;
        this.stopFrameMonitoring();
    }

    startFrameMonitoring() {
        if (!this.enabled) return;

        const monitorFrame = (timestamp) => {
            if (!this.enabled) return;

            if (this.metrics.lastFrameTime !== null) {
                const frameTime = timestamp - this.metrics.lastFrameTime;

                if (frameTime > 17) {
                    this.metrics.threadBlocks++;
                    this.metrics.threadBlockTime += (frameTime - 16.67); // Time over budget
                }
            }

            this.metrics.lastFrameTime = timestamp;
            this.frameCallback = requestAnimationFrame(monitorFrame);
        };

        this.frameCallback = requestAnimationFrame(monitorFrame);
    }

    stopFrameMonitoring() {
        if (this.frameCallback) {
            cancelAnimationFrame(this.frameCallback);
            this.frameCallback = null;
        }
    }

    startTest() {
        if (!this.enabled) return;
        this.metrics.testStartTime = performance.now();
        this.metrics.memoryUsage = [];
        this.metrics.networkRequests = 0;
        this.metrics.errors = [];
    }

    endTest() {
        if (!this.enabled || !this.metrics.testStartTime) return;
        this.metrics.testEndTime = performance.now();
        this.logMetrics();
    }

    recordMemoryUsage() {
        if (!this.enabled || !performance.memory) return;
        this.metrics.memoryUsage.push({
            timestamp: performance.now(),
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        });
    }

    recordNetworkRequest() {
        if (!this.enabled) return;
        this.metrics.networkRequests++;
    }

    recordError(error, context = '') {
        if (!this.enabled) return;
        this.metrics.errors.push({
            timestamp: performance.now(),
            error: error.message || error,
            context
        });
    }

    logMetrics() {
        if (!this.enabled) return;

        const duration = this.metrics.testEndTime - this.metrics.testStartTime;
    }
}

export const performanceMonitor = new PerformanceMonitor();
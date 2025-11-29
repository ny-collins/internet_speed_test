// ========================================
// UTILITY FUNCTIONS
// ========================================

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    // Check for HTTP status codes in the message
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

// ========================================
// PERFORMANCE MONITORING
// ========================================

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            testStartTime: null,
            testEndTime: null,
            memoryUsage: [],
            networkRequests: 0,
            errors: []
        };
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
        console.log('[Performance] Monitoring enabled');
    }

    disable() {
        this.enabled = false;
        console.log('[Performance] Monitoring disabled');
    }

    startTest() {
        if (!this.enabled) return;
        this.metrics.testStartTime = performance.now();
        this.metrics.memoryUsage = [];
        this.metrics.networkRequests = 0;
        this.metrics.errors = [];
        console.log('[Performance] Test started');
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
        console.group('[Performance] Test Metrics');
        console.log(`Duration: ${duration.toFixed(2)}ms`);
        console.log(`Network requests: ${this.metrics.networkRequests}`);
        console.log(`Errors: ${this.metrics.errors.length}`);

        if (this.metrics.errors.length > 0) {
            console.group('Errors:');
            this.metrics.errors.forEach(err => {
                console.log(`${err.timestamp.toFixed(2)}ms: ${err.error} (${err.context})`);
            });
            console.groupEnd();
        }

        if (this.metrics.memoryUsage.length > 0) {
            const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            console.log(`Memory: ${(latest.used / 1024 / 1024).toFixed(2)}MB used of ${(latest.total / 1024 / 1024).toFixed(2)}MB`);
        }

        console.groupEnd();
    }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

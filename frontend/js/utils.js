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

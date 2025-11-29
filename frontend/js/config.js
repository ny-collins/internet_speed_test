// ========================================
// CONFIGURATION
// ========================================

// Progressive enhancement based on device capabilities
function getOptimalUpdateInterval() {
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4; // GB

    // Lower-end devices: reduce update frequency to prevent UI blocking
    if (hardwareConcurrency <= 2 || deviceMemory <= 2) {
        return 200; // 200ms instead of 100ms
    }

    // High-end devices: can handle more frequent updates
    if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
        return 50; // 50ms for smoother updates
    }

    // Default for mid-range devices
    return 100;
}

export const CONFIG = {
    // Test parameters (user configurable)
    threads: {
        download: 4,
        upload: 4,
        min: 1,
        max: 8
    },
    duration: {
        download: {
            min: 3.5,
            max: 10,
            default: 10
        },
        upload: {
            min: 3,
            max: 10,
            default: 10
        }
    },
    stability: {
        sampleCount: 5,          // Minimum samples required before checking stability
        checkWindow: 10,         // Analyze last 10 samples for more reliable detection
        varianceThreshold: 0.15  // Increased from 0.05 (5%) to 0.15 (15%) for more realistic stability detection
    },
    // Performance (dynamically optimized)
    updateInterval: getOptimalUpdateInterval(), // ms between gauge updates
    rafThrottle: 16,     // ~60fps
    // Data transfer
    chunkSize: 512,      // KB for download chunks
    uploadSize: 10,      // MB per upload thread
    downloadSize: 50,    // MB per download thread
    // Backend
    apiBase: typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://speed-test-backend.up.railway.app',
    // UI
    animationDuration: 350
};

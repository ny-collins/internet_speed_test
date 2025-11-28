// ========================================
// CONFIGURATION
// ========================================

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
        varianceThreshold: 0.05
    },
    // ISP Comparison
    ispPlanSpeed: 100, // User's advertised ISP plan speed in Mbps
    // Performance
    updateInterval: 100, // ms between gauge updates
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

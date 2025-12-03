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
            min: 8,      // Increased from 3.5s to allow TCP ramp-up on high-latency links
            max: 20,     // Increased from 10s to give TCP time to reach full speed
            default: 15  // Increased from 10s for international connections
        },
        upload: {
            min: 8,      // Match download for consistency
            max: 20,
            default: 15
        }
    },
    stability: {
        sampleCount: 5,          // Minimum samples required before checking stability
        checkWindow: 10,         // Analyze last 10 samples for more reliable detection
        varianceThreshold: 0.30  // Increased from 0.15 (15%) to 0.30 (30%) - TCP over international links is noisy
    },
    // Measurement accuracy
    warmupDuration: 2.0,        // Seconds to exclude from final speed calculation (TCP slow start)
    // Performance (dynamically optimized)
    updateInterval: getOptimalUpdateInterval(), // ms between gauge updates
    rafThrottle: 16,     // ~60fps
    // Data transfer
    chunkSize: 512,      // KB for download chunks
    uploadSize: 10,      // MB per upload thread
    downloadSize: 50,    // MB per download thread
    // Connection optimization
    connectionTimeout: 10000,   // 10 second timeout for connections
    maxRetries: 2,              // Maximum retry attempts for failed requests
    retryDelay: 1000,           // Delay between retries (ms)
    // Backend
    apiBase: typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://speed-test-backend.up.railway.app',
    // UI Animation Constants
    animationDuration: 350,
    gaugeMaxDegrees: 270,        // Maximum rotation for gauge progress (270° = 3/4 circle)
    numberAnimationDuration: 300, // ms for smooth number counting
    fadeAnimationDuration: 400,   // ms for fade-in effects
    // Accessibility
    screenReaderThrottle: 2000,   // ms between similar announcements
    // Validation
    enableValidation: true,     // Enable measurement validation
    minConfidenceScore: 50      // Minimum confidence score to accept results
};

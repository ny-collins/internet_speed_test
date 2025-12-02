// ========================================
// GLOBAL STATE
// ========================================

export const STATE = {
    testing: false,
    cancelling: false,
    currentPhase: null,
    gaugeElement: null,
    lastMaxScale: 100,
    lastTestTime: 0, // Track last test timestamp for rate limiting
    testResults: {
        download: null,
        upload: null,
        latency: null,
        jitter: null
    },
    abortControllers: [],
    serverInfo: null,
    history: [],
    rafId: null,
    // Performance monitoring
    performance: {
        monitoring: false,
        lastCheck: 0,
        blockWarnings: 0,
        maxBlockTime: 0
    },
    // PWA update management
    pwa: {
        updateAvailable: false,
        newWorker: null
    },
    // Variance graph tracking
    varianceGraph: {
        samples: [],
        maxSamples: 50, // 50 samples at 100ms = 5 seconds of data
        active: false,
        // Animation state for smooth number transitions
        animations: {
            avg: { current: 0, target: 0, rafId: null },
            min: { current: 0, target: 0, rafId: null },
            max: { current: 0, target: 0, rafId: null },
            percent: { current: 0, target: 0, rafId: null }
        }
    }
};

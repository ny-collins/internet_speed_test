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
    }
};

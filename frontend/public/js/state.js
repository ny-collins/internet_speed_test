// ========================================
// GLOBAL STATE
// ========================================

export const STATE = {
    testing: false,
    cancelling: false,
    currentPhase: null,
    gaugeElement: null,
    lastMaxScale: 100,
    lastTestTime: 0,
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
    performance: {
        monitoring: false,
        lastCheck: 0,
        blockWarnings: 0,
        maxBlockTime: 0
    },
    pwa: {
        updateAvailable: false,
        newWorker: null
    },
    varianceGraph: {
        samples: [],
        maxSamples: 50,
        active: false,
        animations: {
            avg: { current: 0, target: 0, rafId: null },
            min: { current: 0, target: 0, rafId: null },
            max: { current: 0, target: 0, rafId: null },
            percent: { current: 0, target: 0, rafId: null }
        }
    }
};

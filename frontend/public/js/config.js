// ========================================
// CONFIGURATION
// ========================================

function getOptimalUpdateInterval() {
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 4;

    if (hardwareConcurrency <= 2 || deviceMemory <= 2) {
        return 200;
    }

    if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
        return 50;
    }

    return 100;
}

export const CONFIG = {
    threads: {
        download: 4,
        upload: 4,
        min: 1,
        max: 8
    },
    duration: {
        download: {
            min: 8,
            max: 20,
            default: 15
        },
        upload: {
            min: 8,
            max: 20,
            default: 15
        }
    },
    stability: {
        sampleCount: 5,
        checkWindow: 10,
        varianceThreshold: 0.30
    },
    warmupDuration: 2.0,
    updateInterval: getOptimalUpdateInterval(),
    rafThrottle: 16,
    chunkSize: 512,
    uploadSize: 20,
    downloadSize: 50,
    connectionTimeout: 10000,
    maxRetries: 2,
    retryDelay: 1000,
    apiBase: typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://speed-test-backend.up.railway.app',
    animationDuration: 350,
    gaugeMaxDegrees: 270,
    numberAnimationDuration: 300,
    fadeAnimationDuration: 400,
    screenReaderThrottle: 2000,
    enableValidation: true,
    minConfidenceScore: 50
};

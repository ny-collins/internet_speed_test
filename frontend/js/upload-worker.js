// ========================================
// UPLOAD WORKER
// Handles upload monitoring off the main thread
// ========================================

// Worker message types
const MESSAGE_TYPES = {
    START_UPLOAD: 'start_upload',
    PROGRESS_UPDATE: 'progress_update',
    UPLOAD_COMPLETE: 'upload_complete',
    UPLOAD_ERROR: 'upload_error',
    ABORT: 'abort'
};

let isRunning = false;
let startTime = 0;
let totalBytes = 0;
let speedSamples = [];
let lastSampleTime = 0;
let lastBytes = 0;
let config = {};

// Stability tracking functions
function isSpeedStable(samples) {
    if (samples.length < config.stability.sampleCount) return false;
    const checkWindow = Math.min(samples.length, config.stability.checkWindow);
    const recentSamples = samples.slice(-checkWindow);
    const avg = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
    const variance = recentSamples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / recentSamples.length;
    return variance < config.stability.varianceThreshold;
}

function calculateStability(samples) {
    if (samples.length < 2) return 100;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / samples.length;
    return Math.max(0, Math.min(100, (1 - variance * 10) * 100));
}

// Monitor loop (runs in worker)
async function monitorLoop() {
    const maxDuration = config.duration.upload.max * 1000;
    const minDuration = config.duration.upload.min * 1000;

    while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, config.updateInterval));

        const elapsed = performance.now() - startTime;

        // Calculate current speed
        let currentSpeed = 0;
        if (elapsed > 0 && totalBytes > 0) {
            currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps
        }

        // Send progress update to main thread
        self.postMessage({
            type: MESSAGE_TYPES.PROGRESS_UPDATE,
            elapsed,
            totalBytes,
            currentSpeed,
            speedSamples: speedSamples.slice(-3) // Send recent samples for smoothing
        });

        // Stability check
        if (elapsed - lastSampleTime >= 500) {
            const intervalBytes = totalBytes - lastBytes;
            const intervalDuration = (elapsed - lastSampleTime) / 1000;

            if (intervalBytes > 0) {
                const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                speedSamples.push(intervalSpeed);

                // Limit sample history to prevent memory growth
                if (speedSamples.length > 100) {
                    speedSamples.shift();
                }

                if (elapsed >= minDuration && speedSamples.length >= config.stability.sampleCount) {
                    if (isSpeedStable(speedSamples)) {
                        console.log('[Upload Worker] Speed stabilized, stopping early');
                        isRunning = false;
                        break;
                    }
                }
            }

            lastSampleTime = elapsed;
            lastBytes = totalBytes;
        }

        // Check duration limits
        if (elapsed >= maxDuration) {
            console.log('[Upload Worker] Max duration reached');
            isRunning = false;
            break;
        }
    }

    // Calculate final results
    const duration = (performance.now() - startTime) / 1000;
    const bytesTransferred = totalBytes;
    const speedMbps = bytesTransferred > 0 ? (bytesTransferred * 8) / duration / 1_000_000 : 0;

    // Send completion message
    self.postMessage({
        type: MESSAGE_TYPES.UPLOAD_COMPLETE,
        speed: speedMbps,
        bytesTransferred,
        duration,
        stability: calculateStability(speedSamples)
    });
}

// Message handler
self.onmessage = function(e) {
    const { type, config: workerConfig, bytesTransferred } = e.data;

    switch (type) {
        case MESSAGE_TYPES.START_UPLOAD: {
            config = workerConfig;
            isRunning = true;
            startTime = performance.now();
            totalBytes = 0;
            speedSamples = [];
            lastSampleTime = 0;
            lastBytes = 0;

            // Start monitor loop
            monitorLoop();
            break;
        }

        case MESSAGE_TYPES.PROGRESS_UPDATE: {
            // Update total bytes from main thread
            totalBytes = bytesTransferred;
            break;
        }

        case MESSAGE_TYPES.ABORT: {
            isRunning = false;
            break;
        }
    }
};


// ========================================
// DOWNLOAD WORKER
// Handles heavy download processing off the main thread
// ========================================

// Worker message types
const MESSAGE_TYPES = {
    START_DOWNLOAD: 'start_download',
    PROGRESS_UPDATE: 'progress_update',
    DOWNLOAD_COMPLETE: 'download_complete',
    DOWNLOAD_ERROR: 'download_error',
    ABORT: 'abort'
};

let isRunning = false;
let abortController = null;
let startTime = 0;
let totalBytes = 0;
let speedSamples = [];
let lastSampleTime = 0;
let lastBytes = 0;

// Configuration (passed from main thread)
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

// Download thread function (runs in worker)
async function downloadThread(threadId, byteCounter) {
    try {
        const url = `${config.apiBase}/api/download?size=${config.downloadSize}&chunk=${config.chunkSize}&t=${Date.now()}`;
        const response = await fetch(url, {
            signal: abortController.signal,
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        if (!response.body) throw new Error('No body');

        const reader = response.body.getReader();

        while (isRunning && !abortController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            byteCounter.bytes += value.length;
        }

        try { await reader.cancel(); } catch (e) { /* Ignore cancel errors */ }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error(`[Download Worker] Thread ${threadId} error:`, error);
            self.postMessage({
                type: MESSAGE_TYPES.DOWNLOAD_ERROR,
                threadId,
                error: error.message
            });
        }
    }
}

// Monitor loop (runs in worker)
async function monitorLoop(threadCount, byteCounters) {
    const maxDuration = config.duration.download.max * 1000;
    const minDuration = config.duration.download.min * 1000;

    while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, config.updateInterval));

        const elapsed = performance.now() - startTime;
        totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

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

                if (elapsed >= minDuration && speedSamples.length >= config.stability.sampleCount) {
                    if (isSpeedStable(speedSamples)) {
                        console.log('[Download Worker] Speed stabilized, stopping early');
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
            console.log('[Download Worker] Max duration reached');
            isRunning = false;
            break;
        }
    }

    // Calculate final results
    const duration = (performance.now() - startTime) / 1000;
    const bytesTransferred = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);
    const speedMbps = bytesTransferred > 0 ? (bytesTransferred * 8) / duration / 1_000_000 : 0;

    // Send completion message
    self.postMessage({
        type: MESSAGE_TYPES.DOWNLOAD_COMPLETE,
        speed: speedMbps,
        bytesTransferred,
        duration,
        stability: calculateStability(speedSamples)
    });
}

// Message handler
self.onmessage = async function(e) {
    const { type, config: workerConfig, threadCount } = e.data;

    switch (type) {
        case MESSAGE_TYPES.START_DOWNLOAD: {
            config = workerConfig;
            isRunning = true;
            abortController = new AbortController();
            startTime = performance.now();
            totalBytes = 0;
            speedSamples = [];
            lastSampleTime = 0;
            lastBytes = 0;

            // Initialize byte counters for each thread
            const byteCounters = Array.from({ length: threadCount }, () => ({ bytes: 0 }));

            // Start download threads
            byteCounters.forEach((counter, i) => {
                downloadThread(i, counter);
            });

            // Start monitor loop
            monitorLoop(threadCount, byteCounters);
            break;
        }

        case MESSAGE_TYPES.ABORT: {
            isRunning = false;
            if (abortController) {
                abortController.abort();
            }
            break;
        }
    }
};

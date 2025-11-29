// ========================================
// UPLOAD WORKER
// Handles heavy upload processing off the main thread
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
let abortController = null;
let startTime = 0;
let totalBytes = 0;
let speedSamples = [];
let lastSampleTime = 0;
let lastBytes = 0;
let lastIntervalSpeed = 0;

// Configuration (passed from main thread)
let config = {};

// Pre-built blob for upload tests (created in worker)
let uploadBlob = null;

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

// Create reusable upload blob
function createUploadBlob() {
    const totalSize = config.uploadSize * 1024 * 1024;
    const chunkSize = 65536; // 64KB chunks
    const chunksNeeded = Math.ceil(totalSize / chunkSize);
    const chunks = [];

    // Create random data chunks
    for (let i = 0; i < chunksNeeded; i++) {
        const chunk = new Uint8Array(chunkSize);
        crypto.getRandomValues(chunk);
        chunks.push(chunk.buffer);
    }

    return new Blob(chunks, { type: 'application/octet-stream' });
}

// Upload thread function (runs in worker)
async function uploadThread(threadId, byteCounter) {
    try {
        // Loop uploads until time limit reached or aborted
        while (isRunning && !abortController.signal.aborted) {
            // XHR Promise for upload with progress tracking
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                let finished = false;

                const finish = (error = null) => {
                    if (finished) return;
                    finished = true;
                    if (error) reject(error);
                    else resolve();
                };

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        byteCounter.bytes = event.loaded;
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        finish();
                    } else {
                        finish(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                };

                xhr.onerror = () => finish(new Error('Network error'));
                xhr.onabort = () => finish(new Error('Aborted'));

                xhr.open('POST', `${config.apiBase}/api/upload?t=${Date.now()}`, true);
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.send(uploadBlob);
            });

            // Check if we should continue looping
            if (!isRunning || abortController.signal.aborted) {
                break;
            }
        }

    } catch (error) {
        if (error.name !== 'AbortError' && error.message !== 'Aborted') {
            console.error(`[Upload Worker] Thread ${threadId} error:`, error);
            self.postMessage({
                type: MESSAGE_TYPES.UPLOAD_ERROR,
                threadId,
                error: error.message
            });
        }
    }
}

// Monitor loop (runs in worker)
async function monitorLoop(threadCount, byteCounters) {
    const maxDuration = config.duration.upload.max * 1000;
    const minDuration = config.duration.upload.min * 1000;

    while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, config.updateInterval));

        const elapsed = performance.now() - startTime;
        totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

        // Use the most recent interval speed for current display
        const currentSpeed = lastIntervalSpeed;

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
                lastIntervalSpeed = intervalSpeed; // Update current speed display

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

    // Calculate final results (excluding warm-up period)
    const totalDuration = (performance.now() - startTime) / 1000;
    const warmUpPeriod = 2.0; // Exclude first 2 seconds to avoid TCP slow start penalty
    const effectiveDuration = Math.max(totalDuration - warmUpPeriod, 1.0); // Minimum 1 second

    const bytesTransferred = totalBytes;
    const speedMbps = bytesTransferred > 0 ? (bytesTransferred * 8) / effectiveDuration / 1_000_000 : 0;

    console.log(`[Upload Worker] Final: ${speedMbps.toFixed(2)} Mbps (${bytesTransferred} bytes in ${totalDuration.toFixed(1)}s, effective: ${effectiveDuration.toFixed(1)}s)`);

    // Send completion message
    self.postMessage({
        type: MESSAGE_TYPES.UPLOAD_COMPLETE,
        speed: speedMbps,
        bytesTransferred,
        duration: totalDuration,
        effectiveDuration,
        stability: calculateStability(speedSamples)
    });
}

// Message handler
self.onmessage = function(e) {
    const { type, config: workerConfig, threadCount } = e.data;

    switch (type) {
    case MESSAGE_TYPES.START_UPLOAD: {
        config = workerConfig;
        isRunning = true;
        abortController = new AbortController();
        startTime = performance.now();
        totalBytes = 0;
        speedSamples = [];
        lastSampleTime = 0;
        lastBytes = 0;

        // Create upload blob
        uploadBlob = createUploadBlob();

        // Create byte counters for each thread
        const byteCounters = [];
        for (let i = 0; i < threadCount; i++) {
            byteCounters.push({ bytes: 0 });
        }

        // Start upload threads
        for (let i = 0; i < threadCount; i++) {
            uploadThread(i, byteCounters[i]);
        }

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


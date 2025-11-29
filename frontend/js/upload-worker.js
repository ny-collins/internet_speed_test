// ========================================
// UPLOAD WORKER
// Handles heavy upload processing off the main thread
// ========================================

import { monitorLoop, calculateFinalResults } from './worker-utils.js';

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
let warmupBytes = 0; // Track bytes transferred during warm-up period
let speedSamples = [];
let lastSampleTime = 0;
let lastBytes = 0;
let lastIntervalSpeed = 0;
let warmupPeriodEnd = 0; // When warm-up period ends

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
async function monitorLoopWrapper(threadCount, byteCounters) {
    // Create refs for mutable variables
    const isRunningRef = { value: isRunning };
    const totalBytesRef = { value: totalBytes };
    const warmupBytesRef = { value: warmupBytes };
    const warmupPeriodEndRef = { value: warmupPeriodEnd };
    const lastSampleTimeRef = { value: lastSampleTime };
    const lastBytesRef = { value: lastBytes };
    const lastIntervalSpeedRef = { value: lastIntervalSpeed };

    await monitorLoop(config, 'upload', threadCount, byteCounters, MESSAGE_TYPES, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable);

    // Update local variables from refs
    isRunning = isRunningRef.value;
    totalBytes = totalBytesRef.value;
    warmupBytes = warmupBytesRef.value;
    warmupPeriodEnd = warmupPeriodEndRef.value;
    lastSampleTime = lastSampleTimeRef.value;
    lastBytes = lastBytesRef.value;
    lastIntervalSpeed = lastIntervalSpeedRef.value;

    // Calculate final results (excluding warm-up period)
    const totalDuration = (performance.now() - startTime) / 1000;
    const warmUpPeriod = 2.0; // Exclude first 2 seconds to avoid TCP slow start penalty
    
    // Use only bytes transferred after warm-up period
    const postWarmupBytes = Math.max(totalBytes - warmupBytes, 0);
    const effectiveDuration = Math.max(totalDuration - warmUpPeriod, 1.0); // Minimum 1 second
    
    // Calculate speed based on post-warmup performance only
    const speedMbps = postWarmupBytes > 0 ? (postWarmupBytes * 8) / effectiveDuration / 1_000_000 : 0;

    console.log(`[Upload Worker] Final: ${speedMbps.toFixed(2)} Mbps (${postWarmupBytes.toLocaleString()} bytes post-warmup in ${effectiveDuration.toFixed(1)}s effective duration, ${warmupBytes.toLocaleString()} bytes during warmup)`);

    // Send completion message
    self.postMessage({
        type: MESSAGE_TYPES.UPLOAD_COMPLETE,
        speed: speedMbps,
        bytesTransferred: postWarmupBytes, // Use post-warmup bytes for accuracy
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
        monitorLoopWrapper(threadCount, byteCounters);
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


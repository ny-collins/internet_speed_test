
import { monitorLoop } from '../worker-utils.js';

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

let config = {};

let uploadBlob = null;

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

function createUploadBlob() {
    // Optimize memory: Create smaller 5MB chunks that can be reused
    // Instead of threadCount * uploadSize MB allocated at once
    const totalSize = Math.min(config.uploadSize * 1024 * 1024, 5 * 1024 * 1024); // Cap at 5MB per blob
    const chunkSize = 65536; // 64KB chunks
    const chunksNeeded = Math.ceil(totalSize / chunkSize);
    const chunks = [];

    for (let i = 0; i < chunksNeeded; i++) {
        const chunk = new Uint8Array(chunkSize);
        crypto.getRandomValues(chunk);
        chunks.push(chunk.buffer);
    }

    return new Blob(chunks, { type: 'application/octet-stream' });
}

async function uploadThread(threadId, byteCounter) {
    let previousBytes = 0; // Track bytes from completed requests

    try {
        while (isRunning && !abortController.signal.aborted) {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                let finished = false;
                let lastLoaded = 0; // Track loaded bytes for this specific request

                const timeoutId = setTimeout(() => {
                    if (!finished) {
                        xhr.abort();
                        reject(new Error('Upload timeout (10s)'));
                    }
                }, 10000);

                const finish = (error = null) => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeoutId);
                    if (error) {
                        reject(error);
                    } else {
                        previousBytes += lastLoaded;
                        resolve();
                    }
                };

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        lastLoaded = event.loaded;
                        byteCounter.bytes = previousBytes + event.loaded;
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

async function monitorLoopWrapper(threadCount, byteCounters) {
    const isRunningRef = { value: isRunning };
    const totalBytesRef = { value: totalBytes };
    const warmupBytesRef = { value: warmupBytes };
    const warmupPeriodEndRef = { value: warmupPeriodEnd };
    const lastSampleTimeRef = { value: lastSampleTime };
    const lastBytesRef = { value: lastBytes };
    const lastIntervalSpeedRef = { value: lastIntervalSpeed };

    await monitorLoop(config, 'upload', threadCount, byteCounters, MESSAGE_TYPES, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable, calculateStability, abortController.signal);

    isRunning = isRunningRef.value;
    totalBytes = totalBytesRef.value;
    warmupBytes = warmupBytesRef.value;
    warmupPeriodEnd = warmupPeriodEndRef.value;
    lastSampleTime = lastSampleTimeRef.value;
    lastBytes = lastBytesRef.value;
    lastIntervalSpeed = lastIntervalSpeedRef.value;
}

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

        uploadBlob = createUploadBlob();

        const byteCounters = [];
        for (let i = 0; i < threadCount; i++) {
            byteCounters.push({ bytes: 0 });
        }

        for (let i = 0; i < threadCount; i++) {
            uploadThread(i, byteCounters[i]);
        }

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


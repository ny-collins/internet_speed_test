// ========================================
// UPLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep, scheduleIdleTask, cancelIdleTask, performanceMonitor } from './utils.js';
import { updateGauge, setProgress, announceToScreenReader } from './ui.js';

// Reusable 64KB chunk to avoid GC pressure and UI freezing
const REUSABLE_UPLOAD_CHUNK = (() => {
    const chunk = new Uint8Array(65536);
    crypto.getRandomValues(chunk);
    return chunk;
})();

// Pre-built blob for upload tests to avoid repeated blob creation
const REUSABLE_UPLOAD_BLOB = (() => {
    const totalSize = CONFIG.uploadSize * 1024 * 1024;
    const chunkSize = REUSABLE_UPLOAD_CHUNK.length;
    const chunksNeeded = Math.ceil(totalSize / chunkSize);
    const chunks = [];

    for (let i = 0; i < chunksNeeded; i++) {
        const isLastChunk = (i === chunksNeeded - 1);
        const remaining = totalSize - (i * chunkSize);
        if (isLastChunk && remaining < chunkSize) {
            chunks.push(REUSABLE_UPLOAD_CHUNK.buffer.slice(0, remaining));
        } else {
            chunks.push(REUSABLE_UPLOAD_CHUNK.buffer);
        }
    }

    return new Blob(chunks, { type: 'application/octet-stream' });
})();

export async function measureUpload() {
    const threadCount = CONFIG.threads.upload;
    const maxDuration = CONFIG.duration.upload.max * 1000;

    console.log(`[Upload] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);

    return new Promise((resolve, reject) => {
        // Create Web Worker
        const worker = new Worker('./js/upload-worker.js');

        let idleTaskId = null;
        let xhr = null;
        let abortController = null;

        // Start the upload test
        worker.postMessage({
            type: 'start_upload',
            config: CONFIG
        });

        // Set up XHR upload (must stay on main thread)
        const startXHRUpload = () => {
            abortController = new AbortController();
            const controllerIndex = STATE.abortControllers.push(abortController) - 1;

            xhr = new XMLHttpRequest();
            let finished = false;

            const finish = () => {
                if (finished) return;
                finished = true;
                if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
                    STATE.abortControllers.splice(controllerIndex, 1);
                }
            };

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    // Send progress update to worker
                    worker.postMessage({
                        type: 'progress_update',
                        bytesTransferred: event.loaded
                    });
                }
            };

            xhr.onload = () => {
                finish();
                // Upload complete - worker will handle the final result
            };

            xhr.onerror = () => {
                finish();
                worker.postMessage({ type: 'upload_error', error: 'XHR upload failed' });
            };

            abortController.signal.addEventListener('abort', () => {
                xhr.abort();
                finish();
            });

            xhr.open('POST', `${CONFIG.apiBase}/api/upload?t=${Date.now()}`, true);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.send(REUSABLE_UPLOAD_BLOB);
        };

        startXHRUpload();

        // Handle worker messages
        worker.onmessage = function(e) {
            const { type, ...data } = e.data;

            switch (type) {
                case 'progress_update':
                    const { elapsed, currentSpeed, speedSamples } = data;

                    // Update gauge with smoothed speed
                    if (speedSamples.length >= 3) {
                        const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
                        updateGauge(avgSpeed, 'upload');
                    } else {
                        updateGauge(currentSpeed, 'upload');
                    }

                    // Schedule memory monitoring as idle task (non-critical)
                    if (idleTaskId) cancelIdleTask(idleTaskId);
                    idleTaskId = scheduleIdleTask(() => {
                        performanceMonitor.recordMemoryUsage();
                    });

                    // Update Progress (60% -> 95%)
                    const progressPercent = 60 + (elapsed / maxDuration) * 35;
                    setProgress(Math.min(progressPercent, 95));

                    // Matrix Border Update
                    const uploadCard = document.querySelector('.matrix-card[data-metric="upload"]');
                    if (uploadCard) {
                        const progress = Math.min((elapsed / maxDuration) * 100, 100);
                        uploadCard.style.setProperty('--progress', progress.toFixed(2));
                    }
                    break;

                case 'upload_complete':
                    const { speed, bytesTransferred, duration, stability } = data;

                    // Cleanup
                    if (idleTaskId) {
                        cancelIdleTask(idleTaskId);
                        idleTaskId = null;
                    }
                    worker.terminate();

                    // Validate result
                    if (speed > 10000 || speed < 0 || !isFinite(speed)) {
                        console.warn('[Upload] Invalid speed measurement:', speed);
                        reject(new Error('Invalid upload measurement result'));
                        return;
                    }

                    console.log(`[Upload] Final: ${speed.toFixed(2)} Mbps`);
                    announceToScreenReader(`Upload speed: ${speed.toFixed(1)} megabits per second`);

                    resolve({
                        speed: speed,
                        bytesTransferred: bytesTransferred,
                        duration,
                        stability
                    });
                    break;

                case 'upload_error':
                    console.error('[Upload] Worker error:', data.error);
                    if (idleTaskId) {
                        cancelIdleTask(idleTaskId);
                        idleTaskId = null;
                    }
                    worker.terminate();
                    reject(new Error(`Upload test failed: ${data.error}`));
                    break;
            }
        };

        worker.onerror = function(error) {
            console.error('[Upload] Worker error:', error);
            if (idleTaskId) {
                cancelIdleTask(idleTaskId);
                idleTaskId = null;
            }
            worker.terminate();
            reject(new Error('Upload worker failed'));
        };

        // Handle cancellation
        const checkCancellation = () => {
            if (STATE.cancelling) {
                worker.postMessage({ type: 'abort' });
                if (abortController) abortController.abort();
                if (idleTaskId) {
                    cancelIdleTask(idleTaskId);
                    idleTaskId = null;
                }
                worker.terminate();
                reject(new Error('Upload test cancelled'));
            } else {
                setTimeout(checkCancellation, 100);
            }
        };
        checkCancellation();
    });
}

async function uploadThread(threadId, isRunning, byteCounter) {
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;

    // XHR Promise
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
                STATE.abortControllers.splice(controllerIndex, 1);
            }
            resolve();
        };

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                byteCounter.bytes = event.loaded;
            }
        };

        xhr.onload = finish;
        xhr.onerror = finish;

        abortController.signal.addEventListener('abort', () => {
            xhr.abort();
            finish();
        });

        xhr.open('POST', `${CONFIG.apiBase}/api/upload?t=${Date.now()}`, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(REUSABLE_UPLOAD_BLOB);
    });
}

function isSpeedStable(samples) {
    if (samples.length < CONFIG.stability.sampleCount) return false;
    const checkWindow = Math.min(samples.length, CONFIG.stability.checkWindow);
    const recentSamples = samples.slice(-checkWindow);
    const avg = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
    const variance = recentSamples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / recentSamples.length;
    return variance < CONFIG.stability.varianceThreshold;
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

async function uploadThread(threadId, isRunning, byteCounter) {
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;

    // XHR Promise
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
                STATE.abortControllers.splice(controllerIndex, 1);
            }
            resolve();
        };

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                byteCounter.bytes = event.loaded;
            }
        };

        xhr.onload = finish;
        xhr.onerror = finish;

        abortController.signal.addEventListener('abort', () => {
            xhr.abort();
            finish();
        });

        xhr.open('POST', `${CONFIG.apiBase}/api/upload?t=${Date.now()}`, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(REUSABLE_UPLOAD_BLOB);
    });
}

function isSpeedStable(samples) {
    if (samples.length < CONFIG.stability.sampleCount) return false;
    const checkWindow = Math.min(samples.length, CONFIG.stability.checkWindow);
    const recentSamples = samples.slice(-checkWindow);
    const avg = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
    const variance = recentSamples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / recentSamples.length;
    return variance < CONFIG.stability.varianceThreshold;
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

// ========================================
// UPLOAD TEST MODULE
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep } from './utils.js';
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
    const minDuration = CONFIG.duration.upload.min * 1000;

    console.log(`[Upload] Starting with ${threadCount} threads`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);

    const startTime = performance.now();
    let totalBytes = 0;
    let isRunning = true;

    const speedSamples = [];
    let lastSampleTime = startTime;
    let lastBytes = 0;

    const byteCounters = [];

    // Spawn threads
    Array.from({ length: threadCount }, (_, i) => {
        const counter = { bytes: 0 };
        byteCounters.push(counter);
        return uploadThread(i, () => isRunning, counter)
            .catch(err => {
                console.error(`[Upload] Thread ${i} failed:`, err);
                return { bytes: counter.bytes };
            });
    });

    // Monitor Loop
    const monitorLoop = async () => {
        while (isRunning && !STATE.cancelling) {
            await sleep(CONFIG.updateInterval);

            const elapsed = performance.now() - startTime;
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

            if (elapsed > 0 && totalBytes > 0) {
                const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000;

                if (speedSamples.length >= 3) {
                    const recentSamples = speedSamples.slice(-3);
                    const avgSpeed = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
                    updateGauge(avgSpeed, 'upload');
                } else {
                    updateGauge(currentSpeed, 'upload');
                }
            }

            // Stability Check
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;

                if (intervalBytes > 0) {
                    const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                    speedSamples.push(intervalSpeed);
                    
                    // Limit sample history to prevent memory growth (keep last 100 samples)
                    if (speedSamples.length > 100) {
                        speedSamples.shift();
                    }

                    if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                        if (isSpeedStable(speedSamples)) {
                            console.log('[Upload] Speed stabilized, stopping early');
                            isRunning = false;
                            break;
                        }
                    }
                }

                lastSampleTime = elapsed;
                lastBytes = totalBytes;
            }

            if (elapsed >= maxDuration) {
                console.log('[Upload] Max duration reached');
                isRunning = false;
                break;
            }

            // Update Progress (60% -> 95%)
            const progressPercent = 60 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 95));

            // Matrix Border Update
            const uploadCard = document.querySelector('.matrix-card[data-metric="upload"]');
            if (uploadCard) {
                const progress = Math.min((elapsed / maxDuration) * 100, 100);
                uploadCard.style.setProperty('--progress', progress.toFixed(2));
            }
        }
    };

    await monitorLoop();

    // Cleanup
    STATE.abortControllers.forEach(controller => {
        try { controller.abort(); } catch (e) { /* Ignore abort errors */ }
    });
    STATE.abortControllers = [];

    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    if (duration === 0 || totalBytes === 0) {
        console.warn('[Upload] Invalid test data');
        throw new Error('Invalid upload test data');
    }

    const speedMbps = (totalBytes * 8) / duration / 1_000_000;
    
    // Validate result - prevent impossible measurements
    if (speedMbps > 10000 || speedMbps < 0 || !isFinite(speedMbps)) {
        console.warn('[Upload] Invalid speed measurement:', speedMbps);
        throw new Error('Invalid upload measurement result');
    }
    
    console.log(`[Upload] Final: ${speedMbps.toFixed(2)} Mbps`);
    announceToScreenReader(`Upload speed: ${speedMbps.toFixed(1)} megabits per second`);

    return {
        speed: speedMbps,
        bytesTransferred: totalBytes,
        duration,
        stability: calculateStability(speedSamples)
    };
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

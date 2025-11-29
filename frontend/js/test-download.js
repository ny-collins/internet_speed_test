// ========================================
// DOWNLOAD TEST MODULE
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep, performanceMonitor } from './utils.js';
import { updateGauge, setProgress, announceToScreenReader } from './ui.js';

export async function measureDownload() {
    const threadCount = CONFIG.threads.download;
    const maxDuration = CONFIG.duration.download.max * 1000;
    const minDuration = CONFIG.duration.download.min * 1000;

    console.log(`[Download] Starting with ${threadCount} threads`);
    announceToScreenReader(`Starting download test with ${threadCount} threads`);

    const startTime = performance.now();
    let totalBytes = 0;
    let isRunning = true;

    // Stability tracking
    const speedSamples = [];
    let lastSampleTime = startTime;
    let lastBytes = 0;

    const byteCounters = [];

    // Spawn threads
    Array.from({ length: threadCount }, (_, i) => {
        const counter = { bytes: 0 };
        byteCounters.push(counter);
        return downloadThread(i, () => isRunning, counter)
            .catch(err => {
                console.error(`[Download] Thread ${i} failed:`, err);
                return { bytes: counter.bytes };
            });
    });

    // Monitor Loop
    let finalBytes = 0;
    let finalDuration = 0;
    const monitorLoop = async () => {
        while (isRunning && !STATE.cancelling) {
            await sleep(CONFIG.updateInterval);
            performanceMonitor.recordMemoryUsage();

            const elapsed = performance.now() - startTime;
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

            if (elapsed > 0 && totalBytes > 0) {
                const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps

                // Smoothing
                if (speedSamples.length >= 3) {
                    const recentSamples = speedSamples.slice(-3);
                    const avgSpeed = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
                    updateGauge(avgSpeed, 'download');
                } else {
                    updateGauge(currentSpeed, 'download');
                }
            }

            // Stability Check (every 500ms)
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;

                if (intervalBytes > 0) {
                    const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                    speedSamples.push(intervalSpeed);

                    if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                        if (isSpeedStable(speedSamples)) {
                            console.log('[Download] Speed stabilized, stopping early');
                            // Capture final values at the exact moment the test should end
                            finalBytes = totalBytes;
                            finalDuration = elapsed / 1000;
                            isRunning = false;
                            break;
                        }
                    }
                }

                lastSampleTime = elapsed;
                lastBytes = totalBytes;
            }

            if (elapsed >= maxDuration) {
                console.log('[Download] Max duration reached');
                // Capture final values at the exact moment the test should end
                finalBytes = totalBytes;
                finalDuration = elapsed / 1000;
                isRunning = false;
                break;
            }

            // Update Progress (25% -> 60%)
            const progressPercent = 25 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 60));

            // Update Matrix Card Border
            const downloadCard = document.querySelector('.matrix-card[data-metric="download"]');
            if (downloadCard) {
                const progress = Math.min((elapsed / maxDuration) * 100, 100);
                downloadCard.style.setProperty('--progress', progress.toFixed(2));
            }
        }
    };

    await monitorLoop();

    // Cleanup threads
    STATE.abortControllers.forEach(controller => {
        try { controller.abort(); } catch (e) { /* Ignore abort errors */ }
    });
    STATE.abortControllers = [];

    // Use the captured values from when the test ended
    const duration = finalDuration || ((performance.now() - startTime) / 1000);
    const bytesTransferred = finalBytes || byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

    if (duration === 0 || bytesTransferred === 0) {
        console.warn('[Download] Invalid test data');
        throw new Error('Invalid download test data');
    }

    const speedMbps = (bytesTransferred * 8) / duration / 1_000_000;

    // Validate result - prevent impossible measurements
    if (speedMbps > 10000 || speedMbps < 0 || !isFinite(speedMbps)) {
        console.warn('[Download] Invalid speed measurement:', speedMbps);
        throw new Error('Invalid download measurement result');
    }

    console.log(`[Download] Final: ${speedMbps.toFixed(2)} Mbps`);
    announceToScreenReader(`Download speed: ${speedMbps.toFixed(1)} megabits per second`);

    return {
        speed: speedMbps,
        bytesTransferred: bytesTransferred,
        duration,
        stability: calculateStability(speedSamples)
    };
}

async function downloadThread(threadId, isRunning, byteCounter) {
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;
    let cleanupDone = false;

    const cleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
            STATE.abortControllers.splice(controllerIndex, 1);
        }
    };

    try {
        const url = `${CONFIG.apiBase}/api/download?size=${CONFIG.downloadSize}&chunk=${CONFIG.chunkSize}&t=${Date.now()}`;
        const response = await fetch(url, {
            signal: abortController.signal,
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
        if (!response.body) throw new Error('No body');

        const reader = response.body.getReader();

        while (!abortController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            byteCounter.bytes += value.length;
        }

        try { await reader.cancel(); } catch (e) { /* Ignore cancel errors */ }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error(`[Download] Thread ${threadId} error:`, error);
        }
    } finally {
        cleanup();
    }
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

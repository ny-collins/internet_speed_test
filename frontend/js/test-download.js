// ========================================
// DOWNLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep, scheduleIdleTask, cancelIdleTask, performanceMonitor, measureLoadedLatency } from './utils.js';
import { updateGauge, setProgress, announceToScreenReader } from './ui.js';

export async function measureDownload() {
    const threadCount = CONFIG.threads.download;
    const maxDuration = CONFIG.duration.download.max * 1000;

    console.log(`[Download] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting download test with ${threadCount} threads`);

    return new Promise((resolve, reject) => {
        // Create abort controller for this test
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

        // Create Web Worker
        const worker = new Worker('./js/download-worker.js');

        let idleTaskId = null;
        let lastProgressUpdate = 0;
        let smoothedSpeed = 0;
        let lastUiUpdate = 0;
        const UI_UPDATE_INTERVAL = 100; // Update UI every 100ms for smooth animation

        // Start the download test
        worker.postMessage({
            type: 'start_download',
            config: CONFIG,
            threadCount: threadCount
        });

        // Start loaded latency measurement concurrently
        const loadedLatencyPromise = measureLoadedLatency(CONFIG, abortController, maxDuration);

        // Handle worker messages
        worker.onmessage = async function(e) {
            const { type, ...data } = e.data;

            switch (type) {
                case 'progress_update':
                    const { elapsed, totalBytes, currentSpeed, speedSamples } = data;
                    const now = performance.now();

                    // Update smoothed speed using exponential moving average
                    if (smoothedSpeed === 0) {
                        smoothedSpeed = currentSpeed;
                    } else {
                        // Alpha = 0.3 for responsive but smooth updates
                        smoothedSpeed = smoothedSpeed * 0.7 + currentSpeed * 0.3;
                    }

                    // Throttle UI updates for smooth animation
                    if (now - lastUiUpdate >= UI_UPDATE_INTERVAL) {
                        updateGauge(smoothedSpeed, 'download');
                        lastUiUpdate = now;

                        // Schedule memory monitoring as idle task (non-critical)
                        if (idleTaskId) cancelIdleTask(idleTaskId);
                        idleTaskId = scheduleIdleTask(() => {
                            performanceMonitor.recordMemoryUsage();
                        });
                    }

                    // Update Progress (25% -> 60%) - always update progress for smooth bar
                    const progressPercent = 25 + (elapsed / maxDuration) * 35;
                    setProgress(Math.min(progressPercent, 60));

                    // Update Matrix Card Border
                    const downloadCard = document.querySelector('.matrix-card[data-metric="download"]');
                    if (downloadCard) {
                        const progress = Math.min((elapsed / maxDuration) * 100, 100);
                        downloadCard.style.setProperty('--progress', progress.toFixed(2));
                    }

                    lastProgressUpdate = elapsed;
                    break;

                case 'download_complete': {
                    const { speed, bytesTransferred, duration, effectiveDuration, stability } = data;

                    // Wait for loaded latency measurement to complete
                    const loadedLatency = await loadedLatencyPromise;

                    // Cleanup
                    cleanup();
                    if (idleTaskId) {
                        cancelIdleTask(idleTaskId);
                        idleTaskId = null;
                    }
                    worker.terminate();

                    // Validate result
                    if (speed > 10000 || speed < 0 || !isFinite(speed)) {
                        console.warn('[Download] Invalid speed measurement:', speed);
                        reject(new Error('Invalid download measurement result'));
                        return;
                    }

                    console.log(`[Download] Final: ${speed.toFixed(2)} Mbps (${loadedLatency ? `Loaded latency: ${loadedLatency.average.toFixed(1)}ms` : 'No loaded latency data'})`);
                    announceToScreenReader(`Download speed: ${speed.toFixed(1)} megabits per second`);

                    resolve({
                        speed: speed,
                        bytesTransferred: bytesTransferred,
                        duration,
                        effectiveDuration,
                        stability,
                        loadedLatency
                    });
                    break;
                }

                case 'download_error':
                    console.error('[Download] Worker error:', data.error);
                    cleanup();
                    if (idleTaskId) {
                        cancelIdleTask(idleTaskId);
                        idleTaskId = null;
                    }
                    worker.terminate();
                    reject(new Error(`Download test failed: ${data.error}`));
                    break;
            }
        };

        worker.onerror = function(error) {
            console.error('[Download] Worker error:', error);
            cleanup();
            if (idleTaskId) {
                cancelIdleTask(idleTaskId);
                idleTaskId = null;
            }
            worker.terminate();
            reject(new Error('Download worker failed'));
        };

        // Handle cancellation
        const checkCancellation = () => {
            if (STATE.cancelling) {
                worker.postMessage({ type: 'abort' });
                cleanup();
                if (idleTaskId) {
                    cancelIdleTask(idleTaskId);
                    idleTaskId = null;
                }
                worker.terminate();
                reject(new Error('Download test cancelled'));
            } else {
                setTimeout(checkCancellation, 100);
            }
        };
        checkCancellation();
    });
}

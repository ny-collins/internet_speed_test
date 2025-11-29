// ========================================
// UPLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep, scheduleIdleTask, cancelIdleTask, performanceMonitor, measureLoadedLatency } from './utils.js';
import { updateGauge, setProgress, announceToScreenReader } from './ui.js';

export async function measureUpload() {
    const threadCount = CONFIG.threads.upload;
    const maxDuration = CONFIG.duration.upload.max * 1000;

    console.log(`[Upload] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);

    return new Promise((resolve, reject) => {
        // Create Web Worker
        const worker = new Worker('./js/upload-worker.js');

        let idleTaskId = null;
        let lastProgressUpdate = 0;
        let smoothedSpeed = 0;
        let lastUiUpdate = 0;
        const UI_UPDATE_INTERVAL = 100; // Update UI every 100ms for smooth animation

        // Start the upload test
        worker.postMessage({
            type: 'start_upload',
            config: CONFIG,
            threadCount: threadCount
        });

        // Start loaded latency measurement concurrently
        const loadedLatencyPromise = measureLoadedLatency(CONFIG, STATE.abortControllers[STATE.abortControllers.length - 1], maxDuration);

        // Handle worker messages
        worker.onmessage = async function(e) {
            const { type, ...data } = e.data;

            switch (type) {
            case 'progress_update': {
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
                    updateGauge(smoothedSpeed, 'upload');
                    lastUiUpdate = now;

                    // Schedule memory monitoring as idle task (non-critical)
                    if (idleTaskId) cancelIdleTask(idleTaskId);
                    idleTaskId = scheduleIdleTask(() => {
                        performanceMonitor.recordMemoryUsage();
                    });
                }

                // Update Progress (60% -> 95%) - always update progress for smooth bar
                const progressPercent = 60 + (elapsed / maxDuration) * 35;
                setProgress(Math.min(progressPercent, 95));

                // Update Matrix Card Border
                const uploadCard = document.querySelector('.matrix-card[data-metric="upload"]');
                if (uploadCard) {
                    const progress = Math.min((elapsed / maxDuration) * 100, 100);
                    uploadCard.style.setProperty('--progress', progress.toFixed(2));
                }

                lastProgressUpdate = elapsed;
                break;
            }

            case 'upload_complete': {
                const { speed, bytesTransferred, duration, effectiveDuration, stability } = data;

                // Wait for loaded latency measurement to complete
                const loadedLatency = await loadedLatencyPromise;

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

                console.log(`[Upload] Final: ${speed.toFixed(2)} Mbps (${loadedLatency ? `Loaded latency: ${loadedLatency.average.toFixed(1)}ms` : 'No loaded latency data'})`);
                announceToScreenReader(`Upload speed: ${speed.toFixed(1)} megabits per second`);

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

            case 'upload_error': {
                console.error('[Upload] Worker error:', data.error);
                if (idleTaskId) {
                    cancelIdleTask(idleTaskId);
                    idleTaskId = null;
                }
                worker.terminate();
                reject(new Error(`Upload test failed: ${data.error}`));
                break;
            }
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

// ========================================
// UPLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from '../config.js';
import { STATE } from '../state.js';
import { scheduleIdleTask, cancelIdleTask, performanceMonitor, measureLoadedLatency } from '../utils.js';
import { updateGauge, setProgress, announceToScreenReader, startSpeedCurve, updateSpeedCurve, stopSpeedCurve, highlightTrayCard } from '../ui.js';

export async function measureUpload() {
    const threadCount = CONFIG.threads.upload;
    const maxDuration = CONFIG.duration.upload.max * 1000;

    console.log(`[Upload] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);

    // Start speed curve
    startSpeedCurve('upload');
    highlightTrayCard('upload');

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
        const worker = new Worker('/js/workers/upload.worker.js', { type: 'module' });

        let idleTaskId = null;
        let smoothedSpeed = 0;
        let lastUiUpdate = 0;
        const UI_UPDATE_INTERVAL = 100; // Update UI every 100ms for smooth animation
        const testStartTime = performance.now(); // Track when test actually started

        // Start the upload test
        worker.postMessage({
            type: 'start_upload',
            config: CONFIG,
            threadCount: threadCount
        });

        // Start loaded latency measurement concurrently
        const loadedLatencyPromise = measureLoadedLatency(CONFIG, abortController, maxDuration);

        // Handle worker messages
        worker.onmessage = async function(e) {
            const { type, ...data } = e.data;

            switch (type) {
            case 'progress_update': {
                const { currentSpeed } = data;
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
                    updateSpeedCurve(currentSpeed); // Track raw speed for curve
                    lastUiUpdate = now;

                    // Schedule memory monitoring as idle task (non-critical)
                    if (idleTaskId) cancelIdleTask(idleTaskId);
                    idleTaskId = scheduleIdleTask(() => {
                        performanceMonitor.recordMemoryUsage();
                    });
                }

                // Update Progress (60% -> 95%) - always update progress for smooth bar
                const testElapsed = now - testStartTime;
                const progressPercent = 60 + (testElapsed / maxDuration) * 35;
                setProgress(Math.min(progressPercent, 95));

                // Update Matrix Card Border - use test elapsed time for consistent animation
                const uploadCard = document.querySelector('.tray-card[data-metric="upload"]');
                if (uploadCard) {
                    const progress = Math.min((testElapsed / maxDuration) * 100, 100);
                    uploadCard.style.setProperty('--progress', progress.toFixed(2));
                }

                break;
            }

            case 'upload_complete': {
                const { speed, bytesTransferred, duration, effectiveDuration, stability, confidence, warnings } = data;

                // Continue main progress bar animation to target (95%) smoothly
                const continueMainProgressAnimation = () => {
                    const now = performance.now();
                    const testElapsed = now - testStartTime;
                    const targetProgress = 95; // Upload goes to 95%
                    const startProgress = 60; // Upload starts at 60%
                    const progressRange = targetProgress - startProgress;
                    const currentProgress = startProgress + (testElapsed / maxDuration) * progressRange;
                    const finalProgress = Math.min(currentProgress, targetProgress);

                    setProgress(finalProgress);

                    if (finalProgress < targetProgress) {
                        requestAnimationFrame(continueMainProgressAnimation);
                    }
                };
                requestAnimationFrame(continueMainProgressAnimation);

                // Handle loaded latency asynchronously (don't block UI)
                loadedLatencyPromise.then(loadedLatency => {
                    console.log(`[Upload] Final: ${speed.toFixed(2)} Mbps (${loadedLatency ? `Loaded latency: ${loadedLatency.average.toFixed(1)}ms` : 'No loaded latency data'})`);

                    // Store loaded latency in state for later use
                    STATE.loadedLatency = loadedLatency;
                }).catch(error => {
                    console.warn('[Upload] Loaded latency measurement failed:', error);
                });

                // Stop speed curve
                stopSpeedCurve();

                // Cleanup immediately (don't wait for loaded latency)
                cleanup();
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

                console.log(`[Upload] Speed measurement complete: ${speed.toFixed(2)} Mbps`);
                announceToScreenReader(`Upload complete: ${speed.toFixed(1)} megabits per second`);

                resolve({
                    speed: speed,
                    bytesTransferred: bytesTransferred,
                    duration,
                    effectiveDuration,
                    stability,
                    loadedLatency: null, // Will be updated asynchronously
                    confidence: confidence || 0,
                    warnings: warnings || []
                });
                break;
            }

            case 'upload_error': {
                console.error('[Upload] Worker error:', data.error);
                cleanup();
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
            cleanup();
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
                cleanup();
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


import { CONFIG } from '../config.js';
import { STATE } from '../state.js';
import { scheduleIdleTask, cancelIdleTask, performanceMonitor, measureLoadedLatency } from '../utils.js';
import { updateGauge, setProgress, announceToScreenReader, startSpeedCurve, updateSpeedCurve, stopSpeedCurve, highlightTrayCard } from '../ui.js';

export async function measureDownload() {
    const threadCount = CONFIG.threads.download;
    const maxDuration = CONFIG.duration.download.max * 1000;

    console.log(`[Download] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting download test with ${threadCount} threads`);

    startSpeedCurve('download');
    highlightTrayCard('download');

    return new Promise((resolve, reject) => {
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

        const worker = new Worker('/js/workers/download.worker.js', { type: 'module' });

        let idleTaskId = null;
        let smoothedSpeed = 0;
        let lastUiUpdate = 0;
        const UI_UPDATE_INTERVAL = 100; // Update UI every 100ms for smooth animation
        const testStartTime = performance.now(); // Track when test actually started

        worker.postMessage({
            type: 'start_download',
            config: CONFIG,
            threadCount: threadCount
        });

        const loadedLatencyPromise = measureLoadedLatency(CONFIG, abortController, maxDuration);

        worker.onmessage = async function(e) {
            const { type, ...data } = e.data;

            switch (type) {
            case 'progress_update': {
                const { currentSpeed } = data;
                const now = performance.now();

                if (smoothedSpeed === 0) {
                    smoothedSpeed = currentSpeed;
                } else {
                    smoothedSpeed = smoothedSpeed * 0.7 + currentSpeed * 0.3;
                }

                if (now - lastUiUpdate >= UI_UPDATE_INTERVAL) {
                    updateGauge(smoothedSpeed, 'download');
                    updateSpeedCurve(currentSpeed); // Track raw speed for curve
                    lastUiUpdate = now;

                    if (idleTaskId) cancelIdleTask(idleTaskId);
                    idleTaskId = scheduleIdleTask(() => {
                        performanceMonitor.recordMemoryUsage();
                    });
                }

                const testElapsed = now - testStartTime;
                const progressPercent = 25 + (testElapsed / maxDuration) * 35;
                setProgress(Math.min(progressPercent, 60));

                const downloadCard = document.querySelector('.tray-card[data-metric="download"]');
                if (downloadCard) {
                    const progress = Math.min((testElapsed / maxDuration) * 100, 100);
                    downloadCard.style.setProperty('--progress', progress.toFixed(2));
                }

                break;
            }

            case 'download_complete': {
                const { speed, bytesTransferred, duration, effectiveDuration, stability, confidence, warnings, completedEarly } = data;

                // Animate progress to target smoothly (especially important for early completion)
                const animateProgressToTarget = (targetProgress) => {
                    const startTime = performance.now();
                    const startProgress = 25 + ((performance.now() - testStartTime) / maxDuration) * 35;
                    const duration = completedEarly ? 500 : 200; // Slower animation if completed early
                    
                    const animate = () => {
                        const elapsed = performance.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const easeOut = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
                        const current = startProgress + (targetProgress - startProgress) * easeOut;
                        
                        setProgress(current);
                        
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        }
                    };
                    
                    requestAnimationFrame(animate);
                };
                
                animateProgressToTarget(60);

                // Wait for loaded latency before resolving
                const loadedLatency = await loadedLatencyPromise.catch(error => {
                    console.warn('[Download] Loaded latency measurement failed:', error);
                    return null;
                });

                if (loadedLatency) {
                    console.log(`[Download] Final: ${speed.toFixed(2)} Mbps (Loaded latency: ${loadedLatency.average.toFixed(1)}ms, Bufferbloat: ${(loadedLatency.average - STATE.testResults.latency.average).toFixed(1)}ms)`);
                } else {
                    console.log(`[Download] Final: ${speed.toFixed(2)} Mbps (No loaded latency data)`);
                }

                stopSpeedCurve();

                cleanup();
                if (idleTaskId) {
                    cancelIdleTask(idleTaskId);
                    idleTaskId = null;
                }
                worker.terminate();

                if (speed > 10000 || speed < 0 || !isFinite(speed)) {
                    console.warn('[Download] Invalid speed measurement:', speed);
                    reject(new Error('Invalid download measurement result'));
                    return;
                }

                console.log(`[Download] Speed measurement complete: ${speed.toFixed(2)} Mbps`);
                announceToScreenReader(`Download complete: ${speed.toFixed(1)} megabits per second`);

                resolve({
                    speed: speed,
                    bytesTransferred: bytesTransferred,
                    duration,
                    effectiveDuration,
                    stability,
                    loadedLatency: loadedLatency,
                    confidence: confidence || 0,
                    warnings: warnings || []
                });
                break;
            }                case 'download_error':
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

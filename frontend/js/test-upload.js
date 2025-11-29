// ========================================
// UPLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { scheduleIdleTask, cancelIdleTask, performanceMonitor } from './utils.js';
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

        // Start the upload test
        worker.postMessage({
            type: 'start_upload',
            config: CONFIG,
            threadCount: threadCount
        });

        // Handle worker messages
        worker.onmessage = function(e) {
            const { type, ...data } = e.data;

            switch (type) {
            case 'progress_update': {
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

                // Update Matrix Card Border
                const uploadCard = document.querySelector('.matrix-card[data-metric="upload"]');
                if (uploadCard) {
                    const progress = Math.min((elapsed / maxDuration) * 100, 100);
                    uploadCard.style.setProperty('--progress', progress.toFixed(2));
                }
                break;
            }

            case 'upload_complete': {
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

// ========================================
// DOWNLOAD TEST MODULE (Web Worker Version)
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep, scheduleIdleTask, cancelIdleTask, performanceMonitor } from './utils.js';
import { updateGauge, setProgress, announceToScreenReader } from './ui.js';

export async function measureDownload() {
    const threadCount = CONFIG.threads.download;
    const maxDuration = CONFIG.duration.download.max * 1000;

    console.log(`[Download] Starting with ${threadCount} threads (Web Worker)`);
    announceToScreenReader(`Starting download test with ${threadCount} threads`);

    return new Promise((resolve, reject) => {
        // Create Web Worker
        const worker = new Worker('./js/download-worker.js');

        let idleTaskId = null;
        let lastProgressUpdate = 0;

        // Start the download test
        worker.postMessage({
            type: 'start_download',
            config: CONFIG,
            threadCount: threadCount
        });

        // Handle worker messages
        worker.onmessage = function(e) {
            const { type, ...data } = e.data;

            switch (type) {
                case 'progress_update':
                    const { elapsed, totalBytes, currentSpeed, speedSamples } = data;

                    // Update gauge with smoothed speed
                    if (speedSamples.length >= 3) {
                        const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
                        updateGauge(avgSpeed, 'download');
                    } else {
                        updateGauge(currentSpeed, 'download');
                    }

                    // Schedule memory monitoring as idle task (non-critical)
                    if (idleTaskId) cancelIdleTask(idleTaskId);
                    idleTaskId = scheduleIdleTask(() => {
                        performanceMonitor.recordMemoryUsage();
                    });

                    // Update Progress (25% -> 60%)
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

                case 'download_complete':
                    const { speed, bytesTransferred, duration, stability } = data;

                    // Cleanup
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

                    console.log(`[Download] Final: ${speed.toFixed(2)} Mbps`);
                    announceToScreenReader(`Download speed: ${speed.toFixed(1)} megabits per second`);

                    resolve({
                        speed: speed,
                        bytesTransferred: bytesTransferred,
                        duration,
                        stability
                    });
                    break;

                case 'download_error':
                    console.error('[Download] Worker error:', data.error);
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

// ========================================
// DOWNLOAD WORKER
// Handles heavy download processing off the main thread
// ========================================

import { monitorLoop } from './worker-utils.js';

// Worker message types
const MESSAGE_TYPES = {
    START_DOWNLOAD: 'start_download',
    PROGRESS_UPDATE: 'progress_update',
    DOWNLOAD_COMPLETE: 'download_complete',
    DOWNLOAD_ERROR: 'download_error',
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

// Configuration (passed from main thread)
let config = {};

// Stability tracking functions
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

// Download thread function (runs in worker)
async function downloadThread(threadId, byteCounter) {
    let retryCount = 0;
    const maxRetries = config.maxRetries || 2;
    
    while (retryCount <= maxRetries) {
        try {
            const url = `${config.apiBase}/api/download?stream=true&chunk=${config.chunkSize}&t=${Date.now()}`;
            
            // Create abort controller with timeout
            const timeoutMs = config.connectionTimeout || 10000;
            const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
            
            const response = await fetch(url, {
                signal: abortController.signal,
                cache: 'no-store',
                keepalive: true,
                priority: 'high'
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status ${response.status}`);
            if (!response.body) throw new Error('No body');

            const reader = response.body.getReader();
            let chunkCount = 0;
            let totalReceived = 0;

            while (isRunning && !abortController.signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                byteCounter.bytes += value.length;
                totalReceived += value.length;
                chunkCount++;
                if (chunkCount <= 10) {
                    console.log(`[Download Worker] Thread ${threadId} chunk #${chunkCount}: ${value.length} bytes (total: ${totalReceived} bytes)`);
                }
            }

            try { await reader.cancel(); } catch (e) { /* Ignore cancel errors */ }
            
            // Success - exit retry loop
            break;

        } catch (error) {
            if (error.name === 'AbortError' || STATE.cancelling) {
                // User cancelled or timeout - don't retry
                break;
            }
            
            retryCount++;
            if (retryCount <= maxRetries) {
                console.warn(`[Download Worker] Thread ${threadId} error, retrying (${retryCount}/${maxRetries}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
            } else {
                console.error(`[Download Worker] Thread ${threadId} failed after ${maxRetries} retries:`, error);
                self.postMessage({
                    type: MESSAGE_TYPES.DOWNLOAD_ERROR,
                    threadId,
                    error: error.message
                });
                break;
            }
        }
    }
}

// Monitor loop (runs in worker)
async function monitorLoopWrapper(threadCount, byteCounters) {
    // Create refs for mutable variables
    const isRunningRef = { value: isRunning };
    const totalBytesRef = { value: totalBytes };
    const warmupBytesRef = { value: warmupBytes };
    const warmupPeriodEndRef = { value: warmupPeriodEnd };
    const lastSampleTimeRef = { value: lastSampleTime };
    const lastBytesRef = { value: lastBytes };
    const lastIntervalSpeedRef = { value: lastIntervalSpeed };

    await monitorLoop(config, 'download', threadCount, byteCounters, MESSAGE_TYPES, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable, calculateStability, abortController.signal);

    // Update local variables from refs
    isRunning = isRunningRef.value;
    totalBytes = totalBytesRef.value;
    warmupBytes = warmupBytesRef.value;
    warmupPeriodEnd = warmupPeriodEndRef.value;
    lastSampleTime = lastSampleTimeRef.value;
    lastBytes = lastBytesRef.value;
    lastIntervalSpeed = lastIntervalSpeedRef.value;
}

// Message handler
self.onmessage = async function(e) {
    const { type, config: workerConfig, threadCount } = e.data;

    switch (type) {
    case MESSAGE_TYPES.START_DOWNLOAD: {
        config = workerConfig;
        isRunning = true;
        abortController = new AbortController();
        startTime = performance.now();
        totalBytes = 0;
        speedSamples = [];
        lastSampleTime = 0;
        lastBytes = 0;

        // Initialize byte counters for each thread
        const byteCounters = Array.from({ length: threadCount }, () => ({ bytes: 0 }));

        // Start download threads
        byteCounters.forEach((counter, i) => {
            downloadThread(i, counter);
        });

        // Start monitor loop
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

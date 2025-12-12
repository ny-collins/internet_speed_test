
import { monitorLoop } from '../worker-utils.js';

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
let failedThreads = new Set(); // Track which threads have failed
let totalThreadCount = 0; // Track total threads for failure rate calculation

let config = {};

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

async function downloadThread(threadId, byteCounter) {
    let retryCount = 0;
    const maxRetries = config.maxRetries || 2;
    
    while (retryCount <= maxRetries) {
        try {
            const url = `${config.apiBase}/api/download?stream=true&chunk=${config.chunkSize}&t=${Date.now()}`;
            
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

            while (isRunning && !abortController.signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                byteCounter.bytes += value.length;
            }

            try { await reader.cancel(); } catch (e) { /* Ignore cancel errors */ }
            
            break;

        } catch (error) {
            if (error.name === 'AbortError' || STATE.cancelling) {
                break;
            }
            
            retryCount++;
            if (retryCount <= maxRetries) {
                console.warn(`[Download Worker] Thread ${threadId} error, retrying (${retryCount}/${maxRetries}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
            } else {
                console.error(`[Download Worker] Thread ${threadId} failed after ${maxRetries} retries:`, error);
                failedThreads.add(threadId);
                
                // Check if majority of threads have failed
                const failureRate = failedThreads.size / totalThreadCount;
                if (failureRate > 0.5) {
                    console.error(`[Download Worker] Too many threads failed (${failedThreads.size}/${totalThreadCount}), aborting test`);
                    isRunning = false;
                    if (abortController) {
                        abortController.abort();
                    }
                }
                
                self.postMessage({
                    type: MESSAGE_TYPES.DOWNLOAD_ERROR,
                    threadId,
                    error: error.message,
                    failedThreads: failedThreads.size,
                    totalThreads: totalThreadCount
                });
                break;
            }
        }
    }
}

async function monitorLoopWrapper(threadCount, byteCounters) {
    const isRunningRef = { value: isRunning };
    const totalBytesRef = { value: totalBytes };
    const warmupBytesRef = { value: warmupBytes };
    const warmupPeriodEndRef = { value: warmupPeriodEnd };
    const lastSampleTimeRef = { value: lastSampleTime };
    const lastBytesRef = { value: lastBytes };
    const lastIntervalSpeedRef = { value: lastIntervalSpeed };

    await monitorLoop(config, 'download', threadCount, byteCounters, MESSAGE_TYPES, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable, calculateStability, abortController.signal, failedThreads, totalThreadCount);

    isRunning = isRunningRef.value;
    totalBytes = totalBytesRef.value;
    warmupBytes = warmupBytesRef.value;
    warmupPeriodEnd = warmupPeriodEndRef.value;
    lastSampleTime = lastSampleTimeRef.value;
    lastBytes = lastBytesRef.value;
    lastIntervalSpeed = lastIntervalSpeedRef.value;
}

self.onmessage = async function(e) {
    // Input validation: guard against malformed messages
    if (!e.data || typeof e.data !== 'object') {
        console.error('[Download Worker] Received invalid message:', e.data);
        return;
    }

    const { type, config: workerConfig, threadCount } = e.data;

    switch (type) {
    case MESSAGE_TYPES.START_DOWNLOAD: {
        // Validate critical config properties
        if (!workerConfig || typeof workerConfig !== 'object') {
            console.error('[Download Worker] Missing or invalid config object');
            self.postMessage({ type: MESSAGE_TYPES.DOWNLOAD_ERROR, error: 'Invalid configuration' });
            return;
        }
        
        if (typeof workerConfig.apiBase !== 'string' || workerConfig.apiBase.length === 0) {
            console.error('[Download Worker] Invalid apiBase:', workerConfig.apiBase);
            self.postMessage({ type: MESSAGE_TYPES.DOWNLOAD_ERROR, error: 'Invalid API base URL' });
            return;
        }
        
        if (typeof threadCount !== 'number' || threadCount <= 0 || threadCount > 16) {
            console.error('[Download Worker] Invalid threadCount:', threadCount);
            self.postMessage({ type: MESSAGE_TYPES.DOWNLOAD_ERROR, error: 'Invalid thread count' });
            return;
        }
        
        config = workerConfig;
        isRunning = true;
        abortController = new AbortController();
        startTime = performance.now();
        totalBytes = 0;
        speedSamples = [];
        lastSampleTime = 0;
        lastBytes = 0;
        failedThreads.clear(); // Reset failed threads tracker
        totalThreadCount = threadCount; // Store total thread count

        const byteCounters = Array.from({ length: threadCount }, () => ({ bytes: 0 }));

        byteCounters.forEach((counter, i) => {
            downloadThread(i, counter);
        });

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

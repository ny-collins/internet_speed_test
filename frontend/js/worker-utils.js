// ========================================
// SHARED WORKER UTILITIES
// Common functions used by download and upload workers
// ========================================

// Shared monitor loop function for both download and upload workers
export async function monitorLoop(config, testType, threadCount, byteCounters, messageTypes, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable) {
    const maxDuration = config.duration[testType].max * 1000;
    const minDuration = config.duration[testType].min * 1000;
    const warmupDuration = config.warmupDuration * 1000;
    warmupPeriodEndRef.value = startTime + warmupDuration;

    while (isRunningRef.value) {
        await new Promise(resolve => setTimeout(resolve, config.updateInterval));

        const elapsed = performance.now() - startTime;
        const currentTotalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);

        // Track bytes transferred during warm-up period
        if (elapsed <= warmupDuration) {
            warmupBytesRef.value = currentTotalBytes;
        }

        totalBytesRef.value = currentTotalBytes;

        // Use the most recent interval speed for current display
        const currentSpeed = lastIntervalSpeedRef.value;

        // Send progress update to main thread
        self.postMessage({
            type: messageTypes.PROGRESS_UPDATE,
            elapsed,
            totalBytes: totalBytesRef.value,
            currentSpeed,
            speedSamples: speedSamples.slice(-3) // Send recent samples for smoothing
        });

        // Stability check
        if (elapsed - lastSampleTimeRef.value >= 500) {
            const intervalBytes = totalBytesRef.value - lastBytesRef.value;
            const intervalDuration = (elapsed - lastSampleTimeRef.value) / 1000;

            if (intervalBytes > 0) {
                const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                speedSamples.push(intervalSpeed);
                lastIntervalSpeedRef.value = intervalSpeed; // Update current speed display

                // Memory management for upload worker (prevents unbounded growth)
                if (testType === 'upload' && speedSamples.length > 100) {
                    speedSamples.shift();
                }

                if (elapsed >= minDuration && speedSamples.length >= config.stability.sampleCount) {
                    if (isSpeedStable(speedSamples)) {
                        console.log(`[${testType.charAt(0).toUpperCase() + testType.slice(1)} Worker] Speed stabilized, stopping early`);
                        isRunningRef.value = false;
                        break;
                    }
                }
            }

            lastSampleTimeRef.value = elapsed;
            lastBytesRef.value = totalBytesRef.value;
        }

        // Check duration limits
        if (elapsed >= maxDuration) {
            console.log(`[${testType.charAt(0).toUpperCase() + testType.slice(1)} Worker] Max duration reached`);
            isRunningRef.value = false;
            break;
        }
    }
}

// Shared final calculation function
export function calculateFinalResults(config, testType, totalBytes, warmupBytes, totalDuration, speedSamples, calculateStability) {
    const warmUpPeriod = config.warmupDuration; // Exclude warm-up period

    // Use only bytes transferred after warm-up period
    const postWarmupBytes = Math.max(totalBytes - warmupBytes, 0);
    const effectiveDuration = Math.max(totalDuration - warmUpPeriod, 1.0); // Minimum 1 second

    // Calculate speed based on post-warmup performance only
    const speedMbps = postWarmupBytes > 0 ? (postWarmupBytes * 8) / effectiveDuration / 1_000_000 : 0;

    console.log(`[${testType.charAt(0).toUpperCase() + testType.slice(1)} Worker] Final: ${speedMbps.toFixed(2)} Mbps (${postWarmupBytes.toLocaleString()} bytes post-warmup in ${effectiveDuration.toFixed(1)}s effective duration, ${warmupBytes.toLocaleString()} bytes during warmup)`);

    return {
        speed: speedMbps,
        bytesTransferred: postWarmupBytes, // Use post-warmup bytes for accuracy
        duration: totalDuration,
        effectiveDuration,
        stability: calculateStability(speedSamples)
    };
}

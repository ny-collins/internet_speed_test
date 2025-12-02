// ========================================
// SHARED WORKER UTILITIES
// Common functions used by download and upload workers
// ========================================

// Shared monitor loop function for both download and upload workers
export async function monitorLoop(config, testType, threadCount, byteCounters, messageTypes, isRunningRef, startTime, totalBytesRef, warmupBytesRef, warmupPeriodEndRef, speedSamples, lastSampleTimeRef, lastBytesRef, lastIntervalSpeedRef, isSpeedStable, calculateStability, abortSignal) {
    const maxDuration = config.duration[testType].max * 1000;
    const minDuration = config.duration[testType].min * 1000;
    const warmupDuration = config.warmupDuration * 1000;
    warmupPeriodEndRef.value = startTime + warmupDuration;

    while (isRunningRef.value && !abortSignal.aborted) {
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

    // Calculate final results and send completion message
    const totalDuration = (performance.now() - startTime) / 1000;
    const finalResults = calculateFinalResults(config, testType, totalBytesRef.value, warmupBytesRef.value, totalDuration, speedSamples, calculateStability);

    // Send completion message
    const messageType = testType === 'download' ? messageTypes.DOWNLOAD_COMPLETE : messageTypes.UPLOAD_COMPLETE;
    self.postMessage({
        type: messageType,
        speed: finalResults.speed,
        bytesTransferred: finalResults.bytesTransferred,
        duration: finalResults.duration,
        effectiveDuration: finalResults.effectiveDuration,
        stability: finalResults.stability,
        confidence: finalResults.confidence,
        warnings: finalResults.warnings
    });
}// Shared final calculation function
export function calculateFinalResults(config, testType, totalBytes, warmupBytes, totalDuration, speedSamples, calculateStability) {
    const warmUpPeriod = config.warmupDuration; // Exclude warm-up period

    // Use only bytes transferred after warm-up period
    const postWarmupBytes = Math.max(totalBytes - warmupBytes, 0);
    const effectiveDuration = Math.max(totalDuration - warmUpPeriod, 1.0); // Minimum 1 second

    // Calculate speed based on post-warmup performance only
    const speedMbps = postWarmupBytes > 0 ? (postWarmupBytes * 8) / effectiveDuration / 1_000_000 : 0;

    // Calculate confidence score based on multiple factors
    const confidence = calculateConfidenceScore(
        speedSamples,
        postWarmupBytes,
        effectiveDuration,
        totalDuration,
        warmUpPeriod
    );

    // Detect potential measurement issues
    const warnings = [];
    if (confidence < 70) warnings.push('Low confidence in measurement');
    if (effectiveDuration < 3) warnings.push('Short test duration may affect accuracy');
    if (speedSamples.length < 5) warnings.push('Insufficient samples for reliable measurement');

    console.log(`[${testType.charAt(0).toUpperCase() + testType.slice(1)} Worker] Final: ${speedMbps.toFixed(2)} Mbps (${postWarmupBytes.toLocaleString()} bytes post-warmup in ${effectiveDuration.toFixed(1)}s effective duration, ${warmupBytes.toLocaleString()} bytes during warmup, confidence: ${confidence}%)`);

    if (warnings.length > 0) {
        console.warn(`[${testType.charAt(0).toUpperCase() + testType.slice(1)} Worker] Warnings:`, warnings);
    }

    return {
        speed: speedMbps,
        bytesTransferred: postWarmupBytes, // Use post-warmup bytes for accuracy
        duration: totalDuration,
        effectiveDuration,
        stability: calculateStability(speedSamples),
        confidence,
        warnings
    };
}

// Calculate confidence score (0-100) based on measurement quality indicators
function calculateConfidenceScore(speedSamples, bytes, duration, totalDuration, warmupPeriod) {
    let score = 100;

    // Factor 1: Sample count (more samples = higher confidence)
    if (speedSamples.length < 5) {
        score -= 20;
    } else if (speedSamples.length < 10) {
        score -= 10;
    }

    // Factor 2: Test duration (longer tests = higher confidence)
    const testDuration = duration;
    if (testDuration < 3) {
        score -= 30;
    } else if (testDuration < 5) {
        score -= 15;
    }

    // Factor 3: Data volume (more data = higher confidence)
    const mbTransferred = bytes / 1024 / 1024;
    if (mbTransferred < 5) {
        score -= 20;
    } else if (mbTransferred < 10) {
        score -= 10;
    }

    // Factor 4: Speed variance (lower variance = higher confidence)
    if (speedSamples.length >= 3) {
        const mean = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
        const variance = speedSamples.reduce((sum, speed) => {
            const diff = (speed - mean) / mean;
            return sum + (diff * diff);
        }, 0) / speedSamples.length;

        if (variance > 0.3) {
            score -= 15; // High variance
        } else if (variance > 0.15) {
            score -= 8;
        }
    }

    // Factor 5: Warmup ratio (proper warmup period used)
    const warmupRatio = (warmupPeriod / totalDuration);
    if (warmupRatio > 0.5) {
        score -= 10; // Too much time spent in warmup
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

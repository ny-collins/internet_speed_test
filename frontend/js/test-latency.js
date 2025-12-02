// ========================================
// LATENCY TEST MODULE
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep } from './utils.js';
import {
    updateDataStripLive,
    setProgress,
    updatePhaseUI,
    updateResultCard,
    drawSparkline,
    announceToScreenReader
} from './ui.js';

export async function measureLatency() {
    const sampleCount = 10;
    const samples = [];
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

    announceToScreenReader('Measuring latency');

    // Reset sparkline - Note: Sparkline container removed in new layout, this might need update or removal if sparkline is not used yet
    // For now, safe to leave as it won't find the element and will skip
    const sparkline = document.querySelector('#jitterSparkline path');
    if (sparkline) sparkline.setAttribute('d', '');

    try {
        for (let i = 0; i < sampleCount; i++) {
            if (STATE.cancelling || abortController.signal.aborted) break;

            const start = performance.now();
            // Use cache: 'no-store' to bypass browser cache
            // Add timestamp to prevent caching
            await fetch(`${CONFIG.apiBase}/api/ping?t=${Date.now()}`, {
                signal: abortController.signal,
                cache: 'no-store'
            });
            const duration = performance.now() - start;

            samples.push(duration);

            // Update UI
            drawSparkline(samples);
            const currentAvg = samples.reduce((a, b) => a + b, 0) / samples.length;
            
            // UPDATED: Use new function name
            updateDataStripLive('latency', currentAvg);
            
            setProgress((i + 1) / sampleCount * 25); // 25% of total progress

            if (i < sampleCount - 1) {
                await sleep(100);
            }
        }

        if (samples.length === 0) throw new Error('No latency samples collected');

        // Remove statistical outliers (values > 2 standard deviations from median)
        const filteredSamples = removeOutliers(samples);
        const effectiveSamples = filteredSamples.length >= 5 ? filteredSamples : samples;
        
        const average = effectiveSamples.reduce((a, b) => a + b, 0) / effectiveSamples.length;
        const min = Math.min(...effectiveSamples);
        const max = Math.max(...effectiveSamples);
        const median = calculateMedian(effectiveSamples);

        // Jitter Calculation Phase
        updatePhaseUI('jitter', 'active');
        const jitter = calculateJitter(effectiveSamples);
        const jitterStats = calculateJitterStats(effectiveSamples);
        STATE.testResults.jitter = { value: jitter, ...jitterStats };

        // UPDATED: Use new function name
        updateDataStripLive('jitter', jitter);
        updateResultCard('jitter', { value: jitter, ...jitterStats });

        // Brief pause for visual effect
        await new Promise(resolve => setTimeout(resolve, 800));
        updatePhaseUI('jitter', 'complete');

        announceToScreenReader(`Latency measured: ${average.toFixed(1)} milliseconds`);

        console.log(`[Latency] Avg: ${average.toFixed(1)}ms, Median: ${median.toFixed(1)}ms, Jitter: ${jitter.toFixed(1)}ms (${filteredSamples.length}/${samples.length} samples after outlier removal)`);

        // Calculate confidence score for latency measurement
        const confidence = calculateLatencyConfidence(filteredSamples.length, samples.length, jitter, average);

        return { 
            average, 
            min, 
            max, 
            median, 
            samples: effectiveSamples, 
            outlierCount: samples.length - filteredSamples.length,
            confidence,
            jitter
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[Latency] Measurement aborted');
            return null;
        }
        throw error;
    } finally {
        cleanup();
    }
}

function calculateJitter(samples) {
    if (samples.length < 2) return 0;

    // Calculate standard deviation (population standard deviation)
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const squaredDifferences = samples.map(sample => Math.pow(sample - mean, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / samples.length;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation;
}

// Remove statistical outliers using median absolute deviation (more robust than standard deviation)
function removeOutliers(samples) {
    if (samples.length < 5) return samples; // Need minimum samples for statistical validity
    
    const median = calculateMedian(samples);
    const mad = calculateMAD(samples, median);
    
    // Modified Z-score threshold of 3.5 (commonly used for outlier detection)
    const threshold = 3.5;
    
    return samples.filter(sample => {
        const modifiedZScore = Math.abs(0.6745 * (sample - median) / mad);
        return modifiedZScore <= threshold;
    });
}

function calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculateMAD(samples, median) {
    const deviations = samples.map(sample => Math.abs(sample - median));
    return calculateMedian(deviations);
}

function calculateJitterStats(samples) {
    if (samples.length < 2) return { consistency: 100 };
    
    const differences = [];
    for (let i = 1; i < samples.length; i++) {
        differences.push(Math.abs(samples[i] - samples[i - 1]));
    }
    
    const avgJitter = differences.reduce((a, b) => a + b, 0) / differences.length;
    const maxJitter = Math.max(...differences);
    
    // Calculate consistency score (0-100, higher is better)
    // Based on coefficient of variation
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / mean) * 100;
    const consistency = Math.max(0, Math.min(100, 100 - coefficientOfVariation));
    
    return {
        avgJitter,
        maxJitter,
        consistency: Math.round(consistency)
    };
}
function calculateLatencyConfidence(sampleCount, originalSampleCount, jitter, average) {
    let score = 100;
    
    // Factor 1: Sample count (more samples = higher confidence)
    if (sampleCount < 20) {
        score -= 25;
    } else if (sampleCount < 30) {
        score -= 10;
    }
    
    // Factor 2: Outlier ratio (fewer outliers = higher confidence)
    const outlierRatio = (originalSampleCount - sampleCount) / originalSampleCount;
    if (outlierRatio > 0.3) {
        score -= 20; // More than 30% outliers
    } else if (outlierRatio > 0.15) {
        score -= 10;
    }
    
    // Factor 3: Jitter relative to average (lower jitter = higher confidence)
    const jitterRatio = jitter / average;
    if (jitterRatio > 0.5) {
        score -= 25; // High jitter
    } else if (jitterRatio > 0.3) {
        score -= 15;
    } else if (jitterRatio > 0.15) {
        score -= 8;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

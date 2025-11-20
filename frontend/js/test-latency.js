// ========================================
// LATENCY TEST MODULE
// ========================================

import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { sleep } from './utils.js';
import { 
    updateMatrixCardLive, 
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
    
    // Reset sparkline
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
            updateMatrixCardLive('latency', currentAvg);
            setProgress((i + 1) / sampleCount * 25); // 25% of total progress
            
            if (i < sampleCount - 1) {
                await sleep(100);
            }
        }
        
        if (samples.length === 0) throw new Error('No latency samples collected');
        
        const average = samples.reduce((a, b) => a + b, 0) / samples.length;
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        
        // Jitter Calculation Phase
        updatePhaseUI('jitter', 'active');
        const jitter = calculateJitter(samples);
        STATE.testResults.jitter = { value: jitter };
        
        updateMatrixCardLive('jitter', jitter);
        updateResultCard('jitter', { value: jitter });
        
        // Brief pause for visual effect
        await new Promise(resolve => setTimeout(resolve, 800));
        updatePhaseUI('jitter', 'complete');
        
        announceToScreenReader(`Latency measured: ${average.toFixed(1)} milliseconds`);
        
        return { average, min, max, samples };
        
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
    let sumDifferences = 0;
    for (let i = 1; i < samples.length; i++) {
        sumDifferences += Math.abs(samples[i] - samples[i - 1]);
    }
    return sumDifferences / (samples.length - 1);
}

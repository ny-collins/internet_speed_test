// ========================================
// UI UPDATES & VISUALIZATION
// ========================================

import { DOM } from './dom.js';
import { STATE } from './state.js';
import { formatBytes, getSpeedQuality, getLatencyQuality, getJitterQuality } from './utils.js';

// Gauge scale breakpoints for adaptive scaling
const GAUGE_SCALES = [10, 25, 50, 100, 250, 500, 1000];

function calculateMaxScale(currentSpeed) {
    // Find the first scale that accommodates the current speed
    for (const scale of GAUGE_SCALES) {
        if (currentSpeed <= scale) return scale;
    }
    // For speeds above 1000, round up to nearest 100
    return Math.ceil(currentSpeed / 100) * 100;
}

export function buildMainGauge() {
    console.log('[Gauge] Using CSS-based circular progress gauge');
}

export function showGauge() {
    if (DOM.gaugeStartButton) DOM.gaugeStartButton.hidden = true;
    if (DOM.gaugeCircle) DOM.gaugeCircle.hidden = false;
    if (DOM.gaugeInner) DOM.gaugeInner.hidden = false;
}

export function hideGauge() {
    if (DOM.gaugeStartButton) DOM.gaugeStartButton.hidden = false;
    if (DOM.gaugeCircle) DOM.gaugeCircle.hidden = true;
    if (DOM.gaugeInner) DOM.gaugeInner.hidden = true;
}

export function updateGauge(speed, phase) {
    if (STATE.cancelling) return;
    if (STATE.rafId) return;
    
    STATE.rafId = requestAnimationFrame(() => {
        const speedText = speed.toFixed(1);
        
        // Only update if value changed (prevents unnecessary repaints)
        if (DOM.gaugeValue && DOM.gaugeValue.textContent !== speedText) {
            DOM.gaugeValue.textContent = speedText;
        }
        
        if (DOM.gaugePhase) {
            const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
            const phaseText = `Testing ${phaseName}`;
            if (DOM.gaugePhase.textContent !== phaseText) {
                DOM.gaugePhase.textContent = phaseText;
            }
        }
        
        updateMatrixCardLive(phase, speed);
        const maxSpeed = calculateMaxScale(speed);
        
        if (DOM.gaugeProgress) {
            const percentage = Math.min(speed / maxSpeed, 1);
            const degrees = percentage * 270;
            
            DOM.gaugeProgress.style.background = `conic-gradient(
                from -135deg,
                transparent 0deg,
                #3b82f6 0deg,
                #8b5cf6 ${degrees / 2}deg,
                #ec4899 ${degrees}deg,
                transparent ${degrees}deg
            )`;
            DOM.gaugeProgress.style.opacity = '1';
        }
        
        STATE.rafId = null;
    });
}

export function updateMatrixCardLive(phase, speed) {
    const matrixCard = document.querySelector(`.matrix-card[data-metric="${phase}"]`);
    if (matrixCard) {
        const numberEl = matrixCard.querySelector('.matrix-number');
        if (numberEl) {
            const speedText = speed.toFixed(1);
            // Only update if value changed
            if (numberEl.textContent !== speedText) {
                numberEl.textContent = speedText;
            }
        }
    }
}

export function resetGauge() {
    if (DOM.gaugeValue) DOM.gaugeValue.textContent = '0';
    if (DOM.gaugePhase) DOM.gaugePhase.textContent = 'Ready';
    
    if (DOM.gaugeProgress) {
        DOM.gaugeProgress.style.opacity = '0';
        DOM.gaugeProgress.style.background = '';
    }
    
    STATE.lastMaxScale = 100;
    hideGauge();
}

export function updatePhaseUI(phase, status) {
    // Update matrix card with matching data-metric attribute
    const metricCard = document.querySelector(`.matrix-card[data-metric="${phase}"]`);
    if (metricCard) {
        // For active status, set to "measuring" and start progress animation
        if (status === 'active') {
            metricCard.setAttribute('data-status', 'measuring');
            
            let duration;
            if (phase === 'latency') {
                duration = 3; 
            } else if (phase === 'download') {
                duration = null;
            } else if (phase === 'upload') {
                duration = null;
            } else if (phase === 'jitter') {
                duration = 0.8; 
            }
            
            if (duration) {
                animateBorderProgress(metricCard, duration * 1000); 
            }
        } else if (status === 'complete') {
            // When complete, set to 100% and fade out
            metricCard.style.setProperty('--progress', '100');
            metricCard.setAttribute('data-status', 'complete');
            
            setTimeout(() => {
                metricCard.style.setProperty('--progress', '0');
            }, 500);
        } else {
            metricCard.setAttribute('data-status', status);
            metricCard.style.setProperty('--progress', '0');
        }
    }
}

function animateBorderProgress(element, durationMs) {
    const startTime = performance.now();
    
    function updateProgress(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min((elapsed / durationMs) * 100, 100);
        
        element.style.setProperty('--progress', progress.toFixed(2));
        
        if (progress < 100 && element.getAttribute('data-status') === 'measuring') {
            requestAnimationFrame(updateProgress);
        }
    }
    
    requestAnimationFrame(updateProgress);
}

export function resetAllPhases() {
    document.querySelectorAll('.matrix-card[data-metric]').forEach(el => {
        el.setAttribute('data-status', 'not-started');
    });
}

export function updateResultCard(type, result) {
    const matrixCard = document.querySelector(`.matrix-card[data-metric="${type}"]`);
    const resultCard = document.querySelector(`.result-card[data-metric="${type}"]`);
    
    switch (type) {
        case 'download':
        case 'upload':
            const speed = result.speed.toFixed(1);
            
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = speed;
            }
            
            if (resultCard) {
                const valueEl = resultCard.querySelector('.metric-value');
                const detailsEl = resultCard.querySelector('.metric-details');
                const qualityEl = resultCard.querySelector('.metric-quality');
                
                if (valueEl) valueEl.textContent = speed;
                if (detailsEl) {
                    detailsEl.innerHTML = `
                        <div>Transferred: ${formatBytes(result.bytesTransferred)}</div>
                        <div>Duration: ${result.duration.toFixed(2)}s</div>
                        <div>Stability: ${result.stability.toFixed(0)}%</div>
                    `;
                }
                if (qualityEl) {
                    const quality = getSpeedQuality(result.speed, type);
                    qualityEl.textContent = quality;
                    qualityEl.className = `metric-quality ${quality.toLowerCase()}`;
                }
            }
            break;
            
        case 'latency':
            const latency = result.average.toFixed(1);
            
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = latency;
            }
            
            if (resultCard) {
                const valueEl = resultCard.querySelector('.metric-value');
                const detailsEl = resultCard.querySelector('.metric-details');
                const qualityEl = resultCard.querySelector('.metric-quality');
                
                if (valueEl) valueEl.textContent = latency;
                if (detailsEl) {
                    detailsEl.innerHTML = `
                        <div>Min: ${result.min.toFixed(1)}ms</div>
                        <div>Max: ${result.max.toFixed(1)}ms</div>
                    `;
                }
                if (qualityEl) {
                    const quality = getLatencyQuality(result.average);
                    qualityEl.textContent = quality;
                    qualityEl.className = `metric-quality ${quality.toLowerCase()}`;
                }
            }
            break;
            
        case 'jitter':
            const jitterValue = result.value.toFixed(1);
            
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = jitterValue;
            }
            
            if (resultCard) {
                const valueEl = resultCard.querySelector('.metric-value');
                const qualityEl = resultCard.querySelector('.metric-quality');
                
                if (valueEl) valueEl.textContent = jitterValue;
                if (qualityEl) {
                    const quality = getJitterQuality(result.value);
                    qualityEl.textContent = quality;
                    qualityEl.className = `metric-quality ${quality.toLowerCase()}`;
                }
            }
            break;
    }
}

export function clearResultsDisplay() {
    document.querySelectorAll('.matrix-card').forEach(card => {
        card.setAttribute('data-status', '');
        const matrixNumber = card.querySelector('.matrix-number');
        if (matrixNumber) matrixNumber.textContent = '—';
    });
    
    document.querySelectorAll('.result-card').forEach(card => {
        card.setAttribute('data-status', '');
        const valueEl = card.querySelector('.metric-value');
        if (valueEl) valueEl.textContent = '—';
        
        const detailsEl = card.querySelector('.metric-details');
        if (detailsEl) detailsEl.innerHTML = '<div>Testing...</div>';
        
        const qualityEl = card.querySelector('.metric-quality');
        if (qualityEl) qualityEl.textContent = '';
    });
    
    // Reset sparkline
    const sparkline = document.querySelector('#jitterSparkline path');
    if (sparkline) sparkline.setAttribute('d', '');
}

export function setProgress(percent) {
    if (DOM.progressBar) {
        DOM.progressBar.style.width = `${percent}%`;
    }
}

export function showStatus(message, type = 'info') {
    if (!DOM.statusBar) return;
    
    DOM.statusBar.setAttribute('data-type', type);
    DOM.statusBar.hidden = false;
    
    if (DOM.statusText) DOM.statusText.textContent = message;
    
    setTimeout(() => {
        if (DOM.statusBar) DOM.statusBar.hidden = true;
    }, 5000);
}

export function drawSparkline(data) {
    const svg = document.getElementById('jitterSparkline');
    if (!svg) return;
    
    const path = svg.querySelector('path');
    if (!path) return;
    
    svg.parentElement.hidden = false;
    
    const width = 100;
    const height = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    });
    
    path.setAttribute('d', `M${points.join(' L')}`);
}

// Add this export to fix the error
export function announceToScreenReader(message) {
    if (DOM.ariaLiveRegion) {
        DOM.ariaLiveRegion.textContent = '';
        setTimeout(() => {
            if (DOM.ariaLiveRegion) DOM.ariaLiveRegion.textContent = message;
        }, 100);
    }
}
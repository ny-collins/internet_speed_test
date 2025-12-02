// ========================================
// UI UPDATES & VISUALIZATION
// ========================================

import { DOM } from './dom.js';
import { STATE } from './state.js';
import { CONFIG } from './config.js';
import { formatBytes, getSpeedQuality, getLatencyQuality, getJitterQuality, getSpeedContext } from './utils.js';
import { showConfidenceIndicator, showMeasurementInfoButton } from './ui-enhancements.js';

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
    if (DOM.testTimer) DOM.testTimer.hidden = false;
}

export function hideGauge() {
    if (DOM.gaugeStartButton) DOM.gaugeStartButton.hidden = false;
    if (DOM.gaugeCircle) DOM.gaugeCircle.hidden = true;
    if (DOM.gaugeInner) DOM.gaugeInner.hidden = true;
    if (DOM.testTimer) DOM.testTimer.hidden = true;
}

export function updateCountdown(secondsRemaining, phase) {
    if (!DOM.timerValue || !DOM.testTimer) return;

    const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
    DOM.timerValue.textContent = `${secondsRemaining}s`;

    if (DOM.testTimer.querySelector('.timer-text')) {
        DOM.testTimer.querySelector('.timer-text').innerHTML =
            `Testing ${phaseName}: <strong id="timerValue">${secondsRemaining}s</strong>`;
    }
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
            const degrees = percentage * CONFIG.gaugeMaxDegrees;

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
    const trayCard = document.querySelector(`.tray-card[data-metric="${phase}"]`);
    if (trayCard) {
        const numberEl = trayCard.querySelector('.matrix-number');
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
    if (DOM.gaugeValue) DOM.gaugeValue.textContent = '—';
    if (DOM.gaugePhase) DOM.gaugePhase.textContent = 'Ready';

    if (DOM.gaugeProgress) {
        DOM.gaugeProgress.style.opacity = '0';
        DOM.gaugeProgress.style.background = '';
    }

    STATE.lastMaxScale = 100;
    hideGauge();
}

export function updatePhaseUI(phase, status) {
    // Update tray card with matching data-metric attribute
    const metricCard = document.querySelector(`.tray-card[data-metric="${phase}"]`);
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
    document.querySelectorAll('.tray-card[data-metric]').forEach(el => {
        el.setAttribute('data-status', 'not-started');
    });
}

export function updateResultCard(type, result) {
    const trayCard = document.querySelector(`.tray-card[data-metric="${type}"]`);
    const resultCard = document.querySelector(`.result-card[data-metric="${type}"]`);

    switch (type) {
    case 'download':
    case 'upload': {
        const speed = result.speed.toFixed(1);

        if (trayCard) {
            const matrixNumber = trayCard.querySelector('.matrix-number');
            if (matrixNumber) {
                matrixNumber.textContent = speed;
                matrixNumber.id = `${type}-value`; // Update ID for accessibility
            }

            const matrixUnit = trayCard.querySelector('.matrix-unit');
            if (matrixUnit) {
                matrixUnit.id = `${type}-unit`; // Update ID for accessibility
            }
            
            // Show confidence indicator if available
            if (result.confidence !== undefined) {
                showConfidenceIndicator(type, result.confidence);
            }
            
            // Show measurement info button
            showMeasurementInfoButton(type, result);

            // Add quality badge
            const quality = getSpeedQuality(result.speed, type);
            let badge = trayCard.querySelector('.quality-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'quality-badge';
                trayCard.appendChild(badge);
            }
            badge.textContent = quality;
            badge.className = `quality-badge ${quality.toLowerCase()}`;

            // Add quality context
            let context = trayCard.querySelector('.matrix-context');
            if (!context) {
                context = document.createElement('div');
                context.className = 'matrix-context';
                context.id = `${type}-context`; // Update ID for accessibility
                trayCard.querySelector('.matrix-content').appendChild(context);
            }
            context.innerHTML = getSpeedContext(result.speed, type);
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
    }

    case 'latency': {
        const latency = result.average.toFixed(1);

        if (trayCard) {
            const matrixNumber = trayCard.querySelector('.matrix-number');
            if (matrixNumber) {
                matrixNumber.textContent = latency;
                matrixNumber.id = 'latency-value'; // Update ID for accessibility
            }

            const matrixUnit = trayCard.querySelector('.matrix-unit');
            if (matrixUnit) {
                matrixUnit.id = 'latency-unit'; // Update ID for accessibility
            }
            
            // Show confidence indicator if available
            if (result.confidence !== undefined) {
                showConfidenceIndicator('latency', result.confidence);
            }
            
            // Show measurement info button
            showMeasurementInfoButton('latency', result);

            // Update quality badge and context
            updateQualityBadge('latency', result.average);
            updateLatencyContext(result.average);
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
    }

    case 'jitter': {
        const jitterValue = result.value.toFixed(1);

        if (trayCard) {
            const matrixNumber = trayCard.querySelector('.matrix-number');
            if (matrixNumber) {
                matrixNumber.textContent = jitterValue;
                matrixNumber.id = 'jitter-value'; // Update ID for accessibility
            }

            const matrixUnit = trayCard.querySelector('.matrix-unit');
            if (matrixUnit) {
                matrixUnit.id = 'jitter-unit'; // Update ID for accessibility
            }

            // Update quality badge
            updateQualityBadge('jitter', result.value);
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
}

export function clearResultsDisplay() {
    document.querySelectorAll('.tray-card').forEach(card => {
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
    
    // Hide quality badges
    document.querySelectorAll('[data-quality-badge]').forEach(badge => {
        badge.style.display = 'none';
    });
    
    // Hide latency context
    const latencyContext = document.querySelector('[data-latency-context]');
    if (latencyContext) latencyContext.style.display = 'none';
    
    // Hide variance graph
    const varianceContainer = document.getElementById('varianceGraphContainer');
    if (varianceContainer) varianceContainer.hidden = true;
    
    // Reset variance graph
    resetVarianceGraph();
}

export function setProgress(percent) {
    if (DOM.progressBar) {
        DOM.progressBar.style.width = `${percent}%`;
        // Update ARIA attributes for accessibility
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) {
            progressContainer.setAttribute('aria-valuenow', percent.toString());
        }
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

let countdownInterval = null;

export function startCountdown(seconds) {
    const timerEl = document.getElementById('testTimer');
    const valueEl = document.getElementById('timerValue');

    if (!timerEl || !valueEl) return;

    timerEl.hidden = false;
    let remaining = seconds;

    const updateTimer = () => {
        valueEl.textContent = `${remaining}s`;
        remaining--;

        if (remaining < 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

export function hideCountdown() {
    const timerEl = document.getElementById('testTimer');
    if (timerEl) timerEl.hidden = true;

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

export function drawSparkline(data) {
    const svg = document.getElementById('jitterSparkline');
    if (!svg) return;

    const path = svg.querySelector('path');
    if (!path) return;

    // Don't draw sparkline if we don't have enough data points
    if (!data || data.length < 2) {
        svg.parentElement.style.visibility = 'hidden';
        return;
    }

    svg.parentElement.style.visibility = 'visible';

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

// Throttle screen reader announcements to avoid flooding speech buffer
let lastAnnouncement = '';
let lastAnnouncementTime = 0;

export function announceToScreenReader(message) {
    if (!DOM.ariaLiveRegion) return;
    
    const now = Date.now();
    
    // Skip if same message was announced within throttle period
    if (message === lastAnnouncement && (now - lastAnnouncementTime) < CONFIG.screenReaderThrottle) {
        return;
    }
    
    lastAnnouncement = message;
    lastAnnouncementTime = now;
    
    // Clear and re-announce for better screen reader compatibility
    DOM.ariaLiveRegion.textContent = '';
    setTimeout(() => {
        if (DOM.ariaLiveRegion) DOM.ariaLiveRegion.textContent = message;
    }, 100);
}

// ========================================
// ANIMATION UTILITIES
// ========================================

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateNumber(elementId, targetValue, stateKey, duration = CONFIG.numberAnimationDuration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const animState = STATE.varianceGraph.animations[stateKey];
    if (!animState) return;

    // Cancel existing animation
    if (animState.rafId) {
        cancelAnimationFrame(animState.rafId);
    }

    const startValue = animState.current || 0;
    const startTime = performance.now();

    animState.target = targetValue;

    // Skip animation if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        animState.current = targetValue;
        element.textContent = targetValue.toFixed(1);
        return;
    }

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        animState.current = currentValue;

        element.textContent = currentValue.toFixed(1);

        if (progress < 1) {
            animState.rafId = requestAnimationFrame(animate);
        } else {
            animState.rafId = null;
        }
    }

    animState.rafId = requestAnimationFrame(animate);
}

// ========================================
// STAGE SPEED CURVE GRAPH
// ========================================

let speedCurvePhase = null; // 'download' or 'upload'
const speedCurveSamples = [];
const MAX_CURVE_SAMPLES = 100;

export function initStageSpeedCurve() {
    const canvas = DOM.stageSpeedCurve;
    if (!canvas) return;

    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Store context for later use
    canvas._ctx = ctx;
    canvas._width = rect.width;
    canvas._height = rect.height;
}

export function startSpeedCurve(phase) {
    speedCurvePhase = phase; // 'download' or 'upload'
    speedCurveSamples.length = 0; // Clear samples
    
    if (DOM.stageSpeedCurve) {
        DOM.stageSpeedCurve.classList.add('active');
        initStageSpeedCurve();
    }
}

export function updateSpeedCurve(speed) {
    if (!speedCurvePhase) return;
    
    speedCurveSamples.push(speed);
    if (speedCurveSamples.length > MAX_CURVE_SAMPLES) {
        speedCurveSamples.shift();
    }
    
    drawSpeedCurve();
}

function drawSpeedCurve() {
    const canvas = DOM.stageSpeedCurve;
    if (!canvas || !canvas._ctx || speedCurveSamples.length < 2) return;

    const ctx = canvas._ctx;
    const width = canvas._width;
    const height = canvas._height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const samples = speedCurveSamples;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const range = max - min || 1;

    // Set colors based on phase
    let lineColor, gradientColorStart, gradientColorEnd;
    if (speedCurvePhase === 'download') {
        lineColor = '#3b82f6'; // Blue
        gradientColorStart = 'rgba(59, 130, 246, 0.4)';
        gradientColorEnd = 'rgba(59, 130, 246, 0.0)';
    } else {
        lineColor = '#8b5cf6'; // Purple
        gradientColorStart = 'rgba(139, 92, 246, 0.4)';
        gradientColorEnd = 'rgba(139, 92, 246, 0.0)';
    }

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, gradientColorStart);
    gradient.addColorStop(1, gradientColorEnd);

    // Draw smooth curve
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    samples.forEach((val, i) => {
        const x = (i / (samples.length - 1)) * width;
        const y = height - ((val - min) / range) * (height * 0.8) - (height * 0.1);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Fill area under curve
    ctx.fillStyle = gradient;
    const lastX = ((samples.length - 1) / (samples.length - 1)) * width;
    const lastY = height - ((samples[samples.length - 1] - min) / range) * (height * 0.8) - (height * 0.1);
    ctx.lineTo(lastX, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
}

export function stopSpeedCurve() {
    speedCurvePhase = null;
    // Keep graph visible to show final result
}

export function resetSpeedCurve() {
    speedCurvePhase = null;
    speedCurveSamples.length = 0;
    
    const canvas = DOM.stageSpeedCurve;
    if (canvas) {
        canvas.classList.remove('active');
        if (canvas._ctx) {
            canvas._ctx.clearRect(0, 0, canvas._width, canvas._height);
        }
    }
}

// ========================================
// STAGE TRANSITIONS
// ========================================

export function showLiveStatus(phase) {
    if (!DOM.liveStatus) return;
    
    // Google Fiber approach: Hide entire gauge (circle + inner), show only graph + live numbers
    if (DOM.gaugeCircle) {
        DOM.gaugeCircle.hidden = true;
        DOM.gaugeCircle.style.display = 'none';
    }
    if (DOM.gaugeInner) {
        DOM.gaugeInner.hidden = true;
        DOM.gaugeInner.style.display = 'none';
    }
    
    // Update phase name
    if (DOM.livePhaseName) {
        const phaseNames = {
            'download': 'Downloading',
            'upload': 'Uploading',
            'latency': 'Measuring Latency'
        };
        DOM.livePhaseName.textContent = phaseNames[phase] || phase;
    }
    
    // Show live status with fade-in
    DOM.liveStatus.hidden = false;
    requestAnimationFrame(() => {
        DOM.liveStatus.classList.add('visible');
    });
}

export function updateLiveStatus(speed, unit = 'Mbps') {
    if (!DOM.liveSpeedValue) return;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        DOM.liveSpeedValue.textContent = speed.toFixed(1);
    } else {
        // Smooth transition
        DOM.liveSpeedValue.textContent = speed.toFixed(1);
    }
    
    if (DOM.liveSpeedUnit) {
        DOM.liveSpeedUnit.textContent = unit;
    }
}

export function hideLiveStatus() {
    if (!DOM.liveStatus) return;
    
    DOM.liveStatus.classList.remove('visible');
    setTimeout(() => {
        DOM.liveStatus.hidden = true;
    }, 300);
    
    // Restore gauge visibility (only when test completes)
    if (DOM.gaugeCircle) {
        DOM.gaugeCircle.hidden = false;
        DOM.gaugeCircle.style.display = '';
    }
    if (DOM.gaugeInner) {
        DOM.gaugeInner.hidden = false;
        DOM.gaugeInner.style.display = '';
    }
}

// ========================================
// TRAY CARD HIGHLIGHTING
// ========================================

export function highlightTrayCard(phase) {
    // Remove highlight from all cards
    document.querySelectorAll('.tray-card').forEach(card => {
        card.classList.remove('active-metric');
    });
    
    // Add highlight to active card
    const activeCard = document.querySelector(`.tray-card[data-metric="${phase}"]`);
    if (activeCard) {
        activeCard.classList.add('active-metric');
    }
}

export function clearTrayHighlights() {
    document.querySelectorAll('.tray-card').forEach(card => {
        card.classList.remove('active-metric');
    });
}

// ========================================
// VARIANCE GRAPH (Legacy - kept for reference)
// ========================================

export function initVarianceGraph() {
    const canvas = document.getElementById('varianceCanvas');
    if (!canvas) return;

    // Set canvas resolution for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Store context for later use
    canvas._ctx = ctx;
    canvas._width = rect.width;
    canvas._height = rect.height;
}

export function updateVarianceGraph(speed) {
    if (!STATE.varianceGraph.active) return;

    // Add sample
    STATE.varianceGraph.samples.push(speed);
    if (STATE.varianceGraph.samples.length > STATE.varianceGraph.maxSamples) {
        STATE.varianceGraph.samples.shift();
    }

    drawVarianceGraph();
}

function drawVarianceGraph() {
    const canvas = document.getElementById('varianceCanvas');
    if (!canvas || !canvas._ctx) return;

    const samples = STATE.varianceGraph.samples;
    if (samples.length < 2) return;

    // Remove loading state once we have data
    const container = document.getElementById('varianceGraphContainer');
    if (container && container.getAttribute('data-loading') === 'true') {
        container.removeAttribute('data-loading');
    }

    const ctx = canvas._ctx;
    const width = canvas._width;
    const height = canvas._height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate stats
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const range = max - min || 1;
    const variance = ((range / avg) * 100);

    // Update stats display with smooth animations
    animateNumber('varianceAvg', avg, 'avg');
    animateNumber('varianceMin', min, 'min');
    animateNumber('varianceMax', max, 'max');
    animateNumber('variancePercent', variance, 'percent');

    // Update quality indicator
    const qualityEl = document.querySelector('.variance-quality');
    if (qualityEl) {
        let quality, text;
        if (variance < 10) {
            quality = 'excellent';
            text = '🟢 Excellent Stability';
        } else if (variance < 20) {
            quality = 'good';
            text = '🟡 Good Stability';
        } else if (variance < 30) {
            quality = 'fair';
            text = '🟠 Fair Stability';
        } else {
            quality = 'poor';
            text = '🔴 Poor Stability';
        }
        qualityEl.textContent = text;
        qualityEl.setAttribute('data-quality', quality);
    }

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw line graph
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    samples.forEach((val, i) => {
        const x = (i / (samples.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw filled area under line
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
}

export function startVarianceTracking() {
    STATE.varianceGraph.samples = [];
    STATE.varianceGraph.active = true;
    initVarianceGraph();
    
    // Show variance graph container with fade-in
    const container = document.getElementById('varianceGraphContainer');
    if (container) {
        container.hidden = false;
        container.setAttribute('data-loading', 'true');
        
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            // No animation for reduced motion preference
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        } else {
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';
            
            // Trigger animation on next frame
            requestAnimationFrame(() => {
                container.style.transition = `opacity ${CONFIG.fadeAnimationDuration}ms ease-out, transform ${CONFIG.fadeAnimationDuration}ms ease-out`;
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            });
        }
    }
}

export function stopVarianceTracking() {
    STATE.varianceGraph.active = false;
    // Keep graph visible after test to show final results
}

export function resetVarianceGraph() {
    STATE.varianceGraph.samples = [];
    const canvas = document.getElementById('varianceCanvas');
    if (canvas && canvas._ctx) {
        canvas._ctx.clearRect(0, 0, canvas._width, canvas._height);
    }

    // Clear stats
    const avgEl = document.getElementById('varianceAvg');
    const minEl = document.getElementById('varianceMin');
    const maxEl = document.getElementById('varianceMax');
    const percentEl = document.getElementById('variancePercent');
    const qualityEl = document.querySelector('.variance-quality');

    if (avgEl) avgEl.textContent = '-';
    if (minEl) minEl.textContent = '-';
    if (maxEl) maxEl.textContent = '-';
    if (percentEl) percentEl.textContent = '-';
    if (qualityEl) {
        qualityEl.textContent = '⚪ Waiting...';
        qualityEl.setAttribute('data-quality', 'waiting');
    }
}

// ========================================
// QUALITY BADGES
// ========================================

export function updateQualityBadge(metric, value) {
    const badge = document.querySelector(`[data-quality-badge="${metric}"]`);
    if (!badge) return;

    let quality, icon, label;

    if (metric === 'latency') {
        if (value < 50) {
            quality = 'excellent';
            icon = '🟢';
            label = 'Great';
        } else if (value < 100) {
            quality = 'good';
            icon = '🟡';
            label = 'Good';
        } else if (value < 200) {
            quality = 'fair';
            icon = '🟠';
            label = 'Fair';
        } else {
            quality = 'poor';
            icon = '🔴';
            label = 'Poor';
        }
    } else if (metric === 'jitter') {
        if (value < 10) {
            quality = 'excellent';
            icon = '🟢';
            label = 'Great';
        } else if (value < 30) {
            quality = 'good';
            icon = '🟡';
            label = 'Good';
        } else if (value < 50) {
            quality = 'fair';
            icon = '🟠';
            label = 'Fair';
        } else {
            quality = 'poor';
            icon = '🔴';
            label = 'Poor';
        }
    }

    badge.setAttribute('data-quality', quality);

    const iconEl = badge.querySelector('.quality-icon');
    const labelEl = badge.querySelector('.quality-label');

    if (iconEl) iconEl.textContent = icon;
    if (labelEl) labelEl.textContent = label;

    // Animate badge appearance with stagger
    const delay = metric === 'latency' ? 0 : 100; // Jitter appears 100ms after latency
    badge.style.opacity = '0';
    badge.style.transform = 'translateY(10px)';
    badge.style.display = 'flex';
    
    setTimeout(() => {
        badge.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        badge.style.opacity = '1';
        badge.style.transform = 'translateY(0)';
    }, delay);
}

export function updateLatencyContext(latency) {
    const contextEl = document.querySelector('[data-latency-context]');
    if (!contextEl) return;

    let text;
    if (latency < 20) {
        text = 'Excellent for competitive gaming and real-time applications';
    } else if (latency < 50) {
        text = 'Great for gaming, video calls, and streaming';
    } else if (latency < 100) {
        text = 'Good for most online activities and video calls';
    } else if (latency < 200) {
        text = 'Fair for casual browsing and standard streaming';
    } else {
        text = 'May experience delays in real-time applications';
    }

    contextEl.textContent = text;
    contextEl.style.display = 'block';
}

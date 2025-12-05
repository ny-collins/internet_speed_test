
import { DOM } from './dom.js';
import { STATE } from './state.js';
import { CONFIG } from './config.js';
import { formatBytes, getSpeedQuality, getLatencyQuality, getJitterQuality, getSpeedContext } from './utils.js';

const GAUGE_SCALES = [
    { max: 100, labels: [0, 1, 5, 10, 25, 50, 75, 100] },
    { max: 500, labels: [0, 50, 100, 200, 300, 400, 500] },
    { max: 1000, labels: [0, 100, 250, 500, 750, 1000] }
];

let currentScaleIdx = 0;

function getScaleForSpeed(speed) {
    for (let i = 0; i < GAUGE_SCALES.length; i++) {
        if (speed <= GAUGE_SCALES[i].max) return i;
    }
    return GAUGE_SCALES.length - 1;
}

export function buildMainGauge() {
    renderGaugeScale(0); // Start with default scale
}

function renderGaugeScale(scaleIdx) {
    currentScaleIdx = scaleIdx;
    const scale = GAUGE_SCALES[scaleIdx];
    const ticksContainer = document.getElementById('gaugeTicks');
    const labelsContainer = document.getElementById('gaugeLabels');

    if (!ticksContainer || !labelsContainer) return;

    ticksContainer.innerHTML = '';
    labelsContainer.innerHTML = '';

    // Get actual gauge dimensions for responsive positioning
    const gaugeContainer = ticksContainer.parentElement;
    const containerSize = gaugeContainer.offsetWidth || 360;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const labelRadius = (containerSize / 2) * 0.88;
    const tickRadius = (containerSize / 2) * 0.85;

    // Standard Speedometer Arch: Starts Bottom-Left (225deg) -> Top -> Bottom-Right (135deg/495deg)
    const startAngle = 225;
    const totalAngle = 270;

    // Render Labels
    scale.labels.forEach((val, i) => {
        const percent = i / (scale.labels.length - 1);
        const angle = startAngle + (percent * totalAngle);

        // Convert CSS Angle (0=Top) to Math Radian (0=Right)
        const rad = (angle - 90) * (Math.PI / 180);

        // Dynamic label positioning based on actual gauge size
        const x = centerX + Math.cos(rad) * labelRadius;
        const y = centerY + Math.sin(rad) * labelRadius;

        const label = document.createElement('div');
        label.className = 'gauge-label';
        label.textContent = val;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        labelsContainer.appendChild(label);

        // Tick mark - simplified positioning
        const tick = document.createElement('div');
        tick.className = 'gauge-tick';

        // Position tick at the calculated angle
        const tickX = centerX + Math.cos(rad) * tickRadius;
        const tickY = centerY + Math.sin(rad) * tickRadius;

        tick.style.position = 'absolute';
        tick.style.left = `${tickX}px`;
        tick.style.top = `${tickY}px`;
        tick.style.width = '10px';
        tick.style.height = '2px';
        tick.style.background = 'var(--color-border-strong)';
        tick.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        tick.style.transformOrigin = 'center';

        ticksContainer.appendChild(tick);
    });
}
    
    function calculateNeedleAngle(speed) {
        const scale = GAUGE_SCALES[currentScaleIdx];
        
        // Find which interval the speed falls into
        let lower = 0;
        let upper = scale.labels[1];
        let lowerIdx = 0;
        
        for (let i = 0; i < scale.labels.length - 1; i++) {
            if (speed >= scale.labels[i] && speed <= scale.labels[i+1]) {
                lower = scale.labels[i];
                upper = scale.labels[i+1];
                lowerIdx = i;
                break;
            }
        }
        
        const startAngle = 225;
        const totalAngle = 270;
        
        if (speed > scale.max) return startAngle + totalAngle - 90; // Cap at max, adjust for needle
        
        // Interpolate position between ticks
        const ratio = (speed - lower) / (upper - lower);
        const tickSpan = totalAngle / (scale.labels.length - 1); // Angle per tick segment
        const gaugeAngle = startAngle + (lowerIdx * tickSpan) + (ratio * tickSpan);
        
        // Needle Correction: 
        // Gauge Angle 0 = Top. 
        // Needle Element 0 = Right.
        // To align, Needle = Gauge - 90.
        return gaugeAngle - 90;
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

        // Dynamic Scale Logic
        const newScaleIdx = getScaleForSpeed(speed);
        if (newScaleIdx > currentScaleIdx) {
            renderGaugeScale(newScaleIdx);
        }

        // Needle Logic
        const angle = calculateNeedleAngle(speed);
        const needle = document.getElementById('gaugeNeedle');
        if (needle) {
            needle.style.transform = `rotate(${angle}deg)`;
        }

        if (DOM.gaugeProgress) {
            // Simple gradient fallback for the ring itself
            // We map 0-max linearly for the gradient ring even if needle is non-linear
            // to keep the visual "fill" looking consistent with the needle? 
            // Actually, if the needle is non-linear, the ring should probably match.
            // But conic-gradient is linear. 
            // For now, let's keep the ring simple linear mapping to the *Current Scale Max*
            const maxSpeed = GAUGE_SCALES[currentScaleIdx].max;
            
            // Calculate percentage based on needle angle to match non-linear scale
            // Needle Angle - Start Angle (adjusted for -90 offset)
            // Needle = Gauge - 90. Gauge = Needle + 90.
            // Gauge Start = 225. 
            // Progress = (GaugeCurrent - 225)
            const gaugeAngle = angle + 90;
            const progressDegrees = Math.max(0, gaugeAngle - 225);

            DOM.gaugeProgress.style.background = `conic-gradient(
                from 225deg,
                #3b82f6 0deg,
                #8b5cf6 ${progressDegrees / 2}deg,
                #ec4899 ${progressDegrees}deg,
                transparent ${progressDegrees}deg
            )`;
            DOM.gaugeProgress.style.opacity = '1';
        }

        STATE.rafId = null;
    });
}
export function updateMatrixCardLive(phase, speed) {
    const trayCard = document.querySelector(`.tray-card[data-metric="${phase}"], .secondary-metric[data-metric="${phase}"]`);
    if (trayCard) {
        const numberEl = trayCard.querySelector('.matrix-number');
        if (numberEl) {
            const speedText = speed.toFixed(1);
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
    const metricCard = document.querySelector(`.tray-card[data-metric="${phase}"], .secondary-metric[data-metric="${phase}"]`);
    if (metricCard) {
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
    document.querySelectorAll('.tray-card[data-metric], .secondary-metric[data-metric]').forEach(el => {
        el.setAttribute('data-status', 'not-started');
    });
}

export function updateResultCard(type, result) {
    // Select from both tray-card and secondary-metric elements
    const trayCard = document.querySelector(`.tray-card[data-metric="${type}"], .secondary-metric[data-metric="${type}"]`);
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

            if (result.confidence !== undefined) {
                showConfidenceIndicator(type, result.confidence);
            }

            showMeasurementInfoButton(type, result);

            const quality = getSpeedQuality(result.speed, type);
            let badge = trayCard.querySelector('.quality-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'quality-badge';
                trayCard.appendChild(badge);
            }
            badge.textContent = quality;
            badge.className = `quality-badge ${quality.toLowerCase()}`;

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

            if (result.confidence !== undefined) {
                showConfidenceIndicator('latency', result.confidence);
            }

            showMeasurementInfoButton('latency', result);

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

    const sparkline = document.querySelector('#jitterSparkline path');
    if (sparkline) sparkline.setAttribute('d', '');

    document.querySelectorAll('[data-quality-badge]').forEach(badge => {
        badge.style.display = 'none';
    });

    const latencyContext = document.querySelector('[data-latency-context]');
    if (latencyContext) latencyContext.style.display = 'none';

    const varianceContainer = document.getElementById('varianceGraphContainer');
    if (varianceContainer) varianceContainer.hidden = true;

    resetVarianceGraph();
}

export function setProgress(percent) {
    if (DOM.progressBar) {
        DOM.progressBar.style.width = `${percent}%`;
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

let lastAnnouncement = '';
let lastAnnouncementTime = 0;

export function announceToScreenReader(message) {
    if (!DOM.ariaLiveRegion) return;

    const now = Date.now();

    if (message === lastAnnouncement && (now - lastAnnouncementTime) < CONFIG.screenReaderThrottle) {
        return;
    }

    lastAnnouncement = message;
    lastAnnouncementTime = now;

    DOM.ariaLiveRegion.textContent = '';
    setTimeout(() => {
        if (DOM.ariaLiveRegion) DOM.ariaLiveRegion.textContent = message;
    }, 100);
}


function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function animateVarianceNumber(elementId, targetValue, stateKey, duration = CONFIG.numberAnimationDuration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const animState = STATE.varianceGraph.animations[stateKey];
    if (!animState) return;

    if (animState.rafId) {
        cancelAnimationFrame(animState.rafId);
    }

    const startValue = animState.current || 0;
    const startTime = performance.now();

    animState.target = targetValue;

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


let speedCurvePhase = null; // 'download' or 'upload'
const speedCurveSamples = [];
const MAX_CURVE_SAMPLES = 100;

export function startSpeedCurve(phase) {
    speedCurvePhase = phase; // 'download' or 'upload'
    speedCurveSamples.length = 0; // Clear samples
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
    const miniCanvas = speedCurvePhase === 'download' ? DOM.downloadMiniGraph : DOM.uploadMiniGraph;

    if (!miniCanvas || speedCurveSamples.length < 2) return;

    const miniCtx = miniCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = miniCanvas.getBoundingClientRect();
    miniCanvas.width = rect.width * dpr;
    miniCanvas.height = rect.height * dpr;
    miniCtx.scale(dpr, dpr);
    drawToCanvas(miniCanvas, miniCtx, rect.width, rect.height);
    miniCanvas.classList.add('visible');
}

function drawToCanvas(canvas, ctx, width, height) {
    if (!ctx || speedCurveSamples.length < 2) return;

    ctx.clearRect(0, 0, width, height);

    const samples = speedCurveSamples;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const range = max - min || 1;

    let lineColor, gradientColorStart, gradientColorEnd;
    if (speedCurvePhase === 'download') {
        lineColor = '#3b82f6';
        gradientColorStart = 'rgba(59, 130, 246, 0.4)';
        gradientColorEnd = 'rgba(59, 130, 246, 0.0)';
    } else {
        lineColor = '#8b5cf6';
        gradientColorStart = 'rgba(139, 92, 246, 0.4)';
        gradientColorEnd = 'rgba(139, 92, 246, 0.0)';
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, gradientColorStart);
    gradient.addColorStop(1, gradientColorEnd);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Show all samples compressed horizontally to fit canvas width
    // This ensures complete test history is visible without left-edge clipping
    const stepX = width / Math.max(samples.length - 1, 1);

    ctx.beginPath();

    const points = samples.map((val, i) => {
        return {
            x: i * stepX,
            y: height - ((val - min) / range) * (height * 0.75) - (height * 0.15)
        };
    });

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        const xc = (p0.x + p1.x) / 2;
        const yc = (p0.y + p1.y) / 2;

        ctx.quadraticCurveTo(p0.x, p0.y, xc, yc);
    }

    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    ctx.stroke();

    ctx.fillStyle = gradient;

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
}

export function stopSpeedCurve() {
    speedCurvePhase = null;
}

export function resetSpeedCurve() {
    speedCurvePhase = null;
    speedCurveSamples.length = 0;

    [DOM.downloadMiniGraph, DOM.uploadMiniGraph].forEach(miniCanvas => {
        if (miniCanvas) {
            miniCanvas.classList.remove('visible');
            const ctx = miniCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
            }
        }
    });
}


export function highlightTrayCard(phase) {
    document.querySelectorAll('.tray-card, .secondary-metric').forEach(card => {
        card.classList.remove('active-metric');
    });

    const activeCard = document.querySelector(`.tray-card[data-metric="${phase}"], .secondary-metric[data-metric="${phase}"]`);
    if (activeCard) {
        activeCard.classList.add('active-metric');
    }
}

export function clearTrayHighlights() {
    document.querySelectorAll('.tray-card, .secondary-metric').forEach(card => {
        card.classList.remove('active-metric');
    });
}


export function initVarianceGraph() {
    const canvas = document.getElementById('varianceCanvas');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    canvas._ctx = ctx;
    canvas._width = rect.width;
    canvas._height = rect.height;
}

export function updateVarianceGraph(speed) {
    if (!STATE.varianceGraph.active) return;

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

    const container = document.getElementById('varianceGraphContainer');
    if (container && container.getAttribute('data-loading') === 'true') {
        container.removeAttribute('data-loading');
    }

    const ctx = canvas._ctx;
    const width = canvas._width;
    const height = canvas._height;

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const range = max - min || 1;
    const variance = ((range / avg) * 100);

    animateVarianceNumber('varianceAvg', avg, 'avg');
    animateVarianceNumber('varianceMin', min, 'min');
    animateVarianceNumber('varianceMax', max, 'max');
    animateVarianceNumber('variancePercent', variance, 'percent');

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

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

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

    const container = document.getElementById('varianceGraphContainer');
    if (container) {
        container.hidden = false;
        container.setAttribute('data-loading', 'true');

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        } else {
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';

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
}

export function resetVarianceGraph() {
    STATE.varianceGraph.samples = [];
    const canvas = document.getElementById('varianceCanvas');
    if (canvas && canvas._ctx) {
        canvas._ctx.clearRect(0, 0, canvas._width, canvas._height);
    }

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


/**
 * Generate physics-aware analysis of test results
 * Considers international routing and physical limitations
 */
export function generatePhysicsAwareAnalysis(testData) {
    const { latency, jitter, download, upload, distance } = testData;
    const analysis = [];

    // Latency analysis with physics context
    if (latency) {
        const minTheoretical = distance ? (distance / 200000) * 1000 : 0; // Speed of light in fiber
        const isReasonable = latency < 200;

        if (distance && distance > 1000) {
            analysis.push({
                metric: 'Latency',
                value: `${latency.toFixed(0)}ms`,
                context: `Testing over ${distance}km introduces ${minTheoretical.toFixed(0)}ms minimum theoretical delay (speed of light). Your latency of ${latency.toFixed(0)}ms includes routing overhead, which is ${isReasonable ? 'reasonable' : 'higher than expected'} for international connections.`
            });
        } else {
            analysis.push({
                metric: 'Latency',
                value: `${latency.toFixed(0)}ms`,
                context: 'International routing adds inherent delay beyond local connections. This measurement reflects the round-trip time including network processing.'
            });
        }
    }

    // Jitter analysis
    if (jitter !== undefined) {
        const isStable = jitter < 30;
        analysis.push({
            metric: 'Jitter',
            value: `${jitter.toFixed(1)}ms`,
            context: `Jitter measures latency variation. ${isStable ? 'Low jitter indicates stable routing' : 'Higher jitter suggests variable network conditions'}, which is common on international routes with multiple hops.`
        });
    }

    // Download analysis
    if (download) {
        analysis.push({
            metric: 'Download',
            value: `${download.toFixed(1)} Mbps`,
            context: 'Your download speed reflects bandwidth capacity and current network load. International tests may show lower speeds than local tests due to routing efficiency and server distance.'
        });
    }

    // Upload analysis
    if (upload) {
        analysis.push({
            metric: 'Upload',
            value: `${upload.toFixed(1)} Mbps`,
            context: 'Upload speeds are typically lower than download speeds by design (asymmetric connections). International testing may further reduce observed speeds compared to local tests.'
        });
    }

    return analysis;
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

/**
 * Show confidence indicator for a measurement
 */
export function showConfidenceIndicator(metric, confidence) {
    const indicator = document.getElementById(`${metric}-confidence`);
    if (!indicator) return;

    indicator.hidden = false;
    const fill = indicator.querySelector('.confidence-fill');
    const text = indicator.querySelector('.confidence-text');

    if (fill) {
        fill.style.width = `${confidence}%`;

        let level = 'very-low';
        if (confidence >= 85) level = 'high';
        else if (confidence >= 70) level = 'medium';
        else if (confidence >= 50) level = 'low';

        fill.setAttribute('data-level', level);
    }

    if (text) {
        text.textContent = `${confidence}% confidence`;
    }
}

/**
 * Show info button for measurement details
 */
export function showMeasurementInfoButton(metric, details) {
    const button = document.getElementById(`${metric}-info`);
    if (!button) return;

    button.hidden = false;

    button.dataset.details = JSON.stringify(details);

    if (!button.dataset.handlerAdded) {
        button.addEventListener('click', () => showMeasurementDetailsModal(metric, details));
        button.dataset.handlerAdded = 'true';
    }
}

/**
 * Show measurement details in modal
 */
function showMeasurementDetailsModal(metric, details) {
    const modal = document.getElementById('measurementDetailsModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');

    if (!modal || !modalBody || !modalTitle) return;

    const metricNames = {
        download: 'Download',
        upload: 'Upload',
        latency: 'Latency',
        jitter: 'Jitter'
    };
    modalTitle.textContent = `${metricNames[metric]} Measurement Details`;

    let content = '';

    if (metric === 'download' || metric === 'upload') {
        content = `
            <div class="measurement-detail">
                <h4>Speed Measurement</h4>
                <dl>
                    <dt>Final Speed</dt>
                    <dd>${details.speed.toFixed(2)} Mbps</dd>
                    
                    <dt>Confidence Score</dt>
                    <dd>${details.confidence}%</dd>
                    
                    <dt>Stability</dt>
                    <dd>${details.stability.toFixed(0)}%</dd>
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>Data Transfer</h4>
                <dl>
                    <dt>Bytes Transferred</dt>
                    <dd>${formatBytes(details.bytesTransferred)}</dd>
                    
                    <dt>Total Duration</dt>
                    <dd>${details.duration.toFixed(2)}s</dd>
                    
                    <dt>Effective Duration</dt>
                    <dd>${details.effectiveDuration.toFixed(2)}s</dd>
                    
                    <dt>Warmup Period</dt>
                    <dd>2.0s (excluded from calculation)</dd>
                </dl>
            </div>
            
            ${details.warnings && details.warnings.length > 0 ? `
            <div class="measurement-detail">
                <h4>⚠️ Warnings</h4>
                <ul style="margin: 0; padding-left: 1.5rem; color: var(--color-warning);">
                    ${details.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="measurement-detail">
                <h4>Methodology</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    This measurement used ${metric === 'download' ? 'multiple parallel connections' : 'chunked uploads'} 
                    to the Amsterdam server. The first 2 seconds (TCP slow start) were excluded to measure 
                    steady-state performance. Confidence score reflects test duration, data volume, and speed variance.
                </p>
            </div>
        `;
    } else if (metric === 'latency') {
        content = `
            <div class="measurement-detail">
                <h4>Latency Statistics</h4>
                <dl>
                    <dt>Average</dt>
                    <dd>${details.average.toFixed(1)} ms</dd>
                    
                    <dt>Median</dt>
                    <dd>${details.median ? details.median.toFixed(1) : details.average.toFixed(1)} ms</dd>
                    
                    <dt>Minimum</dt>
                    <dd>${details.min.toFixed(1)} ms</dd>
                    
                    <dt>Maximum</dt>
                    <dd>${details.max.toFixed(1)} ms</dd>
                    
                    <dt>Samples Collected</dt>
                    <dd>${details.samples ? details.samples.length : 10}</dd>
                    
                    ${details.outlierCount ? `
                    <dt>Outliers Removed</dt>
                    <dd>${details.outlierCount}</dd>
                    ` : ''}
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>Methodology</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    Latency measured using 10 ICMP-like pings to Amsterdam. Statistical outliers 
                    (>3.5 MAD from median) are removed to provide more accurate results. 
                    Median is often more reliable than average for network measurements.
                </p>
            </div>
        `;
    } else if (metric === 'jitter') {
        content = `
            <div class="measurement-detail">
                <h4>Jitter Statistics</h4>
                <dl>
                    <dt>Jitter (StdDev)</dt>
                    <dd>${details.value.toFixed(1)} ms</dd>
                    
                    ${details.avgJitter ? `
                    <dt>Average Jitter</dt>
                    <dd>${details.avgJitter.toFixed(1)} ms</dd>
                    ` : ''}
                    
                    ${details.maxJitter ? `
                    <dt>Maximum Jitter</dt>
                    <dd>${details.maxJitter.toFixed(1)} ms</dd>
                    ` : ''}
                    
                    ${details.consistency ? `
                    <dt>Consistency Score</dt>
                    <dd>${details.consistency}%</dd>
                    ` : ''}
                </dl>
            </div>
            
            <div class="measurement-detail">
                <h4>What is Jitter?</h4>
                <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.6;">
                    Jitter measures the variation in latency over time. Lower jitter means more 
                    consistent connection, which is important for real-time applications like 
                    video calls and gaming. Calculated as standard deviation of latency samples.
                </p>
            </div>
        `;
    }

    modalBody.innerHTML = content;
    modal.hidden = false;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Initialize modal close handlers
 */
export function initializeMeasurementModal() {
    const modal = document.getElementById('measurementDetailsModal');
    const closeBtn = document.getElementById('closeDetailsModal');
    const overlay = modal?.querySelector('.modal-overlay');

    if (!modal) return;

    const closeModal = () => {
        modal.hidden = true;
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });
}

/**
 * Update test context panel
 */
export function updateTestContext(testData) {
    const panel = document.getElementById('testContextPanel');
    if (!panel) return;

    panel.hidden = false;

    // Generate and display physics-aware analysis
    const analysisSection = document.getElementById('resultsAnalysis');
    const analysisItems = document.getElementById('analysisItems');

    if (analysisSection && analysisItems && testData.latency) {
        const analysis = generatePhysicsAwareAnalysis({
            latency: testData.latency?.average,
            jitter: testData.jitter?.value,
            download: testData.download?.speed,
            upload: testData.upload?.speed,
            distance: testData.distance
        });

        analysisItems.innerHTML = analysis.map(item => `
            <div class="analysis-item">
                <strong>${item.metric}:</strong> ${item.value}
                <p>${item.context}</p>
            </div>
        `).join('');

        analysisSection.hidden = false;
    }

    const serverLoc = document.getElementById('contextServerLocation');
    if (serverLoc && testData.serverLocation) {
        serverLoc.textContent = testData.serverLocation;
    }

    const distance = document.getElementById('contextDistance');
    if (distance) {
        if (testData.distance) {
            distance.textContent = `~${testData.distance} km (international route)`;
        } else {
            distance.textContent = 'International route';
        }
    }

    const connType = document.getElementById('contextConnectionType');
    if (connType && testData.connectionType) {
        connType.textContent = testData.connectionType;
    }

    const timestamp = document.getElementById('contextTimestamp');
    if (timestamp) {
        const date = new Date();
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        timestamp.textContent = `${timeStr}, ${dateStr}`;
    }

    const dataUsed = document.getElementById('contextDataUsed');
    if (dataUsed && testData.totalBytes) {
        dataUsed.textContent = formatBytes(testData.totalBytes);
    }
}

/**
 * Get connection type from browser API
 */
export function getConnectionType() {
    if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
        return 'Unknown';
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = connection.effectiveType || connection.type || 'unknown';

    const types = {
        'slow-2g': 'Slow 2G',
        '2g': '2G',
        '3g': '3G',
        '4g': '4G/LTE',
        'wifi': 'WiFi',
        'ethernet': 'Ethernet',
        'unknown': 'Unknown'
    };

    return types[type] || 'Unknown';
}

/**
 * Calculate approximate distance (simple Great Circle distance)
 * Amsterdam coordinates: 52.3676° N, 4.9041° E
 */
export function calculateDistance(userLat, userLon) {
    const amsterdamLat = 52.3676;
    const amsterdamLon = 4.9041;

    const R = 6371; // Earth's radius in km
    const dLat = toRad(amsterdamLat - userLat);
    const dLon = toRad(amsterdamLon - userLon);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(userLat)) * Math.cos(toRad(amsterdamLat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return Math.round(distance);
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Try to get user's approximate location (requires permission)
 */
export async function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            () => {
                resolve(null);
            },
            { timeout: 5000 }
        );
    });
}

/**
 * Create tooltip for Learn page integration
 */
export function createLearnTooltip(element, text, learnUrl) {
    if (!element) return;

    element.style.position = 'relative';
    element.style.cursor = 'help';

    let tooltip = null;

    element.addEventListener('mouseenter', () => {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip visible';
        tooltip.textContent = text;

        if (learnUrl) {
            tooltip.style.cursor = 'pointer';
            tooltip.addEventListener('click', () => {
                window.location.href = learnUrl;
            });
        }

        element.appendChild(tooltip);

        tooltip.style.top = '-40px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
    });

    element.addEventListener('mouseleave', () => {
        if (tooltip && tooltip.parentNode === element) {
            tooltip.remove();
            tooltip = null;
        }
    });
}

/**
 * Animate number counting effect
 */
export function animateNumber(element, targetValue, duration = 1000, decimals = 1) {
    if (!element) return;

    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (targetValue - startValue) * eased;

        element.textContent = current.toFixed(decimals);
        element.classList.add('counting');

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.classList.remove('counting');
        }
    }

    requestAnimationFrame(update);
}

/**
 * Calculate and display history statistics
 */
export function updateHistoryStats(history) {
    if (!history || history.length === 0) return null;

    const stats = {
        avgDownload: 0,
        avgUpload: 0,
        avgLatency: 0,
        maxDownload: 0,
        maxUpload: 0,
        minLatency: Infinity,
        testCount: history.length
    };

    history.forEach(test => {
        stats.avgDownload += test.download || 0;
        stats.avgUpload += test.upload || 0;
        stats.avgLatency += test.latency || 0;
        stats.maxDownload = Math.max(stats.maxDownload, test.download || 0);
        stats.maxUpload = Math.max(stats.maxUpload, test.upload || 0);
        stats.minLatency = Math.min(stats.minLatency, test.latency || Infinity);
    });

    stats.avgDownload /= history.length;
    stats.avgUpload /= history.length;
    stats.avgLatency /= history.length;

    if (stats.minLatency === Infinity) stats.minLatency = 0;

    return stats;
}

/**
 * Display history statistics in UI
 */
export function displayHistoryStats(stats) {
    if (!stats) return;

    const statsContainer = document.getElementById('historyStats');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="history-stat-card">
            <div class="stat-label">Average Download</div>
            <div class="stat-value">${stats.avgDownload.toFixed(1)} <span class="stat-unit">Mbps</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Average Upload</div>
            <div class="stat-value">${stats.avgUpload.toFixed(1)} <span class="stat-unit">Mbps</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Average Latency</div>
            <div class="stat-value">${stats.avgLatency.toFixed(1)} <span class="stat-unit">ms</span></div>
        </div>
        <div class="history-stat-card">
            <div class="stat-label">Tests Run</div>
            <div class="stat-value">${stats.testCount}</div>
        </div>
    `;

    statsContainer.hidden = false;
}

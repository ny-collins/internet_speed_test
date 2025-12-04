// ========================================
// SPEEDCHECK - MAIN ENTRY POINT
// ========================================

import { queryDOMElements, DOM } from './dom.js';
import { initializeTheme, initializeEventListeners, registerTestFunctions, loadConfiguration } from './engine.js';
import { registerServiceWorker } from './worker.js';
import { buildMainGauge, showStatus, announceToScreenReader, updatePhaseUI, startCountdown, hideCountdown, setProgress, resetAllPhases, updateResultCard, resetGauge, showGauge, clearResultsDisplay, resetSpeedCurve, clearTrayHighlights, updateTestContext, updateHistoryStats, displayHistoryStats, animateNumber } from './ui.js';
import { getFriendlyError, getConnectionType, performanceMonitor } from './utils.js';
import { drawHistoryChart } from './chart.js';
import { measureLatency } from './modules/latency.js';
import { measureDownload } from './modules/download.js';
import { measureUpload } from './modules/upload.js';
import { CONFIG } from './config.js';
import { STATE } from './state.js';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('[App] Initializing SpeedCheck (Modular)...');
    
    const skeleton = document.getElementById('loadingSkeleton');
    const appContainer = document.querySelector('.app-container');
    if (skeleton) skeleton.style.display = 'none';
    if (appContainer) appContainer.style.opacity = '1';
    
    registerServiceWorker();
    initializeTheme();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    const isSpeedTestPage = document.getElementById('splitLayout') !== null;
    
    if (isSpeedTestPage) {
        console.log('[App] Speed test page detected');
        queryDOMElements();
    }
    
    registerTestFunctions(startTest, cancelTest, retryTest, clearHistory, exportHistory);
    
    initializeEventListeners();

    if (isSpeedTestPage) {
        loadConfiguration();
        updateConfigSummary();
        buildMainGauge();
        resetSpeedCurve();
        loadHistory();
        await fetchServerInfo();
        
        initializeAccessibility();
        
        initializeModalHandlers();
        
        window.addEventListener('resize', () => {
            if (STATE.history.length > 0) {
                drawHistoryChart(STATE.history);
            }
        });
        
        setupGlobalErrorHandling();
        
        console.log('[App] Speed test initialization complete');
        announceToScreenReader('SpeedCheck ready. Press the Start Test button to begin.');
    } else {
        console.log('[App] Non-speed-test page detected');
    }
}

// ========================================
// LATENCY-BASED OPTIMIZATION
// ========================================

function optimizeThreadCount() {
    const latencyResult = STATE.testResults.latency;
    if (!latencyResult || !latencyResult.average) {
        console.log('[Optimization] No latency data available, using default thread count');
        return;
    }
    
    const avgLatency = latencyResult.average;
    let optimalThreads;
    
    if (avgLatency > 200) {
        optimalThreads = 1;
        CONFIG.duration.download.min = 15;
        CONFIG.duration.upload.min = 15;
        CONFIG.stability.varianceThreshold = 0.40;
        console.log(`[Optimization] High latency detected (${avgLatency.toFixed(0)}ms) - using 1 thread, extended duration, relaxed stability`);
    } 
    else if (avgLatency > 100) {
        optimalThreads = 2;
        CONFIG.duration.download.min = 12;
        CONFIG.duration.upload.min = 12;
        CONFIG.stability.varianceThreshold = 0.35;
        console.log(`[Optimization] Medium latency detected (${avgLatency.toFixed(0)}ms) - using 2 threads`);
    }
    else {
        optimalThreads = 4;
        console.log(`[Optimization] Low latency detected (${avgLatency.toFixed(0)}ms) - using 4 threads`);
    }
    
    CONFIG.threads.download = optimalThreads;
    CONFIG.threads.upload = optimalThreads;
}

// ========================================
// TEST ORCHESTRATION
// ========================================

async function startTest() {
    if (STATE.testing) return;
    
    const now = Date.now();
    const timeSinceLastTest = now - STATE.lastTestTime;
    const cooldownMs = 10000;
    
    if (STATE.lastTestTime > 0 && timeSinceLastTest < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastTest) / 1000);
        showStatus(`Please wait ${remainingSeconds} seconds between tests`, 'warning');
        return;
    }
    
    STATE.lastTestTime = now;
    STATE.testing = true;
    STATE.cancelling = false;
    STATE.abortControllers = [];
    
    performanceMonitor.startTest();
    
    if (DOM.retryTest) DOM.retryTest.hidden = true;
    
    STATE.testResults = { download: null, upload: null, latency: null, jitter: null };
    
    showGauge();
    clearResultsDisplay();
    setProgress(0);
    resetSpeedCurve();
    clearTrayHighlights();
    
    if (DOM.startTest) DOM.startTest.disabled = true;
    if (DOM.cancelTest) {
        DOM.cancelTest.disabled = false;
        DOM.cancelTest.hidden = false;
    }
    
    announceToScreenReader('Speed test started');
    
    try {
        await runPhase('latency', measureLatency);
        if (STATE.cancelling) return;
        
        optimizeThreadCount();
        
        await runPhase('download', measureDownload);
        if (STATE.cancelling) return;
        
        await runPhase('upload', measureUpload);
        if (STATE.cancelling) return;
        
        await completeTest();
        
    } catch (error) {
        console.error('[Test] Error:', error);
        showStatus(getFriendlyError(error.message), 'error');
        
        if (DOM.retryTest) DOM.retryTest.hidden = false;
    } finally {
        cleanupTest();
    }
}

async function runPhase(name, testFn, maxRetries = 2) {
    STATE.currentPhase = name;
    updatePhaseUI(name, 'active');
    
    const duration = name === 'latency' ? 3 : 10;
    startCountdown(duration);
    
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Test] Starting ${name} (attempt ${attempt + 1}/${maxRetries + 1})`);
            const result = await testFn();
            
            hideCountdown();
            
            if (!STATE.cancelling) {
                STATE.testResults[name] = result;
                updatePhaseUI(name, 'complete');
                updateResultCard(name, result);
            }
            return;
            
        } catch (error) {
            lastError = error;
            console.warn(`[Test] ${name} attempt ${attempt + 1} failed:`, error.message);
            
            if (STATE.cancelling || 
                error.message.includes('cancelled') || 
                error.message.includes('Invalid') ||
                error.message.includes('aborted')) {
                break;
            }
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    hideCountdown();
    throw lastError;
}

function cancelTest() {
    if (!STATE.testing) return;
    console.log('[Test] Cancelling...');
    STATE.cancelling = true;

    STATE.abortControllers.forEach(c => {
        try { c.abort(); } catch (e) { /* Ignore errors */ }
    });
    STATE.abortControllers = [];

    if (STATE.rafId) {
        cancelAnimationFrame(STATE.rafId);
        STATE.rafId = null;
    }

    STATE.testing = false;
    resetGauge();

    if (DOM.startTest) DOM.startTest.disabled = false;
    if (DOM.cancelTest) {
        DOM.cancelTest.disabled = true;
        DOM.cancelTest.hidden = true;
    }

    showStatus('Test cancelled', 'info');
}async function retryTest() {
    console.log('[Test] Retrying...');
    
    if (DOM.retryTest) DOM.retryTest.hidden = true;
    
    showStatus('Retrying speed test...', 'info');
    
    startTest();
}

async function completeTest() {
    console.log('[Test] Complete');
    
    performanceMonitor.endTest();
    
    setProgress(100);
    showStatus('Test completed successfully!', 'success');
    resetAllPhases();
    
    const shareBtn = document.getElementById('shareResultBtn');
    if (shareBtn) shareBtn.hidden = false;
    
    const testResult = {
        timestamp: Date.now(),
        download: STATE.testResults.download?.speed || 0,
        upload: STATE.testResults.upload?.speed || 0,
        latency: STATE.testResults.latency?.average || 0,
        jitter: STATE.testResults.jitter?.value || 0,
        connectionType: getConnectionType()
    };
    
    saveToHistory(testResult);
    
    updateTestContext({
        download: STATE.testResults.download,
        upload: STATE.testResults.upload,
        latency: STATE.testResults.latency,
        jitter: STATE.testResults.jitter,
        timestamp: testResult.timestamp,
        connectionType: testResult.connectionType,
        distance: STATE.distance
    });
    
    announceToScreenReader('Test complete');
}

async function cleanupTest() {
    STATE.testing = false;
    STATE.cancelling = false;
    
    resetGauge();
    
    if (DOM.startTest) DOM.startTest.disabled = false;
    if (DOM.cancelTest) {
        DOM.cancelTest.disabled = true;
        DOM.cancelTest.hidden = true;
    }
}

function updateConfigSummary() {
    const summary = document.getElementById('configSummary');
    const threadsEl = document.getElementById('configThreads');
    const durationEl = document.getElementById('configDuration');
    
    if (!summary) return;
    
    const isDefault = CONFIG.threads.download === 4 && CONFIG.duration.download.max === 10;
    
    if (isDefault) {
        summary.hidden = true;
        const settingsToggle = document.getElementById('settingsToggle');
        if (settingsToggle) {
            settingsToggle.removeAttribute('data-custom');
            settingsToggle.removeAttribute('data-count');
        }
    } else {
        summary.hidden = false;
        if (threadsEl) threadsEl.textContent = `${CONFIG.threads.download} threads`;
        if (durationEl) durationEl.textContent = `${CONFIG.duration.download.max}s duration`;
        
        const settingsToggle = document.getElementById('settingsToggle');
        if (settingsToggle) {
            let customCount = 0;
            if (CONFIG.threads.download !== 4) customCount++;
            if (CONFIG.duration.download.max !== 10) customCount++;
            
            settingsToggle.setAttribute('data-custom', 'true');
            settingsToggle.setAttribute('data-count', customCount);
        }
    }
}

// ========================================
// DATA & HISTORY
// ========================================

async function fetchServerInfo() {
    try {
        const response = await fetch(`${CONFIG.apiBase}/api/info`, {
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            STATE.serverInfo = await response.json();
            if (DOM.serverLocation) DOM.serverLocation.textContent = STATE.serverInfo.location || 'Unknown';
            if (DOM.serverLimits && STATE.serverInfo.maxDownloadSize) {
                DOM.serverLimits.textContent = `${STATE.serverInfo.maxDownloadSize}MB DL / ${STATE.serverInfo.maxUploadSize}MB UL`;
            }
            if (DOM.serverInfo) DOM.serverInfo.hidden = false;
        } else {
            if (DOM.serverLocation) DOM.serverLocation.textContent = 'Amsterdam, Netherlands';
        }
    } catch (e) {
        console.warn('[Server] Info fetch failed', e);
        if (DOM.serverLocation) DOM.serverLocation.textContent = 'Amsterdam, Netherlands';
    }
}

function saveToHistory(result) {
    STATE.history.unshift(result);
    if (STATE.history.length > 50) STATE.history = STATE.history.slice(0, 50);
    localStorage.setItem('speedtest_history', JSON.stringify(STATE.history));
    updateHistoryUI();
}

function loadHistory() {
    try {
        const saved = localStorage.getItem('speedtest_history');
        if (saved) {
            STATE.history = JSON.parse(saved);
            updateHistoryUI();
        }
    } catch (e) {
        console.error('[History] Load failed', e);
    }
}

async function updateHistoryUI() {
    if (!DOM.historyList) return;
    
    drawHistoryChart(STATE.history);
    
    const stats = updateHistoryStats(STATE.history);
    if (stats) {
        displayHistoryStats(stats);
    }
    
    if (STATE.history.length === 0) {
        DOM.historyList.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--color-text-tertiary)">No test history yet</div>';
        return;
    }
    
    DOM.historyList.innerHTML = '';
    STATE.history.slice(0, 10).forEach(result => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-data">
                    <span>⬇ ${result.download.toFixed(1)} Mbps</span>
                    <span>⬆ ${result.upload.toFixed(1)} Mbps</span>
                    <span>🏓 ${result.latency.toFixed(0)} ms</span>
                </div>
                <div class="history-item-time">${new Date(result.timestamp).toLocaleString()}</div>
            `;
            DOM.historyList.appendChild(item);
        });
}

function clearHistory() {
    if (confirm('Clear history?')) {
        STATE.history = [];
        localStorage.removeItem('speedtest_history');
        updateHistoryUI();
        showStatus('History cleared');
    }
}

function exportHistory() {
    if (STATE.history.length === 0) return showStatus('No history');
    
    const csv = [
        'Timestamp,Download,Upload,Latency,Jitter',
        ...STATE.history.map(r => `${new Date(r.timestamp).toISOString()},${r.download},${r.upload},${r.latency},${r.jitter}`)
    ].join('\n');
    
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `speedtest-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('History exported', 'success');
}

async function initializeAccessibility() {
    DOM.ariaLiveRegion = document.createElement('div');
    DOM.ariaLiveRegion.className = 'sr-only';
    DOM.ariaLiveRegion.setAttribute('role', 'status');
    DOM.ariaLiveRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(DOM.ariaLiveRegion);
}

function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('[Global Error]', event.error);
        performanceMonitor.recordError(event.error, 'global');
        
        if (!STATE.testing) {
            showStatus('An unexpected error occurred. Please refresh the page.', 'error');
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('[Unhandled Promise Rejection]', event.reason);
        performanceMonitor.recordError(event.reason, 'promise');
        
        event.preventDefault();
    });

    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) {
                        console.warn('[Performance] Long task detected:', entry.duration.toFixed(2) + 'ms');
                        performanceMonitor.recordError(`Long task: ${entry.duration.toFixed(2)}ms`, 'performance');
                    }
                }
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            console.warn('[Performance] Long task monitoring not supported');
        }
    }
}

// ========================================
// MODAL HANDLERS
// ========================================

function initializeModalHandlers() {
    const modal = document.getElementById('measurement-details-modal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

window.updateConfigSummary = updateConfigSummary;
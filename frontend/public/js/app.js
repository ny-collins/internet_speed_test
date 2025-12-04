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
    
    // Hide loading skeleton, show app
    const skeleton = document.getElementById('loadingSkeleton');
    const appContainer = document.querySelector('.app-container');
    if (skeleton) skeleton.style.display = 'none';
    if (appContainer) appContainer.style.opacity = '1';
    
    // 1. Setup PWA & Theme
    registerServiceWorker();
    initializeTheme();
    
    // 2. Initialize Icons (Lucide)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 3. Check Page Type (Speed Test vs Learn)
    const isSpeedTestPage = document.getElementById('splitLayout') !== null;
    
    if (isSpeedTestPage) {
        console.log('[App] Speed test page detected');
        // Query DOM elements FIRST before attaching listeners
        queryDOMElements();
    }
    
    // 4. Register Test Functions (so events.js can call them without circular deps)
    registerTestFunctions(startTest, cancelTest, retryTest, clearHistory, exportHistory);
    
    // 5. Setup Interaction Listeners (after DOM is queried)
    initializeEventListeners();

    if (isSpeedTestPage) {
        loadConfiguration();
        updateConfigSummary();
        buildMainGauge();
        resetSpeedCurve(); // Set initial state
        loadHistory();
        await fetchServerInfo();
        
        // Initialize Accessibility
        initializeAccessibility();
        
        // Initialize modal close handlers
        initializeModalHandlers();
        
        // Listen for resize events to redraw history chart
        window.addEventListener('resize', () => {
            if (STATE.history.length > 0) {
                drawHistoryChart(STATE.history);
            }
        });
        
        // Setup global error handling
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
    
    // High latency (>200ms): Use fewer threads to avoid HTTP/2 stream contention
    // TCP throughput over high-latency links suffers when multiple streams compete
    if (avgLatency > 200) {
        optimalThreads = 1;
        // Also increase minimum test duration for high-latency links to allow TCP ramp-up
        CONFIG.duration.download.min = 15;
        CONFIG.duration.upload.min = 15;
        // Increase variance threshold - high-latency links are naturally more variable
        CONFIG.stability.varianceThreshold = 0.40;
        console.log(`[Optimization] High latency detected (${avgLatency.toFixed(0)}ms) - using 1 thread, extended duration, relaxed stability`);
    } 
    // Medium latency (100-200ms): Use 2 threads
    else if (avgLatency > 100) {
        optimalThreads = 2;
        CONFIG.duration.download.min = 12;
        CONFIG.duration.upload.min = 12;
        CONFIG.stability.varianceThreshold = 0.35;
        console.log(`[Optimization] Medium latency detected (${avgLatency.toFixed(0)}ms) - using 2 threads`);
    }
    // Low latency (<100ms): Use default 4 threads
    else {
        optimalThreads = 4;
        console.log(`[Optimization] Low latency detected (${avgLatency.toFixed(0)}ms) - using 4 threads`);
    }
    
    // Update CONFIG for download and upload tests
    CONFIG.threads.download = optimalThreads;
    CONFIG.threads.upload = optimalThreads;
}

// ========================================
// TEST ORCHESTRATION
// ========================================

async function startTest() {
    if (STATE.testing) return;
    
    // Rate limiting (10s cooldown)
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
    
    // Start performance monitoring
    performanceMonitor.startTest();
    
    // Hide retry button when starting a new test
    if (DOM.retryTest) DOM.retryTest.hidden = true;
    
    // Reset Results
    STATE.testResults = { download: null, upload: null, latency: null, jitter: null };
    
    // Reset UI
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
        // Phase 1: Latency
        await runPhase('latency', measureLatency);
        if (STATE.cancelling) return;
        
        // Optimize thread count based on measured latency
        optimizeThreadCount();
        
        // Phase 2: Download
        await runPhase('download', measureDownload);
        if (STATE.cancelling) return;
        
        // Phase 3: Upload
        await runPhase('upload', measureUpload);
        if (STATE.cancelling) return;
        
        // Complete
        await completeTest();
        
    } catch (error) {
        console.error('[Test] Error:', error);
        showStatus(getFriendlyError(error.message), 'error');
        
        // Show retry button for failed tests
        if (DOM.retryTest) DOM.retryTest.hidden = false;
    } finally {
        cleanupTest();
    }
}

async function runPhase(name, testFn, maxRetries = 2) {
    STATE.currentPhase = name;
    updatePhaseUI(name, 'active');
    
    // Show countdown timer
    const duration = name === 'latency' ? 3 : 10;
    startCountdown(duration);
    
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Test] Starting ${name} (attempt ${attempt + 1}/${maxRetries + 1})`);
            const result = await testFn();
            
            // Hide countdown timer
            hideCountdown();
            
            if (!STATE.cancelling) {
                STATE.testResults[name] = result;
                updatePhaseUI(name, 'complete');
                updateResultCard(name, result);
            }
            return; // Success, exit retry loop
            
        } catch (error) {
            lastError = error;
            console.warn(`[Test] ${name} attempt ${attempt + 1} failed:`, error.message);
            
            // Don't retry on user cancellation or certain errors
            if (STATE.cancelling || 
                error.message.includes('cancelled') || 
                error.message.includes('Invalid') ||
                error.message.includes('aborted')) {
                break;
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    // All retries failed
    hideCountdown();
    throw lastError;
}

function cancelTest() {
    if (!STATE.testing) return;
    console.log('[Test] Cancelling...');
    STATE.cancelling = true;

    // Abort all active controllers
    STATE.abortControllers.forEach(c => {
        try { c.abort(); } catch (e) { /* Ignore errors */ }
    });
    STATE.abortControllers = [];

    if (STATE.rafId) {
        cancelAnimationFrame(STATE.rafId);
        STATE.rafId = null;
    }

    // Force immediate cleanup
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
    
    // Hide retry button
    if (DOM.retryTest) DOM.retryTest.hidden = true;
    
    // Clear any error status and start fresh
    showStatus('Retrying speed test...', 'info');
    
    // Start a new test
    startTest();
}

async function completeTest() {
    console.log('[Test] Complete');
    
    // End performance monitoring
    performanceMonitor.endTest();
    
    setProgress(100);
    showStatus('Test completed successfully!', 'success');
    resetAllPhases();
    
    // Show share button
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
    
    // Update test context panel with detailed test information
    updateTestContext({
        download: STATE.testResults.download,
        upload: STATE.testResults.upload,
        latency: STATE.testResults.latency,
        timestamp: testResult.timestamp,
        connectionType: testResult.connectionType
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
        
        // Add badge to settings button
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
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (response.ok) {
            STATE.serverInfo = await response.json();
            if (DOM.serverLocation) DOM.serverLocation.textContent = STATE.serverInfo.location || 'Unknown';
            if (DOM.serverLimits && STATE.serverInfo.maxDownloadSize) {
                DOM.serverLimits.textContent = `${STATE.serverInfo.maxDownloadSize}MB DL / ${STATE.serverInfo.maxUploadSize}MB UL`;
            }
            if (DOM.serverInfo) DOM.serverInfo.hidden = false;
        } else {
            // Update UI even if fetch fails
            if (DOM.serverLocation) DOM.serverLocation.textContent = 'Amsterdam, Netherlands';
        }
    } catch (e) {
        console.warn('[Server] Info fetch failed', e);
        // Always update the placeholder text even on error
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
    
    // Draw Chart
    drawHistoryChart(STATE.history);
    
    // Calculate and display statistics
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
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
        console.error('[Global Error]', event.error);
        performanceMonitor.recordError(event.error, 'global');
        
        // Show user-friendly error message for critical errors
        if (!STATE.testing) {
            showStatus('An unexpected error occurred. Please refresh the page.', 'error');
        }
    });

    // Global promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        console.error('[Unhandled Promise Rejection]', event.reason);
        performanceMonitor.recordError(event.reason, 'promise');
        
        // Prevent the default browser behavior (logging to console)
        event.preventDefault();
    });

    // Performance monitoring for long tasks
    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Tasks longer than 50ms
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
    
    // Close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

// Export updateConfigSummary so events.js can call it
window.updateConfigSummary = updateConfigSummary;
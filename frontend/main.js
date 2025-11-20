// ========================================
// SPEEDCHECK - MAIN ENTRY POINT
// ========================================

import { queryDOMElements } from './js/dom.js';
import { initializeTheme, initializeEventListeners, registerTestFunctions, loadConfiguration } from './js/events.js';
import { registerServiceWorker } from './js/worker.js';
import { buildMainGauge, showStatus, announceToScreenReader } from './js/ui.js';
import { measureLatency } from './js/test-latency.js';
import { measureDownload } from './js/test-download.js';
import { measureUpload } from './js/test-upload.js';
import { drawHistoryChart } from './js/chart.js';
import { CONFIG } from './js/config.js';
import { STATE } from './js/state.js';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('[App] Initializing SpeedCheck (Modular)...');
    
    // 1. Setup PWA & Theme
    registerServiceWorker();
    initializeTheme();
    
    // 2. Initialize Icons (Lucide)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 3. Check Page Type (Speed Test vs Learn)
    const isSpeedTestPage = document.getElementById('gaugeCircle') !== null;
    
    // 4. Register Test Functions (so events.js can call them without circular deps)
    registerTestFunctions(startTest, cancelTest, clearHistory, exportHistory);
    
    // 5. Setup Interaction Listeners
    initializeEventListeners();

    if (isSpeedTestPage) {
        console.log('[App] Speed test page detected');
        queryDOMElements();
        loadConfiguration();
        buildMainGauge();
        loadHistory();
        await fetchServerInfo();
        
        // Initialize Accessibility
        initializeAccessibility();
        
        // Listen for resize events to redraw history chart
        window.addEventListener('resize', () => {
            if (STATE.history.length > 0) {
                drawHistoryChart(STATE.history);
            }
        });
        
        console.log('[App] Speed test initialization complete');
        announceToScreenReader('SpeedCheck ready. Press the Start Test button to begin.');
    } else {
        console.log('[App] Non-speed-test page detected');
    }
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
    
    // Reset Results
    STATE.testResults = { download: null, upload: null, latency: null, jitter: null };
    
    // Reset UI
    import('./js/ui.js').then(m => {
        m.showGauge();
        m.clearResultsDisplay();
        m.setProgress(0);
    });
    
    const { DOM } = await import('./js/dom.js');
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
        
        // Phase 2: Download
        await runPhase('download', measureDownload);
        if (STATE.cancelling) return;
        
        // Phase 3: Upload
        await runPhase('upload', measureUpload);
        if (STATE.cancelling) return;
        
        // Complete
        completeTest();
        
    } catch (error) {
        console.error('[Test] Error:', error);
        showStatus(`Test failed: ${error.message}`, 'error');
    } finally {
        cleanupTest();
    }
}

async function runPhase(name, testFn) {
    STATE.currentPhase = name;
    const ui = await import('./js/ui.js');
    ui.updatePhaseUI(name, 'active');
    
    console.log(`[Test] Starting ${name}...`);
    const result = await testFn();
    
    if (!STATE.cancelling) {
        STATE.testResults[name] = result;
        ui.updatePhaseUI(name, 'complete');
        ui.updateResultCard(name, result);
    }
}

function cancelTest() {
    if (!STATE.testing) return;
    console.log('[Test] Cancelling...');
    STATE.cancelling = true;
    
    STATE.abortControllers.forEach(c => c.abort());
    STATE.abortControllers = [];
    
    if (STATE.rafId) {
        cancelAnimationFrame(STATE.rafId);
        STATE.rafId = null;
    }
    
    showStatus('Test cancelled', 'info');
    cleanupTest();
}

function completeTest() {
    console.log('[Test] Complete');
    import('./js/ui.js').then(ui => {
        ui.setProgress(100);
        showStatus('Test completed successfully!', 'success');
        ui.resetAllPhases();
    });
    
    saveToHistory({
        timestamp: Date.now(),
        download: STATE.testResults.download?.speed || 0,
        upload: STATE.testResults.upload?.speed || 0,
        latency: STATE.testResults.latency?.average || 0,
        jitter: STATE.testResults.jitter?.value || 0
    });
    
    announceToScreenReader('Test complete');
}

function cleanupTest() {
    STATE.testing = false;
    STATE.cancelling = false;
    
    import('./js/ui.js').then(ui => ui.resetGauge());
    
    import('./js/dom.js').then(({ DOM }) => {
        if (DOM.startTest) DOM.startTest.disabled = false;
        if (DOM.cancelTest) {
            DOM.cancelTest.disabled = true;
            DOM.cancelTest.hidden = true;
        }
    });
}

// ========================================
// DATA & HISTORY
// ========================================

async function fetchServerInfo() {
    try {
        const response = await fetch(`${CONFIG.apiBase}/api/info`);
        if (response.ok) {
            STATE.serverInfo = await response.json();
            const { DOM } = await import('./js/dom.js');
            if (DOM.serverLocation) DOM.serverLocation.textContent = STATE.serverInfo.location || 'Unknown';
            if (DOM.serverLimits && STATE.serverInfo.maxDownloadSize) {
                DOM.serverLimits.textContent = `${STATE.serverInfo.maxDownloadSize}MB DL / ${STATE.serverInfo.maxUploadSize}MB UL`;
            }
            if (DOM.serverInfo) DOM.serverInfo.hidden = false;
        }
    } catch (e) {
        console.warn('[Server] Info fetch failed', e);
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

function updateHistoryUI() {
    import('./js/dom.js').then(({ DOM }) => {
        if (!DOM.historyList) return;
        
        // Draw Chart
        import('./js/chart.js').then(chart => {
            chart.drawHistoryChart(STATE.history);
        });
        
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

function initializeAccessibility() {
    import('./js/dom.js').then(({ DOM }) => {
        DOM.ariaLiveRegion = document.createElement('div');
        DOM.ariaLiveRegion.className = 'sr-only';
        DOM.ariaLiveRegion.setAttribute('role', 'status');
        DOM.ariaLiveRegion.setAttribute('aria-live', 'polite');
        document.body.appendChild(DOM.ariaLiveRegion);
    });
}
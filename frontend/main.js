// ========================================
// CONFIGURATION & STATE
// ========================================

const CONFIG = {
    // Test parameters (user configurable)
    threads: {
        download: 4,
        upload: 4,
        min: 1,
        max: 8
    },
    duration: {
        download: {
            min: 3.5,
            max: 8,
            default: 8
        },
        upload: {
            min: 3,
            max: 6,
            default: 6
        }
    },
    stability: {
        sampleCount: 5,          // Minimum samples required before checking stability
        checkWindow: 10,         // Analyze last 10 samples for more reliable detection
        varianceThreshold: 0.05
    },
    // Performance
    updateInterval: 100, // ms between gauge updates
    rafThrottle: 16,     // ~60fps
    // Data transfer
    chunkSize: 512,      // KB for download chunks
    uploadSize: 10,      // MB per upload thread
    downloadSize: 50,    // MB per download thread
    // Backend
    apiBase: typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://speed-test-backend.up.railway.app',
    // UI
    animationDuration: 350
};

// Global state
const STATE = {
    testing: false,
    cancelling: false,
    currentPhase: null,
    gaugeElement: null,
    gaugeChart: null,
    lastMaxScale: 100,
    testResults: {
        download: null,
        upload: null,
        latency: null,
        jitter: null
    },
    abortControllers: [],
    serverInfo: null,
    history: [],
    rafId: null,
    // Performance monitoring
    performance: {
        monitoring: false,
        lastCheck: 0,
        blockWarnings: 0,
        maxBlockTime: 0
    },
    // PWA update management
    pwa: {
        updateAvailable: false,
        newWorker: null
    }
};

// Centralized DOM element references
const DOM = {
    // Theme & Settings
    themeToggleSwitch: null,
    settingsToggle: null,
    settingsPanel: null,
    settingsClose: null,
    
    // Settings controls
    downloadThreads: null,
    downloadThreadsValue: null,
    maxDuration: null,
    maxDurationValue: null,
    resetSettings: null,
    
    // Test controls
    startTest: null,
    cancelTest: null,
    gaugeStartButton: null,
    
    // Gauge elements
    gaugeCircle: null,
    gaugeInner: null,
    gaugeProgress: null,
    gaugeValue: null,
    gaugeUnit: null,
    gaugePhase: null,
    
    // Results
    resultsMatrix: null,
    
    // Server info
    serverLocation: null,
    serverLimits: null,
    serverInfo: null,
    
    // Progress & Status
    progressBar: null,
    statusBar: null,
    statusText: null,
    
    // History
    historyList: null,
    clearHistory: null,
    exportHistory: null,
    
    // Accessibility
    ariaLiveRegion: null
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// ========================================
// SERVICE WORKER REGISTRATION
// ========================================

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Worker not supported');
        return;
    }
    
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope);
            
            // Check for updates on page load
            registration.update();
            
            // Check for updates periodically (every 60 seconds)
            setInterval(() => {
                registration.update();
            }, 60000);
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                STATE.pwa.newWorker = registration.installing;
                console.log('[PWA] Service Worker update found');
                
                STATE.pwa.newWorker.addEventListener('statechange', () => {
                    if (STATE.pwa.newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] New version available. Showing update prompt.');
                        STATE.pwa.updateAvailable = true;
                        showUpdatePrompt();
                    }
                });
            });
            
            // Listen for controlling service worker change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (STATE.pwa.updateAvailable) {
                    console.log('[PWA] New Service Worker activated. Reloading page...');
                    window.location.reload();
                }
            });
        })
        .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
        });
}

function showUpdatePrompt() {
    // Create update notification banner
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 16px;
            max-width: 90%;
            animation: slideDown 0.3s ease-out;
        ">
            <span style="flex: 1; font-weight: 500;">
                🎉 New version available! Update now for the latest features.
            </span>
            <button id="update-btn" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 8px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            ">
                Update Now
            </button>
            <button id="dismiss-btn" style="
                background: transparent;
                color: white;
                border: 2px solid white;
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            ">
                Later
            </button>
        </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        #update-btn:hover {
            transform: scale(1.05);
        }
        #dismiss-btn:hover {
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(banner);
    
    // Update button handler
    document.getElementById('update-btn').addEventListener('click', () => {
        banner.remove();
        // Tell the waiting service worker to skip waiting and activate
        if (STATE.pwa.newWorker) {
            STATE.pwa.newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    });
    
    // Dismiss button handler
    document.getElementById('dismiss-btn').addEventListener('click', () => {
        banner.remove();
    });
}

async function initializeApp() {
    console.log('[App] Initializing SpeedCheck...');
    
    // Register service worker for PWA support
    registerServiceWorker();
    
    // Always setup theme first (works on all pages)
    initializeTheme();
    
    // Initialize Lucide icons after theme is set
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Initialize theme toggle
    initializeThemeToggle();
    
    // Initialize tab navigation (for learn page)
    initializeTabNavigation();
    
    // Check if this is the speed test page
    const isSpeedTestPage = document.getElementById('gaugeCircle') !== null;
    
    if (isSpeedTestPage) {
        // Speed test page specific initialization
        console.log('[App] Speed test page detected');
        
        // Query all DOM elements once
        queryDOMElements();
        
        // Load saved configuration
        loadConfiguration();
        
        // Setup event listeners
        initializeEventListeners();
        
        // Build gauge
        buildMainGauge();
        
        // Load history
        loadHistory();
        
        // Fetch server info
        await fetchServerInfo();
        
        // Setup accessibility
        initializeAccessibility();
        
        console.log('[App] Speed test initialization complete');
        announceToScreenReader('SpeedCheck ready. Press the Start Test button to begin.');
    } else {
        console.log('[App] Non-speed-test page detected');
    }
}

function queryDOMElements() {
    // Theme & Settings
    DOM.themeToggleSwitch = document.getElementById('themeToggleSwitch');
    DOM.settingsToggle = document.querySelector('.settings-toggle');
    DOM.settingsPanel = document.getElementById('settingsPanel');
    DOM.settingsClose = document.getElementById('settingsClose');
    
    // Settings controls
    DOM.downloadThreads = document.getElementById('downloadThreads');
    DOM.downloadThreadsValue = document.getElementById('downloadThreadsValue');
    DOM.maxDuration = document.getElementById('maxDuration');
    DOM.maxDurationValue = document.getElementById('maxDurationValue');
    DOM.resetSettings = document.getElementById('resetSettings');
    
    // Test controls
    DOM.startTest = document.getElementById('startTest');
    DOM.cancelTest = document.getElementById('cancelTest');
    DOM.gaugeStartButton = document.getElementById('gaugeStartButton');
    
    // Gauge elements
    DOM.gaugeCircle = document.getElementById('gaugeCircle');
    DOM.gaugeInner = document.getElementById('gaugeInner');
    DOM.gaugeProgress = document.getElementById('gaugeProgress');
    DOM.gaugeValue = document.getElementById('gaugeValue');
    DOM.gaugeUnit = document.getElementById('gaugeUnit');
    DOM.gaugePhase = document.getElementById('gaugePhase');
    
    // Results
    DOM.resultsMatrix = document.getElementById('resultsMatrix');
    
    // Server info
    DOM.serverLocation = document.getElementById('serverLocation');
    DOM.serverLimits = document.getElementById('serverLimits');
    DOM.serverInfo = document.getElementById('serverInfo');
    
    // Progress & Status
    DOM.progressBar = document.querySelector('.progress-fill');
    DOM.statusBar = document.getElementById('statusBar');
    DOM.statusText = DOM.statusBar?.querySelector('.status-text');
    
    // History
    DOM.historyList = document.getElementById('historyList');
    DOM.clearHistory = document.getElementById('clearHistory');
    DOM.exportHistory = document.getElementById('exportHistory');
    
    console.log('[DOM] All elements queried and cached');
}

// ========================================
// THEME MANAGEMENT
// ========================================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function initializeThemeToggle() {
    // Find theme toggle button (works on all pages)
    const themeToggle = document.getElementById('themeToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        console.log('[Theme] Theme toggle initialized');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Try to announce if function exists
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(`Theme changed to ${newTheme} mode`);
    }
}

function updateThemeIcon(theme) {
    // Update all theme toggle icons across all pages (DRY approach)
    const themeIcons = document.querySelectorAll('.theme-icon');
    const iconName = theme === 'dark' ? 'sun' : 'moon';
    
    themeIcons.forEach(icon => {
        icon.setAttribute('data-lucide', iconName);
    });
    
    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ========================================
// SIDEBAR NAVIGATION (Learn Page)
// ========================================

function initializeTabNavigation() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
    const contentSections = document.querySelectorAll('.content-section');
    
    if (!sidebar || !sidebarToggle) {
        return; // Not on learn page
    }
    
    console.log('[Sidebar] Initializing sidebar navigation');
    
    // Toggle sidebar
    function toggleSidebar() {
        const isActive = sidebar.classList.contains('active');
        if (isActive) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        } else {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
        }
    }
    
    // Close sidebar
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
    
    // Switch section
    function switchSection(sectionId) {
        // Remove active from all links and sections
        sidebarLinks.forEach(link => link.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));
        
        // Activate target section
        const targetSection = document.getElementById(sectionId);
        const targetLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
        
        if (targetSection) {
            targetSection.classList.add('active');
            if (targetLink) {
                targetLink.classList.add('active');
            }
            
            // Update URL hash
            history.replaceState(null, null, `#${sectionId}`);
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            console.log(`[Sidebar] Switched to ${sectionId}`);
        }
    }
    
    // Event listeners
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            if (sectionId) {
                switchSection(sectionId);
                closeSidebar();
            }
        });
    });
    
    // Handle URL hash on load
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        switchSection(hash);
    } else {
        // Default to first section
        switchSection('speed-testing');
    }
    
    // Handle hash changes
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && document.getElementById(hash)) {
            switchSection(hash);
        }
    });
    
    // Close sidebar on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

// ========================================
// SETTINGS MANAGEMENT
// ========================================

function toggleSettings() {
    if (!DOM.settingsPanel || !DOM.settingsToggle) return;
    
    const isOpen = DOM.settingsPanel.getAttribute('data-open') === 'true';
    
    // Toggle data-open attribute for CSS transition
    DOM.settingsPanel.setAttribute('data-open', !isOpen);
    
    // Update aria-expanded for accessibility
    DOM.settingsToggle.setAttribute('aria-expanded', !isOpen);
    
    if (!isOpen) {
        // Opening: focus first input
        setTimeout(() => {
            DOM.downloadThreads?.focus();
        }, 300);
        announceToScreenReader('Settings panel opened');
    } else {
        // Closing: return focus to toggle button
        DOM.settingsToggle?.focus();
        announceToScreenReader('Settings panel closed');
    }
}

function updateSettingValue(id, value) {
    const displayElement = DOM[id + 'Value'];
    if (displayElement) {
        displayElement.textContent = value;
    }
}

function saveSettings() {
    if (!DOM.downloadThreads || !DOM.maxDuration) return;
    
    const threads = parseInt(DOM.downloadThreads.value);
    const maxDur = parseFloat(DOM.maxDuration.value);
    
    // Apply threads to both download and upload
    CONFIG.threads.download = threads;
    CONFIG.threads.upload = threads;
    
    // Apply duration settings
    CONFIG.duration.download.max = maxDur;
    CONFIG.duration.download.default = maxDur;
    CONFIG.duration.upload.max = Math.max(3, maxDur - 2);
    CONFIG.duration.upload.default = CONFIG.duration.upload.max;
    
    localStorage.setItem('config', JSON.stringify(CONFIG));
    showStatus('Settings saved', 'success');
    announceToScreenReader('Settings saved');
}

function resetSettings() {
    // Reset to defaults
    CONFIG.threads.download = 4;
    CONFIG.threads.upload = 4;
    CONFIG.duration.download.max = 8;
    CONFIG.duration.download.default = 8;
    CONFIG.duration.upload.max = 6;
    CONFIG.duration.upload.default = 6;
    
    // Update UI
    if (DOM.downloadThreads) DOM.downloadThreads.value = CONFIG.threads.download;
    if (DOM.maxDuration) DOM.maxDuration.value = CONFIG.duration.download.max;
    
    updateSettingValue('downloadThreads', CONFIG.threads.download);
    updateSettingValue('maxDuration', CONFIG.duration.download.max + 's');
    
    localStorage.removeItem('config');
    showStatus('Settings reset to defaults', 'info');
    announceToScreenReader('Settings reset to defaults');
}

function loadConfiguration() {
    try {
        const saved = localStorage.getItem('config');
        if (saved) {
            const savedConfig = JSON.parse(saved);
            Object.assign(CONFIG, savedConfig);
        }
        
        // Populate UI if elements exist
        if (DOM.downloadThreads) {
            DOM.downloadThreads.value = CONFIG.threads.download;
            updateSettingValue('downloadThreads', CONFIG.threads.download);
        }
        if (DOM.maxDuration) {
            DOM.maxDuration.value = CONFIG.duration.download.max;
            updateSettingValue('maxDuration', CONFIG.duration.download.max + 's');
        }
    } catch (error) {
        console.error('[Config] Failed to load configuration:', error);
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function initializeEventListeners() {
    // Theme toggle (now in settings panel)
    DOM.themeToggleSwitch?.addEventListener('click', toggleTheme);
    
    // Settings panel
    DOM.settingsToggle?.addEventListener('click', toggleSettings);
    DOM.settingsClose?.addEventListener('click', toggleSettings);
    
    // Settings controls (simplified to just 2 controls)
    if (DOM.downloadThreads) {
        DOM.downloadThreads.addEventListener('input', (e) => {
            updateSettingValue('downloadThreads', e.target.value);
        });
        DOM.downloadThreads.addEventListener('change', saveSettings);
    }
    
    if (DOM.maxDuration) {
        DOM.maxDuration.addEventListener('input', (e) => {
            updateSettingValue('maxDuration', e.target.value + 's');
        });
        DOM.maxDuration.addEventListener('change', saveSettings);
    }
    
    DOM.resetSettings?.addEventListener('click', resetSettings);
    
    // Test controls
    DOM.startTest?.addEventListener('click', startTest);
    DOM.cancelTest?.addEventListener('click', cancelTest);
    DOM.gaugeStartButton?.addEventListener('click', startTest);
    
    // History actions
    DOM.clearHistory?.addEventListener('click', clearHistory);
    DOM.exportHistory?.addEventListener('click', exportHistory);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
    // Don't trigger if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Ctrl/Cmd + T: Start test
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        if (!STATE.testing) {
            startTest();
        }
    }
    
    // Escape: Cancel test or close settings
    if (e.key === 'Escape') {
        const settingsOpen = DOM.settingsPanel?.getAttribute('data-open') === 'true';
        if (settingsOpen) {
            toggleSettings();
        } else if (STATE.testing) {
            cancelTest();
        }
    }
    
    // Ctrl/Cmd + ,: Open settings
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        toggleSettings();
    }
}

// ========================================
// SERVER INFO
// ========================================

async function fetchServerInfo() {
    try {
        const response = await fetch(`${CONFIG.apiBase}/api/info`);
        if (!response.ok) throw new Error('Failed to fetch server info');
        
        STATE.serverInfo = await response.json();
        
        // Update UI
        if (DOM.serverLocation) {
            DOM.serverLocation.textContent = STATE.serverInfo.serverLocation || 'Unknown';
        }
        if (DOM.serverLimits && STATE.serverInfo.maxDownloadSize) {
            DOM.serverLimits.textContent = `${STATE.serverInfo.maxDownloadSize}MB DL / ${STATE.serverInfo.maxUploadSize}MB UL`;
        }
        if (DOM.serverInfo) {
            DOM.serverInfo.hidden = false;
        }
        
        console.log('[Server] Info fetched:', STATE.serverInfo);
    } catch (error) {
        console.error('[Server] Failed to fetch info:', error);
        // Don't show error status - it's not critical
        console.log('[Server] Using default server info');
    }
}

// ========================================
// MAIN TEST ORCHESTRATION
// ========================================

async function startTest() {
    if (STATE.testing) return;
    
    console.log('[Test] Starting comprehensive speed test...');
    STATE.testing = true;
    STATE.cancelling = false;
    STATE.abortControllers = [];
    
    // Reset results
    STATE.testResults = {
        download: null,
        upload: null,
        latency: null,
        jitter: null
    };
    
    // Start performance monitoring
    startPerformanceMonitoring();
    
    // Show gauge and hide start button
    showGauge();
    
    // Update UI
    if (DOM.startTest) DOM.startTest.disabled = true;
    if (DOM.cancelTest) {
        DOM.cancelTest.disabled = false;
        DOM.cancelTest.hidden = false;
    }
    clearResultsDisplay();
    setProgress(0);
    announceToScreenReader('Speed test started');
    
    try {
        // Phase 1: Latency test
        await runPhase('latency', measureLatency);
        if (STATE.cancelling) return;
        
        // Phase 2: Download test
        await runPhase('download', measureDownload);
        if (STATE.cancelling) return;
        
        // Phase 3: Upload test
        await runPhase('upload', measureUpload);
        if (STATE.cancelling) return;
        
        // Phase 4: Complete
        completeTest();
        
    } catch (error) {
        console.error('[Test] Error during test:', error);
        showStatus(`Test failed: ${error.message}`, 'error');
        announceToScreenReader(`Test failed: ${error.message}`);
    } finally {
        // Stop performance monitoring
        stopPerformanceMonitoring();
        
        STATE.testing = false;
        if (DOM.startTest) DOM.startTest.disabled = false;
        if (DOM.cancelTest) {
            DOM.cancelTest.disabled = true;
            DOM.cancelTest.hidden = true;
        }
        resetGauge();
    }
}

async function runPhase(phaseName, phaseFunction) {
    STATE.currentPhase = phaseName;
    updatePhaseUI(phaseName, 'active');
    
    console.log(`[Test] Starting ${phaseName} phase...`);
    const result = await phaseFunction();
    
    if (!STATE.cancelling) {
        STATE.testResults[phaseName] = result;
        updatePhaseUI(phaseName, 'complete');
        updateResultCard(phaseName, result);
        console.log(`[Test] ${phaseName} complete:`, result);
    }
    
    return result;
}

function cancelTest() {
    if (!STATE.testing) return;
    
    console.log('[Test] Cancelling test...');
    STATE.cancelling = true;
    
    // Abort all ongoing requests
    STATE.abortControllers.forEach(controller => {
        try {
            controller.abort();
        } catch (e) {
            console.warn('[Test] Error aborting request:', e);
        }
    });
    STATE.abortControllers = [];
    
    // Cancel animation frame
    if (STATE.rafId) {
        cancelAnimationFrame(STATE.rafId);
        STATE.rafId = null;
    }
    
    // Stop performance monitoring
    stopPerformanceMonitoring();
    
    showStatus('Test cancelled', 'info');
    announceToScreenReader('Test cancelled');
    resetAllPhases();
    resetGauge();
}

function completeTest() {
    console.log('[Test] All phases complete');
    setProgress(100);
    showStatus('Test completed successfully!', 'success');
    announceToScreenReader('Speed test completed successfully');
    
    // Save to history
    saveToHistory({
        timestamp: Date.now(),
        download: STATE.testResults.download?.speed || 0,
        upload: STATE.testResults.upload?.speed || 0,
        latency: STATE.testResults.latency?.average || 0,
        jitter: STATE.testResults.jitter?.value || 0
    });
    
    // Reset phases
    setTimeout(() => resetAllPhases(), 2000);
}

// ========================================
// LATENCY MEASUREMENT
// ========================================

async function measureLatency() {
    const sampleCount = 10;
    const samples = [];
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;
    let cleanupDone = false;
    
    const cleanup = () => {
        // Idempotent cleanup - safe to call multiple times
        if (cleanupDone) return;
        cleanupDone = true;
        
        // Remove this controller from the array to prevent memory leaks
        if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
            STATE.abortControllers.splice(controllerIndex, 1);
        }
    };
    
    announceToScreenReader('Measuring latency');
    
    try {
        for (let i = 0; i < sampleCount; i++) {
            if (STATE.cancelling || abortController.signal.aborted) break;
            
            const start = performance.now();
            await fetch(`${CONFIG.apiBase}/api/ping?t=${Date.now()}`, {
                signal: abortController.signal,
                cache: 'no-store'
            });
            const duration = performance.now() - start;
            
            samples.push(duration);
            
            // Update live average in matrix card
            const currentAvg = samples.reduce((a, b) => a + b, 0) / samples.length;
            updateMatrixCardLive('latency', currentAvg);
            
            // Update progress
            setProgress((i + 1) / sampleCount * 25); // 25% of total
            
            // Small delay between pings
            if (i < sampleCount - 1) {
                await sleep(100);
            }
        }
        
        if (samples.length === 0) throw new Error('No latency samples collected');
        
        const average = samples.reduce((a, b) => a + b, 0) / samples.length;
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        
        // Calculate jitter - start animation for jitter card
        updatePhaseUI('jitter', 'active');
        const jitter = calculateJitter(samples);
        STATE.testResults.jitter = { value: jitter };
        updateMatrixCardLive('jitter', jitter);
        updateResultCard('jitter', { value: jitter });
        
        // Wait a brief moment to show the jitter calculation animation
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

// ========================================
// DOWNLOAD MEASUREMENT
// ========================================

async function measureDownload() {
    const threadCount = CONFIG.threads.download;
    const maxDuration = CONFIG.duration.download.max * 1000;
    const minDuration = CONFIG.duration.download.min * 1000;
    
    console.log(`[Download] Starting with ${threadCount} threads`);
    announceToScreenReader(`Starting download test with ${threadCount} threads`);
    
    const startTime = performance.now();
    let totalBytes = 0;
    let isRunning = true;
    
    // Speed tracking for stability detection
    const speedSamples = [];
    let lastSampleTime = startTime;
    let lastBytes = 0;
    
    // Create byte counters that threads will update
    const byteCounters = [];
    
    // Track thread completion
    let threadsCompleted = false;
    
    // Launch all download threads (non-blocking)
    const threadPromises = Array.from({ length: threadCount }, (_, i) => {
        const counter = { bytes: 0 };
        byteCounters.push(counter);
        return downloadThread(i, () => isRunning, counter);
    });
    
    // Set flag when all threads complete (async, but monitor loop will check it)
    (async () => {
        await Promise.all(threadPromises);
        threadsCompleted = true;
    })();
    
    // Track when monitoring ends (for accurate duration calculation)
    let monitorEndTime = startTime;
    let inFinishingPhase = false;
    
    // Monitor loop - runs concurrently with threads, continues until all complete
    const monitorLoop = async () => {
        while (!STATE.cancelling) {
            await sleep(CONFIG.updateInterval);
            
            const elapsed = performance.now() - startTime;
            
            // Sum bytes from all threads
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);
            
            // Always calculate and display current speed for real-time updates
            if (elapsed > 0 && totalBytes > 0) {
                // Calculate instantaneous speed based on current progress
                const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps
                
                // If we have speed samples, use rolling average for smoother display
                if (speedSamples.length >= 3) {
                    const recentSamples = speedSamples.slice(-3);
                    const avgSpeed = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
                    updateGauge(avgSpeed, 'download');
                } else {
                    // Early in test, just show current speed
                    updateGauge(currentSpeed, 'download');
                }
            }
            
            // Collect speed samples every 500ms for stability calculation
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;
                
                // Only add sample if we had progress in this interval
                // This prevents adding zero-speed samples during connection issues
                if (intervalBytes > 0) {
                    const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                    speedSamples.push(intervalSpeed);
                    
                    // Check for stability after minimum duration
                    if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                        const stabilityCheck = speedSamples.slice(-CONFIG.stability.sampleCount);
                        if (isSpeedStable(stabilityCheck)) {
                            console.log('[Download] Speed stabilized, stopping early');
                            isRunning = false;
                            monitorEndTime = performance.now(); // Capture when we stop monitoring
                            break;
                        }
                    }
                } else {
                    console.log(`[Download] No progress in last ${intervalDuration}s`);
                }
                
                lastSampleTime = elapsed;
                lastBytes = totalBytes;
            }
            
            // Check if main measurement window is over
            if (!inFinishingPhase && elapsed >= maxDuration) {
                console.log('[Download] Max duration reached, entering finishing phase...');
                isRunning = false; // Stop threads from starting new reads
                inFinishingPhase = true;
                monitorEndTime = performance.now(); // Capture when we stop monitoring
            }
            
            // Exit monitor loop when all threads complete
            if (threadsCompleted) {
                console.log('[Download] All threads completed, exiting monitor loop');
                break;
            }
            
            // Update progress (25-60% range)
            const progressPercent = 25 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 60));
            
            // Update visual border progress on download matrix card
            const downloadCard = document.querySelector('.matrix-card[data-metric="download"]');
            if (downloadCard) {
                const progress = Math.min((elapsed / maxDuration) * 100, 100);
                downloadCard.style.setProperty('--progress', progress.toFixed(2));
            }
        }
    };
    
    // Run monitor concurrently
    await monitorLoop();
    
    // Wait for all threads to complete and get their results
    const threadResults = await Promise.all(threadPromises);
    
    // Debug: Log what each thread returned
    console.log('[Download] Thread results:', threadResults.map((r, i) => `Thread ${i}: ${r.bytes} bytes at ${r.completionTime.toFixed(2)}ms`).join(', '));
    
    // CRITICAL: Recalculate totalBytes from thread results after monitoring completes
    // The monitor loop may have exited early, leaving totalBytes stale
    totalBytes = threadResults.reduce((sum, result) => sum + result.bytes, 0);
    
    // Find the latest completion time from all threads (like upload does)
    const downloadEndTime = Math.max(...threadResults.map(r => r.completionTime || 0));
    
    // Use actual download completion time for duration calculation
    // This matches upload behavior and gives accurate speed for full download
    const duration = (downloadEndTime - startTime) / 1000;
    const speedMbps = (totalBytes * 8) / duration / 1_000_000;
    
    // No need to update gauge here - monitor loop already showed the final speed
    // The monitor continues until threads complete, so last gauge value is accurate
    
    console.log(`[Download] Completed: ${speedMbps.toFixed(2)} Mbps (${totalBytes} bytes in ${duration.toFixed(2)}s)`);
    announceToScreenReader(`Download speed: ${speedMbps.toFixed(1)} megabits per second`);
    
    return {
        speed: speedMbps,
        bytesTransferred: totalBytes,
        duration,
        stability: calculateStability(speedSamples)
    };
}

async function downloadThread(threadId, isRunning, byteCounter) {
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;
    let cleanupDone = false;
    let completionTime = null; // Track when download completes
    
    const cleanup = () => {
        // Idempotent cleanup - safe to call multiple times
        if (cleanupDone) return;
        cleanupDone = true;
        
        // Remove this controller from the array to prevent memory leaks
        if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
            STATE.abortControllers.splice(controllerIndex, 1);
        }
    };
    
    try {
        const url = `${CONFIG.apiBase}/api/download?size=${CONFIG.downloadSize}&chunk=${CONFIG.chunkSize}&t=${Date.now()}`;
        console.log(`[Download] Thread ${threadId} starting: ${url}`);
        
        const response = await fetch(url, { 
            signal: abortController.signal,
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Thread ${threadId} failed: ${response.status} ${response.statusText}`);
        }
        
        if (!response.body) {
            throw new Error(`Thread ${threadId}: Response body is null`);
        }
        
        const reader = response.body.getReader();
        console.log(`[Download] Thread ${threadId} reader created, starting to read...`);
        
        // Read until stream ends - don't check isRunning() here
        // This matches upload behavior where XHR continues to completion
        // The monitor loop controls UI updates, not data transfer
        while (!abortController.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            
            byteCounter.bytes += value.length;
        }
        
        completionTime = performance.now(); // Capture completion time
        console.log(`[Download] Thread ${threadId} completed: ${byteCounter.bytes} bytes at ${completionTime.toFixed(2)}ms`);
        
        // Properly cancel the reader
        try {
            await reader.cancel();
        } catch (e) {
            // Ignore cancel errors
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`[Download] Thread ${threadId} aborted`);
        } else {
            console.error(`[Download] Thread ${threadId} error:`, error);
            // Don't re-throw, just log - let test continue with other threads
        }
    } finally {
        cleanup();
    }
    
    // Return both bytes and completion time (like upload does)
    return {
        bytes: byteCounter.bytes,
        completionTime: completionTime || performance.now()
    };
}

// ========================================
// UPLOAD MEASUREMENT
// ========================================

// Create a reusable chunk for upload (avoids memory allocation per request)
// Note: crypto.getRandomValues() has a 64KB (65536 bytes) limit
const REUSABLE_UPLOAD_CHUNK = (() => {
    const chunk = new Uint8Array(65536); // 64KB reusable chunk (crypto limit)
    crypto.getRandomValues(chunk);
    return chunk;
})();

async function measureUpload() {
    const threadCount = CONFIG.threads.upload;
    const maxDuration = CONFIG.duration.upload.max * 1000;
    const minDuration = CONFIG.duration.upload.min * 1000;
    
    console.log(`[Upload] Starting with ${threadCount} threads`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);
    
    const startTime = performance.now();
    let totalBytes = 0;
    let isRunning = true;
    let transmissionEndTime = null; // Track when data transmission actually ends
    
    // Speed tracking
    const speedSamples = [];
    let lastSampleTime = startTime;
    let lastBytes = 0;
    
    // Create byte counters that threads will update
    const byteCounters = [];
    
    // Track when monitoring ends (for accurate duration calculation)
    let monitorEndTime = startTime;
    let inFinishingPhase = false;
    
    // Track thread completion
    let threadsCompleted = false;
    
    // Launch all upload threads
    const threadPromises = Array.from({ length: threadCount }, (_, i) => {
        const counter = { bytes: 0 };
        byteCounters.push(counter);
        return uploadThread(i, () => isRunning, counter);
    });
    
    // Set flag when all threads complete (async, but monitor loop will check it)
    (async () => {
        await Promise.all(threadPromises);
        threadsCompleted = true;
    })();
    
    // Monitor loop - continues until all threads complete
    const monitorLoop = async () => {
        while (!STATE.cancelling) {
            await sleep(CONFIG.updateInterval);
            
            const elapsed = performance.now() - startTime;
            
            // Sum bytes from all threads
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);
            
            // Always calculate and display current speed for real-time updates
            if (elapsed > 0 && totalBytes > 0) {
                // Calculate instantaneous speed based on current progress
                const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps
                
                // If we have speed samples, use rolling average for smoother display
                if (speedSamples.length >= 3) {
                    const recentSamples = speedSamples.slice(-3);
                    const avgSpeed = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
                    updateGauge(avgSpeed, 'upload');
                } else {
                    // Early in test, just show current speed
                    updateGauge(currentSpeed, 'upload');
                }
            }
            
            // Collect speed samples every 500ms for stability calculation
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;
                
                // Only add sample if we had progress in this interval
                // This prevents adding zero-speed samples when upload is finishing
                if (intervalBytes > 0) {
                    const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                    speedSamples.push(intervalSpeed);
                    
                    // Check stability
                    if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                        const stabilityCheck = speedSamples.slice(-CONFIG.stability.sampleCount);
                        if (isSpeedStable(stabilityCheck)) {
                            console.log('[Upload] Speed stabilized, stopping early');
                            isRunning = false;
                            monitorEndTime = performance.now(); // Capture when we stop monitoring
                            break;
                        }
                    }
                } else {
                    console.log(`[Upload] No progress in last ${intervalDuration}s - likely finishing up`);
                }
                
                lastSampleTime = elapsed;
                lastBytes = totalBytes;
            }
            
            // Check if main measurement window is over
            if (!inFinishingPhase && elapsed >= maxDuration) {
                console.log('[Upload] Max duration reached, entering finishing phase...');
                isRunning = false; // Stop new uploads from starting
                inFinishingPhase = true;
                monitorEndTime = performance.now(); // Capture when we stop monitoring
            }
            
            // Exit monitor loop when all threads complete
            if (threadsCompleted) {
                console.log('[Upload] All threads completed, exiting monitor loop');
                break;
            }
            
            // Update progress (60-95% range)
            const progressPercent = 60 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 95));
            
            // Update visual border progress on upload matrix card
            const uploadCard = document.querySelector('.matrix-card[data-metric="upload"]');
            if (uploadCard) {
                const progress = Math.min((elapsed / maxDuration) * 100, 100);
                uploadCard.style.setProperty('--progress', progress.toFixed(2));
            }
        }
    };
    
    await monitorLoop();
    
    // Wait for all thread promises to resolve, but capture end time from last transmission
    const threadResults = await Promise.all(threadPromises);
    
    // Debug: Log what each thread returned
    console.log('[Upload] Thread results:', threadResults.map((r, i) => `Thread ${i}: ${r.bytes} bytes at ${r.transmissionEndTime}ms`).join(', '));
    
    // CRITICAL: Recalculate totalBytes from thread results after monitoring completes
    // The monitor loop may have exited early, leaving totalBytes stale
    totalBytes = threadResults.reduce((sum, result) => sum + result.bytes, 0);
    
    // Find the latest transmission end time from all threads
    transmissionEndTime = Math.max(...threadResults.map(r => r.transmissionEndTime || 0));
    
    // Use transmission end time for duration calculation (excludes server response wait)
    const duration = (transmissionEndTime - startTime) / 1000;
    const speedMbps = (totalBytes * 8) / duration / 1_000_000;
    
    // No need to update gauge here - monitor loop already showed the final speed
    // The monitor continues until threads complete, so last gauge value is accurate
    
    console.log(`[Upload] Completed: ${speedMbps.toFixed(2)} Mbps (${totalBytes} bytes in ${duration.toFixed(2)}s)`);
    announceToScreenReader(`Upload speed: ${speedMbps.toFixed(1)} megabits per second`);
    
    return {
        speed: speedMbps,
        bytesTransferred: totalBytes,
        duration,
        stability: calculateStability(speedSamples)
    };
}

// Helper: Check if streaming upload is supported
function supportsStreamingUpload() {
    try {
        // Check if ReadableStream is available
        if (typeof ReadableStream === 'undefined') {
            console.log('[Upload] ReadableStream not supported, using fallback');
            return false;
        }
        
        // Check if fetch can accept ReadableStream as body
        // Some browsers have ReadableStream but don't support it in fetch body
        const testStream = new ReadableStream({
            start(controller) {
                controller.close();
            }
        });
        
        // Try to create a Request with a stream body
        try {
            new Request('https://example.com', { method: 'POST', body: testStream, duplex: 'half' });
            console.log('[Upload] Using streaming upload (ReadableStream)');
            return true;
        } catch (e) {
            console.log('[Upload] ReadableStream not supported in fetch, using fallback');
            return false;
        }
    } catch (e) {
        console.log('[Upload] Error checking stream support, using fallback:', e.message);
        return false;
    }
}

async function uploadThread(threadId, isRunning, byteCounter) {
    const totalSize = CONFIG.uploadSize * 1024 * 1024; // Convert MB to bytes
    
    const abortController = new AbortController();
    const controllerIndex = STATE.abortControllers.push(abortController) - 1;
    let cleanupDone = false;
    
    const cleanup = () => {
        // Idempotent cleanup - safe to call multiple times
        if (cleanupDone) return;
        cleanupDone = true;
        
        // Remove this controller from the array to prevent memory leaks
        if (controllerIndex !== -1 && STATE.abortControllers[controllerIndex] === abortController) {
            STATE.abortControllers.splice(controllerIndex, 1);
        }
    };
    
    // Use optimized upload with reusable chunk and XHR progress tracking
    // Returns object with byteCounter and transmissionEndTime
    return uploadWithReusableChunk(threadId, totalSize, abortController, isRunning, byteCounter, cleanup);
}

// Optimized upload using reusable chunk with XHR progress tracking
async function uploadWithReusableChunk(threadId, totalSize, abortController, isRunning, byteCounter, cleanup) {
    // Build blob from reusable chunk (fast, no crypto generation delay)
    const chunkSize = REUSABLE_UPLOAD_CHUNK.length; // 64KB
    const chunksNeeded = Math.ceil(totalSize / chunkSize);
    const chunks = [];
    
    // Reuse the same chunk multiple times to build the blob quickly
    for (let i = 0; i < chunksNeeded; i++) {
        if (!isRunning() || STATE.cancelling || abortController.signal.aborted) {
            console.log(`[Upload] Thread ${threadId} aborted during preparation`);
            cleanup();
            return byteCounter;
        }
        
        const isLastChunk = (i === chunksNeeded - 1);
        const remaining = totalSize - (i * chunkSize);
        
        if (isLastChunk && remaining < chunkSize) {
            // Last chunk might be smaller
            chunks.push(REUSABLE_UPLOAD_CHUNK.buffer.slice(0, remaining));
        } else {
            chunks.push(REUSABLE_UPLOAD_CHUNK.buffer);
        }
    }
    
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    
    // Use XHR for accurate upload progress tracking
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let lastProgressTime = performance.now();
        let lastProgressBytes = 0;
        let transmissionEndTime = null; // Capture when data transmission ends
        
        // Track actual network upload progress
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                byteCounter.bytes = event.loaded;
                lastProgressTime = performance.now();
                lastProgressBytes = event.loaded;
                
                // Log progress for debugging
                const percent = ((event.loaded / event.total) * 100).toFixed(1);
                if (event.loaded === event.total || lastProgressBytes % (1024 * 1024) < (event.loaded % (1024 * 1024))) {
                    console.log(`[Upload] Thread ${threadId} progress: ${percent}% (${event.loaded}/${event.total})`);
                }
            }
        };
        
        xhr.upload.onloadstart = () => {
            console.log(`[Upload] Thread ${threadId} started uploading ${totalSize} bytes`);
        };
        
        xhr.upload.onloadend = () => {
            // Upload transmission complete (before server response)
            // This is the critical timestamp - when data transmission actually ended
            transmissionEndTime = performance.now();
            byteCounter.bytes = totalSize;
            console.log(`[Upload] Thread ${threadId} transmission complete at ${transmissionEndTime.toFixed(2)}ms`);
        };
        
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                byteCounter.bytes = totalSize;
                const serverResponseTime = performance.now() - (transmissionEndTime || performance.now());
                console.log(`[Upload] Thread ${threadId} server response received after ${serverResponseTime.toFixed(2)}ms`);
            } else {
                console.error(`[Upload] Thread ${threadId} failed with status ${xhr.status}`);
            }
            cleanup();
            resolve({ 
                bytes: byteCounter.bytes, 
                transmissionEndTime: transmissionEndTime || performance.now() 
            });
        };
        
        xhr.onerror = () => {
            console.error(`[Upload] Thread ${threadId} network error`);
            cleanup();
            resolve({ 
                bytes: byteCounter.bytes, 
                transmissionEndTime: transmissionEndTime || performance.now() 
            });
        };
        
        abortController.signal.addEventListener('abort', () => {
            try { xhr.abort(); } catch(e) {}
            console.log(`[Upload] Thread ${threadId} aborted`);
            cleanup();
            resolve({ 
                bytes: byteCounter.bytes, 
                transmissionEndTime: transmissionEndTime || performance.now() 
            });
        });
        
        xhr.open('POST', `${CONFIG.apiBase}/api/upload?t=${Date.now()}`, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(blob);
    });
}

// ========================================
// STABILITY DETECTION
// ========================================

function isSpeedStable(samples) {
    if (samples.length < CONFIG.stability.sampleCount) return false;
    
    // Use longer window for more reliable stability detection
    // Analyze up to last 10 samples instead of just 5
    const checkWindow = Math.min(samples.length, CONFIG.stability.checkWindow);
    const recentSamples = samples.slice(-checkWindow);
    
    const avg = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
    const variance = recentSamples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / recentSamples.length;
    
    const isStable = variance < CONFIG.stability.varianceThreshold;
    
    if (isStable) {
        console.log(`[Stability] Detected: variance=${variance.toFixed(4)}, threshold=${CONFIG.stability.varianceThreshold}, window=${checkWindow} samples`);
    }
    
    return isStable;
}

function calculateStability(samples) {
    if (samples.length < 2) return 100;
    
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / samples.length;
    
    // Convert variance to stability score (0-100)
    const stabilityScore = Math.max(0, Math.min(100, (1 - variance * 10) * 100));
    return stabilityScore;
}

// ========================================
// GAUGE VISUALIZATION
// ========================================

function buildMainGauge() {
    console.log('[Gauge] Using CSS-based circular progress gauge');
}

function showGauge() {
    if (DOM.gaugeStartButton) DOM.gaugeStartButton.hidden = true;
    if (DOM.gaugeCircle) DOM.gaugeCircle.hidden = false;
    if (DOM.gaugeInner) DOM.gaugeInner.hidden = false;
}

function hideGauge() {
    if (DOM.gaugeStartButton) DOM.gaugeStartButton.hidden = false;
    if (DOM.gaugeCircle) DOM.gaugeCircle.hidden = true;
    if (DOM.gaugeInner) DOM.gaugeInner.hidden = true;
}

function updateGauge(speed, phase) {
    if (STATE.cancelling) return;
    if (STATE.rafId) return;
    
    STATE.rafId = requestAnimationFrame(() => {
        if (DOM.gaugeValue) DOM.gaugeValue.textContent = speed.toFixed(1);
        if (DOM.gaugePhase) {
            const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
            DOM.gaugePhase.textContent = `Testing ${phaseName}`;
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

function updateMatrixCardLive(phase, speed) {
    const matrixCard = document.querySelector(`.matrix-card[data-metric="${phase}"]`);
    if (matrixCard) {
        const numberEl = matrixCard.querySelector('.matrix-number');
        if (numberEl) {
            numberEl.textContent = speed.toFixed(1);
        }
    }
}

function calculateMaxScale(currentSpeed) {
    if (currentSpeed <= 10) return 10;
    if (currentSpeed <= 25) return 25;
    if (currentSpeed <= 50) return 50;
    if (currentSpeed <= 100) return 100;
    if (currentSpeed <= 250) return 250;
    if (currentSpeed <= 500) return 500;
    if (currentSpeed <= 1000) return 1000;
    return Math.ceil(currentSpeed / 100) * 100;
}

function resetGauge() {
    if (DOM.gaugeValue) DOM.gaugeValue.textContent = '0';
    if (DOM.gaugePhase) DOM.gaugePhase.textContent = 'Ready';
    
    if (DOM.gaugeProgress) {
        DOM.gaugeProgress.style.opacity = '0';
        DOM.gaugeProgress.style.background = '';
    }
    
    STATE.lastMaxScale = 100;
    hideGauge();
}

// ========================================
// UI UPDATES
// ========================================

function updatePhaseUI(phase, status) {
    // Update matrix card with matching data-metric attribute
    const metricCard = document.querySelector(`.matrix-card[data-metric="${phase}"]`);
    if (metricCard) {
        // For active status, set to "measuring" and start progress animation
        if (status === 'active') {
            metricCard.setAttribute('data-status', 'measuring');
            
            // Set animation duration based on phase
            // Note: Download and upload progress is updated directly in their monitor loops
            // for accurate synchronization with actual test progress
            let duration;
            if (phase === 'latency') {
                duration = 3; // Latency is quick (3 pings)
            } else if (phase === 'download') {
                // Progress updated in measureDownload() monitor loop
                duration = null;
            } else if (phase === 'upload') {
                // Progress updated in measureUpload() monitor loop
                duration = null;
            } else if (phase === 'jitter') {
                duration = 0.8; // Jitter calculation is quick
            }
            
            if (duration) {
                // Start animating the border progress (latency and jitter only)
                animateBorderProgress(metricCard, duration * 1000); // Convert to ms
            }
        } else if (status === 'complete') {
            // When complete, set to 100% and fade out
            metricCard.style.setProperty('--progress', '100');
            metricCard.setAttribute('data-status', 'complete');
            
            // Remove measuring status after fade out
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
        
        // Continue animation if not complete and still measuring
        if (progress < 100 && element.getAttribute('data-status') === 'measuring') {
            requestAnimationFrame(updateProgress);
        }
    }
    
    requestAnimationFrame(updateProgress);
}

function resetAllPhases() {
    document.querySelectorAll('.matrix-card[data-metric]').forEach(el => {
        el.setAttribute('data-status', 'not-started');
    });
}

function updateResultCard(type, result) {
    const matrixCard = document.querySelector(`.matrix-card[data-metric="${type}"]`);
    const resultCard = document.querySelector(`.result-card[data-metric="${type}"]`);
    
    switch (type) {
        case 'download':
        case 'upload':
            const speed = result.speed.toFixed(1);
            
            // Update matrix card
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = speed;
            }
            
            // Update detailed card if exists
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
            
            // Update matrix card (latency metric)
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = latency;
            }
            
            // Update detailed card if exists
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
            
            // Update matrix card
            if (matrixCard) {
                const matrixNumber = matrixCard.querySelector('.matrix-number');
                if (matrixNumber) matrixNumber.textContent = jitterValue;
            }
            
            // Update detailed card if exists
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

function clearResultsDisplay() {
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
}

function getSpeedQuality(speed, type) {
    if (type === 'download') {
        if (speed >= 100) return 'Excellent';
        if (speed >= 50) return 'Good';
        if (speed >= 25) return 'Average';
        return 'Slow';
    } else {
        if (speed >= 50) return 'Excellent';
        if (speed >= 25) return 'Good';
        if (speed >= 10) return 'Average';
        return 'Slow';
    }
}

function getLatencyQuality(latency) {
    if (latency <= 20) return 'Excellent';
    if (latency <= 50) return 'Good';
    if (latency <= 100) return 'Average';
    return 'High';
}

function getJitterQuality(jitter) {
    if (jitter <= 5) return 'Excellent';
    if (jitter <= 15) return 'Good';
    if (jitter <= 30) return 'Average';
    return 'Unstable';
}

function setProgress(percent) {
    if (DOM.progressBar) {
        DOM.progressBar.style.width = `${percent}%`;
    }
}

function showStatus(message, type = 'info') {
    if (!DOM.statusBar) return;
    
    DOM.statusBar.setAttribute('data-type', type);
    DOM.statusBar.hidden = false;
    
    if (DOM.statusText) DOM.statusText.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (DOM.statusBar) DOM.statusBar.hidden = true;
    }, 5000);
}

// ========================================
// HISTORY MANAGEMENT
// ========================================

function saveToHistory(result) {
    STATE.history.unshift(result);
    if (STATE.history.length > 50) {
        STATE.history = STATE.history.slice(0, 50);
    }
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
    } catch (error) {
        console.error('[History] Failed to load:', error);
    }
}

function updateHistoryUI() {
    if (!DOM.historyList) return;
    
    if (STATE.history.length === 0) {
        DOM.historyList.innerHTML = '<div style="text-align:center;color:var(--color-text-tertiary);padding:2rem;">No test history yet</div>';
        return;
    }
    
    DOM.historyList.innerHTML = STATE.history.slice(0, 10).map(result => {
        const date = new Date(result.timestamp);
        const timeStr = date.toLocaleString();
        
        return `
            <div class="history-item">
                <div class="history-item-data">
                    <span>⬇ ${result.download.toFixed(1)} Mbps</span>
                    <span>⬆ ${result.upload.toFixed(1)} Mbps</span>
                    <span>🏓 ${result.latency.toFixed(0)} ms</span>
                </div>
                <div class="history-item-time">${timeStr}</div>
            </div>
        `;
    }).join('');
}

function clearHistory() {
    if (!confirm('Clear all test history?')) return;
    
    STATE.history = [];
    localStorage.removeItem('speedtest_history');
    updateHistoryUI();
    showStatus('History cleared', 'info');
    announceToScreenReader('Test history cleared');
}

function exportHistory() {
    if (STATE.history.length === 0) {
        showStatus('No history to export', 'info');
        return;
    }
    
    const csv = [
        'Timestamp,Download (Mbps),Upload (Mbps),Latency (ms),Jitter (ms)',
        ...STATE.history.map(r => 
            `${new Date(r.timestamp).toISOString()},${r.download},${r.upload},${r.latency},${r.jitter}`
        )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speedtest-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showStatus('History exported', 'success');
    announceToScreenReader('Test history exported to CSV file');
}

// ========================================
// ACCESSIBILITY
// ========================================

function initializeAccessibility() {
    DOM.ariaLiveRegion = document.createElement('div');
    DOM.ariaLiveRegion.id = 'ariaLiveRegion';
    DOM.ariaLiveRegion.className = 'sr-only';
    DOM.ariaLiveRegion.setAttribute('role', 'status');
    DOM.ariaLiveRegion.setAttribute('aria-live', 'polite');
    DOM.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(DOM.ariaLiveRegion);
    
    if (STATE.gaugeElement) {
        STATE.gaugeElement.setAttribute('role', 'img');
        STATE.gaugeElement.setAttribute('aria-label', 'Speed gauge showing current test speed');
    }
}

function announceToScreenReader(message) {
    if (DOM.ariaLiveRegion) {
        DOM.ariaLiveRegion.textContent = '';
        setTimeout(() => {
            if (DOM.ariaLiveRegion) DOM.ariaLiveRegion.textContent = message;
        }, 100);
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========================================
// PERFORMANCE MONITORING
// ========================================

/**
 * Start monitoring UI thread responsiveness
 * Detects if main thread is blocked for too long
 */
function startPerformanceMonitoring() {
    if (STATE.performance.monitoring) return;
    
    STATE.performance.monitoring = true;
    STATE.performance.lastCheck = performance.now();
    STATE.performance.blockWarnings = 0;
    STATE.performance.maxBlockTime = 0;
    
    const checkInterval = 250; // Check every 250ms
    const warningThreshold = 500; // Warn if blocked for >500ms
    
    function checkUIThread() {
        if (!STATE.performance.monitoring) return;
        
        const now = performance.now();
        const elapsed = now - STATE.performance.lastCheck;
        
        // If more time elapsed than expected, UI thread was blocked
        const expectedElapsed = checkInterval;
        const blockTime = elapsed - expectedElapsed;
        
        if (blockTime > warningThreshold) {
            STATE.performance.blockWarnings++;
            STATE.performance.maxBlockTime = Math.max(STATE.performance.maxBlockTime, blockTime);
            
            console.warn(`[Performance] UI thread blocked for ${blockTime.toFixed(0)}ms`);
            
            // Show warning to user if blocking is severe
            if (blockTime > 1000 && STATE.performance.blockWarnings <= 3) {
                showPerformanceWarning(blockTime);
            }
        }
        
        STATE.performance.lastCheck = now;
        
        if (STATE.performance.monitoring) {
            setTimeout(checkUIThread, checkInterval);
        }
    }
    
    setTimeout(checkUIThread, checkInterval);
    console.log('[Performance] Monitoring started');
}

/**
 * Stop monitoring UI thread
 */
function stopPerformanceMonitoring() {
    STATE.performance.monitoring = false;
    
    if (STATE.performance.blockWarnings > 0) {
        console.log(`[Performance] Monitoring stopped. Warnings: ${STATE.performance.blockWarnings}, Max block time: ${STATE.performance.maxBlockTime.toFixed(0)}ms`);
    }
}

/**
 * Show performance warning to user
 */
function showPerformanceWarning(blockTime) {
    // Only show warning if test is running
    if (!STATE.testing) return;
    
    // Create a subtle warning notification
    const warning = document.createElement('div');
    warning.className = 'performance-warning';
    warning.textContent = `Performance impact detected (${Math.round(blockTime)}ms delay)`;
    
    document.body.appendChild(warning);
    
    // Remove after 3 seconds
    setTimeout(() => {
        warning.classList.add('hiding');
        setTimeout(() => warning.remove(), 300);
    }, 3000);
}

if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}
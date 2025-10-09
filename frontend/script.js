/**
 * ===========================================
 * SPEEDCHECK PRO - ENHANCED CLIENT
 * ===========================================
 * 
 * Features:
 * - Multi-threaded download & upload with parallel streaming
 * - Adaptive duration with stability detection
 * - Real-time animated Google Fiber-style gauge
 * - Cancel functionality for all operations
 * - Configuration UI with localStorage persistence
 * - Comprehensive error handling with retry logic
 * - Full accessibility support (ARIA, keyboard nav)
 * - Performance optimizations (RAF throttling, debouncing)
 * - Test history with visualization and export
 */

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
        sampleCount: 5,
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
    apiBase: '',
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
    rafId: null
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('[App] Initializing SpeedCheck Pro...');
    
    // Load saved configuration
    loadConfiguration();
    
    // Setup theme
    initializeTheme();
    
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
    
    console.log('[App] Initialization complete');
    announceToScreenReader('SpeedCheck Pro ready. Press the Start Test button to begin.');
}

// ========================================
// THEME MANAGEMENT
// ========================================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    announceToScreenReader(`Theme changed to ${newTheme} mode`);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

// ========================================
// SETTINGS MANAGEMENT
// ========================================

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const isOpen = panel.getAttribute('data-open') === 'true';
    panel.setAttribute('data-open', !isOpen);
    
    if (!isOpen) {
        // Opening: focus first input
        setTimeout(() => {
            document.getElementById('downloadThreads')?.focus();
        }, 300);
        announceToScreenReader('Settings panel opened');
    } else {
        // Closing: return focus to toggle button
        document.querySelector('.settings-toggle')?.focus();
        announceToScreenReader('Settings panel closed');
    }
}

function updateSettingValue(id, value) {
    const displayElement = document.getElementById(id + 'Value');
    if (displayElement) {
        displayElement.textContent = value;
    }
}

function saveSettings() {
    CONFIG.threads.download = parseInt(document.getElementById('downloadThreads').value);
    CONFIG.threads.upload = parseInt(document.getElementById('uploadThreads').value);
    CONFIG.duration.download.default = parseFloat(document.getElementById('downloadDuration').value);
    CONFIG.duration.upload.default = parseFloat(document.getElementById('uploadDuration').value);
    
    localStorage.setItem('config', JSON.stringify(CONFIG));
    showStatus('Settings saved successfully', 'success');
    announceToScreenReader('Settings saved');
}

function resetSettings() {
    // Reset to defaults
    CONFIG.threads.download = 4;
    CONFIG.threads.upload = 4;
    CONFIG.duration.download.default = 8;
    CONFIG.duration.upload.default = 6;
    
    // Update UI
    document.getElementById('downloadThreads').value = CONFIG.threads.download;
    document.getElementById('uploadThreads').value = CONFIG.threads.upload;
    document.getElementById('downloadDuration').value = CONFIG.duration.download.default;
    document.getElementById('uploadDuration').value = CONFIG.duration.upload.default;
    
    updateSettingValue('downloadThreads', CONFIG.threads.download);
    updateSettingValue('uploadThreads', CONFIG.threads.upload);
    updateSettingValue('downloadDuration', CONFIG.duration.download.default);
    updateSettingValue('uploadDuration', CONFIG.duration.upload.default);
    
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
        
        // Populate UI if elements exist - check each individually
        const downloadThreadsEl = document.getElementById('downloadThreads');
        const uploadThreadsEl = document.getElementById('uploadThreads');
        const downloadDurationEl = document.getElementById('downloadDuration');
        const uploadDurationEl = document.getElementById('uploadDuration');
        
        if (downloadThreadsEl) {
            downloadThreadsEl.value = CONFIG.threads.download;
            updateSettingValue('downloadThreads', CONFIG.threads.download);
        }
        if (uploadThreadsEl) {
            uploadThreadsEl.value = CONFIG.threads.upload;
            updateSettingValue('uploadThreads', CONFIG.threads.upload);
        }
        if (downloadDurationEl) {
            downloadDurationEl.value = CONFIG.duration.download.default;
            updateSettingValue('downloadDuration', CONFIG.duration.download.default);
        }
        if (uploadDurationEl) {
            uploadDurationEl.value = CONFIG.duration.upload.default;
            updateSettingValue('uploadDuration', CONFIG.duration.upload.default);
        }
    } catch (error) {
        console.error('[Config] Failed to load configuration:', error);
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function initializeEventListeners() {
    // Theme toggle
    document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Settings panel
    document.querySelector('.settings-toggle')?.addEventListener('click', toggleSettings);
    document.getElementById('settingsClose')?.addEventListener('click', toggleSettings);
    
    // Settings controls
    ['downloadThreads', 'uploadThreads', 'downloadDuration', 'uploadDuration'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => updateSettingValue(id, e.target.value));
            input.addEventListener('change', saveSettings);
        }
    });
    
    document.getElementById('resetSettings')?.addEventListener('click', resetSettings);
    
    // Test controls
    document.getElementById('startTest')?.addEventListener('click', startTest);
    document.getElementById('cancelTest')?.addEventListener('click', cancelTest);
    document.getElementById('gaugeStartButton')?.addEventListener('click', startTest);
    
    // History actions
    document.getElementById('clearHistory')?.addEventListener('click', clearHistory);
    document.getElementById('exportHistory')?.addEventListener('click', exportHistory);
    
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
        const settingsOpen = document.getElementById('settingsPanel')?.getAttribute('data-open') === 'true';
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
        const locationEl = document.getElementById('serverLocation');
        const limitsEl = document.getElementById('serverLimits');
        const infoContainer = document.getElementById('serverInfo');
        
        if (locationEl) {
            locationEl.textContent = STATE.serverInfo.serverLocation || 'Unknown';
        }
        if (limitsEl && STATE.serverInfo.maxDownloadSize) {
            limitsEl.textContent = `${STATE.serverInfo.maxDownloadSize}MB DL / ${STATE.serverInfo.maxUploadSize}MB UL`;
        }
        if (infoContainer) {
            infoContainer.hidden = false;
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
    
    // Show gauge and hide start button
    showGauge();
    
    // Update UI
    const startBtn = document.getElementById('startTest');
    const cancelBtn = document.getElementById('cancelTest');
    if (startBtn) startBtn.disabled = true;
    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.hidden = false;
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
        STATE.testing = false;
        const startBtn = document.getElementById('startTest');
        const cancelBtn = document.getElementById('cancelTest');
        if (startBtn) startBtn.disabled = false;
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.hidden = true;
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

/**
 * Measures latency (ping) to server using multiple samples
 * Returns: { average, min, max, samples }
 */
async function measureLatency() {
    const sampleCount = 10;
    const samples = [];
    const abortController = new AbortController();
    STATE.abortControllers.push(abortController);
    
    announceToScreenReader('Measuring latency');
    
    try {
        for (let i = 0; i < sampleCount; i++) {
            if (STATE.cancelling) break;
            
            const start = performance.now();
            await fetch(`${CONFIG.apiBase}/api/ping?t=${Date.now()}`, {
                signal: abortController.signal,
                cache: 'no-store'
            });
            const duration = performance.now() - start;
            
            samples.push(duration);
            
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
        
        // Calculate jitter
        const jitter = calculateJitter(samples);
        STATE.testResults.jitter = { value: jitter };
        updateResultCard('jitter', { value: jitter });
        
        announceToScreenReader(`Latency measured: ${average.toFixed(1)} milliseconds`);
        
        return { average, min, max, samples };
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[Latency] Measurement aborted');
            return null;
        }
        throw error;
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

/**
 * Measures download speed using multi-threaded parallel streaming
 * Returns: { speed, bytesTransferred, duration, stability }
 */
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
    
    // Launch all download threads (non-blocking)
    const threadPromises = Array.from({ length: threadCount }, (_, i) => 
        downloadThread(i, () => isRunning)
    );
    
    // Accumulate bytes from all threads
    const byteCounters = await Promise.all(threadPromises.map(p => p.then(counter => counter)));
    
    // Monitor loop - runs concurrently with threads
    const monitorLoop = async () => {
        while (isRunning && !STATE.cancelling) {
            await sleep(CONFIG.updateInterval);
            
            const elapsed = performance.now() - startTime;
            
            // Sum bytes from all threads
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);
            
            // Calculate current speed
            const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps
            updateGauge(currentSpeed, 'download');
            
            // Track speed samples for stability check
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;
                const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                
                speedSamples.push(intervalSpeed);
                lastSampleTime = elapsed;
                lastBytes = totalBytes;
                
                // Check for stability after minimum duration
                if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                    const recentSamples = speedSamples.slice(-CONFIG.stability.sampleCount);
                    if (isSpeedStable(recentSamples)) {
                        console.log('[Download] Speed stabilized, stopping early');
                        isRunning = false;
                        break;
                    }
                }
            }
            
            // Stop at max duration
            if (elapsed >= maxDuration) {
                console.log('[Download] Max duration reached');
                isRunning = false;
                break;
            }
            
            // Update progress (25-60% range)
            const progressPercent = 25 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 60));
        }
    };
    
    // Run monitor concurrently
    await monitorLoop();
    
    // Wait for all threads to complete
    await Promise.all(threadPromises);
    
    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = (totalBytes * 8) / duration / 1_000_000;
    
    console.log(`[Download] Completed: ${speedMbps.toFixed(2)} Mbps (${totalBytes} bytes in ${duration.toFixed(2)}s)`);
    announceToScreenReader(`Download speed: ${speedMbps.toFixed(1)} megabits per second`);
    
    return {
        speed: speedMbps,
        bytesTransferred: totalBytes,
        duration,
        stability: calculateStability(speedSamples)
    };
}

/**
 * Individual download thread - streams data and counts bytes
 */
async function downloadThread(threadId, isRunning) {
    const byteCounter = { bytes: 0 };
    const abortController = new AbortController();
    STATE.abortControllers.push(abortController);
    
    try {
        const url = `${CONFIG.apiBase}/api/download?size=${CONFIG.downloadSize}&chunk=${CONFIG.chunkSize}&t=${Date.now()}`;
        const response = await fetch(url, { signal: abortController.signal });
        
        if (!response.ok) throw new Error(`Thread ${threadId} failed: ${response.status}`);
        
        const reader = response.body.getReader();
        
        while (isRunning()) {
            const { done, value } = await reader.read();
            if (done) break;
            
            byteCounter.bytes += value.length;
        }
        
        reader.cancel();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`[Download] Thread ${threadId} aborted`);
        } else {
            console.error(`[Download] Thread ${threadId} error:`, error);
        }
    }
    
    return byteCounter;
}

// ========================================
// UPLOAD MEASUREMENT
// ========================================

/**
 * Measures upload speed using multi-threaded parallel uploads
 * Returns: { speed, bytesTransferred, duration, stability }
 */
async function measureUpload() {
    const threadCount = CONFIG.threads.upload;
    const maxDuration = CONFIG.duration.upload.max * 1000;
    const minDuration = CONFIG.duration.upload.min * 1000;
    
    console.log(`[Upload] Starting with ${threadCount} threads`);
    announceToScreenReader(`Starting upload test with ${threadCount} threads`);
    
    const startTime = performance.now();
    let totalBytes = 0;
    let isRunning = true;
    
    // Speed tracking
    const speedSamples = [];
    let lastSampleTime = startTime;
    let lastBytes = 0;
    
    // Launch all upload threads
    const threadPromises = Array.from({ length: threadCount }, (_, i) => 
        uploadThread(i, () => isRunning)
    );
    
    // Get byte counters
    const byteCounters = await Promise.all(threadPromises.map(p => p.then(counter => counter)));
    
    // Monitor loop
    const monitorLoop = async () => {
        while (isRunning && !STATE.cancelling) {
            await sleep(CONFIG.updateInterval);
            
            const elapsed = performance.now() - startTime;
            
            // Sum bytes from all threads
            totalBytes = byteCounters.reduce((sum, counter) => sum + counter.bytes, 0);
            
            // Calculate current speed
            const currentSpeed = (totalBytes * 8) / (elapsed / 1000) / 1_000_000; // Mbps
            updateGauge(currentSpeed, 'upload');
            
            // Track speed samples
            if (elapsed - lastSampleTime >= 500) {
                const intervalBytes = totalBytes - lastBytes;
                const intervalDuration = (elapsed - lastSampleTime) / 1000;
                const intervalSpeed = (intervalBytes * 8) / intervalDuration / 1_000_000;
                
                speedSamples.push(intervalSpeed);
                lastSampleTime = elapsed;
                lastBytes = totalBytes;
                
                // Check stability
                if (elapsed >= minDuration && speedSamples.length >= CONFIG.stability.sampleCount) {
                    const recentSamples = speedSamples.slice(-CONFIG.stability.sampleCount);
                    if (isSpeedStable(recentSamples)) {
                        console.log('[Upload] Speed stabilized, stopping early');
                        isRunning = false;
                        break;
                    }
                }
            }
            
            // Max duration check
            if (elapsed >= maxDuration) {
                console.log('[Upload] Max duration reached');
                isRunning = false;
                break;
            }
            
            // Update progress (60-95% range)
            const progressPercent = 60 + (elapsed / maxDuration) * 35;
            setProgress(Math.min(progressPercent, 95));
        }
    };
    
    await monitorLoop();
    await Promise.all(threadPromises);
    
    const duration = (performance.now() - startTime) / 1000;
    const speedMbps = (totalBytes * 8) / duration / 1_000_000;
    
    console.log(`[Upload] Completed: ${speedMbps.toFixed(2)} Mbps (${totalBytes} bytes in ${duration.toFixed(2)}s)`);
    announceToScreenReader(`Upload speed: ${speedMbps.toFixed(1)} megabits per second`);
    
    return {
        speed: speedMbps,
        bytesTransferred: totalBytes,
        duration,
        stability: calculateStability(speedSamples)
    };
}

/**
 * Individual upload thread - sends data using XHR for progress tracking
 */
async function uploadThread(threadId, isRunning) {
    const byteCounter = { bytes: 0 };
    const totalSize = CONFIG.uploadSize * 1024 * 1024; // Convert MB to bytes
    
    // Generate random data in chunks (crypto.getRandomValues has 65KB limit)
    const maxChunkSize = 65536; // 64KB max for crypto
    const data = new Uint8Array(totalSize);
    for (let i = 0; i < totalSize; i += maxChunkSize) {
        const chunkSize = Math.min(maxChunkSize, totalSize - i);
        const chunk = new Uint8Array(chunkSize);
        crypto.getRandomValues(chunk);
        data.set(chunk, i);
    }
    
    const abortController = new AbortController();
    STATE.abortControllers.push(abortController);
    
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                byteCounter.bytes = e.loaded;
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(byteCounter);
            } else {
                console.error(`[Upload] Thread ${threadId} failed: ${xhr.status}`);
                resolve(byteCounter);
            }
        });
        
        xhr.addEventListener('error', () => {
            console.error(`[Upload] Thread ${threadId} network error`);
            resolve(byteCounter);
        });
        
        xhr.addEventListener('abort', () => {
            console.log(`[Upload] Thread ${threadId} aborted`);
            resolve(byteCounter);
        });
        
        // Listen for abort signal
        abortController.signal.addEventListener('abort', () => {
            xhr.abort();
        });
        
        // Check if we should still be running periodically
        const checkInterval = setInterval(() => {
            if (!isRunning() || STATE.cancelling) {
                clearInterval(checkInterval);
                xhr.abort();
            }
        }, 100);
        
        xhr.open('POST', `${CONFIG.apiBase}/api/upload?t=${Date.now()}`, true);
        xhr.send(data.buffer);
    });
}

// ========================================
// STABILITY DETECTION
// ========================================

/**
 * Checks if recent speed samples are stable (low variance)
 */
function isSpeedStable(samples) {
    if (samples.length < CONFIG.stability.sampleCount) return false;
    
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, speed) => {
        const diff = (speed - avg) / avg;
        return sum + (diff * diff);
    }, 0) / samples.length;
    
    const isStable = variance < CONFIG.stability.varianceThreshold;
    
    if (isStable) {
        console.log(`[Stability] Detected: variance=${variance.toFixed(4)}, threshold=${CONFIG.stability.varianceThreshold}`);
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
    // Pure CSS gauge - no build needed
    console.log('[Gauge] Using CSS-based circular progress gauge');
}

function showGauge() {
    // Hide start button
    const startButton = document.getElementById('gaugeStartButton');
    if (startButton) startButton.hidden = true;
    
    // Show gauge circle
    const gaugeCircle = document.getElementById('gaugeCircle');
    if (gaugeCircle) gaugeCircle.hidden = false;
}

function hideGauge() {
    // Show start button
    const startButton = document.getElementById('gaugeStartButton');
    if (startButton) startButton.hidden = false;
    
    // Hide gauge circle
    const gaugeCircle = document.getElementById('gaugeCircle');
    if (gaugeCircle) gaugeCircle.hidden = true;
}

function updateGauge(speed, phase) {
    if (STATE.cancelling) return;
    
    // Throttle using RAF
    if (STATE.rafId) return;
    
    STATE.rafId = requestAnimationFrame(() => {
        const value = document.getElementById('gaugeValue');
        const phaseLabel = document.getElementById('gaugePhase');
        const progressRing = document.getElementById('gaugeProgress');
        
        if (value) value.textContent = speed.toFixed(1);
        if (phaseLabel) phaseLabel.textContent = phase.charAt(0).toUpperCase() + phase.slice(1);
        
        // Calculate max scale dynamically
        const maxSpeed = calculateMaxScale(speed);
        
        // Update CSS circular progress
        if (progressRing) {
            const percentage = Math.min(speed / maxSpeed, 1);
            const degrees = percentage * 270; // 270° arc
            
            // Update conic-gradient to show progress
            progressRing.style.background = `conic-gradient(
                from 135deg,
                #3b82f6 0deg,
                #8b5cf6 ${degrees / 2}deg,
                #ec4899 ${degrees}deg,
                transparent ${degrees}deg
            )`;
            progressRing.style.opacity = '1';
        }
        
        STATE.rafId = null;
    });
}

function calculateMaxScale(currentSpeed) {
    // Dynamic scaling similar to Google Fiber
    if (currentSpeed <= 10) return 10;
    if (currentSpeed <= 25) return 25;
    if (currentSpeed <= 50) return 50;
    if (currentSpeed <= 100) return 100;
    if (currentSpeed <= 250) return 250;
    if (currentSpeed <= 500) return 500;
    if (currentSpeed <= 1000) return 1000;
    
    // Round up to next 100
    return Math.ceil(currentSpeed / 100) * 100;
}

function resetGauge() {
    const value = document.getElementById('gaugeValue');
    const phaseLabel = document.getElementById('gaugePhase');
    const progressRing = document.getElementById('gaugeProgress');
    
    if (value) value.textContent = '0';
    if (phaseLabel) phaseLabel.textContent = 'Ready';
    
    // Reset CSS progress
    if (progressRing) {
        progressRing.style.opacity = '0';
        progressRing.style.background = '';
    }
    
    // Reset max scale
    STATE.lastMaxScale = 100;
    
    // Hide gauge and show start button
    hideGauge();
}

// ========================================
// UI UPDATES
// ========================================

function updatePhaseUI(phase, status) {
    const phaseElement = document.querySelector(`[data-phase="${phase}"]`);
    if (phaseElement) {
        phaseElement.setAttribute('data-status', status);
    }
}

function resetAllPhases() {
    document.querySelectorAll('.phase').forEach(el => {
        el.setAttribute('data-status', 'not-started');
    });
}

function updateResultCard(type, result) {
    // Update both matrix card and detailed result card (if exists)
    const matrixCard = document.querySelector(`.matrix-card[data-metric="${type}"]`);
    const resultCard = document.querySelector(`.result-card[data-metric="${type}"]`);
    
    // Animate matrix card
    if (matrixCard) {
        matrixCard.setAttribute('data-status', 'active');
        setTimeout(() => matrixCard.setAttribute('data-status', ''), 500);
    }
    
    // Animate result card if it exists
    if (resultCard) {
        resultCard.setAttribute('data-status', 'active');
        setTimeout(() => resultCard.setAttribute('data-status', ''), 500);
    }
    
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
    // Clear matrix cards
    document.querySelectorAll('.matrix-card').forEach(card => {
        card.setAttribute('data-status', '');
        const matrixNumber = card.querySelector('.matrix-number');
        if (matrixNumber) matrixNumber.textContent = '—';
    });
    
    // Clear detailed result cards if they exist
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
    const progressBar = document.querySelector('.progress-fill');
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
}

function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('statusBar');
    if (!statusBar) return;
    
    statusBar.setAttribute('data-type', type);
    statusBar.hidden = false;
    
    const statusText = statusBar.querySelector('.status-text');
    if (statusText) statusText.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusBar.hidden = true;
    }, 5000);
}

// ========================================
// HISTORY MANAGEMENT
// ========================================

function saveToHistory(result) {
    STATE.history.unshift(result);
    
    // Keep only last 50 results
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
    const container = document.getElementById('historyList');
    if (!container) return;
    
    if (STATE.history.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--color-text-tertiary);padding:2rem;">No test history yet</div>';
        return;
    }
    
    container.innerHTML = STATE.history.slice(0, 10).map(result => {
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
    // Create live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.id = 'ariaLiveRegion';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
    
    // Add ARIA labels to gauge
    if (STATE.gaugeElement) {
        STATE.gaugeElement.setAttribute('role', 'img');
        STATE.gaugeElement.setAttribute('aria-label', 'Speed gauge showing current test speed');
    }
}

function announceToScreenReader(message) {
    const liveRegion = document.getElementById('ariaLiveRegion');
    if (liveRegion) {
        // Clear and set to ensure announcement
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
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

// Initialize Lucide icons when DOM is ready
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

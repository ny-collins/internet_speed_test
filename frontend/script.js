// ===== Configuration =====
// Dynamically determine backend API base URL.
// Priority:
// 1. Explicit global override window.__BACKEND_URL__ (can be injected server-side)
// 2. data-backend-url attribute on <html>
// 3. If current host includes 'localhost' -> use http://localhost:3000
// 4. Fallback to production Railway backend URL
function resolveBackendBase() {
    if (typeof window !== 'undefined') {
        if (window.__BACKEND_URL__) return window.__BACKEND_URL__.replace(/\/$/, '') + '/api';
        const attr = document.documentElement.getAttribute('data-backend-url');
        if (attr) return attr.replace(/\/$/, '') + '/api';
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
    }
    // Railway deployed backend default
    return 'https://speed-test-backend.up.railway.app/api';
}

const CONFIG = {
    API_BASE_URL: resolveBackendBase(),
    PING_COUNT: 10,
    DOWNLOAD_SIZE_MB: 5,
    UPLOAD_SIZE_MB: 2,
    TIMEOUT_MS: 30000
};

// ===== Theme Management =====
const ThemeManager = {
    STORAGE_KEY: 'speed-test-theme',
    
    init() {
        // Check for user preference in localStorage
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        
        if (savedTheme) {
            // User has a saved preference
            this.setTheme(savedTheme);
        } else {
            // Detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
        
        // Listen for system theme changes (only if user hasn't set preference)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    },
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateIcon(theme);
    },
    
    updateIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            // Remove existing icon
            themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
            // Reinitialize icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    },
    
    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Save user preference
        localStorage.setItem(this.STORAGE_KEY, newTheme);
        this.setTheme(newTheme);
    },
    
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme');
    }
};

// ===== State Management =====
const state = {
    testing: false,
    currentTest: null,
    results: {
        download: null,
        upload: null,
        ping: null,
        jitter: null
    },
    info: null
};

// ===== DOM Elements =====
const elements = {
    startButton: document.getElementById('startTest'),
    connectionStatus: document.getElementById('connectionStatus'),
    themeToggle: document.getElementById('themeToggle'),
    progressBar: document.getElementById('progressBar'),
    metricCards: {
        download: document.querySelector('[data-metric="download"]'),
        upload: document.querySelector('[data-metric="upload"]'),
        ping: document.querySelector('[data-metric="ping"]'),
        jitter: document.querySelector('[data-metric="jitter"]')
    },
    serverInfoBar: document.getElementById('serverInfo'),
    serverLocation: document.getElementById('serverLocation'),
    serverVersion: document.getElementById('serverVersion'),
    serverLimits: document.getElementById('serverLimits'),
    historyList: document.getElementById('historyList'),
    copyLastResult: document.getElementById('copyLastResult'),
    copyAllResults: document.getElementById('copyAllResults'),
    clearHistory: document.getElementById('clearHistory')
};

// ===== Utility Functions =====
const utils = {
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    formatNumber: (num, decimals = 2) => {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
    
    showStatus: (message, type = 'info') => {
        elements.connectionStatus.classList.remove('hidden', 'error', 'success');
        elements.connectionStatus.classList.add(type);
        elements.connectionStatus.querySelector('.status-text').textContent = message;
    },
    
    hideStatus: () => {
        elements.connectionStatus.classList.add('hidden');
    },
    
    ensureGauge(metric) {
        const card = elements.metricCards[metric];
        if (!card || card.querySelector('.gauge-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'gauge-wrapper';
        wrapper.setAttribute('data-gauge-metric', metric);
        const radius = 60;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 150 150');
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        track.setAttribute('cx', '75'); track.setAttribute('cy', '75'); track.setAttribute('r', radius);
        track.classList.add('gauge-track');
        const prog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        prog.setAttribute('cx', '75'); prog.setAttribute('cy', '75'); prog.setAttribute('r', radius);
        prog.classList.add('gauge-progress');
        const fullCirc = 2 * Math.PI * radius;
        const visibleFraction = 270/360; // 270° sweep
        const dashArray = fullCirc * visibleFraction;
        const gap = fullCirc - dashArray;
        track.setAttribute('stroke-dasharray', `${dashArray} ${gap}`);
        prog.setAttribute('stroke-dasharray', `${dashArray} ${gap}`);
        track.setAttribute('stroke-dashoffset', (gap/2).toString());
        prog.setAttribute('stroke-dashoffset', (gap/2 + dashArray).toString());
        svg.appendChild(track); svg.appendChild(prog);
        const gaugeDiv = document.createElement('div'); gaugeDiv.className = 'gauge'; gaugeDiv.appendChild(svg);
        const needle = document.createElement('div'); needle.className = 'gauge-needle';
        const cap = document.createElement('div'); cap.className = 'gauge-center-cap';
        const live = document.createElement('div'); live.className = 'gauge-value-live'; live.textContent = '—';
        wrapper.appendChild(gaugeDiv); wrapper.appendChild(needle); wrapper.appendChild(cap); wrapper.appendChild(live);
        card.querySelector('.metric-card-content').prepend(wrapper);
        card._gauge = { prog, needle, live, dashArray, gap, lastValue: 0 };
    },
    gaugeMax(metric, value) {
        if (metric === 'download' || metric === 'upload') {
            const tiers = [10,25,50,100,200,500,1000];
            const v = value || 0;
            for (const t of tiers) if (v <= t) return t;
            return tiers[tiers.length-1];
        }
        if (metric === 'ping') return 200;
        if (metric === 'jitter') return 100;
        return 100;
    },
    animateGauge(metric, rawVal) {
        const card = elements.metricCards[metric];
        if (!card || !card._gauge) return;
        const g = card._gauge;
        const max = utils.gaugeMax(metric, rawVal);
        // Gauge animation notes:
        // - Sweep covers 270 degrees (-135deg to +135deg) for a classic speedometer arc.
        // - gaugeMax() picks a contextual ceiling so the needle uses most of the arc; tweak tiers there.
        // - To change duration, adjust 'duration'. Ease function is symmetric for smooth accel/decel.
        // - Stroke-dashoffset drives arc fill; needle rotation is purely cosmetic.
        const start = g.lastValue || 0;
        const end = Math.min(rawVal, max);
        const startTime = performance.now();
        const duration = 700;
        const ease = t => t < .5 ? 2*t*t : -1 + (4 - 2*t)*t;
        function step(now) {
            const p = Math.min(1, (now - startTime) / duration);
            const v = start + (end - start) * ease(p);
            const ratio = v / max;
            const angle = -135 + 270 * ratio;
            g.needle.style.transform = `translate(-50%, -90%) rotate(${angle}deg)`;
            const offset = g.gap/2 + g.dashArray * (1 - ratio);
            g.prog.setAttribute('stroke-dashoffset', offset.toString());
            g.live.textContent = utils.formatNumber(v, (metric === 'ping' || metric === 'jitter') ? 0 : 1);
            if (p < 1) requestAnimationFrame(step); else { g.lastValue = end; }
        }
        requestAnimationFrame(step);
    },
    updateMetricCard: (metric, value, unit = 'Mbps') => {
        const card = elements.metricCards[metric];
        if (!card) return;
        utils.ensureGauge(metric);
        
        const valueElement = card.querySelector('.metric-value');
        const qualityElement = card.querySelector('.metric-quality');
        const subvalueElement = card.querySelector('.metric-subvalue');
        
        if (value !== null && value !== undefined && value !== 'error') {
            valueElement.textContent = value;
            const numeric = parseFloat(value);
            if (!isNaN(numeric)) utils.animateGauge(metric, numeric);
            
            // Update quality indicator
            const quality = getQualityRating(metric, value);
            if (quality && qualityElement) {
                qualityElement.textContent = quality.label;
                qualityElement.className = `metric-quality ${quality.class}`;
            }
            
            // Update subvalue for jitter
            if (metric === 'jitter' && subvalueElement) {
                const stability = value < 5 ? 'Stable' : value < 15 ? 'Moderate' : 'Unstable';
                subvalueElement.textContent = stability;
            }
        } else if (value === 'error') {
            valueElement.textContent = 'Err';
            const gw = card.querySelector('.gauge-wrapper'); if (gw) gw.classList.add('error');
            if (qualityElement) qualityElement.textContent = '';
            if (subvalueElement) subvalueElement.textContent = '';
            card.classList.add('metric-error');
        } else {
            valueElement.textContent = '—';
            const gw = card.querySelector('.gauge-wrapper'); if (gw) gw.classList.remove('error');
            if (qualityElement) qualityElement.textContent = '';
            if (subvalueElement) subvalueElement.textContent = '';
        }
    },
    
    setActiveCard: (metric) => {
        Object.values(elements.metricCards).forEach(card => {
            card.classList.remove('active');
        });
        
        if (metric && elements.metricCards[metric]) {
            elements.metricCards[metric].classList.add('active');
        }
    },
    saveResultHistory(result) {
        try {
            const key = 'speed-test-history';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.unshift(result); // newest first
            if (existing.length > 50) existing.length = 50; // cap
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) { /* ignore */ }
    },
    loadHistory() {
        try { return JSON.parse(localStorage.getItem('speed-test-history') || '[]'); } catch { return []; }
    },
    renderHistory() {
        if (!elements.historyList) return;
        const history = utils.loadHistory();
        elements.historyList.innerHTML = '';
        history.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.textContent = `${idx + 1}. D:${item.download ?? '-'} U:${item.upload ?? '-'} P:${item.ping ?? '-'} J:${item.jitter ?? '-'} (${item.timestampReadable})`;
            li.title = new Date(item.timestamp).toISOString();
            elements.historyList.appendChild(li);
        });
    },
    copyToClipboard(text) {
        if (navigator.clipboard) return navigator.clipboard.writeText(text);
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(_) {} finally { document.body.removeChild(ta); }
    },
    updateServerInfo(info) {
        if (!info || !elements.serverInfoBar) return;
        elements.serverLocation.textContent = `Location: ${info.serverLocation}`;
        elements.serverVersion.textContent = `Version: ${info.version}`;
        if (info.maxDownloadSize || info.maxUploadSize) {
            elements.serverLimits.textContent = `Limits: ↓ ${info.maxDownloadSize}MB / ↑ ${info.maxUploadSize}MB`;
        }
        elements.serverInfoBar.hidden = false;
    }
};

// ===== Quality Rating System =====
function getQualityRating(metric, value) {
    const ratings = {
        download: [
            { threshold: 100, label: 'Excellent', class: 'excellent' },
            { threshold: 50, label: 'Good', class: 'good' },
            { threshold: 25, label: 'Average', class: 'average' },
            { threshold: 0, label: 'Slow', class: 'slow' }
        ],
        upload: [
            { threshold: 50, label: 'Excellent', class: 'excellent' },
            { threshold: 20, label: 'Good', class: 'good' },
            { threshold: 10, label: 'Average', class: 'average' },
            { threshold: 0, label: 'Slow', class: 'slow' }
        ],
        ping: [
            { threshold: 0, label: 'Excellent', class: 'excellent', max: 20 },
            { threshold: 0, label: 'Good', class: 'good', max: 50 },
            { threshold: 0, label: 'Average', class: 'average', max: 100 },
            { threshold: 0, label: 'High', class: 'high', max: Infinity }
        ],
        jitter: [
            { threshold: 0, label: 'Excellent', class: 'excellent', max: 5 },
            { threshold: 0, label: 'Good', class: 'good', max: 15 },
            { threshold: 0, label: 'Moderate', class: 'average', max: 30 },
            { threshold: 0, label: 'Unstable', class: 'unstable', max: Infinity }
        ]
    };
    
    const metricRatings = ratings[metric];
    if (!metricRatings) return null;
    
    if (metric === 'ping' || metric === 'jitter') {
        // For ping and jitter, lower is better
        for (const rating of metricRatings) {
            if (value < rating.max) {
                return rating;
            }
        }
    } else {
        // For download and upload, higher is better
        for (const rating of metricRatings) {
            if (value >= rating.threshold) {
                return rating;
            }
        }
    }
    
    return metricRatings[metricRatings.length - 1];
}

// ===== API Functions =====
const api = {
    async checkConnection() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/test`, {
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return response.ok;
        } catch (error) {
            console.error('Connection check failed:', error);
            return false;
        }
    },
    
    async measurePing() {
        const measurements = [];
        
        for (let i = 0; i < CONFIG.PING_COUNT; i++) {
            const start = performance.now();
            
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                
                await fetch(`${CONFIG.API_BASE_URL}/ping`, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                const end = performance.now();
                measurements.push(end - start);
            } catch (error) {
                console.error('Ping measurement failed:', error);
                measurements.push(null);
            }
            
            // Small delay between pings
            if (i < CONFIG.PING_COUNT - 1) {
                await utils.delay(100);
            }
        }
        
        // Filter out failed measurements
        const validMeasurements = measurements.filter(m => m !== null);
        
        if (validMeasurements.length === 0) {
            throw new Error('All ping measurements failed');
        }
        
        // Calculate average ping
        const avgPing = validMeasurements.reduce((a, b) => a + b, 0) / validMeasurements.length;
        
        // Calculate jitter (standard deviation)
        const squaredDiffs = validMeasurements.map(m => Math.pow(m - avgPing, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / validMeasurements.length;
        const jitter = Math.sqrt(variance);
        
        return {
            ping: utils.formatNumber(avgPing, 0),
            jitter: utils.formatNumber(jitter, 1)
        };
    },
    
    async measureDownload() {
        const startTime = performance.now();
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
            
            const response = await fetch(
                `${CONFIG.API_BASE_URL}/download?size=${CONFIG.DOWNLOAD_SIZE_MB}`,
                {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Read the entire response
            const blob = await response.blob();
            const endTime = performance.now();
            
            // Calculate speed
            const durationSeconds = (endTime - startTime) / 1000;
            const bitsDownloaded = blob.size * 8;
            const speedMbps = bitsDownloaded / (durationSeconds * 1000000);
            
            return utils.formatNumber(speedMbps, 2);
        } catch (error) {
            console.error('Download test failed:', error);
            throw error;
        }
    },
    
    async measureUpload() {
        // Generate random data for upload
        const uploadSize = CONFIG.UPLOAD_SIZE_MB * 1024 * 1024;
        const data = new Uint8Array(uploadSize);
        // Prefer cryptographically strong fill if available for speed
        if (window.crypto && window.crypto.getRandomValues) {
            // getRandomValues limit is 65536 bytes per call; fill in chunks
            const chunkSize = 65536; // 64KB
            for (let offset = 0; offset < data.length; offset += chunkSize) {
                const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
                window.crypto.getRandomValues(slice);
            }
        } else {
            for (let i = 0; i < uploadSize; i++) data[i] = Math.floor(Math.random() * 256);
        }

        const startTime = performance.now();
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/upload`, {
                method: 'POST',
                body: data,
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                cache: 'no-store',
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            const endTime = performance.now();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Optionally read JSON for server-side computed speed (authoritative)
            let serverReported = null;
            try {
                serverReported = await response.json();
            } catch (e) {
                // ignore parse issues; we'll compute client-side
            }
            
            // Calculate speed
            const durationSeconds = (endTime - startTime) / 1000;
            const bitsUploaded = uploadSize * 8;
            const speedMbps = bitsUploaded / (durationSeconds * 1000000);
            const clientValue = utils.formatNumber(speedMbps, 2);
            if (serverReported && typeof serverReported.speedMbps === 'number') {
                return utils.formatNumber(serverReported.speedMbps, 2);
            }
            return clientValue;
        } catch (error) {
            console.error('Upload test failed:', error);
            throw error;
        }
    }
};

// ===== Main Test Function =====
async function runSpeedTest() {
    if (state.testing) return;
    
    // Reset state
    state.testing = true;
    state.results = {
        download: null,
        upload: null,
        ping: null,
        jitter: null
    };
    
    // Update UI
    elements.startButton.disabled = true;
    elements.startButton.querySelector('.button-text').textContent = 'Testing...';
    utils.hideStatus();
    
    // Reset metric cards
    Object.keys(elements.metricCards).forEach(metric => {
        utils.updateMetricCard(metric, null);
    });
    
    try {
        const phases = ['ping+jitter', 'download', 'upload'];
        let phaseIndex = 0;
        const updateProgress = () => {
            if (!elements.progressBar) return;
            const percent = Math.min(100, Math.round((phaseIndex / phases.length) * 100));
            elements.progressBar.style.width = percent + '%';
        };
        updateProgress();

        // Connection check
        utils.showStatus(`(Prep) Checking connection...`, 'info');

        const connected = await api.checkConnection();
        if (!connected) {
            throw new Error('Cannot connect to test server');
        }
        utils.hideStatus();

        // Ping + Jitter
    phaseIndex = 0; updateProgress();
        utils.showStatus(`(${phaseIndex+1}/${phases.length}) Measuring latency...`, 'info');
        state.currentTest = 'ping';
        utils.setActiveCard('ping');
        try {
            const pingResults = await api.measurePing();
            state.results.ping = pingResults.ping;
            state.results.jitter = pingResults.jitter;
            utils.updateMetricCard('ping', pingResults.ping, 'ms');
            utils.updateMetricCard('jitter', pingResults.jitter, 'ms');
        } catch (e) {
            console.error('Ping/Jitter failed', e);
            utils.updateMetricCard('ping', 'error', 'ms');
            utils.updateMetricCard('jitter', 'error', 'ms');
        }
        await utils.delay(400);

        // Download
    phaseIndex = 1; updateProgress();
        utils.showStatus(`(${phaseIndex+1}/${phases.length}) Testing download speed...`, 'info');
        state.currentTest = 'download';
        utils.setActiveCard('download');
        try {
            const downloadSpeed = await api.measureDownload();
            state.results.download = downloadSpeed;
            utils.updateMetricCard('download', downloadSpeed);
        } catch (e) {
            console.error('Download failed', e);
            utils.updateMetricCard('download', 'error');
        }
        await utils.delay(400);

        // Upload
    phaseIndex = 2; updateProgress();
        utils.showStatus(`(${phaseIndex+1}/${phases.length}) Testing upload speed...`, 'info');
        state.currentTest = 'upload';
        utils.setActiveCard('upload');
        try {
            const uploadSpeed = await api.measureUpload();
            state.results.upload = uploadSpeed;
            utils.updateMetricCard('upload', uploadSpeed);
        } catch (e) {
            console.error('Upload failed', e);
            utils.updateMetricCard('upload', 'error');
        }

        state.currentTest = null;
        utils.setActiveCard(null);
        phaseIndex = phases.length; updateProgress();
        utils.showStatus('Test completed (see any error metrics).', 'success');
        // Persist result summary at end
        const summary = {
            timestamp: Date.now(),
            timestampReadable: new Date().toLocaleString(),
            download: state.results.download,
            upload: state.results.upload,
            ping: state.results.ping,
            jitter: state.results.jitter
        };
        utils.saveResultHistory(summary);
        utils.renderHistory();
        setTimeout(() => utils.hideStatus(), 4000);
    } catch (error) {
        console.error('Speed test fatal error:', error);
        utils.showStatus(`Test aborted: ${error.message}`, 'error');
        utils.setActiveCard(null);
    } finally {
        state.testing = false;
        elements.startButton.disabled = false;
        elements.startButton.querySelector('.button-text').textContent = 'Start Test';
    }
}

// ===== Info Section Accordion =====
function initializeAccordions() {
    const headers = document.querySelectorAll('.info-section-header');
    
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.info-section');
            const isExpanded = section.classList.contains('expanded');
            
            // Toggle current section
            if (isExpanded) {
                section.classList.remove('expanded');
            } else {
                section.classList.add('expanded');
            }
        });
    });
}

// ===== Initialization =====
function init() {
    // Initialize theme
    ThemeManager.init();
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Bind event listeners
    elements.startButton.addEventListener('click', runSpeedTest);
    elements.themeToggle.addEventListener('click', () => ThemeManager.toggle());
    
    // Initialize accordions
    initializeAccordions();
    
    // Fetch server info to adapt (non-blocking)
    fetch(`${CONFIG.API_BASE_URL.replace(/\/$/, '')}/info`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(info => { state.info = info; utils.updateServerInfo(info); })
        .catch(() => {});

    // History & export buttons
    utils.renderHistory();
    if (elements.copyLastResult) {
        elements.copyLastResult.addEventListener('click', () => {
            const history = utils.loadHistory();
            if (history[0]) utils.copyToClipboard(JSON.stringify(history[0], null, 2));
        });
    }
    if (elements.copyAllResults) {
        elements.copyAllResults.addEventListener('click', () => {
            utils.copyToClipboard(JSON.stringify(utils.loadHistory(), null, 2));
        });
    }
    if (elements.clearHistory) {
        elements.clearHistory.addEventListener('click', () => {
            localStorage.removeItem('speed-test-history');
            utils.renderHistory();
        });
    }

    // Check initial connection (non-blocking UI enhancements above)
    api.checkConnection().then(connected => {
        if (!connected) {
            utils.showStatus('Cannot connect to server. Please ensure the backend is running.', 'error');
        }
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

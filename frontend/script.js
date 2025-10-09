// ===== Configuration =====
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
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
    }
};

// ===== DOM Elements =====
const elements = {
    startButton: document.getElementById('startTest'),
    connectionStatus: document.getElementById('connectionStatus'),
    themeToggle: document.getElementById('themeToggle'),
    metricCards: {
        download: document.querySelector('[data-metric="download"]'),
        upload: document.querySelector('[data-metric="upload"]'),
        ping: document.querySelector('[data-metric="ping"]'),
        jitter: document.querySelector('[data-metric="jitter"]')
    }
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
    
    updateMetricCard: (metric, value, unit = 'Mbps') => {
        const card = elements.metricCards[metric];
        if (!card) return;
        
        const valueElement = card.querySelector('.metric-value');
        const qualityElement = card.querySelector('.metric-quality');
        const subvalueElement = card.querySelector('.metric-subvalue');
        
        if (value !== null) {
            valueElement.textContent = value;
            
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
        } else {
            valueElement.textContent = '—';
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
        
        // Fill with random data
        for (let i = 0; i < uploadSize; i++) {
            data[i] = Math.floor(Math.random() * 256);
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
            
            // Calculate speed
            const durationSeconds = (endTime - startTime) / 1000;
            const bitsUploaded = uploadSize * 8;
            const speedMbps = bitsUploaded / (durationSeconds * 1000000);
            
            return utils.formatNumber(speedMbps, 2);
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
        // Check connection first
        utils.showStatus('Checking connection...', 'info');
        const connected = await api.checkConnection();
        
        if (!connected) {
            throw new Error('Cannot connect to test server');
        }
        
        utils.hideStatus();
        
        // Run Ping Test
        utils.showStatus('Measuring latency...', 'info');
        state.currentTest = 'ping';
        utils.setActiveCard('ping');
        
        const pingResults = await api.measurePing();
        state.results.ping = pingResults.ping;
        state.results.jitter = pingResults.jitter;
        
        utils.updateMetricCard('ping', pingResults.ping, 'ms');
        utils.updateMetricCard('jitter', pingResults.jitter, 'ms');
        
        await utils.delay(500);
        
        // Run Download Test
        utils.showStatus('Testing download speed...', 'info');
        state.currentTest = 'download';
        utils.setActiveCard('download');
        
        const downloadSpeed = await api.measureDownload();
        state.results.download = downloadSpeed;
        
        utils.updateMetricCard('download', downloadSpeed);
        
        await utils.delay(500);
        
        // Run Upload Test
        utils.showStatus('Testing upload speed...', 'info');
        state.currentTest = 'upload';
        utils.setActiveCard('upload');
        
        const uploadSpeed = await api.measureUpload();
        state.results.upload = uploadSpeed;
        
        utils.updateMetricCard('upload', uploadSpeed);
        
        // Test complete
        state.currentTest = null;
        utils.setActiveCard(null);
        utils.showStatus('Test completed successfully!', 'success');
        
        setTimeout(() => {
            utils.hideStatus();
        }, 3000);
        
    } catch (error) {
        console.error('Speed test error:', error);
        utils.showStatus(`Test failed: ${error.message}`, 'error');
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
    
    // Check initial connection
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

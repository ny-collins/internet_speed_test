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
    TIMEOUT_MS: 30000,
    DOWNLOAD_THREADS: 4, // parallel streams
    MIN_DOWNLOAD_DURATION_MS: 3500,
    MAX_DOWNLOAD_DURATION_MS: 8000,
    STABILITY_WINDOW_MS: 1200, // window to assess stabilization
    STABILITY_VARIANCE_PCT: 5 // stop early if variance within this percent
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
    
    // Global gauge methods
    buildMainGauge() {
        const container = document.getElementById('mainGaugeContainer');
        if (!container || container._built) return;
        // Gauge design notes:
        // - 270° arc (classic speedometer) using stroke-dasharray with a gap.
        // - Adaptive max scaling during test so needle occupies meaningful range.
        // - Animated via requestAnimationFrame for smoothness (ease in/out).
        const radius = 90;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 220 220');
        // Gradient definition
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const lg = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        lg.setAttribute('id','gaugeGradient');
        lg.setAttribute('x1','0%'); lg.setAttribute('y1','0%');
        lg.setAttribute('x2','100%'); lg.setAttribute('y2','0%');
        const stops = [
            {o: '0%', c: 'var(--color-primary)'},
            {o: '50%', c: 'var(--color-accent)'},
            {o: '100%', c: 'var(--color-success)'}
        ];
        stops.forEach(s => { const st = document.createElementNS('http://www.w3.org/2000/svg','stop'); st.setAttribute('offset', s.o); st.setAttribute('stop-color', s.c); lg.appendChild(st); });
        defs.appendChild(lg); svg.appendChild(defs);
        const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        track.setAttribute('cx','110'); track.setAttribute('cy','110'); track.setAttribute('r', radius);
        track.classList.add('gauge-track');
        const prog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        prog.setAttribute('cx','110'); prog.setAttribute('cy','110'); prog.setAttribute('r', radius);
        prog.classList.add('gauge-progress');
        const fullCirc = 2 * Math.PI * radius;
        const visibleFraction = 270/360;
        const dashArray = fullCirc * visibleFraction;
        const gap = fullCirc - dashArray;
        track.setAttribute('stroke-dasharray', `${dashArray} ${gap}`);
        prog.setAttribute('stroke-dasharray', `${dashArray} ${gap}`);
        track.setAttribute('stroke-dashoffset', (gap/2).toString());
        prog.setAttribute('stroke-dashoffset', (gap/2 + dashArray).toString());
        svg.appendChild(track); svg.appendChild(prog);
        const wrapper = document.createElement('div'); wrapper.className = 'gauge-wrapper main-gauge';
        const gaugeDiv = document.createElement('div'); gaugeDiv.className = 'gauge'; gaugeDiv.appendChild(svg);
        const needle = document.createElement('div'); needle.className = 'gauge-needle';
        const cap = document.createElement('div'); cap.className = 'gauge-center-cap';
        const live = document.createElement('div'); live.className = 'gauge-value-live'; live.textContent = '—';
        const label = document.createElement('div'); label.className = 'gauge-phase-label'; label.textContent = '';
        // Zone band overlay
        const zoneBand = document.createElement('div'); zoneBand.className = 'gauge-zone-band';
        // Ticks (every 10 degrees inside 270 sweep). Sweep from -135 to +135.
        const tickContainer = document.createElement('div'); tickContainer.className = 'gauge-ticks';
        const totalSweep = 270;
        const startAngle = -135;
        for (let i=0;i<=27;i++) { // 0..27 inclusive (every 10 degrees)
            const deg = startAngle + (totalSweep/27)*i;
            const tick = document.createElement('div');
            const strong = i % 3 === 0; // every 30 degrees stronger
            tick.className = strong ? 'gauge-tick-strong' : 'gauge-tick';
            tick.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
            tickContainer.appendChild(tick);
            if (strong) {
                const lbl = document.createElement('div');
                lbl.className = 'gauge-scale-label';
                lbl.textContent = i === 0 ? '0' : '';
                lbl.style.left = '50%';
                lbl.style.top = '50%';
                const r = 102; // radius for labels
                const rad = (deg*Math.PI)/180;
                const x = Math.cos(rad)*r;
                const y = Math.sin(rad)*r;
                lbl.style.transform = `translate(${x}px, ${y}px)`;
                tickContainer.appendChild(lbl);
            }
        }
        wrapper.appendChild(gaugeDiv); wrapper.appendChild(needle); wrapper.appendChild(cap); wrapper.appendChild(live); wrapper.appendChild(label);
        wrapper.appendChild(zoneBand); wrapper.appendChild(tickContainer);
        container.appendChild(wrapper);
        container._built = true;
        // Store references for dynamic scale labels we will create now
        const scaleLabels = { zero: null, mid: null, max: null };
        // Create mid & max labels (initial placement approximated; updated on rescale)
        const mkLabel = (cls) => { const el = document.createElement('div'); el.className = 'gauge-scale-label '+cls; tickContainer.appendChild(el); return el; };
        scaleLabels.zero = Array.from(tickContainer.querySelectorAll('.gauge-scale-label')).find(el=>el.textContent==='0');
        scaleLabels.mid = mkLabel('gauge-scale-label-mid');
        scaleLabels.max = mkLabel('gauge-scale-label-max');
        container._gauge = { prog, needle, live, label, dashArray, gap, lastValue: 0, max: 100, scaleLabels };
    },
    setGaugePhase(phase) {
        const container = document.getElementById('mainGaugeContainer');
        if (!container?._gauge) return;
        const g = container._gauge;
        if (phase === 'download') g.label.textContent = 'Download';
        else if (phase === 'upload') g.label.textContent = 'Upload';
        else g.label.textContent = '';
        if (phase === 'download' || phase === 'upload') {
            container.removeAttribute('aria-hidden');
        } else {
            container.setAttribute('aria-hidden','true');
        }
    },
    animateMainGauge(rawVal) {
        const container = document.getElementById('mainGaugeContainer');
        if (!container?._gauge) return;
        const g = container._gauge;
        // Adaptive scaling
        if (rawVal > g.max * 0.95) {
            const tiers = [50,100,200,500,1000,2000,5000];
            for (const t of tiers) { if (rawVal <= t) { g.max = t; break; } }
            // Update scale labels (0, mid, max) positions & text after rescale
            if (g.scaleLabels) {
                const { zero, mid, max } = g.scaleLabels;
                const place = (el, frac, text) => {
                    if (!el) return;
                    const startAngle = -135; const sweep = 270; const ang = (startAngle + sweep * frac) * Math.PI/180;
                    const r = 102; const x = Math.cos(ang)*r; const y = Math.sin(ang)*r;
                    el.style.transform = `translate(${x}px, ${y}px)`; el.textContent = text;
                };
                place(zero, 0, '0');
                place(mid, 0.5, g.max >= 1000 ? (g.max/2 >= 1000 ? (g.max/2000)+'G' : (g.max/2)) : g.max/2);
                place(max, 1, g.max >= 1000 ? (g.max/1000)+'G' : g.max);
            }
        }
        const start = g.lastValue || 0;
        const end = Math.min(rawVal, g.max);
        const startTime = performance.now();
        const duration = 400;
        const ease = t => t<.5? 2*t*t : -1 + (4 - 2*t)*t;
        function step(now) {
            const p = Math.min(1, (now - startTime) / duration);
            const v = start + (end - start) * ease(p);
            const ratio = v / g.max;
            const angle = -135 + 270 * ratio;
            g.needle.style.transform = `translate(-50%, -90%) rotate(${angle}deg)`;
            const offset = g.gap/2 + g.dashArray * (1 - ratio);
            g.prog.setAttribute('stroke-dashoffset', offset.toString());
            g.live.textContent = utils.formatNumber(v, 1);
            if (p < 1) requestAnimationFrame(step); else { g.lastValue = end; }
        }
        requestAnimationFrame(step);
    },
    resetMainGauge() {
        const container = document.getElementById('mainGaugeContainer');
        if (!container?._gauge) return;
        const g = container._gauge;
        g.lastValue = 0; g.max = 100; g.live.textContent = '—';
        g.needle.style.transform = 'translate(-50%, -90%) rotate(-135deg)';
        g.prog.setAttribute('stroke-dashoffset', (g.gap/2 + g.dashArray).toString());
    },
    updateMetricCard: (metric, value, unit = 'Mbps') => {
        const card = elements.metricCards[metric];
        if (!card) return;
    // Per-metric gauges removed; single global gauge shown during active transfer phases.
        
        const valueElement = card.querySelector('.metric-value');
        const qualityElement = card.querySelector('.metric-quality');
        const subvalueElement = card.querySelector('.metric-subvalue');
        
        if (value !== null && value !== undefined && value !== 'error') {
            valueElement.textContent = value;
            // Numeric animation handled by main gauge only for current phase.
            
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
        // MULTI-THREAD STREAMING DOWNLOAD METHODOLOGY
        // - Launch N parallel fetch streams to better saturate high-bandwidth connections and reduce single TCP slow-start impact.
        // - Start timer at first chunk across all threads.
        // - Continuously aggregate total bytes and compute moving average throughput.
        // - Run for at least MIN_DOWNLOAD_DURATION_MS; allow early stop if recent variance < STABILITY_VARIANCE_PCT over STABILITY_WINDOW_MS.
        // - Hard stop at MAX_DOWNLOAD_DURATION_MS.
        utils.buildMainGauge();
        utils.setGaugePhase('download');
        const threads = CONFIG.DOWNLOAD_THREADS;
        const targetMBPerThread = Math.max(CONFIG.DOWNLOAD_SIZE_MB, 10); // each thread target baseline size
        const controllers = [];
        const readers = [];
        const states = Array.from({length: threads}, () => ({ bytes:0, done:false }));
        let firstChunkTime = null;
        const samples = []; // {t, mbps}
        let aggBytes = 0;
        const startWall = performance.now();
        const minDuration = CONFIG.MIN_DOWNLOAD_DURATION_MS;
        const maxDuration = CONFIG.MAX_DOWNLOAD_DURATION_MS;
        const stabilityWindow = CONFIG.STABILITY_WINDOW_MS;
        const variancePct = CONFIG.STABILITY_VARIANCE_PCT;
        let stopped = false;
        const launchThread = async (i) => {
            const controller = new AbortController();
            controllers.push(controller);
            try {
                const resp = await fetch(`${CONFIG.API_BASE_URL}/download?size=${targetMBPerThread}`, { cache:'no-store', signal: controller.signal });
                if (!resp.ok || !resp.body) throw new Error('Thread HTTP '+resp.status);
                const reader = resp.body.getReader();
                readers.push(reader);
                while (!stopped) {
                    const {done, value} = await reader.read();
                    if (done) { states[i].done = true; break; }
                    if (value) {
                        if (!firstChunkTime) firstChunkTime = performance.now();
                        states[i].bytes += value.length;
                        aggBytes += value.length;
                    }
                }
            } catch(e) {
                states[i].done = true; // mark as done on error
            }
        };
        // Launch all threads concurrently
        await Promise.all(Array.from({length: threads}, (_,i)=>launchThread(i)));
        // Real-time monitor loop
        const monitor = async () => {
            while (!stopped) {
                await utils.delay(120);
                if (!firstChunkTime) continue;
                const now = performance.now();
                const elapsed = (now - firstChunkTime)/1000;
                if (elapsed <= 0) continue;
                const bits = aggBytes * 8;
                const mbps = bits / (elapsed * 1_000_000);
                samples.push({t: now, v: mbps});
                // Keep last 50 samples
                if (samples.length > 50) samples.shift();
                // Compute moving average last ~600ms
                const recent = samples.filter(s => now - s.t <= 600);
                if (recent.length) {
                    const avg = recent.reduce((a,b)=>a+b.v,0)/recent.length;
                    utils.animateMainGauge(avg);
                }
                const totalElapsedMs = now - startWall;
                if (totalElapsedMs >= minDuration) {
                    // Stability check over stabilityWindow
                    const windowSamples = samples.filter(s => now - s.t <= stabilityWindow);
                    if (windowSamples.length >= 5) {
                        const vals = windowSamples.map(s=>s.v);
                        const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
                        const min = Math.min(...vals), max = Math.max(...vals);
                        const spread = ((max - min)/mean)*100;
                        if (spread <= variancePct) {
                            stopped = true; break;
                        }
                    }
                }
                if (totalElapsedMs >= maxDuration) { stopped = true; break; }
            }
        };
        await monitor();
        // Abort any still-running fetches
        controllers.forEach(c=>{ try { c.abort(); } catch(_) {} });
        const end = performance.now();
        if (!firstChunkTime) throw new Error('No data received');
        const durationSeconds = (end - firstChunkTime)/1000;
        if (durationSeconds <= 0) throw new Error('Invalid duration');
        const bits = aggBytes * 8;
        const finalMbps = bits / (durationSeconds * 1_000_000);
        return utils.formatNumber(finalMbps, 2);
    },
    
    async measureUpload() {
        // UPLOAD TEST METHODOLOGY
        // 1. Pre-generate random payload (>=5MB) to avoid generation cost mid-transfer.
        // 2. Use XMLHttpRequest for upload progress events (fetch lacks granular upload progress in most browsers).
        // 3. Start timing at first progress event (first bytes leaving) vs open time.
        // 4. Gauge updates use smoothed moving average of latest Mbps.
        // 5. Prefer server's computed speed if available (authoritative, measured post-receipt).
        // Adaptive size: ensure enough data to reach steady state (min ~3s if possible)
        const targetMB = Math.max(CONFIG.UPLOAD_SIZE_MB, 5); // bump to at least 5MB for better sampling
        const uploadSize = targetMB * 1024 * 1024;
        const data = new Uint8Array(uploadSize);
        if (window.crypto?.getRandomValues) {
            const chunkSize = 65536;
            for (let offset = 0; offset < data.length; offset += chunkSize) {
                window.crypto.getRandomValues(data.subarray(offset, Math.min(offset + chunkSize, data.length)));
            }
        } else {
            for (let i = 0; i < uploadSize; i++) data[i] = (Math.random() * 256) | 0;
        }
        return await new Promise((resolve, reject) => {
            utils.buildMainGauge();
            utils.setGaugePhase('upload');
            const xhr = new XMLHttpRequest();
            let startTime = null;
            let lastBytes = 0;
            const samples = [];
            xhr.open('POST', `${CONFIG.API_BASE_URL}/upload`);
            xhr.timeout = CONFIG.TIMEOUT_MS;
            xhr.responseType = 'json';
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    if (!startTime) startTime = performance.now();
                    const now = performance.now();
                    const bytes = e.loaded;
                    const elapsed = (now - startTime) / 1000;
                    if (elapsed > 0) {
                        const bits = bytes * 8;
                        const mbps = bits / (elapsed * 1_000_000);
                        samples.push(mbps);
                        const recent = samples.slice(-5);
                        const avg = recent.reduce((a,b)=>a+b,0)/recent.length;
                        utils.animateMainGauge(avg);
                    }
                    lastBytes = bytes;
                }
            };
            xhr.onerror = () => reject(new Error('Upload network error'));
            xhr.ontimeout = () => reject(new Error('Upload timeout'));
            xhr.onload = () => {
                try {
                    const end = performance.now();
                    const effectiveStart = startTime || (end - 1); // fallback
                    const durationSeconds = (end - effectiveStart) / 1000;
                    const bitsUploaded = uploadSize * 8;
                    const speedMbps = bitsUploaded / (durationSeconds * 1_000_000);
                    // Prefer server authoritative speed if present
                    const serverReported = (xhr.response && typeof xhr.response.speedMbps === 'number') ? xhr.response.speedMbps : null;
                    resolve(utils.formatNumber(serverReported ?? speedMbps, 2));
                } catch (e) {
                    reject(e);
                }
            };
            xhr.send(data);
        });
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
    
    // Build & reset global gauge
    utils.buildMainGauge();
    utils.resetMainGauge();
    utils.setGaugePhase(null);

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
    utils.setGaugePhase(null); // hide gauge during latency phase
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
        utils.setGaugePhase('download');
        try {
            const downloadSpeed = await api.measureDownload();
            state.results.download = downloadSpeed;
            utils.updateMetricCard('download', downloadSpeed);
            const numeric = parseFloat(downloadSpeed); if (!isNaN(numeric)) utils.animateMainGauge(numeric);
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
        utils.setGaugePhase('upload');
        try {
            const uploadSpeed = await api.measureUpload();
            state.results.upload = uploadSpeed;
            utils.updateMetricCard('upload', uploadSpeed);
            const numeric = parseFloat(uploadSpeed); if (!isNaN(numeric)) utils.animateMainGauge(numeric);
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

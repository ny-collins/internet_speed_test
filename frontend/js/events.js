// ========================================
// EVENT HANDLERS
// ========================================

import { DOM } from './dom.js';
import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { showStatus, announceToScreenReader } from './ui.js';

// We will export the startTest and cancelTest functions so main.js can pass them in
// because they depend on the test logic modules (circular dependency avoidance)
let startTestFn;
let cancelTestFn;
let clearHistoryFn;
let exportHistoryFn;

export function registerTestFunctions(start, cancel, clear, exportHist) {
    startTestFn = start;
    cancelTestFn = cancel;
    clearHistoryFn = clear;
    exportHistoryFn = exportHist;
}

export function initializeEventListeners() {
    // Theme
    DOM.themeToggleSwitch?.addEventListener('click', toggleTheme);
    const headerThemeToggle = document.getElementById('themeToggle'); // From header
    headerThemeToggle?.addEventListener('click', toggleTheme);

    // Settings Panel
    DOM.settingsToggle?.addEventListener('click', toggleSettings);
    DOM.settingsClose?.addEventListener('click', toggleSettings);

    // Settings Controls
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

    if (DOM.ispPlanSpeed) {
        DOM.ispPlanSpeed.addEventListener('input', (e) => {
            updateSettingValue('ispPlanSpeed', e.target.value + ' Mbps');
        });
        DOM.ispPlanSpeed.addEventListener('change', saveSettings);
    }

    DOM.resetSettings?.addEventListener('click', resetSettings);

    // Test Controls
    DOM.startTest?.addEventListener('click', () => startTestFn());
    DOM.cancelTest?.addEventListener('click', () => cancelTestFn());
    DOM.gaugeStartButton?.addEventListener('click', () => startTestFn());

    // History Actions
    DOM.clearHistory?.addEventListener('click', () => clearHistoryFn());
    DOM.exportHistory?.addEventListener('click', () => exportHistoryFn());

    // Keyboard
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Sidebar (if present)
    initializeTabNavigation();
    
    // Footer toggle
    const footerToggleBtn = document.getElementById('footerToggleBtn');
    const footerInfoGrid = document.getElementById('footerInfoGrid');
    const footerToggleText = document.getElementById('footerToggleText');
    
    if (footerToggleBtn && footerInfoGrid && footerToggleText) {
        footerToggleBtn.addEventListener('click', () => {
            const isCollapsed = footerInfoGrid.classList.contains('collapsed');
            
            if (isCollapsed) {
                footerInfoGrid.classList.remove('collapsed');
                footerToggleText.textContent = 'Show Less';
            } else {
                footerInfoGrid.classList.add('collapsed');
                footerToggleText.textContent = 'Show More Information';
            }
        });
    }
    
    // Help modal
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpModal');
    
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.hidden = true;
        });
    }
    
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) helpModal.hidden = true;
        });
    }
    
    // Share modal
    const shareModal = document.getElementById('shareModal');
    const closeShareBtn = document.getElementById('closeShareModal');
    const shareResultBtn = document.getElementById('shareResultBtn');
    
    if (shareResultBtn) {
        shareResultBtn.addEventListener('click', openShareModal);
    }
    
    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', () => {
            if (shareModal) shareModal.hidden = true;
        });
    }
    
    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) shareModal.hidden = true;
        });
    }
    
    // Share options
    document.getElementById('copyLinkBtn')?.addEventListener('click', copyResultLink);
    document.getElementById('downloadImageBtn')?.addEventListener('click', downloadResultImage);
    document.getElementById('copyTextBtn')?.addEventListener('click', copyResultText);
    
    // Initialize Lucide icons after all DOM updates
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 100);
}

// --- Settings Logic ---

function toggleSettings() {
    if (!DOM.settingsPanel || !DOM.settingsToggle) return;
    const isOpen = DOM.settingsPanel.getAttribute('data-open') === 'true';
    DOM.settingsPanel.setAttribute('data-open', !isOpen);
    DOM.settingsToggle.setAttribute('aria-expanded', !isOpen);

    if (!isOpen) {
        setTimeout(() => DOM.downloadThreads?.focus(), 300);
        announceToScreenReader('Settings panel opened');
    } else {
        DOM.settingsToggle?.focus();
        announceToScreenReader('Settings panel closed');
    }
}

function updateSettingValue(id, value) {
    const displayElement = document.getElementById(id + 'Value');
    if (displayElement) displayElement.textContent = value;
}

async function saveSettings() {
    if (!DOM.downloadThreads || !DOM.maxDuration) return;

    const threads = parseInt(DOM.downloadThreads.value);
    const maxDur = parseFloat(DOM.maxDuration.value);
    const ispSpeed = DOM.ispPlanSpeed ? parseInt(DOM.ispPlanSpeed.value) : 100;

    CONFIG.threads.download = threads;
    CONFIG.threads.upload = threads;
    CONFIG.duration.download.max = maxDur;
    CONFIG.duration.download.default = maxDur;
    CONFIG.duration.upload.max = Math.max(3, maxDur - 2);
    CONFIG.duration.upload.default = CONFIG.duration.upload.max;
    CONFIG.ispPlanSpeed = ispSpeed;

    localStorage.setItem('config', JSON.stringify(CONFIG));
    
    // Update config summary
    if (typeof window.updateConfigSummary === 'function') {
        window.updateConfigSummary();
    }
    
    showStatus('Settings saved', 'success');
    announceToScreenReader('Settings saved');
}

function resetSettings() {
    CONFIG.threads.download = 4;
    CONFIG.threads.upload = 4;
    CONFIG.duration.download.max = 10;
    CONFIG.duration.download.default = 10;
    CONFIG.duration.upload.max = 10;
    CONFIG.duration.upload.default = 10;
    CONFIG.ispPlanSpeed = 100;

    if (DOM.downloadThreads) DOM.downloadThreads.value = CONFIG.threads.download;
    if (DOM.maxDuration) DOM.maxDuration.value = CONFIG.duration.download.max;
    if (DOM.ispPlanSpeed) DOM.ispPlanSpeed.value = CONFIG.ispPlanSpeed;

    updateSettingValue('downloadThreads', CONFIG.threads.download);
    updateSettingValue('maxDuration', CONFIG.duration.download.max + 's');
    updateSettingValue('ispPlanSpeed', CONFIG.ispPlanSpeed + ' Mbps');

    localStorage.removeItem('config');
    showStatus('Settings reset to defaults', 'info');
    announceToScreenReader('Settings reset to defaults');
}

export function loadConfiguration() {
    try {
        const saved = localStorage.getItem('config');
        if (saved) {
            const savedConfig = JSON.parse(saved);
            Object.assign(CONFIG, savedConfig);
        }

        if (DOM.downloadThreads) {
            DOM.downloadThreads.value = CONFIG.threads.download;
            updateSettingValue('downloadThreads', CONFIG.threads.download);
        }
        if (DOM.maxDuration) {
            DOM.maxDuration.value = CONFIG.duration.download.max;
            updateSettingValue('maxDuration', CONFIG.duration.download.max + 's');
        }
        if (DOM.ispPlanSpeed) {
            DOM.ispPlanSpeed.value = CONFIG.ispPlanSpeed || 100;
            updateSettingValue('ispPlanSpeed', (CONFIG.ispPlanSpeed || 100) + ' Mbps');
        }
    } catch (error) {
        console.error('[Config] Failed to load configuration:', error);
    }
}

// --- Theme Logic ---

export function initializeTheme() {
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
    if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(`Theme changed to ${newTheme} mode`);
    }
}

function updateThemeIcon(theme) {
    const themeIcons = document.querySelectorAll('.theme-icon');
    const iconName = theme === 'dark' ? 'sun' : 'moon';
    themeIcons.forEach(icon => icon.setAttribute('data-lucide', iconName));
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Keyboard & Sidebar ---

function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Show help modal on '?'
    if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        const helpModal = document.getElementById('helpModal');
        if (helpModal) helpModal.hidden = false;
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        if (!STATE.testing) startTestFn();
    }

    if (e.key === 'Escape') {
        // Close modals first
        const helpModal = document.getElementById('helpModal');
        const shareModal = document.getElementById('shareModal');
        
        if (helpModal && !helpModal.hidden) {
            helpModal.hidden = true;
            return;
        }
        
        if (shareModal && !shareModal.hidden) {
            shareModal.hidden = true;
            return;
        }
        
        const settingsOpen = DOM.settingsPanel?.getAttribute('data-open') === 'true';
        if (settingsOpen) {
            toggleSettings();
        } else if (STATE.testing) {
            cancelTestFn();
        }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        toggleSettings();
    }
}

function initializeTabNavigation() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
    const contentSections = document.querySelectorAll('.content-section');

    if (!sidebar || !sidebarToggle) return;

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

    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    function switchSection(sectionId) {
        sidebarLinks.forEach(link => link.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));

        const targetSection = document.getElementById(sectionId);
        const targetLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);

        if (targetSection) {
            targetSection.classList.add('active');
            if (targetLink) targetLink.classList.add('active');
            history.replaceState(null, null, `#${sectionId}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

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

    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        switchSection(hash);
    } else {
        switchSection('speed-testing');
    }

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash && document.getElementById(hash)) {
            switchSection(hash);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

// === Share Functionality ===

function openShareModal() {
    const shareModal = document.getElementById('shareModal');
    if (shareModal) {
        shareModal.hidden = false;
        // Reinitialize icons in the modal
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 50);
    }
}

function copyResultLink() {
    const results = STATE.testResults;
    const params = new URLSearchParams({
        d: results.download?.speed?.toFixed(1) || 0,
        u: results.upload?.speed?.toFixed(1) || 0,
        l: results.latency?.average?.toFixed(0) || 0,
        j: results.jitter?.value?.toFixed(1) || 0
    });
    
    const url = `${window.location.origin}?${params.toString()}`;
    
    navigator.clipboard.writeText(url).then(() => {
        showStatus('Link copied to clipboard!', 'success');
    }).catch(() => {
        showStatus('Failed to copy link', 'error');
    });
}

function downloadResultImage() {
    // Create a canvas with result card
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1200;
    canvas.height = 630;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SpeedCheck Results', canvas.width / 2, 100);
    
    // Results
    const results = STATE.testResults;
    ctx.font = '32px system-ui';
    ctx.fillStyle = '#cbd5e1';
    
    const y = 250;
    const spacing = 80;
    
    ctx.fillText(`Download: ${results.download?.speed?.toFixed(1) || 0} Mbps`, canvas.width / 2, y);
    ctx.fillText(`Upload: ${results.upload?.speed?.toFixed(1) || 0} Mbps`, canvas.width / 2, y + spacing);
    ctx.fillText(`Latency: ${results.latency?.average?.toFixed(0) || 0} ms`, canvas.width / 2, y + spacing * 2);
    ctx.fillText(`Jitter: ${results.jitter?.value?.toFixed(1) || 0} ms`, canvas.width / 2, y + spacing * 3);
    
    // Date
    ctx.font = '24px system-ui';
    ctx.fillStyle = '#64748b';
    ctx.fillText(new Date().toLocaleString(), canvas.width / 2, canvas.height - 50);
    
    // Download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speedtest-result-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Image downloaded!', 'success');
    });
}

function copyResultText() {
    const results = STATE.testResults;
    const text = `SpeedCheck Results
━━━━━━━━━━━━━━━━━━━━
Download: ${results.download?.speed?.toFixed(1) || 0} Mbps
Upload: ${results.upload?.speed?.toFixed(1) || 0} Mbps
Latency: ${results.latency?.average?.toFixed(0) || 0} ms
Jitter: ${results.jitter?.value?.toFixed(1) || 0} ms

Server: Amsterdam, Netherlands
Tested: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━`;
    
    navigator.clipboard.writeText(text).then(() => {
        showStatus('Results copied to clipboard!', 'success');
    }).catch(() => {
        showStatus('Failed to copy results', 'error');
    });
}

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

function saveSettings() {
    if (!DOM.downloadThreads || !DOM.maxDuration) return;
    
    const threads = parseInt(DOM.downloadThreads.value);
    const maxDur = parseFloat(DOM.maxDuration.value);
    
    CONFIG.threads.download = threads;
    CONFIG.threads.upload = threads;
    CONFIG.duration.download.max = maxDur;
    CONFIG.duration.download.default = maxDur;
    CONFIG.duration.upload.max = Math.max(3, maxDur - 2);
    CONFIG.duration.upload.default = CONFIG.duration.upload.max;
    
    localStorage.setItem('config', JSON.stringify(CONFIG));
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
    
    if (DOM.downloadThreads) DOM.downloadThreads.value = CONFIG.threads.download;
    if (DOM.maxDuration) DOM.maxDuration.value = CONFIG.duration.download.max;
    
    updateSettingValue('downloadThreads', CONFIG.threads.download);
    updateSettingValue('maxDuration', CONFIG.duration.download.max + 's');
    
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
    
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        if (!STATE.testing) startTestFn();
    }
    
    if (e.key === 'Escape') {
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

// ========================================
// DOM ELEMENTS
// ========================================

export const DOM = {
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

export function queryDOMElements() {
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


export const DOM = {
    themeToggleSwitch: null,
    settingsToggle: null,
    settingsPanel: null,
    settingsClose: null,

    downloadThreads: null,
    downloadThreadsValue: null,
    maxDuration: null,
    maxDurationValue: null,
    resetSettings: null,

    cancelTest: null,
    retryTest: null,
    gaugeStartButton: null,

    gaugeCircle: null,
    gaugeInner: null,
    gaugeProgress: null,
    gaugeValue: null,
    gaugeUnit: null,
    gaugePhase: null,

    splitLayout: null,
    downloadMiniGraph: null,
    uploadMiniGraph: null,

    resultsMatrix: null,

    serverLocation: null,
    serverLimits: null,
    serverInfo: null,

    progressBar: null,
    statusBar: null,
    statusText: null,
    testTimer: null,
    timerValue: null,

    historyList: null,
    clearHistory: null,
    exportHistory: null,

    ariaLiveRegion: null
};

export function queryDOMElements() {
    DOM.themeToggleSwitch = document.getElementById('themeToggleSwitch');
    DOM.settingsToggle = document.querySelector('.settings-toggle');
    DOM.settingsPanel = document.getElementById('settingsPanel');
    DOM.settingsClose = document.getElementById('settingsClose');

    DOM.downloadThreads = document.getElementById('downloadThreads');
    DOM.downloadThreadsValue = document.getElementById('downloadThreadsValue');
    DOM.maxDuration = document.getElementById('maxDuration');
    DOM.maxDurationValue = document.getElementById('maxDurationValue');
    DOM.resetSettings = document.getElementById('resetSettings');

    DOM.cancelTest = document.getElementById('cancelTest');
    DOM.retryTest = document.getElementById('retryTest');
    DOM.gaugeStartButton = document.getElementById('gaugeStartButton');

    DOM.gaugeCircle = document.getElementById('gaugeCircle');
    DOM.gaugeInner = document.getElementById('gaugeInner');
    DOM.gaugeProgress = document.getElementById('gaugeProgress');
    DOM.gaugeValue = document.getElementById('gaugeValue');
    DOM.gaugeUnit = document.getElementById('gaugeUnit');
    DOM.gaugePhase = document.getElementById('gaugePhase');

    DOM.splitLayout = document.getElementById('splitLayout');
    DOM.downloadMiniGraph = document.getElementById('downloadMiniGraph');
    DOM.uploadMiniGraph = document.getElementById('uploadMiniGraph');

    DOM.resultsMatrix = document.getElementById('resultsMatrix');

    DOM.serverLocation = document.getElementById('serverLocation');
    DOM.serverLimits = document.getElementById('serverLimits');
    DOM.serverInfo = document.getElementById('serverInfo');

    DOM.progressBar = document.querySelector('.progress-fill');
    DOM.statusBar = document.getElementById('statusBar');
    DOM.statusText = DOM.statusBar?.querySelector('.status-text');
    DOM.testTimer = document.getElementById('testTimer');
    DOM.timerValue = document.getElementById('timerValue');

    DOM.historyList = document.getElementById('historyList');
    DOM.clearHistory = document.getElementById('clearHistory');
    DOM.exportHistory = document.getElementById('exportHistory');
}

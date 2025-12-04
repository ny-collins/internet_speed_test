// ========================================
// SETTINGS HELPER - Quick access to settings
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    const settingsButton = document.querySelector('[data-action="open-settings"]');
    const settingsToggle = document.getElementById('settingsToggle');
    
    if (settingsButton && settingsToggle) {
        settingsButton.addEventListener('click', () => {
            settingsToggle.click();
        });
    }
});

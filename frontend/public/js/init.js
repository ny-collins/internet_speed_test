// ========================================
// INITIALIZATION - Early setup before main app loads
// ========================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.API_BASE_URL = 'http://localhost:3000';
}

setTimeout(function() {
    const skeleton = document.getElementById('loadingSkeleton');
    const appContainer = document.querySelector('.app-container');
    if (skeleton && skeleton.style.display !== 'none') {
        console.error('[Emergency] JavaScript failed to load - showing app anyway');
        if (skeleton) skeleton.style.display = 'none';
        if (appContainer) appContainer.style.opacity = '1';
    }
}, 3000);

window.addEventListener('error', function(e) {
    if (e.filename && e.filename.includes('.js')) {
        console.error('[Module Error]', e.message, e.filename);
        const skeleton = document.getElementById('loadingSkeleton');
        if (skeleton) {
            skeleton.innerHTML = 
                '<div class="error-message">' +
                '<h2>Failed to load application</h2>' +
                '<p>Error: ' + e.message + '</p>' +
                '<p>File: ' + e.filename + '</p>' +
                '<p>Please check browser console for details</p>' +
                '</div>';
        }
    }
}, true);

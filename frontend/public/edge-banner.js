// ========================================
// EDGE BANNER - Show banner on non-edge deployments
// ========================================

(function() {
    const EDGE_DOMAIN = 'speed-test-ahc.pages.dev';
    const CURRENT_DOMAIN = window.location.hostname;
    
    if (CURRENT_DOMAIN === EDGE_DOMAIN) return;

    const banner = document.getElementById('edgeBanner');
    if (!banner) return;

    // Check if banner was dismissed
    const dismissed = localStorage.getItem('edgeBannerDismissed');
    if (dismissed === 'true') {
        banner.remove();
        return;
    }

    // Show banner after delay
    setTimeout(() => {
        banner.style.display = 'flex';
    }, 2000);

    // Handle dismiss
    const dismissBtn = document.getElementById('edgeDismissBtn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            localStorage.setItem('edgeBannerDismissed', 'true');
            banner.style.display = 'none';
        });
    }
})();

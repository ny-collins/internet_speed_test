// ========================================
// EDGE BANNER - Show banner on non-edge deployments
// ========================================

(function() {
    const EDGE_DOMAIN = 'speed-test-ahc.pages.dev';
    const CURRENT_DOMAIN = window.location.hostname;
    
    if (CURRENT_DOMAIN.includes(EDGE_DOMAIN)) return;

    const banner = document.getElementById('africa-banner');
    if (!banner) return;

    const dismissed = localStorage.getItem('edgeBannerDismissed');
    if (dismissed === 'true') {
        banner.remove();
        return;
    }

    setTimeout(() => {
        banner.style.display = 'flex';
    }, 2000);

    const dismissBtn = document.getElementById('close-banner');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            localStorage.setItem('edgeBannerDismissed', 'true');
            banner.style.display = 'none';
        });
    }
})();

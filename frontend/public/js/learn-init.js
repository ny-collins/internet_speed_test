// ========================================
// LEARN PAGE INITIALIZATION
// ========================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.API_BASE_URL = 'http://localhost:3000';
}

window.addEventListener('load', () => {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
});

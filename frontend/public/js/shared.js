// ========================================
// SHARED - Lightweight Entry for Content Pages
// ========================================

import { initializeTheme } from './event-handlers.js';
import { registerServiceWorker } from './service-worker-manager.js';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initializeTheme();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    const pageLoader = document.querySelector('.page-loader');
    if (pageLoader) {
        pageLoader.classList.add('hidden');
    }
});

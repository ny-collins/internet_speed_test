// ========================================
// SHARED - Lightweight Entry for Content Pages
// ========================================

import { initializeTheme } from './js/engine.js';
import { registerServiceWorker } from './js/worker.js';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Shared] Initializing lightweight page...');
    
    registerServiceWorker();
    initializeTheme();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    const pageLoader = document.querySelector('.page-loader');
    if (pageLoader) {
        pageLoader.classList.add('hidden');
    }
    
    console.log('[Shared] Initialization complete');
});

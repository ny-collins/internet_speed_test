// ========================================
// SHARED - Lightweight Entry for Content Pages
// ========================================

import { initializeTheme } from './engine.js';
import { registerServiceWorker } from './worker.js';

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

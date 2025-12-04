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
    
    // 1. Setup PWA & Theme
    registerServiceWorker();
    initializeTheme();
    
    // 2. Initialize Icons (Lucide)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 3. Hide Page Loader
    const pageLoader = document.querySelector('.page-loader');
    if (pageLoader) {
        pageLoader.classList.add('hidden');
    }
    
    console.log('[Shared] Initialization complete');
});

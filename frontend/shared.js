// ========================================
// SHARED - Lightweight Entry for Content Pages
// ========================================

import { initializeTheme } from './js/events.js';
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
    
    console.log('[Shared] Initialization complete');
});

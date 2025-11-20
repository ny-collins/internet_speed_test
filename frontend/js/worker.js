// ========================================
// SERVICE WORKER & PWA
// ========================================

import { STATE } from './state.js';

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service Worker not supported');
        return;
    }
    
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope);
            
            // Check for updates on page load
            registration.update();
            
            // Check for updates periodically (every 60 seconds)
            let updateInterval;
            
            const startUpdateChecks = () => {
                if (updateInterval) return; 
                updateInterval = setInterval(() => {
                    registration.update();
                }, 60000);
            };
            
            const stopUpdateChecks = () => {
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            };
            
            startUpdateChecks();
            
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('[PWA] Page hidden, pausing update checks');
                    stopUpdateChecks();
                } else {
                    console.log('[PWA] Page visible, resuming update checks');
                    registration.update(); 
                    startUpdateChecks();
                }
            });
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                STATE.pwa.newWorker = registration.installing;
                console.log('[PWA] Service Worker update found');
                
                STATE.pwa.newWorker.addEventListener('statechange', () => {
                    if (STATE.pwa.newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] New version available. Showing update prompt.');
                        STATE.pwa.updateAvailable = true;
                        showUpdatePrompt();
                    }
                });
            });
            
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (STATE.pwa.updateAvailable) {
                    console.log('[PWA] New Service Worker activated. Reloading page...');
                    window.location.reload();
                }
            });
        })
        .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
        });
}

function showUpdatePrompt() {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 16px;
            max-width: 90%;
            animation: slideDown 0.3s ease-out;
        ">
            <span style="flex: 1; font-weight: 500;">
                🎉 New version available! Update now for the latest features.
            </span>
            <button id="update-btn" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 8px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            ">
                Update Now
            </button>
            <button id="dismiss-btn" style="
                background: transparent;
                color: white;
                border: 2px solid white;
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            ">
                Later
            </button>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #update-btn:hover, #dismiss-btn:hover { transform: scale(1.05); }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);
    
    document.getElementById('update-btn').addEventListener('click', () => {
        banner.remove();
        if (STATE.pwa.newWorker) {
            STATE.pwa.newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    });
    
    document.getElementById('dismiss-btn').addEventListener('click', () => {
        banner.remove();
    });
}

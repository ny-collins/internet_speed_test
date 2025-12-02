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
    const banner = document.getElementById('update-banner');
    banner.hidden = false;

    document.getElementById('update-btn').addEventListener('click', () => {
        banner.hidden = true;
        if (STATE.pwa.newWorker) {
            STATE.pwa.newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
        banner.hidden = true;
    });
}

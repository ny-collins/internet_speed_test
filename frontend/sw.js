// ========================================
// SERVICE WORKER - SpeedCheck PWA
// ========================================

const CACHE_NAME = 'speedcheck-v1.05.1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/learn.html',
    '/404.html',
    '/main.js?v=1.05.1',
    '/main.css?v=1.05.1',
    '/favicon.svg',
    '/favicon-192x192.png',
    '/favicon-512x512.png',
    '/site.webmanifest'
];

// ========================================
// INSTALL EVENT
// ========================================

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                // Don't skip waiting automatically - wait for user confirmation
                // return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// ========================================
// MESSAGE EVENT (for update control)
// ========================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Received SKIP_WAITING message');
        self.skipWaiting();
    }
});

// ========================================
// ACTIVATE EVENT
// ========================================

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// ========================================
// FETCH EVENT
// ========================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Don't cache API requests (speed test endpoints)
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
        return;
    }
    
    // Network first, fallback to cache strategy
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Clone response before caching
                const responseToCache = response.clone();
                
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(request, responseToCache);
                    });
                
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            console.log('[Service Worker] Serving from cache:', request.url);
                            return cachedResponse;
                        }
                        
                        // If not in cache and it's a navigation request, show offline page
                        if (request.destination === 'document') {
                            return caches.match('/404.html');
                        }
                    });
            })
    );
});
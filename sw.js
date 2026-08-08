const CACHE_NAME = 'toko-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/admin.html',
    '/css/style.css',
    '/css/skeleton.css',
    '/css/dark-mode.css',
    '/js/app.js',
    '/js/admin.js',
    '/js/config.js',
    '/js/db.js',
    '/js/auth.js',
    '/js/notification.js',
    '/js/storage.js',
    '/js/analytics.js',
    '/js/promo.js',
    '/js/review.js',
    '/js/pagination.js',
    '/js/theme.js',
    '/js/error-tracking.js',
    '/js/admin-components.js',
    '/js/admin-dashboard.js',
    '/js/admin-orders.js',
    '/js/admin-products.js',
    '/js/admin-promos.js',
    '/js/admin-report.js',
    '/js/admin-settings.js',
    '/firebase/firebase-config.js'
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache opened');
                return cache.addAll(urlsToCache)
                    .catch(err => {
                        console.warn('⚠️ Some files failed to cache:', err);
                    });
            })
    );
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch with network-first strategy, skip non-GET requests
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests (POST, PUT, DELETE, etc.)
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Skip non-HTTP requests
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    // Skip Firebase requests
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebase.googleapis.com') ||
        event.request.url.includes('googleapis.com')) {
        return fetch(event.request);
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone response untuk cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        try {
                            // Only cache successful GET requests
                            if (response.status === 200) {
                                cache.put(event.request, responseClone);
                            }
                        } catch (e) {
                            // Ignore caching errors
                        }
                    })
                    .catch(() => {});
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        // Fallback untuk offline
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        // Return a simple error response
                        return new Response('Offline - Data tidak tersedia', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});
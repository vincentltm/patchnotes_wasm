const CACHE_NAME = 'patchnotes-v3.0';
const ASSETS_TO_CACHE = [
    'patchnotes.html',
    'style.css',
    'manifest.json',

    // Images
    'images/largeKnob.svg',
    'images/largeKnob_dark.svg',
    'images/mediumKnob.svg',
    'images/mediumKnob_dark.svg',
    'images/panel_image.svg',
    'images/panel_image_dark.svg',
    'images/smallKnob.svg',
    'images/smallKnob_dark.svg',

    // External Libraries
    'js/ext/dom-to-image.min.js',
    'js/ext/jszip.min.js',
    'js/ext/lz-string.min.js',

    // Core JS
    'js/pwa.js',
    'js/audio-engine.js',
    'js/computer.js',
    'js/globals.js',
    'js/main.js',
    'js/scope.js',
    'js/tape.js',
    'js/ui.js',
    'js/utils.js',

    // Cards
    'js/cards/CardCV.js',
    'js/cards/CardDefinitions.js',
    'js/cards/CardDrumLoop.js',
    'js/cards/CardDualDelay.js',
    'js/cards/CardEuclidean.js',
    'js/cards/CardNoOp.js',
    'js/cards/CardVCA.js',
    'js/cards/ComputerCard.js',
    'js/cards/UtilityPairDefinitions.js',
    'js/cards/CardUSBAudio.js',
    'js/cards/WasmCardWrapper.js',
    'js/cards/wasm/editor_bridge.js',
    'js/cards/wasm/patchnotes_cards.js',
    'js/cards/wasm/patchnotes_cards.wasm'
];

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching assets:', CACHE_NAME);
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            return self.clients.matchAll();
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'VERSION',
                    version: CACHE_NAME
                });
            });
        })
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Network-First for HTML, JS, WASM, CSS, JSON (Code & Binaries)
    // Always fetch fresh version from server when online, update cache, fallback to cache if offline.
    const isCodeOrBinary = request.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/') ||
        url.pathname.endsWith('.wasm') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.json');

    if (isCodeOrBinary) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-First with Network Fallback for static assets (e.g. SVG images)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});

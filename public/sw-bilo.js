var CACHE_NAME = 'bilo-offline-v1';
var OFFLINE_URL = './bilo-offline.html';

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll([OFFLINE_URL, './manifest-bilo.json']);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
                return undefined;
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') {
        return;
    }
    var url = new URL(request.url);
    if (url.pathname !== '/' && url.pathname.indexOf('/bilo-offline.html') === -1 &&
        url.pathname.indexOf('/sw-bilo.js') === -1 && url.pathname.indexOf('/manifest-bilo.json') === -1 &&
        url.pathname.indexOf('/icon-') === -1) {
        return;
    }
    event.respondWith(
        fetch(request).then(function (response) {
            if (response && response.status === 200) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clone);
                });
            }
            return response;
        }).catch(function () {
            return caches.match(request).then(function (cached) {
                if (cached) {
                    return cached;
                }
                if (request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
                return new Response('', { status: 404, statusText: 'Sin conexión' });
            });
        })
    );
});
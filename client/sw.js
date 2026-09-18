/**
 * FSARAP SERVICE WORKER (PWA & OFFLINE ENGINE)
 * Niger Delta University - Faculty of Science Academic Repository & Assessment Portal
 * 
 * Provides offline caching, network-first fallback strategies, and background sync support
 * allowing FSARAP to function seamlessly both when hosted on cloud servers (Render) and offline.
 */

const CACHE_NAME = 'fsarap-v2.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/repository.html',
  '/quizzes.html',
  '/take-quiz.html',
  '/quiz-result.html',
  '/dashboard-student.html',
  '/dashboard-lecturer.html',
  '/dashboard-admin.html',
  '/material-details.html',
  '/upload-material.html',
  '/create-quiz.html',
  '/css/main.css',
  '/css/components.css',
  '/js/utils.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/repository.js',
  '/js/quiz.js',
  '/js/dashboard.js',
  '/manifest.json'
];

// Install Event - Pre-cache Static App Shell
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing FSARAP Offline Engine...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static app shell resources');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event Handler - Network First with Cache Fallback for API & Cache First for Assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests for SW handling (they are handled by client offline queue)
  if (req.method !== 'GET') {
    return;
  }

  // API Requests Strategy: Network First, Fallback to Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn('[ServiceWorker] API Network failed. Serving cached response for:', url.pathname);
          return caches.match(req).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return JSON fallback if no cache available
            return new Response(JSON.stringify({
              status: 'offline',
              offline: true,
              message: 'You are currently offline. Displaying locally cached data.',
              data: []
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Static Assets Strategy: Cache First, Network Fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update to refresh cache
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {/* Ignore background fetch error when offline */});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && req.url.startsWith('http')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Offline fallback for HTML pages
      if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
        return caches.match('/index.html');
      }
    })
  );
});

// Handle Background Sync Messages from Client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

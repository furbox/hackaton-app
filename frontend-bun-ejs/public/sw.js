// Minimal Service Worker — enables PWA installability
const CACHE_NAME = 'urloft-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Pass-through fetch — no offline cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

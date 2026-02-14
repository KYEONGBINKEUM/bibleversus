// Service Worker for PWA
self.addEventListener('install', (e) => {
  console.log('Service Worker installing...');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  console.log('Service Worker activating...');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Network first strategy
  e.respondWith(fetch(e.request));
});

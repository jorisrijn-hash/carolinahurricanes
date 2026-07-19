/* ==========================================================================
   SERVICE WORKER
   Two jobs only:
   1. Keep the shell and the ticket wallet available with no connection.
      Arena wifi at 18,700 people is effectively no connection.
   2. Never serve a stale score. Data is network first, always.

   Bump CACHE when the shell changes, or visitors keep the old one.
   ========================================================================== */
var CACHE = 'canes-shell-v4';

var SHELL = [
  'index.html', 'my-canes.html', 'schedule.html', 'tickets.html',
  'css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/layout.css',
  'css/components.css', 'css/sections.css', 'css/pages.css', 'css/rink.css', 'css/product.css',
  'js/core.js', 'js/nav.js', 'js/motion.js', 'js/prefs.js', 'js/live.js',
  'js/sfx.js', 'js/cursor.js', 'js/transition.js', 'js/hero-video.js',
  'assets/brand/canes-primary.svg',
  'assets/fonts/big-shoulders-display-latin-900-normal.woff2',
  'assets/fonts/archivo-latin-400-normal.woff2',
  'assets/fonts/martian-mono-latin-400-normal.woff2',
  'offline.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      // addAll rejects the whole batch if one file 404s, which would leave
      // no cache at all. Add individually and tolerate misses.
      .then(function (cache) {
        return Promise.all(SHELL.map(function (url) {
          return cache.add(url).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Live data: network first, cache only as a last resort, and never for
  // the score feed, which is better absent than wrong.
  if (url.pathname.indexOf('/data/') > -1) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (url.pathname.indexOf('game.json') > -1) return response;
          var copy = response.clone();
          caches.open(CACHE).then(function (c) { c.put(request, copy); });
          return response;
        })
        .catch(function () { return caches.match(request); })
    );
    return;
  }

  // Everything else: cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (c) { c.put(request, copy); });
        return response;
      }).catch(function () {
        return cached || caches.match('offline.html');
      });
      return cached || network;
    })
  );
});

/* Nimbus service worker — cache shell for Android installability */
var CACHE = "nimbus-shell-v10";
var SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./settings.js",
  "./discovery.js",
  "./settings_catalog.json",
  "./icons/nimbus-logo.jpg",
  "./chart.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (req.url.indexOf("state.json") !== -1 || req.url.indexOf("/d/") !== -1) {
    e.respondWith(fetch(req));
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return res; });
    })
  );
});

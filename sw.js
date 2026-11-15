// Change ce numéro à chaque mise à jour de l'appli pour que les téléphones récupèrent les nouveaux fichiers.
const CACHE = "sb2-v8";
const FILES = ["./", "index.html", "style.css", "core.js", "i18n.js", "cloud.js", "ui.js", "config.js", "xlsx.full.min.js", "html2canvas.min.js", "firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).then(() => c.add("logo.png").catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("sb2-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});

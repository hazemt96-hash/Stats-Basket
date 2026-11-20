// Change ce numéro à chaque mise à jour de l'appli pour que les téléphones récupèrent les nouveaux fichiers.
const CACHE = "sb2-v18";
const FILES = ["./", "index.html", "style.css", "core.js", "i18n.js", "cloud.js", "ui.js", "config.js", "xlsx.full.min.js", "html2canvas.min.js", "firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => {
  // { cache: "reload" } : on prend les fichiers sur le serveur, jamais une vieille copie du navigateur
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // Supprime tous les anciens caches, y compris ceux de la première version de l'appli
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: "window" }))
    .then(list => list.forEach(c => c.postMessage("sb2-updated"))));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  // On ne lit que dans le cache de cette version
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })).then(hit => hit || fetch(e.request)));
});

// Guarda todos los archivos del juego para que funcione sin internet.
// Al cambiar cualquier archivo, subir la versión para que los dispositivos se actualicen.
const CACHE = 'baby-quiz-v60';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/util.js',
  'js/storage.js',
  'js/audio.js',
  'js/characters.js',
  'js/wardrobe.js',
  'js/puppet.js',
  'js/render.js',
  'js/connect.js',
  'js/worlds/registry.js',
  'js/worlds/colores.js',
  'js/worlds/animales.js',
  'js/worlds/numeros.js',
  'js/worlds/vocales.js',
  'js/worlds/formas.js',
  'js/worlds/unir.js',
  'js/online-config.js',
  'js/bingo.js',
  'js/trophies.js',
  'js/sport.js',
  'js/penales.js',
  'js/partido.js',
  'js/pool.js',
  'js/bowling.js',
  'js/ppt.js',
  'js/tiro.js',
  'js/libres.js',
  'js/maze.js',
  'js/game.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Con internet trae siempre la versión nueva (y la guarda); sin internet usa la guardada.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});

// Guarda todos los archivos del juego para que funcione sin internet.
// Al cambiar cualquier archivo, subir la versión para que los dispositivos se actualicen.
const CACHE = 'baby-quiz-v2';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/util.js',
  'js/storage.js',
  'js/audio.js',
  'js/characters.js',
  'js/render.js',
  'js/worlds/registry.js',
  'js/worlds/colores.js',
  'js/worlds/animales.js',
  'js/worlds/numeros.js',
  'js/worlds/vocales.js',
  'js/worlds/formas.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    })),
  );
});

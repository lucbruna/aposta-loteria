const CACHE = 'loteria-ia-v2';
const urls = [
  '/',
  '/index.html',
  '/src/main.ts',
  '/src/styles.css',
  '/src/types.ts',
  '/src/config.ts',
  '/src/state.ts',
  '/src/utils.ts',
  '/data-embed.js',
  '/Lotofácil.csv',
  '/Mega-Sena.csv',
  '/Quina.csv',
  '/Lotomania.csv',
  '/Timemania.csv',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(urls))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

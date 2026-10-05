// Service worker do PWA — deliberadamente simples (sem Workbox): só o necessário pra
// instalabilidade + Web Push, nada de cache agressivo. O app usa HashRouter (tudo depois de "#"
// é só client-side), então nunca há uma "rota de navegação" real pra interceptar — só a raiz "/".

const STATIC_CACHE = 'gp-static-v1';

// Só ativos verdadeiramente estáveis (nunca o HTML/JS/CSS com hash de build do Vite — cacheá-los
// aqui arriscaria servir um shell desatualizado apontando pra arquivos que não existem mais na
// próxima build, seção 45/47 do pedido: nunca cache de dado autenticado nem de API).
const CAMINHOS_ESTAVEIS = ['/manifest.webmanifest', '/favicon.svg'];

function ehAssetEstavel(url) {
  return CAMINHOS_ESTAVEIS.includes(url.pathname) || url.pathname.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CAMINHOS_ESTAVEIS).catch(() => {})),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!ehAssetEstavel(url)) return; // tudo mais (API, navegação, JS/CSS) vai direto pra rede

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const emCache = await cache.match(event.request);
      if (emCache) return emCache;
      const resposta = await fetch(event.request);
      if (resposta.ok) cache.put(event.request, resposta.clone());
      return resposta;
    }),
  );
});

// --- Web Push ------------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Notificação', body: event.data.text() };
  }

  const url = payload.url ? new URL(payload.url, self.location.origin).href : self.location.origin;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title || 'Notificação', {
        body: payload.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url },
      });

      // Avisa páginas já abertas pra atualizar o badge/central sem precisar de polling (seção 39
      // do pedido) — só funciona quando o Push chega, não substitui o refresh em "window focus".
      const clientes = await self.clients.matchAll({ type: 'window' });
      clientes.forEach((cliente) => cliente.postMessage({ type: 'nova-notificacao' }));
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existente = clientes.find((c) => c.url.startsWith(self.location.origin));
      if (existente) {
        existente.postMessage({ type: 'navegar-notificacao', url });
        await existente.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

// Registro do service worker do PWA. Falha de registro (navegador sem suporte, erro de rede no
// primeiro load) nunca pode impedir o app de funcionar normalmente — por isso só loga, nunca lança.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // import.meta.env.BASE_URL (não "/" fixo): em produção o app é publicado no GitHub Pages sob um
  // subcaminho (ex.: /teachers-app/), não na raiz do domínio — registrar em "/sw.js" buscaria o
  // arquivo no lugar errado (404) e o service worker nunca ativaria.
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.error('[pwa] falha ao registrar o service worker', err);
    });
  });
}

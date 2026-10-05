// Registro do service worker do PWA. Falha de registro (navegador sem suporte, erro de rede no
// primeiro load) nunca pode impedir o app de funcionar normalmente — por isso só loga, nunca lança.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[pwa] falha ao registrar o service worker', err);
    });
  });
}

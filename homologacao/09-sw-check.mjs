import { abrir, login } from './lib.mjs';
import { registrar } from './resultados.mjs';
const { browser, page } = await abrir();
await login(page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await page.goto('https://localhost:5180/#/formulario-um-terco'); await page.waitForTimeout(2500);
await page.reload(); await page.waitForTimeout(2500);
const info = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  const caches_ = await caches.keys();
  return { registrado: regs.length, estado: regs[0]?.active?.state ?? null, escopo: regs[0]?.scope ?? null, controla: !!navigator.serviceWorker.controller, caches: caches_ };
});
console.log(JSON.stringify(info));
registrar('UT-SW-01', 'Offline (Service Worker)', 'Service Worker registra, fica ativo e controla a página (certificado autoassinado aceito só neste ambiente)', 'registrado=1, ativo, controla=true', JSON.stringify(info), info.registrado > 0 && info.estado === 'activated' && info.controla ? 'APROVADO' : 'REPROVADO');
await browser.close();

// Conferência da PRODUÇÃO depois da publicação do lançamento (11/11/2026). Só leitura, com as contas ZZCARGA
// (apagadas no fim do teste de carga). Uso: node 54-producao-publicacao.mjs [url-do-site]
import { chromium } from 'playwright';
import { EVID } from './lib.mjs';

const SITE = process.argv[2] ?? 'https://hevertonvp.github.io/teachers-app/';
const SENHA = 'ZzCarga!2026-teste';
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '[OK]  ' : '[FALHA]'} ${msg}`); if (!cond) falhas += 1; };

for (const [quem, email] of [['prof', 'zzcarga-1@teste.invalid'], ['sec', 'zzcarga-sec@teste.invalid']]) {
  for (const [tela, viewport] of [['pc', { width: 1280, height: 800 }], ['cel', { width: 390, height: 844 }]]) {
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport, locale: 'pt-BR' })).newPage();
    const erros = [];
    const apis = new Set();
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('request', (r) => { if (r.url().includes('onrender.com')) apis.add(new URL(r.url()).host); });
    try {
      await page.goto(SITE + '#/login', { waitUntil: 'networkidle' });
      ok((await page.title()) === 'Educa São João', `${quem}/${tela}: título "${await page.title()}"`);
      await page.locator('input[type=email]').fill(email);
      await page.locator('input[type=password]').first().fill(SENHA);
      await page.getByRole('button', { name: /entrar/i }).click();
      await page.waitForFunction(() => !location.hash.includes('/login'), null, { timeout: 30000 });
      await page.waitForLoadState('networkidle');
      if (tela === 'cel') await page.getByRole('button', { name: 'Abrir menu' }).click().catch(() => {});
      const menu = (await page.locator('aside a, nav a').allTextContents()).map((t) => t.trim()).join(' | ');
      ok(!/\bPDI\b|Correções/.test(menu) && /Formulário 1\/3/.test(menu), `${quem}/${tela}: menu sem PDI, com 1/3 → ${menu}`);
      await page.goto(SITE + '#/formulario-um-terco', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const corpo = await page.locator('main').innerText();
      ok(/ZZCARGA/.test(corpo), `${quem}/${tela}: 1/3 mostra o ciclo de teste`);
      const largura = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      ok(largura, `${quem}/${tela}: sem rolagem lateral`);
      await page.screenshot({ path: `${EVID}54-${quem}-${tela}-um-terco.png`, fullPage: true });
      ok([...apis].every((h) => h === 'educa-sao-joao-api.onrender.com') && apis.size > 0, `${quem}/${tela}: chamadas só para a API nova → ${[...apis].join(', ')}`);
      ok(erros.length === 0, `${quem}/${tela}: sem erros no console ${erros.join(' / ')}`);
    } catch (e) {
      ok(false, `${quem}/${tela}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
}
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');

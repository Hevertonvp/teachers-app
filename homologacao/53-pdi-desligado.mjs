// Lançamento "Educa São João" (11/11/2026): PDI desligado na interface (src/config/modulos.js).
// Banco LOCAL. Confere menu, rotas, painéis e Acompanhamento por perfil, no computador e no celular.
import { abrir, login, foto, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`PDI-DESL-${id}`, 'PDI desligado (lançamento)', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const SENHA = 'Nexo!Homolog-2026';
const CEL = { width: 390, height: 844 };

const menu = async (page) => (await page.locator('aside a, nav a').allTextContents()).map((t) => t.trim()).filter(Boolean);
const temPdi = (itens) => itens.some((t) => /^PDI\b|Correções/.test(t));

const perfis = [
  ['prof', 'p04@homolog.nexo', 'Nexo!Prof04-2026'],
  ['sec', 'secretaria@escola.gov.br', '12345678'],
  ['gestor', 'gestor.aur@homolog.nexo', SENHA],
  ['diretora', 'diretora.aur@homolog.nexo', SENHA],
];

for (const [nome, email, senha] of perfis) {
  for (const [tela, viewport] of [['pc', undefined], ['cel', CEL]]) {
    const X = await abrir(viewport ? { viewport } : {});
    try {
      await login(X.page, email, senha);
      await X.page.goto(BASE + '/#/dashboard'); await X.page.waitForLoadState('networkidle');
      if (tela === 'cel') { await X.page.getByRole('button', { name: 'Abrir menu' }).click().catch(() => {}); await X.page.waitForTimeout(300); }
      const itens = await menu(X.page);
      const corpo = await X.page.locator('main').innerText().catch(() => '');
      await foto(X.page, `53-${nome}-${tela}-dashboard`);
      r(`${nome}-${tela}-menu`, `${nome} (${tela}): menu sem PDI e sem Correções`, 'sem PDI/Correções', itens.join(' | '), !temPdi(itens) && itens.length > 0);
      r(`${nome}-${tela}-dash`, `${nome} (${tela}): Dashboard sem PDI`, 'nenhum "PDI" no painel', /PDI/.test(corpo) ? corpo.match(/.{0,40}PDI.{0,40}/)[0] : 'ok', !/PDI/.test(corpo));
      if (nome === 'prof') {
        const atalho = await X.page.getByRole('link', { name: 'Abrir Formulário 1/3' }).count();
        r(`${nome}-${tela}-atalho`, 'Professor: atalho para o 1/3 no Dashboard', '1 atalho', atalho, atalho === 1);
      }
      for (const rota of ['/pdi', '/pdi/meus-pdis', '/correcoes', '/correcoes/pdi']) {
        await X.page.goto(BASE + '/#' + rota); await X.page.waitForLoadState('networkidle');
        const hash = await X.page.evaluate(() => location.hash);
        if (tela === 'pc') r(`${nome}-rota${rota}`, `${nome}: abrir ${rota} direto volta ao Dashboard`, '#/dashboard', hash, hash === '#/dashboard');
      }
      if (nome === 'sec' || nome === 'diretora') {
        await X.page.goto(BASE + '/#/acompanhamento-escolar'); await X.page.waitForLoadState('networkidle');
        await X.page.waitForFunction(() => /1\/3/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => {});
        await X.page.waitForTimeout(800);
        const txt = await X.page.locator('main').innerText().catch(() => '');
        const seletor = await X.page.getByRole('group', { name: 'Formulário' }).count();
        await foto(X.page, `53-${nome}-${tela}-acompanhamento`);
        const largura = await X.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        r(`${nome}-${tela}-acomp`, `${nome} (${tela}): Acompanhamento só com 1/3`, 'sem PDI, sem seletor, com 1/3, sem rolagem lateral', `PDI: ${/PDI/.test(txt)}; seletor: ${seletor}; 1/3: ${/1\/3/.test(txt)}; largura ok: ${largura}`, !/PDI/.test(txt) && seletor === 0 && /1\/3/.test(txt) && largura);
      }
      r(`${nome}-${tela}-console`, `${nome} (${tela}): sem erros no console`, '0 erros', X.erros.join(' / ') || '0', X.erros.length === 0);
    } finally {
      await X.browser.close();
    }
  }
}
console.log('fim');

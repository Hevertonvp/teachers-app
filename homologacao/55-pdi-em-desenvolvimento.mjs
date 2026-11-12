// PDI "em desenvolvimento" (MODO_PDI = 'desenvolvimento', decisão do usuário 11/11/2026). Banco LOCAL.
// Tudo do PDI aparece (menu, cartões, telas), mas desabilitado e com o aviso; o 1/3 segue normal.
import { abrir, login, foto, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`PDI-DESENV-${id}`, 'PDI em desenvolvimento', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const SENHA = 'Nexo!Homolog-2026';
const CEL = { width: 390, height: 844 };

const perfis = [
  ['prof', 'p04@homolog.nexo', 'Nexo!Prof04-2026', true],
  ['sec', 'secretaria@escola.gov.br', '12345678', true],
  ['gestor', 'gestor.aur@homolog.nexo', SENHA, true],
  ['diretora', 'diretora.aur@homolog.nexo', SENHA, false],
];

for (const [nome, email, senha, temPdiNoMenu] of perfis) {
  for (const [tela, viewport] of [['pc', undefined], ['cel', CEL]]) {
    const X = await abrir(viewport ? { viewport } : {});
    try {
      await login(X.page, email, senha);
      await X.page.goto(BASE + '/#/dashboard'); await X.page.waitForLoadState('networkidle');
      if (tela === 'cel') { await X.page.getByRole('button', { name: 'Abrir menu' }).click().catch(() => {}); }
      await X.page.getByRole('link', { name: 'Dashboard' }).first().waitFor({ timeout: 15000 }).catch(() => {});
      const menu = (await X.page.locator('aside a, nav a').allTextContents()).map((t) => t.trim()).join(' | ');
      if (temPdiNoMenu) r(`${nome}-${tela}-menu`, `${nome} (${tela}): PDI no menu com selo "em desenvolvimento"`, 'PDI…em desenvolvimento', menu, /PDIemdesenvolvimento/i.test(menu.replace(/\s/g, '')));
      else r(`${nome}-${tela}-menu`, `${nome} (${tela}): menu sem PDI (perfil nunca teve)`, 'sem PDI', menu, !/PDI/.test(menu));
      if (tela === 'cel') await X.page.keyboard.press('Escape').catch(() => {});
      await X.page.goto(BASE + '/#/dashboard'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(800);
      const corpo = await X.page.locator('main').innerText().catch(() => '');
      await foto(X.page, `55-${nome}-${tela}-dashboard`);
      if (nome !== 'diretora') r(`${nome}-${tela}-dash`, `${nome} (${tela}): Dashboard mostra PDI "Em desenvolvimento"`, 'aviso visível', /Em desenvolvimento/.test(corpo) ? 'ok' : corpo.slice(0, 200), /Em desenvolvimento/.test(corpo) && /PDI está em desenvolvimento/.test(corpo));
      if (tela === 'pc') {
        for (const rota of ['/pdi', '/pdi/meus-pdis', '/correcoes', '/correcoes/pdi']) {
          await X.page.goto(BASE + '/#' + rota); await X.page.waitForLoadState('networkidle');
          // 12/11/2026: para a Secretaria, /correcoes é a entrada de Correções (1/3 de verdade + PDI com o selo).
          if (nome === 'sec' && rota === '/correcoes') {
            const hub = await X.page.locator('main').innerText().catch(() => '');
            r(`${nome}-rota${rota}`, `${nome}: ${rota} mostra o 1/3 e o PDI "em desenvolvimento"`, 'cartão 1/3 + PDI com selo', hub.replace(/\s+/g, ' ').slice(0, 120), /Correção das folhas do 1\/3/.test(hub) && /desenvolvimento/i.test(hub));
            continue;
          }
          const titulo = await X.page.getByRole('heading', { name: 'PDI em desenvolvimento' }).count();
          r(`${nome}-rota${rota}`, `${nome}: ${rota} mostra "PDI em desenvolvimento"`, 'aviso', titulo, titulo === 1);
        }
        await foto(X.page, `55-${nome}-pc-pagina-em-desenvolvimento`);
      }
      if (nome === 'sec' || nome === 'diretora') {
        await X.page.goto(BASE + '/#/acompanhamento-escolar'); await X.page.waitForLoadState('networkidle');
        await X.page.waitForFunction(() => /1\/3/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => {});
        await X.page.waitForTimeout(800);
        const txt = await X.page.locator('main').innerText();
        const pdiBtn = X.page.getByRole('group', { name: 'Formulário' }).getByRole('button', { name: /PDI/ });
        const desab = await pdiBtn.isDisabled().catch(() => null);
        const largura = await X.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        await foto(X.page, `55-${nome}-${tela}-acompanhamento`);
        r(`${nome}-${tela}-acomp`, `${nome} (${tela}): Acompanhamento com PDI em desenvolvimento e 1/3 normal`, 'cartão em desenvolvimento, botão PDI desabilitado, 1/3, sem rolagem', `desenv: ${/em desenvolvimento/i.test(txt)}; botão desab: ${desab}; 1/3: ${/1\/3/.test(txt)}; largura: ${largura}`, /em desenvolvimento/i.test(txt) && desab === true && /1\/3/.test(txt) && largura);
      }
      if (nome === 'prof') {
        await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle');
        const ok13 = await X.page.getByRole('heading', { name: /Formulário 1\/3/ }).count();
        r(`${nome}-${tela}-1-3`, 'Professor: Formulário 1/3 continua abrindo', 'título', ok13, ok13 > 0);
      }
      r(`${nome}-${tela}-console`, `${nome} (${tela}): sem erros no console`, '0', X.erros.join(' / ') || '0', X.erros.length === 0);
    } finally {
      await X.browser.close();
    }
  }
}
console.log('fim');

// Menu "⋮" (ActionMenu) da ÚLTIMA linha da lista de professores, no fim da tela: aparece inteiro (15/11/2026 —
// antes abria sempre para baixo e ficava cortado na borda da tela). Navegador real, banco LOCAL. Não grava nada.
import { abrir, login, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`MENU-${id}`, 'Menu de ações', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
for (const [nome, vp] of [['computador', { width: 1366, height: 768 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  const botoes = X.page.getByRole('button', { name: 'Mais ações' });
  const ultimo = botoes.last();
  await ultimo.scrollIntoViewIfNeeded();
  await X.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await X.page.waitForTimeout(400);
  const b = await ultimo.boundingBox();
  await ultimo.click(); await X.page.waitForTimeout(400);
  const menu = X.page.getByRole('menu').filter({ has: X.page.getByRole('menuitem', { name: /Inativar|Reativar/ }) }).last();
  const m = await menu.boundingBox();
  const inativar = await menu.getByRole('menuitem', { name: /Inativar|Reativar/ }).isVisible().catch(() => false);
  const dentro = m && m.y >= 0 && m.y + m.height <= vp.height && m.x >= 0 && m.x + m.width <= vp.width;
  r(`1-${nome}`, `${nome}: "⋮" da última linha, no fim da tela: o menu aparece inteiro (abre para cima se não couber) e "Inativar" fica visível`, 'menu dentro da tela; Inativar visível',
    `botão y=${Math.round(b.y)}; menu y=${Math.round(m?.y)} a ${Math.round((m?.y ?? 0) + (m?.height ?? 0))} (tela ${vp.height}); Inativar visível: ${inativar}`, dentro && inativar);
  await X.page.screenshot({ path: `evidencias/72-menu-ultima-linha-${nome}.png` });
  await X.browser.close();
}

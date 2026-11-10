// Exportação para Excel — botões no CELULAR (390px): sem rolagem horizontal e botão inteiro visível.
import { abrir, login, foto, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const X = await abrir({ viewport: { width: 390, height: 844 } });
await login(X.page, 'secretaria@escola.gov.br', '123456');
for (const [id, rota] of [['pdi', '/pdi'], ['um-terco', '/formulario-um-terco'], ['painel', '/formulario-um-terco/ciclos/1'], ['pessoas', '/pessoas'], ['turmas', '/turmas'], ['alunos', '/pdi/alunos']]) {
  await X.page.goto(BASE + '/#' + rota); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  const b = X.page.getByRole('button', { name: 'Exportar para Excel' }).first();
  await b.scrollIntoViewIfNeeded();
  const caixa = await b.boundingBox();
  const largura = await X.page.evaluate(() => document.documentElement.scrollWidth);
  await foto(X.page, `43b-celular-${id}`);
  const ok = !!caixa && caixa.x >= 0 && caixa.x + caixa.width <= 390 && largura <= 390;
  registrar(`EXP-CEL-${id}`, 'Exportação para Excel', `Celular 390px, ${rota}: botão "Exportar para Excel" inteiro na tela, sem rolagem horizontal`, 'botão dentro de 0–390px; página ≤ 390px', `botão x=${Math.round(caixa?.x)}..${Math.round((caixa?.x ?? 0) + (caixa?.width ?? 0))}; página ${largura}px`, ok ? 'APROVADO' : 'REPROVADO', `43b-celular-${id}.png`);
}
await X.browser.close();

// Filtros de escola das telas internas seguem o seletor do topo, só no sentido topo → filtro
// (pedido do usuário, 12/11/2026). Banco LOCAL. Só leitura: nada é gravado.
import { abrir, login, foto } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`FILTRO-${id}`, 'Filtros seguem o topo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');

const ir = async (page, rota) => { await page.evaluate((h) => { location.hash = h; }, rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); };
const topoBotao = (page) => page.locator('button[aria-haspopup="listbox"]').first();
const topoNome = async (page) => (await topoBotao(page).textContent()).trim();
const topoEscolher = async (page, { indice, nome }) => {
  await topoBotao(page).click();
  const opcao = nome ? page.getByRole('listbox').getByRole('option', { name: nome, exact: true }) : page.getByRole('listbox').getByRole('option').nth(indice);
  const texto = (await opcao.textContent()).trim();
  await opcao.click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  return texto;
};
const valorSelect = (loc) => loc.evaluate(s => s.options[s.selectedIndex]?.text?.trim() ?? '');
const escolherNoSelect = async (loc, texto) => { const v = await loc.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t)?.value, texto); await loc.selectOption(v); await loc.page().waitForTimeout(800); };

const X = await abrir();
const { page, erros } = X;
try {
  await login(page, 'secretaria@escola.gov.br', '12345678');

  // Gestão de Turmas
  const a = await topoEscolher(page, { indice: 3 });
  await ir(page, '#/turmas');
  const filtroTurmas = page.locator('select').filter({ has: page.locator('option', { hasText: 'Todas as escolas' }) }).first();
  const v1 = await valorSelect(filtroTurmas);
  r('1', 'Turmas: filtro abre com a escola do topo', a, v1, v1 === a);
  await escolherNoSelect(filtroTurmas, 'Todas as escolas');
  const t1 = await topoNome(page);
  r('2', 'Turmas: mudar o filtro NÃO muda o topo', a, t1, t1 === a);
  const b = await topoEscolher(page, { indice: 4 });
  const v2 = await valorSelect(filtroTurmas);
  r('3', 'Turmas: mudar o topo com a tela aberta muda o filtro', b, v2, v2 === b);
  await foto(page, '57-turmas');

  // Acompanhamento Escolar
  await ir(page, '#/acompanhamento-escolar');
  const hero = page.locator('.acp-hero');
  const v3 = (await hero.textContent()).includes(b) ? b : '(outra visão)';
  r('4', 'Acompanhamento: abre na escola do topo', b, v3, v3 === b);
  const voltar = page.getByRole('button', { name: '← Rede' });
  await voltar.click();
  await page.waitForTimeout(800);
  const t2 = await topoNome(page);
  r('5', 'Acompanhamento: voltar à Rede NÃO muda o topo', b, t2, t2 === b);
  await topoEscolher(page, { indice: 0 });
  const v4 = (await page.getByRole('button', { name: '← Rede' }).count()) ? 'escola' : 'Rede';
  const t3 = await topoNome(page);
  r('6', 'Acompanhamento: topo em "Todas" → tela na Rede', 'Rede / Todas as escolas', `${v4} / ${t3}`, /Todas as escolas/.test(t3) && !(await page.getByRole('button', { name: '← Rede' }).count()));

  // Painel do 1/3 (ciclo 1 do banco local)
  await ir(page, '#/formulario-um-terco/ciclos/1');
  const selPainel = page.locator('select[aria-label="Escola"]').first();
  const escolasPainel = await selPainel.evaluate(s => [...s.options].map(o => o.text.trim()).filter(t => t !== 'Todas as escolas'));
  const v5 = await valorSelect(selPainel);
  r('7', 'Painel 1/3: topo em "Todas" → filtro em "Todas"', 'Todas as escolas', v5, v5 === 'Todas as escolas');
  if (escolasPainel.length) {
    const c = await topoEscolher(page, { nome: escolasPainel[escolasPainel.length - 1] });
    const v6 = await valorSelect(selPainel);
    r('8', 'Painel 1/3: topo numa escola do ciclo → filtro nessa escola', c, v6, v6 === c);
    await escolherNoSelect(selPainel, 'Todas as escolas');
    const t4 = await topoNome(page);
    r('9', 'Painel 1/3: mudar o filtro NÃO muda o topo', c, t4, t4 === c);
    await foto(page, '57-painel');
  } else {
    r('8', 'Painel 1/3: topo numa escola do ciclo', 'ciclo com escolas', 'ciclo 1 sem escolas no painel: não testado', false);
  }

  r('10', 'Sem erros no console', '0', erros.join(' | ') || '0', erros.length === 0);
} finally {
  await X.browser.close();
}

// Celular (390 px): Acompanhamento abre na escola do topo, sem rolagem lateral.
const C = await abrir({ viewport: { width: 390, height: 844 } });
try {
  await login(C.page, 'secretaria@escola.gov.br', '12345678');
  const e = await topoEscolher(C.page, { indice: 2 });
  await ir(C.page, '#/acompanhamento-escolar');
  const v = (await C.page.locator('.acp-hero').textContent()).includes(e) ? e : '(outra visão)';
  const largura = await C.page.evaluate(() => document.documentElement.scrollWidth);
  await foto(C.page, '57-acompanhamento-celular');
  r('11', 'Celular: Acompanhamento na escola do topo, sem rolagem lateral', `${e}; ≤ 390`, `${v}; ${largura}`, v === e && largura <= 390);
} finally {
  await C.browser.close();
}

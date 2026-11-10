// Formulário 1/3: ciclos INATIVOS em tela separada (pedido do usuário, 10/11/2026), navegador real, banco LOCAL.
// Cria 1 ciclo de teste pela API, inativa e reativa pela tela e, no fim, deixa-o INATIVO.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UT-INAT-${id}`, 'Formulário 1/3 — inativos separados', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const API = 'http://localhost:3340';
const antes = new Set((await prisma.cicloUmTerco.findMany({ select: { id: true } })).map(c => c.id));
const TITULO = 'ZZ-INAT ' + new Date().toISOString().slice(11, 19).replace(/:/g, '');
const cartoes = (page) => page.locator('h2', { hasText: 'trimestre de' });

try {
  for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    await login(X.page, 'secretaria@escola.gov.br', '12345678');
    await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
    const [nAtivos, nInativos] = [await prisma.cicloUmTerco.count({ where: { status: 'ATIVA' } }), await prisma.cicloUmTerco.count({ where: { status: 'INATIVA' } })];
    const telaAtivos = await cartoes(X.page).count();
    const badgesInativo = await X.page.getByText('Inativo', { exact: true }).count();
    const link = X.page.getByRole('link', { name: /Ver inativos/ });
    const textoLink = (await link.innerText()).trim();
    await foto(X.page, `47-ativos-${nome}`);
    r(`1-${nome}`, `${nome}: tela principal só com ciclos ativos (nenhum selo "Inativo") e link "Ver inativos (N)"`, `${nAtivos} cartões; 0 selos; "Ver inativos (${nInativos}) →"`, `${telaAtivos} cartões; ${badgesInativo} selos; "${textoLink}"`, telaAtivos === nAtivos && badgesInativo === 0 && textoLink === `Ver inativos (${nInativos}) →`, `47-ativos-${nome}.png`);

    await link.click(); await X.page.waitForTimeout(1200);
    const url = X.page.url();
    const titulo = (await X.page.getByRole('heading', { level: 1, name: /^Formulário 1\/3 — / }).innerText()).trim();
    const telaInativos = await cartoes(X.page).count();
    const reativar = await X.page.getByRole('button', { name: 'Reativar' }).count();
    const novo = await X.page.getByRole('button', { name: '+ Novo ciclo' }).count();
    const largura = await X.page.evaluate(() => document.documentElement.scrollWidth);
    await foto(X.page, `47-inativos-${nome}`);
    r(`2-${nome}`, `${nome}: "Ver inativos" abre tela separada (endereço próprio) só com os inativos, cada um com Reativar; sem "+ Novo ciclo"; sem rolagem horizontal`, `?ver=inativos; "Formulário 1/3 — Inativos"; ${nInativos} cartões e ${nInativos} Reativar; 0 Novo; ≤ ${vp.width}px`, `${url.includes('ver=inativos')}; "${titulo}"; ${telaInativos} cartões, ${reativar} Reativar; ${novo} Novo; ${largura}px`, url.includes('ver=inativos') && titulo === 'Formulário 1/3 — Inativos' && telaInativos === nInativos && reativar === nInativos && novo === 0 && largura <= vp.width, `47-inativos-${nome}.png`);

    await X.page.goBack(); await X.page.waitForTimeout(1000);
    const voltou = (await X.page.getByRole('heading', { level: 1, name: /^Formulário 1\/3 — / }).innerText()).trim();
    r(`3-${nome}`, `${nome}: botão Voltar do navegador retorna aos ciclos ativos`, '"Formulário 1/3 — Conteúdos"', `"${voltou}"`, voltou === 'Formulário 1/3 — Conteúdos');
    await X.browser.close();
  }

  // Ciclo de teste: inativar pela tela → sai dos ativos e aparece nos inativos; reativar → volta
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tk = await X.page.evaluate(() => localStorage.getItem('authToken'));
  const res = await fetch(API + '/api/formulario-um-terco/ciclos', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ anoLetivo: 2026, trimestre: 3, titulo: TITULO, abreEm: '2026-12-01T00:00', prazoEm: '2026-12-18T23:59', semanas: [{ dataInicio: '2026-11-23', dataFim: '2026-11-27' }] }) });
  const criado = await res.json();
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
  const cartaoTeste = X.page.locator('div', { has: X.page.getByRole('heading', { name: TITULO }) }).filter({ has: X.page.getByRole('button', { name: 'Painel de entregas' }) }).last();
  const estavaNosAtivos = await cartaoTeste.count();
  await cartaoTeste.getByRole('button', { name: 'Inativar' }).click(); await X.page.waitForTimeout(500);
  await X.page.locator('div.fixed.inset-0').getByRole('button', { name: /Inativar/ }).last().click(); await X.page.waitForTimeout(1500);
  const msg = (await X.page.getByText(/Ciclo inativado/).first().innerText().catch(() => '')).trim();
  const sumiuDosAtivos = (await X.page.getByRole('heading', { name: TITULO }).count()) === 0;
  await X.page.getByRole('link', { name: /Ver inativos/ }).click(); await X.page.waitForTimeout(1000);
  const estaNosInativos = await X.page.getByRole('heading', { name: TITULO }).count();
  r('4', 'Inativar pela tela: o ciclo sai da lista principal, a mensagem indica onde ele foi parar e ele aparece em "Ver inativos"', `${res.status}; estava 1; "Ciclo inativado. Ele fica em \\"Ver inativos\\"."; sumiu; está nos inativos`, `${res.status}; estava ${estavaNosAtivos}; "${msg}"; sumiu: ${sumiuDosAtivos}; nos inativos: ${estaNosInativos}`, res.status === 201 && estavaNosAtivos === 1 && /Ver inativos/.test(msg) && sumiuDosAtivos && estaNosInativos === 1);

  const cartaoInat = X.page.locator('div', { has: X.page.getByRole('heading', { name: TITULO }) }).filter({ has: X.page.getByRole('button', { name: 'Reativar' }) }).last();
  await cartaoInat.getByRole('button', { name: 'Reativar' }).click(); await X.page.waitForTimeout(1500);
  const saiuDosInativos = (await X.page.getByRole('heading', { name: TITULO }).count()) === 0;
  await X.page.getByRole('link', { name: /Voltar aos ciclos ativos/ }).click(); await X.page.waitForTimeout(1000);
  const voltouAtivos = await X.page.getByRole('heading', { name: TITULO }).count();
  const statusBanco = (await prisma.cicloUmTerco.findUnique({ where: { id: criado.id } }))?.status;
  r('5', 'Reativar na tela de inativos: sai de lá e volta para a lista principal (banco ATIVA)', 'saiu; volta 1; ATIVA', `saiu: ${saiuDosInativos}; nos ativos: ${voltouAtivos}; banco ${statusBanco}`, saiuDosInativos && voltouAtivos === 1 && statusBanco === 'ATIVA');
  console.log('erros:', X.erros.filter(e => !/40[0134]/.test(e)));
  await X.browser.close();
} finally {
  const novos = await prisma.cicloUmTerco.findMany({ where: { id: { notIn: [...antes] } }, select: { id: true } });
  if (novos.length) await prisma.cicloUmTerco.updateMany({ where: { id: { in: novos.map(c => c.id) } }, data: { status: 'INATIVA' } });
  console.log('ciclos criados pelo teste inativados:', novos.map(c => c.id));
  await prisma.$disconnect();
}

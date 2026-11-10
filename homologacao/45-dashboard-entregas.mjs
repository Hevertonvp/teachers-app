// Dashboard da Secretaria com a entrega do PDI e do Formulário 1/3 (pedido de 10/11/2026), navegador real,
// banco LOCAL: números iguais aos das APIs de cada módulo (todas as escolas e uma escola), gráficos com
// legenda numérica, sem rolagem horizontal no celular; página do PDI continua com os mesmos números.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`DASH-${id}`, 'Dashboard — entregas PDI e 1/3', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const API = 'http://localhost:3340';
const get = async (tk, p) => (await fetch(API + p, { headers: { authorization: 'Bearer ' + tk } })).json();

// Lê "N Concluídas / N Em preenchimento / N Não iniciadas" e o percentual de um painel pelo título.
const lerPainel = async (page, titulo) => {
  const card = page.locator('div.overflow-hidden', { has: page.getByText(titulo, { exact: true }) }).first();
  const t = (await card.innerText()).replace(/\s+/g, ' ');
  const num = (rot) => Number((t.match(new RegExp(`(\\d+) ${rot}`)) || [])[1] ?? NaN);
  return { texto: t, concluidas: num('Concluídas'), emAndamento: num('Em preenchimento'), naoIniciadas: num('Não iniciadas'), pct: (t.match(/(\d+)% concluído/) || [])[1] };
};

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tk = await X.page.evaluate(() => localStorage.getItem('authToken'));
  await X.page.goto(BASE + '/#/dashboard'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  await foto(X.page, `45-dashboard-${nome}`);

  // Esperado: PDI = indicadores (escolas com Aplicação e fichas esperadas); 1/3 = resumo do painel do ciclo aberto
  const ind = (await get(tk, '/api/pdi-aplicacoes/indicadores')).filter(i => i.aplicacaoId !== null && i.totalEsperado > 0);
  const pdiEsp = ind.reduce((a, i) => ({ c: a.c + i.concluidas, e: a.e + (i.emAndamento ?? 0), n: a.n + Math.max(0, i.totalEsperado - i.concluidas - (i.emAndamento ?? 0)) }), { c: 0, e: 0, n: 0 });
  const pdi = await lerPainel(X.page, 'Entrega do PDI');
  r(`1-${nome}`, `${nome}, todas as escolas: painel do PDI no Dashboard = indicadores do PDI`, `${pdiEsp.c}/${pdiEsp.e}/${pdiEsp.n}`, `${pdi.concluidas}/${pdi.emAndamento}/${pdi.naoIniciadas} (${pdi.pct}% concluído)`, pdi.concluidas === pdiEsp.c && pdi.emAndamento === pdiEsp.e && pdi.naoIniciadas === pdiEsp.n, `45-dashboard-${nome}.png`);

  const ciclos = await get(tk, '/api/formulario-um-terco/ciclos');
  const aberto = ciclos.find(c => c.status === 'ATIVA' && c.statusPrazo === 'aberto') ?? ciclos.find(c => c.statusRegistro === 'ativa' && c.statusPrazo === 'aberto');
  const painel = await get(tk, `/api/formulario-um-terco/ciclos/${aberto.id}/painel`);
  const ut = await lerPainel(X.page, 'Entrega do Formulário 1/3');
  r(`2-${nome}`, `${nome}, todas as escolas: painel do 1/3 no Dashboard = resumo do Painel de entregas do ciclo aberto ("${aberto.titulo}")`, `${painel.resumo.concluidas}/${painel.resumo.emAndamento}/${painel.resumo.naoIniciadas} (${painel.resumo.percentualEntrega}%)`, `${ut.concluidas}/${ut.emAndamento}/${ut.naoIniciadas} (${ut.pct}%)`, ut.concluidas === painel.resumo.concluidas && ut.emAndamento === painel.resumo.emAndamento && ut.naoIniciadas === painel.resumo.naoIniciadas && Number(ut.pct) === painel.resumo.percentualEntrega);

  const largura = await X.page.evaluate(() => document.documentElement.scrollWidth);
  const links = [await X.page.getByRole('link', { name: /Abrir PDI/ }).count(), await X.page.getByRole('link', { name: /Abrir 1\/3/ }).count()];
  r(`3-${nome}`, `${nome}: sem rolagem horizontal; atalhos "Abrir PDI" e "Abrir 1/3"`, `≤ ${vp.width}px; 1 e 1`, `${largura}px; ${links.join(' e ')}`, largura <= vp.width && links[0] === 1 && links[1] === 1);

  if (nome === 'desktop') {
    // Uma escola selecionada no topo (Aurora)
    const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
    await X.page.getByRole('button', { name: /Todas as escolas/ }).first().click(); await X.page.waitForTimeout(500); await X.page.getByText(aurora.nome, { exact: true }).first().click();
    await X.page.waitForTimeout(2500);
    const sel = (await X.page.getByRole('button', { name: aurora.nome }).count()) > 0 ? String(aurora.id) : 'não trocou';
    const painelA = await get(tk, `/api/formulario-um-terco/ciclos/${aberto.id}/painel?escolaId=${aurora.id}`);
    const indA = ind.find(i => i.escolaId === aurora.id);
    const utA = await lerPainel(X.page, 'Entrega do Formulário 1/3');
    const pdiA = await lerPainel(X.page, 'Entrega do PDI');
    await foto(X.page, '45-dashboard-aurora');
    r('4', 'Escola Aurora selecionada no topo: PDI e 1/3 mostram só os números da Aurora', `PDI ${indA?.concluidas}/${indA?.emAndamento}; 1/3 ${painelA.resumo.concluidas}/${painelA.resumo.emAndamento}/${painelA.resumo.naoIniciadas}`, `seleção ${sel}; PDI ${pdiA.concluidas}/${pdiA.emAndamento}; 1/3 ${utA.concluidas}/${utA.emAndamento}/${utA.naoIniciadas}`, String(sel) === String(aurora.id) && pdiA.concluidas === indA.concluidas && pdiA.emAndamento === (indA.emAndamento ?? 0) && utA.concluidas === painelA.resumo.concluidas && utA.emAndamento === painelA.resumo.emAndamento && utA.naoIniciadas === painelA.resumo.naoIniciadas, '45-dashboard-aurora.png');

    // Página do PDI continua igual (mesmo componente, versão completa)
    await X.page.goto(BASE + '/#/pdi'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
    const pdiHome = await lerPainel(X.page, 'Entrega do PDI');
    await foto(X.page, '45-pdi-home');
    const espA = { c: indA.concluidas, e: indA.emAndamento ?? 0, n: Math.max(0, indA.totalEsperado - indA.concluidas - (indA.emAndamento ?? 0)) };
    r('5', 'Página do PDI (Aurora continua selecionada no topo): painel de entrega igual aos indicadores da Aurora (componente extraído, versão completa)', `${espA.c}/${espA.e}/${espA.n}`, `${pdiHome.concluidas}/${pdiHome.emAndamento}/${pdiHome.naoIniciadas}`, pdiHome.concluidas === espA.c && pdiHome.emAndamento === espA.e && pdiHome.naoIniciadas === espA.n, '45-pdi-home.png');
  }
  console.log(nome, 'erros:', X.erros.filter(e => !/40[134]/.test(e)));
  await X.browser.close();
}
await prisma.$disconnect();

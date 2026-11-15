// Desativados em tela própria por área (decisões do usuário, 15/11/2026). Navegador real, banco LOCAL.
// Substitui o 47. Cria dados com prefixo ZZDES e apaga tudo no fim.
// Intervenção declarada: os registros inativos de teste são criados direto no banco local (com desativadoEm).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const r = (id, cen, esp, obs, ok, ev = '') => registrar(`DESAT-${id}`, 'Desativados por área', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const P = 'ZZDES';
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(900); };
const semRolagem = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const corpo = async (page) => (await page.locator('main').innerText().catch(() => page.locator('body').innerText())).replace(/\s+/g, ' ');
const agora = Date.now();
const minutosAtras = (m) => new Date(agora - m * 60000);

async function limpar() {
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: P } }, select: { id: true } })).map(e => e.id);
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P.toLowerCase() } }, select: { id: true } })).map(p => p.id);
  const ciclos = (await prisma.cicloUmTerco.findMany({ where: { titulo: { startsWith: P } }, select: { id: true } })).map(c => c.id);
  await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: { in: ciclos } } });
  await prisma.cicloUmTerco.deleteMany({ where: { id: { in: ciclos } } });
  await prisma.atuacaoPedagogica.deleteMany({ where: { nome: { startsWith: P } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoas } }, { escolaId: { in: escolas } }] } });
  await prisma.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

await limpar();
const erros = [];
try {
  // ---- Massa: 22 escolas inativas (paginação de 20), 1 turma, 1 professor, 1 atuação, ciclos do 1/3 ----
  const escolaBase = await prisma.escola.create({ data: { nome: `${P} Escola base` } });
  for (let i = 1; i <= 22; i++) await prisma.escola.create({ data: { nome: `${P} Escola inativa ${String(i).padStart(2, '0')}`, status: 'INATIVA', desativadoEm: minutosAtras(100 - i) } });
  const turma = await prisma.turma.create({ data: { escolaId: escolaBase.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 8, turno: 'MANHA', identificador: 8, nome: `${P} 8M8`, identidadeChave: `zzdes-${agora}`, status: 'INATIVA', desativadoEm: minutosAtras(5) } });
  const prof = await prisma.pessoa.create({ data: { nome: `${P} Professor Inativo`, email: `${P.toLowerCase()}-prof@teste.invalid`, perfil: 'PROFESSOR', status: 'INATIVO', desativadoEm: minutosAtras(4) } });
  const atuacao = await prisma.atuacaoPedagogica.create({ data: { nome: `${P} Atuação inativa`, status: 'INATIVA', desativadoEm: minutosAtras(3) } });
  const cicloBase = { anoLetivo: 2026, trimestre: 3, todasEscolas: false, escolas: { create: [{ escolaId: escolaBase.id }] }, semanas: { create: [{ numero: 1, dataInicio: new Date('2026-09-01'), dataFim: new Date('2026-09-04') }] } };
  const vencido = await prisma.cicloUmTerco.create({ data: { ...cicloBase, titulo: `${P} vencido`, abreEm: new Date(agora - 3 * 86400000), prazoEm: new Date(agora - 60000) } });
  const inativo = await prisma.cicloUmTerco.create({ data: { ...cicloBase, titulo: `${P} inativo`, status: 'INATIVA', desativadoEm: minutosAtras(2), abreEm: new Date('2026-09-08T03:00:00Z'), prazoEm: new Date('2026-09-12T02:59:59Z') } });

  for (const [nome, vp] of [['computador', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    await login(X.page, 'secretaria@escola.gov.br', '12345678');

    // 1. Escolas
    await ir(X.page, '/escolas');
    const principal = await corpo(X.page);
    const linkEsc = X.page.getByRole('link', { name: /Ver escolas desativadas/ });
    const textoLink = await linkEsc.innerText().catch(() => '');
    await linkEsc.click(); await X.page.waitForTimeout(1200);
    const tabela = await X.page.locator('table').count();
    const linhas = await X.page.locator('tbody tr').count();
    const primeira = await X.page.locator('tbody tr').first().innerText().catch(() => '');
    const paginacao = (await corpo(X.page)).match(/Página 1 de \d+ · \d+ no total/)?.[0] ?? '';
    const larg1 = await semRolagem(X.page);
    await foto(X.page, `68-escolas-desativadas-${nome}`);
    r(`1-${nome}`, `${nome}: Escolas — lista principal sem inativas; "Ver escolas desativadas" abre TABELA paginada (20 por página), mais recente primeiro, com motivo`, 'sem ZZDES inativa na principal; tabela; 20 linhas; 1ª = inativa 22; "Página 1 de N"; sem rolagem lateral',
      `principal tem inativa: ${principal.includes('Escola inativa')}; link "${textoLink}"; tabelas ${tabela}; linhas ${linhas}; 1ª: "${primeira.slice(0, 60).replace(/\s+/g, ' ')}"; "${paginacao}"; sem rolagem: ${larg1}`,
      !principal.includes('Escola inativa') && tabela === 1 && linhas === 20 && primeira.includes('Escola inativa 22') && /Desativado manualmente/.test(primeira) && paginacao && larg1, `68-escolas-desativadas-${nome}.png`);

    if (nome === 'computador') {
      // 2. Reativar pela lista
      const alvo = X.page.locator('tbody tr', { hasText: 'Escola inativa 22' });
      await alvo.getByRole('button', { name: 'Reativar' }).click();
      await X.page.locator('div.fixed.inset-0').getByRole('button', { name: 'Reativar' }).click();
      await X.page.waitForTimeout(1500);
      const db = await prisma.escola.findFirst({ where: { nome: `${P} Escola inativa 22` } });
      const saiu = !(await X.page.locator('tbody tr', { hasText: 'Escola inativa 22' }).count());
      r('2', 'Reativar escola pela tela de desativadas: confirma, some da lista, volta ATIVA e sem data de desativação', 'ATIVA; desativadoEm nulo; sumiu da lista', `${db.status}; ${db.desativadoEm}; sumiu: ${saiu}`, db.status === 'ATIVA' && db.desativadoEm === null && saiu);
      await prisma.escola.update({ where: { id: db.id }, data: { status: 'INATIVA', desativadoEm: minutosAtras(78) } });
    }

    // 3. Turmas
    await ir(X.page, '/turmas');
    const semFiltroStatus = !(await X.page.getByText('Status', { exact: true }).count());
    const principalT = await corpo(X.page);
    await X.page.getByRole('link', { name: /Ver turmas desativadas/ }).click(); await X.page.waitForTimeout(1200);
    const temTurma = await X.page.locator('tbody tr', { hasText: `${P} 8M8` }).count();
    r(`3-${nome}`, `${nome}: Turmas — sem filtro Status; inativa fora da principal; tela de desativadas com a turma`, 'sem filtro; fora; 1 linha', `sem filtro: ${semFiltroStatus}; na principal: ${principalT.includes(`${P} 8M8`)}; linhas: ${temTurma}; sem rolagem: ${await semRolagem(X.page)}`, semFiltroStatus && !principalT.includes(`${P} 8M8`) && temTurma === 1 && await semRolagem(X.page));

    // 4. Pessoas
    await ir(X.page, '/pessoas');
    const semVerInativos = !(await X.page.getByText(/Ver inativos/).count());
    await X.page.getByRole('link', { name: /Ver desativados e encerrados/ }).click(); await X.page.waitForTimeout(1200);
    const temProf = await X.page.locator('tbody tr', { hasText: `${P} Professor Inativo` }).count();
    await X.page.locator('select').first().selectOption('cargos'); await X.page.waitForTimeout(1000);
    const cabecalhoCargo = (await X.page.locator('thead').innerText()).replace(/\s+/g, ' ');
    r(`4-${nome}`, `${nome}: Pessoas — sem "Ver inativos" nas abas; tela própria com o professor inativo; troca para "Cargos encerrados" carrega tabela "Encerrado em"`, 'sem link antigo; 1 linha; coluna Encerrado em', `sem link antigo: ${semVerInativos}; linhas: ${temProf}; thead: ${cabecalhoCargo}; sem rolagem: ${await semRolagem(X.page)}`, semVerInativos && temProf === 1 && /Encerrado em/i.test(cabecalhoCargo) && await semRolagem(X.page));

    // 5. Configurações (atuações)
    await ir(X.page, '/configuracoes');
    const atuNaPrincipal = (await corpo(X.page)).includes(`${P} Atuação inativa`);
    await X.page.getByRole('link', { name: /Ver atuações desativadas/ }).click(); await X.page.waitForTimeout(1200);
    const temAtu = await X.page.locator('tbody tr', { hasText: `${P} Atuação inativa` }).count();
    r(`5-${nome}`, `${nome}: Configurações — atuação inativa fora da lista; tela de desativados com ela`, 'fora; 1 linha', `na principal: ${atuNaPrincipal}; linhas: ${temAtu}; sem rolagem: ${await semRolagem(X.page)}`, !atuNaPrincipal && temAtu === 1 && await semRolagem(X.page));

    // 6. Formulário 1/3: vencido e inativo fora da principal; lista com motivos; Reabrir só no vencido
    await ir(X.page, '/formulario-um-terco');
    const principal13 = await corpo(X.page);
    await X.page.getByRole('link', { name: /Ver encerrados e inativos/ }).click(); await X.page.waitForTimeout(1200);
    const lVencido = X.page.locator('tbody tr', { hasText: `${P} vencido` });
    const lInativo = X.page.locator('tbody tr', { hasText: `${P} inativo` });
    const tVencido = (await lVencido.innerText().catch(() => '')).replace(/\s+/g, ' ');
    const tInativo = (await lInativo.innerText().catch(() => '')).replace(/\s+/g, ' ');
    const cartoes = await X.page.locator('h2', { hasText: 'trimestre de' }).count();
    await foto(X.page, `68-um-terco-encerrados-${nome}`);
    r(`6-${nome}`, `${nome}: 1/3 — vencido e inativo fora da principal; tela "Encerrados e inativos" em tabela (sem cartões) com "Encerrado pelo prazo" (Painel/Excel/Reabrir) e "Desativado manualmente" (Reativar, sem Reabrir)`,
      'fora; vencido: Encerrado pelo prazo + Reabrir; inativo: Desativado manualmente + Reativar; 0 cartões',
      `principal tem: ${principal13.includes(`${P} vencido`) || principal13.includes(`${P} inativo`)}; vencido: "${tVencido.slice(0, 120)}"; inativo: "${tInativo.slice(0, 120)}"; cartões: ${cartoes}; sem rolagem: ${await semRolagem(X.page)}`,
      !principal13.includes(`${P} vencido`) && !principal13.includes(`${P} inativo`) && /Encerrado pelo prazo/.test(tVencido) && /Reabrir/.test(tVencido) && /Painel/.test(tVencido) && /Desativado manualmente/.test(tInativo) && /Reativar/.test(tInativo) && !/Reabrir/.test(tInativo) && cartoes === 0 && await semRolagem(X.page), `68-um-terco-encerrados-${nome}.png`);

    if (nome === 'computador') {
      await lVencido.getByRole('button', { name: 'Painel' }).click(); await X.page.waitForTimeout(1500);
      r('7', '1/3 — "Painel" na linha do ciclo vencido abre o painel de entregas dele', `/formulario-um-terco/ciclos/${vencido.id}`, X.page.url().split('#')[1], X.page.url().includes(`/formulario-um-terco/ciclos/${vencido.id}`));
    }

    // 8. PDI: aplicações/modelos e alunos arquivados abrem em tabela
    await ir(X.page, '/pdi/formulario?ver=desativados&tipo=aplicacoes');
    const tabApl = await X.page.locator('table').count();
    await X.page.locator('select').first().selectOption('modelos'); await X.page.waitForTimeout(1200);
    const tabMod = await X.page.locator('table').count();
    await ir(X.page, '/pdi/alunos?ver=arquivados');
    const tituloAl = (await X.page.locator('h1', { hasText: 'Alunos PDI arquivados' }).count()) ? 'Alunos PDI arquivados' : '';
    const tabAl = await X.page.locator('table').count();
    r(`8-${nome}`, `${nome}: PDI — encerradas/removidas, modelos desativados e alunos arquivados abrem em tabela`, '3 tabelas; "Alunos PDI arquivados"', `aplicações ${tabApl}; modelos ${tabMod}; alunos ${tabAl} "${tituloAl}"; sem rolagem: ${await semRolagem(X.page)}`, tabApl === 1 && tabMod === 1 && tabAl === 1 && tituloAl === 'Alunos PDI arquivados' && await semRolagem(X.page));

    erros.push(...X.erros);
    await X.browser.close();
  }

  // 9. Diretora: sem link e sem tela de desativados
  {
    const D = await abrir();
    await login(D.page, 'diretora.aur@homolog.nexo', 'Nexo!Homolog-2026');
    await ir(D.page, '/pessoas');
    const link = await D.page.getByRole('link', { name: /Ver desativados/ }).count();
    const antigo = await D.page.getByText(/Ver inativos/).count();
    await ir(D.page, '/pessoas?ver=desativados');
    const titulo = (await D.page.locator('h1', { hasText: 'Gestão de Pessoas' }).count()) ? 'Gestão de Pessoas' : '';
    r('9', 'Diretora: sem "Ver desativados" nem "Ver inativos" em Gestão de Pessoas; endereço direto mostra a tela normal', '0; 0; "Gestão de Pessoas"', `${link}; ${antigo}; "${titulo}"`, link === 0 && antigo === 0 && titulo === 'Gestão de Pessoas');
    erros.push(...D.erros);
    await D.browser.close();
  }
  void inativo; void turma; void prof; void atuacao;
} finally {
  await limpar();
}
const relevantes = erros.filter(e => /PAGEERROR|HTTP 5/.test(e));
r('10', 'Console em todo o roteiro', 'nenhum erro de página nem 5xx', relevantes.slice(0, 3).join(' | ') || 'nenhum', relevantes.length === 0);
await prisma.$disconnect();

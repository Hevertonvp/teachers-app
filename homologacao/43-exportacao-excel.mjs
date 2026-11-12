// Exportação para Excel — navegador real, banco LOCAL. Cada planilha é BAIXADA pela tela, aberta com
// ExcelJS e conferida contra o banco: sem omitir nem duplicar, filtros respeitados, acentos, datas,
// campos vazios, texto com cara de fórmula gravado como texto, controle de acesso.
// Altera temporariamente 1 resposta do PDI e 1 semana do 1/3 (texto "=..." com acento) e RESTAURA no fim.
import ExcelJS from 'exceljs';
import { abrir, login, foto, BASE, EVID } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const r = (id, cen, esp, obs, ok, evid = '') => registrar(`EXP-${id}`, 'Exportação para Excel', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const API = 'http://localhost:3340';
const SENHA_GD = 'Nexo!Homolog-2026';
const FORMULA_PDI = '=1+1 História (teste de fórmula)';

const ORDEM = []; // por arquivo: primeira aba, última aba, aba ativa ao abrir, linhas da primeira aba
async function baixar(page, botao, nome) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), botao.click()]);
  const caminho = EVID + nome + '.xlsx';
  await download.saveAs(caminho);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const primeira = wb.worksheets[0];
  ORDEM.push({ nome, primeira: primeira.name, ultima: wb.worksheets.at(-1).name, ativa: wb.views?.[0]?.activeTab ?? 0, linhas: primeira.rowCount - 1, cab: primeira.getRow(1).values.slice(1, 4).join(" | ") });
  return { wb, arquivo: download.suggestedFilename() };
}
// Aba -> lista de objetos { cabeçalho: célula }
const aba = (wb, nome) => {
  const ws = wb.getWorksheet(nome);
  if (!ws) return null;
  const cab = ws.getRow(1).values.slice(1);
  const linhas = [];
  ws.eachRow((row, n) => { if (n > 1) linhas.push(Object.fromEntries(cab.map((h, i) => [h, row.getCell(i + 1)]))); });
  return { ws, cab, linhas, v: (l, h) => l[h]?.value };
};
const filtro = (wb, rotulo) => {
  let valor = null;
  wb.getWorksheet('Filtros').eachRow(row => { if (row.getCell(1).value === rotulo) valor = row.getCell(2).value; });
  return valor;
};
// Nenhuma célula com lixo de serialização nem fórmula
const sujeira = (wb) => {
  const achados = [];
  wb.eachSheet(ws => ws.eachRow(row => row.eachCell(c => {
    if (c.formula || c.type === ExcelJS.ValueType.Formula) achados.push(`${ws.name}!${c.address} fórmula`);
    if (typeof c.value === 'string' && /^(undefined|null|NaN|\[object Object\])$|undefined|\[object Object\]/.test(c.value)) achados.push(`${ws.name}!${c.address}=${c.value}`);
  })));
  return achados;
};
const diaUtc = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
const token = (page) => page.evaluate(() => localStorage.getItem('authToken'));
const apiGet = async (tk, path) => { const res = await fetch(API + path, { headers: { authorization: 'Bearer ' + tk } }); return { status: res.status, body: res.status < 400 ? await res.json() : null }; };

// ---- preparação: textos com cara de fórmula (restaurados no fim) ----
const respostaPdi = await prisma.respostaPdi.findFirst({ where: { aplicacaoPergunta: { tipoResposta: 'TEXTO' }, ficha: { status: 'CONCLUIDA' } }, include: { ficha: true } });
const respostaPdiOriginal = respostaPdi?.valor;

try {
  if (respostaPdi) await prisma.respostaPdi.update({ where: { id: respostaPdi.id }, data: { valor: { ...(respostaPdi.valor ?? {}), resposta: FORMULA_PDI } } });

  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tkSec = await token(X.page);

  // ================= A. PDI (página principal) =================
  await X.page.goto(BASE + '/#/pdi'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  await foto(X.page, '43-pdi-home');
  const { wb: wbPdi, arquivo: arqPdi } = await baixar(X.page, X.page.getByRole('button', { name: 'Exportar para Excel' }), '43-pdi');
  const escolaFiltroPdi = filtro(wbPdi, 'Escola');
  const escolaPdi = /^Todas/.test(String(escolaFiltroPdi)) ? null : await prisma.escola.findFirst({ where: { nome: String(escolaFiltroPdi) } });
  const whereFichas = escolaPdi ? { aluno: { turma: { escolaId: escolaPdi.id } } } : {};
  const fichasDb = await prisma.fichaPdi.findMany({ where: whereFichas, select: { id: true, status: true, alunoId: true, aplicacaoId: true, aplicacaoDataInicioSnapshot: true } });
  const fichas = aba(wbPdi, 'Fichas');
  const chaves = new Set(fichas.linhas.map(l => [fichas.v(l, 'Aplicação'), fichas.v(l, 'Escola'), fichas.v(l, 'Turma'), fichas.v(l, 'Aluno'), fichas.v(l, 'Disciplina')].join('|')));
  r('A1', `PDI: aba Fichas = Fichas do banco no escopo (${escolaPdi ? escolaPdi.nome : 'todas as escolas'}), sem duplicar`, `${fichasDb.length} linhas, ${fichasDb.length} chaves únicas`, `${fichas.linhas.length} linhas, ${chaves.size} chaves únicas; arquivo ${arqPdi}; abas ${wbPdi.worksheets.map(w => w.name).join(', ')}`, fichas.linhas.length === fichasDb.length && chaves.size === fichasDb.length, '43-pdi.xlsx');

  const contar = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] ?? 0) + 1, m), {});
  const stDb = contar(fichasDb, f => ({ PENDENTE: 'Não iniciada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' })[f.status]);
  const stXl = contar(fichas.linhas, l => fichas.v(l, 'Status'));
  r('A2', 'PDI: concluídas, em andamento e não iniciadas batem com o banco', JSON.stringify(stDb), JSON.stringify(stXl), JSON.stringify(Object.entries(stDb).sort()) === JSON.stringify(Object.entries(stXl).sort()));

  const fichaIds = fichasDb.map(f => f.id);
  const respDb = await prisma.respostaPdi.count({ where: { fichaId: { in: fichaIds }, aplicacaoPergunta: { tipoResposta: { not: 'ORIENTACAO' } } } });
  const resp = aba(wbPdi, 'Respostas');
  r('A3', 'PDI: aba Respostas = respostas do banco dessas Fichas (sem orientações)', String(respDb), String(resp.linhas.length), resp.linhas.length === respDb);

  const alunoIds = [...new Set(fichasDb.map(f => f.alunoId))]; const aplIds = [...new Set(fichasDb.map(f => f.aplicacaoId))];
  const comunsDb = await prisma.respostaPadraoPdi.count({ where: { bloco: { alunoId: { in: alunoIds }, aplicacaoId: { in: aplIds } }, aplicacaoPerguntaPadrao: { tipoResposta: { not: 'ORIENTACAO' } } } });
  const comuns = aba(wbPdi, 'Perguntas comuns');
  r('A4', 'PDI: aba Perguntas comuns = respostas comuns do banco desses alunos/Aplicações', String(comunsDb), String(comuns.linhas.length), comuns.linhas.length === comunsDb);

  const celFormula = resp.linhas.map(l => l['Resposta']).find(c => c.value === FORMULA_PDI);
  r('A5', 'PDI: resposta que começa com "=" vira TEXTO na planilha (não fórmula), com acento preservado', `tipo String, valor "${FORMULA_PDI}"`, celFormula ? `tipo ${celFormula.type === ExcelJS.ValueType.String ? 'String' : celFormula.type}, fórmula: ${celFormula.formula ?? 'nenhuma'}` : 'célula não encontrada', !!celFormula && celFormula.type === ExcelJS.ValueType.String && !celFormula.formula);

  const ini = fichas.linhas.map(l => l['Início']).find(c => c.value instanceof Date);
  const primeiraFicha = fichasDb.find(Boolean);
  const iniDb = primeiraFicha ? diaUtc(primeiraFicha.aplicacaoDataInicioSnapshot) : '';
  const iniXlDias = new Set(fichas.linhas.map(l => diaUtc(l['Início'].value)));
  const iniDbDias = new Set(fichasDb.map(f => diaUtc(f.aplicacaoDataInicioSnapshot)));
  r('A6', 'PDI: datas de início como DATA (dd/mm/aaaa), mesmo dia do banco (sem voltar um dia)', `datas ${[...iniDbDias].join(', ')}`, `datas ${[...iniXlDias].join(', ')}; formato ${ini?.numFmt}; ex. banco ${iniDb}`, ini && ini.numFmt === 'dd/mm/yyyy' && [...iniDbDias].sort().join() === [...iniXlDias].sort().join());

  const indic = (await apiGet(tkSec, '/api/pdi-aplicacoes/indicadores')).body.filter(i => !escolaPdi || i.escolaId === escolaPdi.id);
  const entrega = aba(wbPdi, 'Entrega por escola');
  const somaXl = entrega.linhas.reduce((s, l) => s + (entrega.v(l, 'Concluídas') ?? 0), 0);
  const somaApi = indic.reduce((s, i) => s + i.concluidas, 0);
  r('A7', 'PDI: aba Entrega por escola = mesmos números do painel (indicadores)', `${indic.length} escolas, ${somaApi} concluídas`, `${entrega.linhas.length} escolas, ${somaXl} concluídas`, entrega.linhas.length === indic.length && somaXl === somaApi);
  const sujPdi = sujeira(wbPdi);
  r('A8', 'PDI: nenhuma célula com fórmula, "undefined", "null" ou "[object Object]"; vazios ficam vazios', 'nenhuma', sujPdi.slice(0, 5).join('; ') || 'nenhuma', sujPdi.length === 0);

  // ================= B. Formulário 1/3: coberto pelo teste 61-excel-um-terco-por-cargo.mjs (1/3 por cargo, 12/11/2026). =================

  // ================= C. Gestão de Pessoas (professores) =================
  await X.page.goto(BASE + '/#/pessoas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  await foto(X.page, '43-pessoas');
  const { wb: wbProf } = await baixar(X.page, X.page.getByRole('button', { name: 'Exportar para Excel' }), '43-professores');
  const profApi = (await apiGet(tkSec, '/api/pessoas/professores')).body;
  const prof = aba(wbProf, 'Professores'); const vinc = aba(wbProf, 'Vínculos');
  const vincDb = await prisma.professorTurmaDisciplina.findMany({ where: { status: 'ATIVO', professorId: { in: profApi.map(p => p.id) } }, include: { professor: true } });
  const chavesV = new Set(vinc.linhas.map(l => [vinc.v(l, 'Professor'), vinc.v(l, 'Escola'), vinc.v(l, 'Turma'), vinc.v(l, 'Disciplina')].join('|')));
  r('C1', 'Professores: 1 linha por professor; Vínculos = vínculos ATIVOS do banco, sem duplicar', `${profApi.length} professores; ${vincDb.length} vínculos`, `${prof.linhas.length} professores (${new Set(prof.linhas.map(l => prof.v(l, 'E-mail'))).size} e-mails únicos); ${vinc.linhas.length} vínculos (${chavesV.size} únicos)`, prof.linhas.length === profApi.length && vinc.linhas.length === vincDb.length && chavesV.size === vincDb.length, '43-professores.xlsx');
  const porProf = contar(vincDb, v => v.professor.nome);
  const multi = Object.entries(porProf).sort((a, b) => b[1] - a[1])[0];
  const multiXl = vinc.linhas.filter(l => vinc.v(l, 'Professor') === multi?.[0]).length;
  const multiCol = prof.linhas.find(l => prof.v(l, 'Nome') === multi?.[0]);
  r('C2', 'Professores: professor com vários vínculos aparece em várias linhas de Vínculos e com a contagem certa', `${multi?.[0]}: ${multi?.[1]}`, `${multiXl} linhas; coluna "Vínculos ativos" = ${multiCol ? prof.v(multiCol, 'Vínculos ativos') : '?'}`, multi && multiXl === multi[1] && prof.v(multiCol, 'Vínculos ativos') === multi[1]);

  // ================= D. Turmas (filtro de escola) =================
  const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
  await X.page.goto(BASE + '/#/turmas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  await X.page.locator('select').filter({ hasText: 'Todas as escolas' }).first().selectOption(String(aurora.id)); await X.page.waitForTimeout(800);
  await foto(X.page, '43-turmas');
  const { wb: wbTur } = await baixar(X.page, X.page.getByRole('button', { name: 'Exportar para Excel' }), '43-turmas-aurora');
  const tur = aba(wbTur, 'Turmas'); const turV = aba(wbTur, 'Professores e disciplinas');
  const turDb = await prisma.turma.findMany({ where: { escolaId: aurora.id, status: 'ATIVA' }, select: { id: true } });
  const turVDb = await prisma.professorTurmaDisciplina.count({ where: { status: 'ATIVO', turmaId: { in: turDb.map(t => t.id) } } });
  const soAurora = tur.linhas.every(l => tur.v(l, 'Escola') === aurora.nome) && turV.linhas.every(l => turV.v(l, 'Escola') === aurora.nome);
  r('D1', `Turmas (filtro Escola = ${aurora.nome}, Ativas): todas as turmas do filtro (não só a página), só dessa escola; professores/disciplinas ativos delas`, `${turDb.length} turmas; ${turVDb} vínculos; Filtros: Escola = ${aurora.nome}`, `${tur.linhas.length} turmas; ${turV.linhas.length} vínculos; só Aurora: ${soAurora}; Filtros: Escola = ${filtro(wbTur, 'Escola')}`, tur.linhas.length === turDb.length && turV.linhas.length === turVDb && soAurora && filtro(wbTur, 'Escola') === aurora.nome, '43-turmas-aurora.xlsx');

  // ================= E. PDI > Alunos (status "Todos") =================
  await X.page.goto(BASE + '/#/pdi/alunos'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  await X.page.locator('select').filter({ hasText: 'Arquivados' }).first().selectOption('todos'); await X.page.waitForTimeout(800);
  await foto(X.page, '43-pdi-alunos');
  const { wb: wbAl } = await baixar(X.page, X.page.getByRole('button', { name: 'Exportar para Excel' }), '43-alunos-pdi');
  const al = aba(wbAl, 'Alunos PDI');
  const topo = filtro(wbAl, 'Escola (topo)');
  const escTopo = /^Todas/.test(String(topo)) ? null : await prisma.escola.findFirst({ where: { nome: String(topo) } });
  const alDb = await prisma.alunoPdi.count({ where: escTopo ? { turma: { escolaId: escTopo.id } } : {} });
  r('E1', `Alunos PDI (status Todos; escola do topo: ${topo}): todos os alunos do filtro, não só a página da tabela`, String(alDb), `${al.linhas.length} linhas (${new Set(al.linhas.map(l => [al.v(l, 'Aluno'), al.v(l, 'Escola'), al.v(l, 'Turma')].join('|'))).size} únicas); Filtros: ${filtro(wbAl, 'Ativos e arquivados')}`, al.linhas.length === alDb && filtro(wbAl, 'Ativos e arquivados') === 'Todos', '43-alunos-pdi.xlsx');
  const sujResto = [...sujeira(wbProf), ...sujeira(wbTur), ...sujeira(wbAl)];
  r('E2', 'Professores/Turmas/Alunos: nenhuma célula com fórmula ou lixo de serialização', 'nenhuma', sujResto.slice(0, 5).join('; ') || 'nenhuma', sujResto.length === 0);
  console.log('erros Secretaria:', X.erros.filter(e => !/40[134]/.test(e)));
  await X.browser.close();

  // ================= F. Controle de acesso =================
  const P = await abrir();
  await login(P.page, 'p01@homolog.nexo', 'Nexo!Prof01-2026');
  const tkP = await token(P.page);
  const pPdi = await apiGet(tkP, '/api/pdi-fichas/exportacao');
  const p13 = await apiGet(tkP, '/api/formulario-um-terco/ciclos/1/exportacao');
  await P.page.goto(BASE + '/#/pdi'); await P.page.waitForLoadState('networkidle'); await P.page.waitForTimeout(1500);
  const botaoProf = await P.page.getByRole('button', { name: 'Exportar para Excel' }).count();
  r('F1', 'Professor: API de exportação do PDI e do 1/3 recusam (403); botão não aparece na página do PDI', '403, 403, 0 botões', `${pPdi.status}, ${p13.status}, ${botaoProf} botões`, pPdi.status === 403 && p13.status === 403 && botaoProf === 0);
  await P.browser.close();

  const D = await abrir();
  await login(D.page, 'diretora.aur@homolog.nexo', SENHA_GD);
  const diretora = await prisma.pessoa.findUnique({ where: { email: 'diretora.aur@homolog.nexo' }, include: { vinculosEscolares: { where: { status: 'ATIVO' } } } });
  const escolasDir = diretora.vinculosEscolares.map(v => v.escolaId);
  await D.page.goto(BASE + '/#/pdi'); await D.page.waitForLoadState('networkidle'); await D.page.waitForTimeout(1500);
  const { wb: wbDir } = await baixar(D.page, D.page.getByRole('button', { name: 'Exportar para Excel' }), '43-pdi-diretora');
  const escolaDirFiltro = filtro(wbDir, 'Escola');
  const escDirSel = /^Todas/.test(String(escolaDirFiltro)) ? null : await prisma.escola.findFirst({ where: { nome: String(escolaDirFiltro) } });
  // Escopo = o MESMO da listagem de Fichas (segue a escola ATUAL do aluno): comparado com a própria API de listagem.
  const fichasDir = await prisma.fichaPdi.count({ where: { aluno: { turma: { escolaId: escDirSel ? escDirSel.id : { in: escolasDir } } } } });
  const listagemDir = (await apiGet(await token(D.page), '/api/pdi-fichas')).body.filter(f => !escDirSel || f.escolaId !== undefined);
  const fDir = aba(wbDir, 'Fichas');
  const nomesEscDir = (await prisma.escola.findMany({ where: { id: { in: escolasDir } } })).map(e => e.nome);
  const foraDoEscopo = fDir.linhas.filter(l => !nomesEscDir.includes(fDir.v(l, 'Escola atual do aluno'))).length;
  const feitasEmOutra = fDir.linhas.filter(l => fDir.v(l, 'Escola') !== fDir.v(l, 'Escola atual do aluno')).length;
  const d13 = await apiGet(await token(D.page), '/api/formulario-um-terco/ciclos/1/exportacao');
  r('F2', `Diretora (escolas: ${nomesEscDir.join(', ')}): exporta só Fichas de alunos das próprias escolas — mesmo escopo da listagem de Fichas; 1/3 continua só da Secretaria`, `${fichasDir} Fichas (listagem: ${listagemDir.length}), 0 de aluno fora das escolas dela; 1/3: 403`, `${fDir.linhas.length} Fichas, ${foraDoEscopo} fora; ${feitasEmOutra} feita(s) em outra escola antes de transferência (coluna "Escola atual do aluno"); 1/3: ${d13.status}`, fDir.linhas.length === fichasDir && (escDirSel || fDir.linhas.length === listagemDir.length) && foraDoEscopo === 0 && d13.status === 403, '43-pdi-diretora.xlsx');
  await D.browser.close();

  // ================= G. O arquivo abre NA LISTA (não na aba Filtros) =================
  const ruins = ORDEM.filter(o => o.primeira === 'Filtros' || o.ultima !== 'Filtros' || o.ativa !== 0 || o.linhas < 1);
  r('G1', 'Toda exportação abre na aba de dados (com linhas); a aba Filtros é a última', 'todas', ORDEM.map(o => `${o.nome}: abre em "${o.primeira}" (${o.linhas} linhas; ${o.cab}), última "${o.ultima}"`).join(' ¦ '), ruins.length === 0);
} finally {
  if (respostaPdi) await prisma.respostaPdi.update({ where: { id: respostaPdi.id }, data: { valor: respostaPdiOriginal } });
  const voltouPdi = respostaPdi ? JSON.stringify((await prisma.respostaPdi.findUnique({ where: { id: respostaPdi.id } })).valor) === JSON.stringify(respostaPdiOriginal) : true;
  console.log('textos de teste restaurados:', voltouPdi);
  await prisma.$disconnect();
}

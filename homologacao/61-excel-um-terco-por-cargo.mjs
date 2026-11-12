// Exportação para Excel do Formulário 1/3 POR CARGO (12/11/2026) — navegador real, banco LOCAL.
// A planilha é BAIXADA pela tela, aberta com ExcelJS e conferida contra a API/banco: abas, cabeçalhos (sem
// ano/série), cargo + "escola — disciplinas", conteúdos das semanas, texto com cara de fórmula, datas, filtros.
// Usa os cargos de teste (cargos-homolog.mjs) e apaga as folhas criadas no fim.
import ExcelJS from 'exceljs';
import { abrir, login, foto, BASE, EVID } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, FOLHAS_ESPERADAS_CICLO1, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';

const r = (id, cen, esp, obs, ok, evid = '') => registrar(`XLS13-${id}`, 'Excel do 1/3 por cargo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const API = 'http://localhost:3340';
const FORMULA = '=HYPERLINK("http://exemplo.invalido";"clique") Ação, reflexão e ênfase';
const A = 'ZZ-HOMOLOG Escola Aurora'; const BV = 'ZZ-HOMOLOG Escola Boa Vista';
const tokenDe = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo ? JSON.stringify(corpo) : undefined }); return res.json().catch(() => ({})); };

async function baixar(page, botao, nome) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), botao.click()]);
  const caminho = EVID + nome + '.xlsx';
  await download.saveAs(caminho);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  return wb;
}
const aba = (wb, nome) => {
  const ws = wb.getWorksheet(nome);
  if (!ws) return null;
  const cab = ws.getRow(1).values.slice(1);
  const linhas = [];
  ws.eachRow((row, n) => { if (n > 1) linhas.push(Object.fromEntries(cab.map((h, i) => [h, row.getCell(i + 1)]))); });
  return { cab, linhas, v: (l, h) => l[h]?.value };
};
const filtro = (wb, rotulo) => { let valor = null; wb.getWorksheet('Filtros')?.eachRow(row => { if (row.getCell(1).value === rotulo) valor = row.getCell(2).value; }); return valor; };
const sujeira = (wb) => { const a = []; wb.eachSheet(ws => ws.eachRow(row => row.eachCell(c => { if (c.formula || c.type === ExcelJS.ValueType.Formula) a.push(`${ws.name}!${c.address} fórmula`); if (typeof c.value === 'string' && /undefined|\[object Object\]|^null$|^NaN$/.test(c.value)) a.push(`${ws.name}!${c.address}=${c.value}`); }))); return a; };
const dia = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

await prepararCargosHomolog();
const p13 = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'p13@homolog.nexo' } });
const regente = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor Regente' } });
const intervencao = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor de Intervenção' } });
const escolaA = await prisma.escola.findFirstOrThrow({ where: { nome: A } });
const inglesId = (await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Inglês' } })).id;
const antesAbertura = new Date('2026-11-01T12:00:00Z');
const cargoP13 = await prisma.cargoProfessor.create({ data: { professorId: p13.id, dataInicio: new Date('2026-02-01T00:00:00Z'), createdAt: antesAbertura, versoes: { create: { criadaEm: antesAbertura, composicao: [{ escolaId: escolaA.id, disciplinaIds: [inglesId], atuacaoIds: [regente.id, intervencao.id] }] } } } });
const FOLHAS = FOLHAS_ESPERADAS_CICLO1 + 1;
const ciclo = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } } } });
// Massa: P05 (1 cargo, 2 escolas) conclui com acento e "fórmula" na semana 1; P07 (2 cargos iguais) e P14 (Educação Infantil) começam.
for (const [cod, textos, concluir] of [['p05', [FORMULA, 'Semana 2: atletismo.', 'Semana 3: vôlei.', 'Semana 4: avaliação prática.'], true], ['p07', ['Frações equivalentes.'], false], ['p14', ['Brincadeiras cantadas e roda de conversa.'], false]]) {
  const tk = await tokenDe(`${cod}@homolog.nexo`, SENHA(cod)); const [c] = await cargosDe(cod);
  const s = await api(tk, 'PUT', `/api/formulario-um-terco/ciclos/1/cargos/${c}/respostas`, { baseUpdatedAt: null, respostas: ciclo.semanas.slice(0, textos.length).map((x, i) => ({ semanaId: x.id, texto: textos[i] })) });
  if (concluir) await api(tk, 'POST', `/api/formulario-um-terco/ciclos/1/cargos/${c}/concluir`, { baseUpdatedAt: s.updatedAt });
}

const X = await abrir();
try {
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tkSec = await X.page.evaluate(() => localStorage.getItem('authToken'));
  const painel = await api(tkSec, 'GET', '/api/formulario-um-terco/ciclos/1/painel');
  const respostasDb = await prisma.respostaSemanaUmTerco.findMany({ where: { entregaId: { in: painel.linhas.map(l => l.entregaId).filter(Boolean) } }, include: { semana: true } });

  // ---- Lista de ciclos → Exportar ----
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  const cartao = X.page.locator('div', { has: X.page.getByRole('heading', { name: /Formulário 1\/3 — Nov\/2026 \(homolog\)/ }) }).filter({ has: X.page.getByRole('button', { name: 'Exportar para Excel' }) }).last();
  const wb = await baixar(X.page, cartao.getByRole('button', { name: 'Exportar para Excel' }), '61-um-terco-lista');
  const abas = wb.worksheets.map(w => w.name);
  const ent = aba(wb, 'Entregas'); const con = aba(wb, 'Conteúdos');
  r('1', 'Planilha abre com as abas Entregas, Conteúdos, Cobertura por escola, Resumo e Filtros', 'todas presentes', abas.join(', '), ['Entregas', 'Conteúdos', 'Cobertura por escola', 'Resumo', 'Filtros'].every(n => abas.includes(n)));
  const cabEnt = ['Professor', 'Cargo', 'Escolas e atuação', 'Status', 'Semanas preenchidas', 'Total de semanas', 'Concluída em', 'Última alteração'];
  const cabCon = ['Professor', 'Cargo', 'Escolas e atuação', 'Semana', 'Início', 'Fim', 'Conteúdo'];
  const semAnoSerie = !wb.worksheets.some(w => w.getRow(1).values.some(v => /Ano\/série|Turmas?$|^Disciplina$/.test(String(v ?? ''))));
  r('2', 'Cabeçalhos: cargo e "escolas e disciplinas"; sem ano/série, sem turma, sem disciplina solta', `Entregas: ${cabEnt.join(' | ')}; Conteúdos: ${cabCon.join(' | ')}`, `Entregas: ${ent.cab.join(' | ')}; Conteúdos: ${con.cab.join(' | ')}`, JSON.stringify(ent.cab) === JSON.stringify(cabEnt) && JSON.stringify(con.cab) === JSON.stringify(cabCon) && semAnoSerie);

  const chaves = new Set(ent.linhas.map(l => `${ent.v(l, 'Professor')}|${ent.v(l, 'Cargo')}|${ent.v(l, 'Escolas e atuação')}`));
  r('3', `Entregas = folhas do painel (${FOLHAS}), sem duplicar`, `${painel.linhas.length} linhas únicas`, `${ent.linhas.length} linhas (${chaves.size} únicas)`, ent.linhas.length === painel.linhas.length && chaves.size === ent.linhas.length && ent.linhas.length === FOLHAS);

  const nome = async (cod) => (await prisma.pessoa.findUnique({ where: { email: `${cod}@homolog.nexo` } })).nome;
  const linhaDe = async (cod) => { const n = await nome(cod); return ent.linhas.filter(l => ent.v(l, 'Professor') === n); };
  const l05 = await linhaDe('p05'); const l07 = await linhaDe('p07'); const l14 = await linhaDe('p14'); const l12 = await linhaDe('p12');
  const v = (ls, h) => ls.map(l => ent.v(l, h)).join(' / ');
  r('4', 'Cargo de 2 escolas (P05): 1 linha com as duas escolas associadas às disciplinas; status Concluído', `Cargo 1; ${A} — Educação Física; ${BV} — Educação Física; Concluído; 4/4`, `${v(l05, 'Cargo')}; ${v(l05, 'Escolas e atuação')}; ${v(l05, 'Status')}; ${v(l05, 'Semanas preenchidas')}/${v(l05, 'Total de semanas')}`, l05.length === 1 && ent.v(l05[0], 'Cargo') === 'Cargo 1' && ent.v(l05[0], 'Escolas e atuação') === `${A} — Educação Física | ${BV} — Educação Física` && ent.v(l05[0], 'Status') === 'Concluído' && ent.v(l05[0], 'Semanas preenchidas') === 4);
  r('5', 'Cargos iguais (P07): 1 linha "Cargos 1 e 2"; quase iguais (P12): 2 linhas', 'P07: Cargos 1 e 2; P12: Cargo 1 e Cargo 2', `P07: ${v(l07, 'Cargo')}; P12: ${v(l12, 'Cargo')}`, l07.length === 1 && ent.v(l07[0], 'Cargo') === 'Cargos 1 e 2' && l12.length === 2);
  r('6', 'Educação Infantil (P14): só a escola, sem disciplina inventada', `${A}`, `${v(l14, 'Escolas e atuação')}; ${v(l14, 'Status')}`, l14.length === 1 && ent.v(l14[0], 'Escolas e atuação') === A);

  const l13 = await linhaDe('p13');
  r('6b', 'Atuação pedagógica na planilha: disciplina e atuações da mesma escola na mesma célula', `${A} — Inglês; Professor de Intervenção, Professor Regente`, v(l13, 'Escolas e atuação'), l13.length === 1 && ent.v(l13[0], 'Escolas e atuação') === `${A} — Inglês; Professor de Intervenção, Professor Regente`);
  r('7', 'Conteúdos = semanas com texto das folhas listadas (banco)', `${respostasDb.length}`, `${con.linhas.length}`, con.linhas.length === respostasDb.length);
  const celF = con.linhas.find(l => l['Conteúdo'].value === FORMULA);
  r('8', 'Texto que começa com "=" e tem acentos fica como TEXTO (não vira fórmula)', 'String, sem fórmula', celF ? `tipo ${celF['Conteúdo'].type === ExcelJS.ValueType.String ? 'String' : celF['Conteúdo'].type}; fórmula ${celF['Conteúdo'].formula ?? 'nenhuma'}` : 'não encontrado', !!celF && celF['Conteúdo'].type === ExcelJS.ValueType.String && !celF['Conteúdo'].formula);
  const s1 = ciclo.semanas[0];
  r('9', 'Início/fim da semana iguais ao banco (sem voltar um dia); linha do conteúdo traz cargo e escolas', `${dia(s1.dataInicio)} a ${dia(s1.dataFim)}; Cargo 1`, celF ? `${dia(celF['Início'].value)} a ${dia(celF['Fim'].value)}; ${celF['Cargo'].value}; ${celF['Escolas e atuação'].value}` : '—', !!celF && dia(celF['Início'].value) === dia(s1.dataInicio) && dia(celF['Fim'].value) === dia(s1.dataFim) && celF['Cargo'].value === 'Cargo 1' && /Boa Vista — Educação Física/.test(celF['Escolas e atuação'].value));

  const cob = aba(wb, 'Cobertura por escola');
  const porEscola = Object.fromEntries(cob.linhas.map(l => [cob.v(l, 'Escola'), cob.v(l, 'Esperadas')]));
  const res = aba(wb, 'Resumo');
  r('10', 'Cobertura por escola: folha de 2 escolas conta nas duas; o Resumo conta cada folha uma vez', `Aurora 13; Boa Vista 3; Resumo ${FOLHAS}`, `Aurora ${porEscola[A]}; Boa Vista ${porEscola[BV]}; Resumo ${res.v(res.linhas[0], 'Esperadas')}`, porEscola[A] === 13 && porEscola[BV] === 3 && res.v(res.linhas[0], 'Esperadas') === FOLHAS);

  // ---- Painel filtrado por escola (Boa Vista) → Exportar ----
  await X.page.goto(BASE + '/#/formulario-um-terco/ciclos/1'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  const selEscola = X.page.getByLabel('Escola').first();
  const valorBV = await selEscola.evaluate((s, t) => [...s.options].find(o => o.text === t)?.value, BV);
  await selEscola.selectOption(valorBV); await X.page.waitForTimeout(1500);
  const semAnoNoPainel = (await X.page.getByLabel('Ano/série').count()) === 0;
  await foto(X.page, '61-painel-boa-vista');
  const wbBV = await baixar(X.page, X.page.getByRole('button', { name: 'Exportar para Excel' }), '61-um-terco-painel-boa-vista');
  const entBV = aba(wbBV, 'Entregas');
  const todasBV = entBV.linhas.every(l => String(entBV.v(l, 'Escolas e atuação')).includes(BV));
  r('11', 'Painel filtrado por escola: só folhas que cobrem a escola (P05 incluído); filtro anotado na planilha; sem filtro de ano/série', `3 folhas, todas com Boa Vista; Filtros: Escola = ${BV}`, `${entBV.linhas.length} folhas; todas com BV: ${todasBV}; filtro: ${filtro(wbBV, 'Escola')}; ano/série na tela: ${!semAnoNoPainel}`, entBV.linhas.length === 3 && todasBV && filtro(wbBV, 'Escola') === BV && semAnoNoPainel && filtro(wbBV, 'Ano/série') === null);
  const suj = [...sujeira(wb), ...sujeira(wbBV)];
  r('12', 'Nenhuma célula com fórmula ou lixo de serialização ("undefined", "[object Object]")', 'nenhuma', suj.slice(0, 5).join('; ') || 'nenhuma', suj.length === 0);
  r('13', 'Sem erros no console', '0', X.erros.join(' | ') || '0', X.erros.length === 0);
} finally {
  await X.browser.close();
  await prisma.cargoVersao.deleteMany({ where: { cargoId: cargoP13.id } });
  await prisma.cargoProfessor.delete({ where: { id: cargoP13.id } });
  await prepararCargosHomolog(); // apaga as folhas criadas por este teste
  await prisma.$disconnect();
}

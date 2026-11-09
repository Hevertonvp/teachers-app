// Fase 7 — vínculos históricos, múltiplos vínculos e estados administrativos.
// INTERVENÇÃO DECLARADA: professores P07–P15 e seus vínculos COM DATAS PASSADAS/FUTURAS são criados direto no banco local
// (a interface não permite informar data de início do vínculo — DEF-03). Todas as LEITURAS e verificações são pela interface.
// Janela do ciclo A: 02/11/2026 08:00 → 20/11/2026 18:00. Hoje (sistema): 04/11/2026.
// Contagens esperadas calculadas À MÃO (abaixo), não pelo algoritmo de produção.
import { createRequire } from 'node:module';
import { abrir, login, foto, sair, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');

const d = (s) => new Date(s + 'T00:00:00Z');
const disc = async (nome) => (await prisma.disciplina.findUnique({ where: { nome } })).id;
const esc = async (n) => (await prisma.escola.findFirst({ where: { nome: { contains: n } } })).id;
const turma = async (escolaNome, nome) => (await prisma.turma.findFirst({ where: { nome, escola: { nome: { contains: escolaNome } } } })).id;

// ---- Parte A (UI): turma de Educação Infantil na Aurora (P14 não deve receber o formulário) ----
let b = await abrir();
await login(b.page, 'secretaria@escola.gov.br', '123456');
if (!(await prisma.turma.count({ where: { etapa: 'EDUCACAO_INFANTIL', escola: { nome: { contains: 'Aurora' } } } }))) {
  await b.page.goto(BASE + '/#/turmas'); await b.page.waitForLoadState('networkidle');
  await b.page.getByRole('button', { name: '+ Nova turma' }).first().click();
  const m = b.page.locator('div.fixed.inset-0');
  await m.getByLabel('Escola').selectOption({ label: 'ZZ-HOMOLOG Escola Aurora' });
  await m.getByLabel('Ano letivo').fill('2026');
  await m.getByLabel('Etapa').selectOption({ label: 'Educação Infantil' });
  await m.getByLabel('Turno').selectOption({ label: 'Manhã' });
  await m.getByLabel('Identificador da turma').fill('1');
  await m.getByRole('button', { name: 'Salvar' }).click(); await b.page.waitForTimeout(1200);
}
const turmaEI = await prisma.turma.findFirst({ where: { etapa: 'EDUCACAO_INFANTIL', escola: { nome: { contains: 'Aurora' } } } });
registrar('UT-VIN-00', 'Vínculos', 'Turma de Educação Infantil criada pela interface', 'turma EI existe', turmaEI ? turmaEI.nome : 'não criada', turmaEI ? 'APROVADO' : 'REPROVADO');
await b.browser.close();

// ---- Parte B (banco local, declarado): professores e vínculos históricos ----
const hash = await bcrypt.hash('Nexo!ProfXX-2026', 10);
const AUR = await esc('Aurora'), BV = await esc('Boa Vista');
const plano = [
  ['P07', AUR, [['6M3', 'Matemática', 'ATIVO', '2026-11-10', null]]],
  ['P08', AUR, [['6M4', 'Redação', 'ENCERRADO', '2026-02-10', '2026-11-10']]],
  ['P09', AUR, [['6M3', 'História', 'ENCERRADO', '2026-02-10', '2026-10-15']]],
  ['P10', AUR, [['6M3', 'Arte', 'ATIVO', '2026-11-25', null]]],
  ['P11', AUR, [['7M1', 'História', 'ATIVO', '2026-02-10', null]]],
  ['P12', AUR, [['6M4', 'Ciências', 'ATIVO', '2026-02-10', null], ['6M3', 'Ciências', 'ENCERRADO', '2026-02-10', '2026-11-01'], ['7M2', 'Ciências', 'ATIVO', '2026-11-15', null]]],
  ['P13', AUR, []],
  ['P14', AUR, [['EI', 'Arte', 'ATIVO', '2026-02-10', null]]],
  ['P15', BV, [['7M1', 'Matemática', 'ATIVO', '2026-02-10', null]]],
];
for (const [cod, escolaId, vincs] of plano) {
  const email = `${cod.toLowerCase()}@homolog.nexo`;
  if (await prisma.pessoa.findUnique({ where: { email } })) continue;
  const p = await prisma.pessoa.create({ data: { nome: `Professor(a) ${cod} Homolog`, email, perfil: 'PROFESSOR', senhaHash: await bcrypt.hash(`Nexo!Prof${cod.slice(1)}-2026`, 10), senhaTemporaria: false } });
  await prisma.vinculoEscolar.create({ data: { escolaId, pessoaId: p.id, status: 'ATIVO', dataInicio: d('2026-02-01') } });
  for (const [tn, dn, st, ini, fim] of vincs) {
    const turmaId = tn === 'EI' ? turmaEI.id : await turma(escolaId === AUR ? 'Aurora' : 'Boa Vista', tn);
    await prisma.professorTurmaDisciplina.create({ data: { professorId: p.id, turmaId, disciplinaId: await disc(dn), status: st, dataInicio: d(ini), dataFim: fim ? d(fim) : null } });
  }
}
console.log('Professores P07–P15 e vínculos preparados no banco local.');

// ---- Parte C (UI): o que cada professor vê. Expectativas à mão. ----
const esperadoCards = {
  P07: ['6º ano — Matemática'],                         // vínculo começou DENTRO da janela (10/11 ≤ 20/11)
  P08: ['6º ano — Redação'],                            // encerrou 10/11, DENTRO da janela (≥ 02/11)
  P09: [],                                              // encerrou 15/10, ANTES da janela
  P10: [],                                              // começou 25/11, DEPOIS do prazo (20/11)
  P11: ['7º ano — História'],
  P12: ['6º ano — Ciências', '7º ano — Ciências'],      // 6M3 encerrou 01/11 (antes) fica fora; 6M4 e 7M2 (início 15/11) entram
  P13: [],                                              // ativo sem vínculos
  P14: [],                                              // Educação Infantil não recebe o 1/3
  P15: ['7º ano — Matemática'],
};
const coberturaEsperada = { P12: { '6º ano — Ciências': ['6M4'], '7º ano — Ciências': ['7M2'] }, P07: { '6º ano — Matemática': ['6M3'] } };
let totalCards = 0;
for (const cod of Object.keys(esperadoCards)) {
  const x = await abrir();
  await login(x.page, `${cod.toLowerCase()}@homolog.nexo`, `Nexo!Prof${cod.slice(1)}-2026`);
  await x.page.goto(BASE + '/#/formulario-um-terco'); await x.page.waitForLoadState('networkidle'); await x.page.waitForTimeout(1500);
  const cards = await x.page.locator('h2.text-xl').evaluateAll(hs => hs.map(h => { const c = h.closest('div.flex-col'); return { r: h.innerText.trim(), t: c ? c.innerText.replace(/\s+/g, ' ') : '' }; }));
  totalCards += cards.length;
  await foto(x.page, `13-${cod}-lista`);
  const obs = cards.map(c => c.r).sort(); const exp = [...esperadoCards[cod]].sort();
  let ok = JSON.stringify(obs) === JSON.stringify(exp);
  let cob = '';
  for (const [rotulo, turmas] of Object.entries(coberturaEsperada[cod] ?? {})) { const c = cards.find(k => k.r === rotulo); const bate = !!c && turmas.every(t => c.t.includes(t)); cob += ` | ${rotulo} cobre ${turmas.join(',')}: ${bate}`; ok = ok && bate; }
  const aviso = cards.length === 0 ? (await x.page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 130) : '';
  registrar(`UT-VIN-${cod}`, 'Vínculos', `${cod}: formulários visíveis conforme vínculo histórico`, exp.join(' + ') || '(nenhum)', (obs.join(' + ') || '(nenhum)') + cob + (aviso ? ` — tela: "${aviso}"` : ''), ok ? 'APROVADO' : 'REPROVADO', `13-${cod}-lista.png`);
  await x.browser.close();
}

// ---- Parte D (UI): painel da Secretaria. Esperado (à mão) = 15 já existentes + 6 novos = 21 ----
//  existentes: P01=1, P02=3, P03=2, P04=7, P05=1, P06=1 → 15 ; novos: P07=1, P08=1, P11=1, P12=2, P15=1 → 6
async function lerPainel(tag) {
  const s = await abrir();
  await login(s.page, 'secretaria@escola.gov.br', '123456');
  const ciclo = await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } } });
  await s.page.goto(BASE + `/#/formulario-um-terco/ciclos/${ciclo.id}`); await s.page.waitForLoadState('networkidle'); await s.page.waitForTimeout(2000);
  const txt = (await s.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const pega = (rot) => Number((txt.match(new RegExp(rot + '\\s*(\\d+)')) ?? [])[1]);
  const r = { esperadas: pega('Esperadas'), concluidas: pega('Concluídas'), andamento: pega('Em andamento'), nao: pega('Não iniciadas') };
  const linhas = await s.page.locator('div.space-y-3 > div').count();
  await foto(s.page, `13-painel-${tag}`);
  await s.browser.close();
  return { ...r, linhas, txt };
}
const p1 = await lerPainel('antes');
registrar('UT-VIN-PAINEL1', 'Painel', 'Painel: obrigações esperadas = 21 (cálculo manual por professor)', 'Esperadas 21', JSON.stringify({ esperadas: p1.esperadas, concluidas: p1.concluidas, andamento: p1.andamento, nao: p1.nao, linhas: p1.linhas }), p1.esperadas === 21 ? 'APROVADO' : 'REPROVADO', '13-painel-antes.png');
registrar('UT-VIN-PAINEL1b', 'Painel', 'Painel: concluídas + em andamento + não iniciadas = esperadas', 'soma = esperadas', `${p1.concluidas}+${p1.andamento}+${p1.nao}=${p1.concluidas + p1.andamento + p1.nao}`, p1.concluidas + p1.andamento + p1.nao === p1.esperadas ? 'APROVADO' : 'REPROVADO');
registrar('UT-VIN-CARDS', 'Painel', 'Total de cartões vistos pelos professores novos = 6 e bate com o painel', '6', String(totalCards), totalCards === 6 ? 'APROVADO' : 'REPROVADO');
console.log('Painel antes:', JSON.stringify({ ...p1, txt: undefined }));
await prisma.$disconnect();

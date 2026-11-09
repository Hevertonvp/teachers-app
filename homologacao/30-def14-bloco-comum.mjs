// DEF-14 — bloco de perguntas comuns do PDI nunca pode ser alterado por OUTRO professor.
// Uso: node 30-def14-bloco-comum.mjs antes|depois   (mesmo roteiro antes e depois da correção)
// Cria alunos fictícios novos a cada execução (sufixo de hora). Professores pela INTERFACE (Chromium);
// preparação, transferências, substituição de professor e gravações simultâneas pela API (declarado);
// conferência no banco LOCAL. Nunca toca no Neon.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { createRequire } from 'node:module';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');

const FASE = (process.argv[2] || 'antes').toUpperCase();
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const API = 'http://localhost:3340';
const AP1 = 1, AP2 = 2, T_6M1 = 1, T_6M2 = 2, T_6M3 = 3, T_BV6M1 = 7;
const ARTE = 3, CIENCIAS = 6, INGLES = 9, LP = 1;
const ID = { p02: 12, p04: 14, p06: 16, p10: 20, p12: 22 };
const SENHA = (c) => `Nexo!Prof${c.slice(1)}-2026`;
for (const c of ['p02', 'p06', 'p12']) await prisma.pessoa.update({ where: { email: `${c}@homolog.nexo` }, data: { senhaHash: await bcrypt.hash(SENHA(c), 10), senhaTemporaria: false } });

const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const tk = {}; for (const c of ['p02', 'p04', 'p06', 'p10', 'p12']) tk[c] = await token(`${c}@homolog.nexo`, SENHA(c));
const tSec = await token('secretaria@escola.gov.br', '123456');
const r = (id, cen, esp, obs, ok, evid = '', nota = '') => registrar(`DEF14-${FASE}-${id}`, 'PDI bloco comum (DEF-14)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid, nota);

const bloco = (alunoId, turmaId, professorId, aplicacaoId = AP1) => prisma.blocoRespostasPadraoPdi.findUnique({ where: { aplicacaoId_alunoId_turmaId_professorId: { aplicacaoId, alunoId, turmaId, professorId } }, include: { respostas: true } });
const textoDo = (b) => b ? JSON.stringify(b.respostas.map(x => x.valor)) : '(sem bloco)';
const criarAluno = async (nome, turmaId) => (await api(tSec, 'POST', '/api/pdi-alunos', { nome, turmaId, responsavelNome: 'Responsável fictício', responsavelParentesco: 'Mãe', responsavelTelefone: '(31) 90000-0000' })).json;
const mover = async (aluno, turmaId) => api(tSec, 'PUT', `/api/pdi-alunos/${aluno.id}`, { nome: aluno.nome, turmaId, responsavelNome: 'Responsável fictício', responsavelParentesco: 'Mãe', responsavelTelefone: '(31) 90000-0000' });
const ficha = async (prof, ap, alunoId, disc) => (await api(tk[prof], 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap, alunoId, disciplinaId: disc })).json;
const salvarComum = async (prof, f, texto) => api(tk[prof], 'PUT', `/api/pdi-fichas/${f.ficha.id}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: f.blocoPadrao.perguntas.find(p => p.tipoResposta !== 'ORIENTACAO').id, valor: { resposta: texto, complementarTexto: '' } }], version: f.blocoPadrao.version });
// Abre o aluno pela interface e devolve o valor do campo comum (1º textarea); opcionalmente digita e salva.
async function telaProfessor(prof, ap, alunoId, novoTexto, arq) {
  const X = await abrir();
  await login(X.page, `${prof}@homolog.nexo`, SENHA(prof));
  await X.page.goto(`${BASE}/#/pdi/aluno/${ap}/${alunoId}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const tas = X.page.locator('main textarea');
  const n = await tas.count();
  const comum = n ? await tas.nth(0).inputValue() : '(sem campos)';
  await foto(X.page, `${arq}-antes`);
  let salvou = false, erroTela = '';
  if (novoTexto && n) {
    await tas.nth(0).fill(novoTexto);
    await X.page.getByRole('button', { name: 'Salvar', exact: true }).click(); await X.page.waitForTimeout(3000);
    salvou = true;
    erroTela = ((await X.page.locator('body').innerText()).replace(/\s+/g, ' ').match(/(não pode|não é|Erro|recus|conflit)[^.]{0,90}/i) || [''])[0];
    await foto(X.page, `${arq}-depois`);
  }
  await X.browser.close();
  return { comum, salvou, erroTela, n };
}

// ===== S1 — mesmo aluno, mesma turma, dois professores (P04 Arte e P02 LP) + gravação quase simultânea =====
const A = await criarAluno(`DEF14 Ana ${TAG}`, T_6M1);
const B = await criarAluno(`DEF14 Bruno ${TAG}`, T_6M2);
console.log('alunos', A?.id, B?.id);
await telaProfessor('p04', AP1, A.id, `P04 escreveu sobre a Ana (${TAG})`, `30-${FASE}-S1-p04`);
await telaProfessor('p02', AP1, A.id, `P02 escreveu sobre a Ana (${TAG})`, `30-${FASE}-S1-p02`);
let b04 = await bloco(A.id, T_6M1, ID.p04), b02 = await bloco(A.id, T_6M1, ID.p02);
r('S1a', 'Mesma turma: P04 e P02 salvam o campo comum da mesma aluna pela tela; cada um no próprio bloco', '2 blocos, cada um com o texto do seu autor', `P04: ${textoDo(b04).slice(0, 60)} | P02: ${textoDo(b02).slice(0, 60)}`, textoDo(b04).includes('P04 escreveu') && textoDo(b02).includes('P02 escreveu'), `30-${FASE}-S1-p02-depois.png`);
const [f04, f02] = await Promise.all([ficha('p04', AP1, A.id, ARTE), ficha('p02', AP1, A.id, LP)]);
const [s04, s02] = await Promise.all([salvarComum('p04', f04, `P04 simultâneo ${TAG}`), salvarComum('p02', f02, `P02 simultâneo ${TAG}`)]);
b04 = await bloco(A.id, T_6M1, ID.p04); b02 = await bloco(A.id, T_6M1, ID.p02);
r('S1b', 'P04 e P02 gravam o campo comum ao mesmo tempo (API em paralelo)', 'as duas gravações aceitas, cada uma no próprio bloco', `HTTP ${s04.status}/${s02.status}; P04: ${textoDo(b04).slice(0, 50)} | P02: ${textoDo(b02).slice(0, 50)}`, s04.status === 200 && s02.status === 200 && textoDo(b04).includes('P04 simultâneo') && textoDo(b02).includes('P02 simultâneo'));

// ===== S2 — P04 conclui a ficha de Arte da Ana (respostas copiadas de uma ficha de Arte já concluída, só o formato) =====
const modeloArte = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: AP1, disciplinaId: ARTE, status: 'CONCLUIDA' }, include: { respostas: true } });
const fA = await ficha('p04', AP1, A.id, ARTE);
const pr = await api(tk.p04, 'PUT', `/api/pdi-fichas/${fA.ficha.id}/respostas`, { respostas: modeloArte.respostas.map(x => ({ aplicacaoPerguntaId: x.aplicacaoPerguntaId, valor: typeof x.valor?.resposta === 'string' && x.valor.resposta.length > 20 ? { ...x.valor, resposta: `Arte da Ana pela P04 (${TAG})` } : x.valor })), baseUpdatedAt: fA.ficha.updatedAt ?? fA.ficha.createdAt });
const cc = await api(tk.p04, 'POST', `/api/pdi-fichas/${fA.ficha.id}/concluir`, {});
const fichaArteAntes = await prisma.fichaPdi.findUnique({ where: { id: fA.ficha.id }, include: { respostas: true } });
r('S2', 'P04 preenche e conclui a ficha de Arte da Ana (professora anterior com ficha concluída)', 'CONCLUIDA', `respostas HTTP ${pr.status}; concluir HTTP ${cc.status}; status ${fichaArteAntes.status}`, fichaArteAntes.status === 'CONCLUIDA');
const textoP04Antes = textoDo(await bloco(A.id, T_6M1, ID.p04));

// ===== S3 — troca de TURMA (6M1 → 6M3, Arte passa para o P10) =====
await mover(A, T_6M3);
const t3 = await telaProfessor('p10', AP1, A.id, `P10 escreveu sobre a Ana (${TAG})`, `30-${FASE}-S3-p10`);
const p04Depois = textoDo(await bloco(A.id, T_6M1, ID.p04));
const b10 = await bloco(A.id, T_6M3, ID.p10);
r('S3a', 'Troca de turma: o campo comum que o novo professor (P10) vê ao abrir a aluna', 'vazio (o bloco é dele, não o da P04)', `"${t3.comum.slice(0, 60)}"`, t3.comum === '', `30-${FASE}-S3-p10-antes.png`);
r('S3b', 'Troca de turma: depois de o P10 salvar, o bloco da P04 continua intacto', 'texto da P04 inalterado', `antes ${textoP04Antes.slice(0, 50)} | depois ${p04Depois.slice(0, 50)}`, p04Depois === textoP04Antes, `30-${FASE}-S3-p10-depois.png`);
r('S3c', 'Troca de turma: o texto do P10 fica no bloco DELE (turma atual 6M3)', 'bloco P10/6M3 com o texto do P10', textoDo(b10).slice(0, 70), textoDo(b10).includes('P10 escreveu'));
const fichaArteDepois = await prisma.fichaPdi.findUnique({ where: { id: fA.ficha.id }, include: { respostas: true } });
r('S3d', 'Ficha de Arte concluída pela P04 continua concluída e com as respostas dela', 'CONCLUIDA; respostas iguais', `status ${fichaArteDepois.status}; respostas iguais: ${JSON.stringify(fichaArteAntes.respostas.map(x => x.valor)) === JSON.stringify(fichaArteDepois.respostas.map(x => x.valor))}`, fichaArteDepois.status === 'CONCLUIDA' && JSON.stringify(fichaArteAntes.respostas.map(x => x.valor)) === JSON.stringify(fichaArteDepois.respostas.map(x => x.valor)));

// ===== S4 — SUBSTITUIÇÃO de professor sem transferência (Ciências 6M2: P06 → P12) =====
const fB = await ficha('p06', AP1, B.id, CIENCIAS);
await salvarComum('p06', fB, `P06 escreveu sobre o Bruno (${TAG})`);
const p06Antes = textoDo(await bloco(B.id, T_6M2, ID.p06));
const sub = await api(tSec, 'POST', '/api/professor-turma-disciplina', { turmaId: T_6M2, professorId: ID.p12, disciplinaId: CIENCIAS });
const t4 = await telaProfessor('p12', AP1, B.id, `P12 escreveu sobre o Bruno (${TAG})`, `30-${FASE}-S4-p12`);
const p06Depois = textoDo(await bloco(B.id, T_6M2, ID.p06));
const b12 = await bloco(B.id, T_6M2, ID.p12);
r('S4a', 'Substituição de professor (sem transferência): campo comum que o substituto (P12) vê', 'vazio (bloco próprio)', `substituição HTTP ${sub.status}; "${t4.comum.slice(0, 60)}"`, t4.comum === '', `30-${FASE}-S4-p12-antes.png`);
r('S4b', 'Substituição: depois de o P12 salvar, o bloco do P06 continua intacto', 'texto do P06 inalterado', `antes ${p06Antes.slice(0, 45)} | depois ${p06Depois.slice(0, 45)}`, p06Depois === p06Antes, `30-${FASE}-S4-p12-depois.png`);
r('S4c', 'Substituição: texto do P12 no bloco DELE', 'bloco P12/6M2 com o texto do P12', textoDo(b12).slice(0, 70), textoDo(b12).includes('P12 escreveu'));
await api(tSec, 'POST', '/api/professor-turma-disciplina', { turmaId: T_6M2, professorId: ID.p06, disciplinaId: CIENCIAS }); // devolve Ciências 6M2 ao P06

// ===== S5 — troca de ESCOLA (6M3 Aurora → 6M1 Boa Vista; Inglês = P04 na Aplicação da Boa Vista) =====
await mover(A, T_BV6M1);
const t5 = await telaProfessor('p04', AP2, A.id, `P04 na Boa Vista sobre a Ana (${TAG})`, `30-${FASE}-S5-p04`);
const p04Final = textoDo(await bloco(A.id, T_6M1, ID.p04));
const p10Final = textoDo(await bloco(A.id, T_6M3, ID.p10));
r('S5a', 'Troca de escola: na nova Aplicação o campo comum da P04 começa vazio (sem cópia)', 'vazio', `"${t5.comum.slice(0, 60)}"`, t5.comum === '', `30-${FASE}-S5-p04-antes.png`);
r('S5b', 'Troca de escola: blocos anteriores (P04 na Aurora 6M1 e P10 na Aurora 6M3) intactos', 'inalterados', `P04 igual: ${p04Final === p04Depois}; P10 igual: ${p10Final === textoDo(b10)}`, p04Final === p04Depois && p10Final === textoDo(b10));

console.log('fim', FASE, TAG);
await prisma.$disconnect();

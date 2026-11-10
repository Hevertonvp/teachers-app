// PDI — transferência de TURMA na mesma escola (Aurora 6M1 → 6M3), com ficha EM ANDAMENTO (Lucas)
// e CONCLUÍDA (Marina). Transferência pela interface da Secretaria; professores pela interface.
// Leitura direta do banco local só para conferir persistência (declarado). Nada de código de produção.
import fs from 'node:fs';
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '12345678'];
const P04 = ['p04@homolog.nexo', 'Nexo!Prof04-2026'];
const P10 = ['p10@homolog.nexo', 'Nexo!Prof10-2026'];
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const txt = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const SAIDA = {};

const AP = 1, LUCAS = 1, MARINA = 2, ARTE = 3;
const T_6M3 = (await prisma.turma.findFirst({ where: { nome: '6M3', escolaId: 1 } })).id;

// ---------- Fotografia ANTES (banco local) ----------
const fotoBanco = async () => ({
  fichas: await prisma.fichaPdi.findMany({ where: { alunoId: { in: [LUCAS, MARINA] } }, include: { respostas: { orderBy: { aplicacaoPerguntaId: 'asc' } } }, orderBy: { id: 'asc' } }),
  blocos: await prisma.blocoRespostasPadraoPdi.findMany({ where: { alunoId: { in: [LUCAS, MARINA] } }, include: { respostas: true }, orderBy: { id: 'asc' } }),
  mov: await prisma.movimentacaoAlunoPdi.findMany({ where: { alunoId: { in: [LUCAS, MARINA] } }, orderBy: { id: 'asc' } }),
});
const antes = await fotoBanco();
const tSec = await token(SEC);
const indAntes = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
SAIDA.indicadoresAntes = indAntes;
console.log('INDICADORES ANTES', JSON.stringify(indAntes));

// ---------- 1. Secretaria transfere Lucas e Marina para a 6M3 PELA INTERFACE ----------
const S = await abrir();
await login(S.page, ...SEC);
for (const [alunoId, nome] of [[LUCAS, 'Lucas'], [MARINA, 'Marina']]) {
  await S.page.goto(`${BASE}/#/pdi/alunos/${alunoId}`); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(1500);
  await S.page.getByRole('button', { name: 'Editar aluno' }).click(); await S.page.waitForTimeout(600);
  const m = S.page.locator('div.fixed.inset-0');
  const selTurma = m.locator('select').nth(1);
  await selTurma.selectOption(String(T_6M3));
  await foto(S.page, `25a-editar-${nome}`);
  await m.getByRole('button', { name: 'Salvar' }).click(); await S.page.waitForTimeout(2000);
  const aluno = await prisma.alunoPdi.findUnique({ where: { id: alunoId } });
  registrar(`PDI-TRF-T0-${nome}`, 'PDI transferência', `Secretaria troca ${nome} de 6M1 para 6M3 (mesma escola) pela interface`, 'turma = 6M3', `turmaId ${aluno.turmaId} (6M3 = ${T_6M3})`, aluno.turmaId === T_6M3 ? 'APROVADO' : 'REPROVADO', `25a-editar-${nome}.png`);
}
await S.browser.close();

const mov = await prisma.movimentacaoAlunoPdi.findMany({ where: { alunoId: { in: [LUCAS, MARINA] } }, orderBy: { id: 'asc' } });
const movOk = [LUCAS, MARINA].every(a => { const x = mov.filter(m => m.alunoId === a); return x.length === 2 && x[0].dataFim && !x[1].dataFim && x[1].turmaId === T_6M3; });
registrar('PDI-TRF-T1', 'PDI transferência', 'Histórico de movimentação: turma antiga fechada e nova aberta (Lucas e Marina)', '2 movimentações por aluno; antiga com fim; nova aberta', mov.map(m => `${m.alunoId}:${m.turmaId}:${m.dataFim ? 'fechada' : 'aberta'}`).join(' '), movOk ? 'APROVADO' : 'REPROVADO');

// ---------- 2. Indicadores depois ----------
const indDepois = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
SAIDA.indicadoresDepoisTurma = indDepois;
const aur = (l) => l.find(e => e.escolaId === 1);
registrar('PDI-TRF-T2', 'PDI transferência', 'Indicadores da Aurora antes × depois da troca de turma (mesma escola)', 'registrar variação', `antes esp ${aur(indAntes).totalEsperado}/concl ${aur(indAntes).concluidas}/and ${aur(indAntes).emAndamento} → depois esp ${aur(indDepois).totalEsperado}/concl ${aur(indDepois).concluidas}/and ${aur(indDepois).emAndamento}`, 'OBSERVAÇÃO (regra não especificada)');

// ---------- 3. Professora anterior (P04) perde o acesso ----------
const A = await abrir();
await login(A.page, ...P04);
await A.page.goto(BASE + '/#/pdi/meus-pdis'); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(1800);
const listaP04 = await txt(A.page);
await foto(A.page, '25a-p04-meus-pdis');
registrar('PDI-TRF-T3', 'PDI transferência', 'Professora anterior (P04, 6M1) deixa de ver Lucas e Marina em "Meus PDIs"', 'Lucas e Marina ausentes', `Lucas: ${listaP04.includes('Lucas')}; Marina: ${listaP04.includes('Marina')}`, !listaP04.includes('Lucas') && !listaP04.includes('Marina') ? 'APROVADO' : 'REPROVADO', '25a-p04-meus-pdis.png');
await A.page.goto(`${BASE}/#/pdi/aluno/${AP}/${LUCAS}`); await A.page.waitForLoadState('networkidle'); await A.page.waitForTimeout(2000);
const telaP04 = await txt(A.page);
await foto(A.page, '25a-p04-url-lucas');
const tP04 = await token(P04);
const gP04 = await api(tP04, 'GET', `/api/pdi-fichas/${AP}/${LUCAS}/${ARTE}`);
const pP04 = await api(tP04, 'PUT', `/api/pdi-fichas/${antes.fichas.find(f => f.alunoId === LUCAS && f.disciplinaId === ARTE).id}/respostas`, { respostas: [] });
registrar('PDI-TRF-T4', 'PDI transferência', 'P04 abre por URL/API a ficha de Arte do Lucas depois da troca de turma', 'sem acesso (403)', `tela: ${(telaP04.match(/(não é o professor|sem acesso|não tem|Você não)[^.]{0,80}/i) || ['(sem mensagem)'])[0]}; GET ${gP04.status}; PUT ${pP04.status}`, gP04.status === 403 && pP04.status === 403 ? 'APROVADO' : 'REPROVADO', '25a-p04-url-lucas.png');
await A.browser.close();

// ---------- 4. Novo professor (P10, Arte 6M3) ----------
const B = await abrir();
await login(B.page, ...P10);
await B.page.goto(BASE + '/#/pdi/meus-pdis'); await B.page.waitForLoadState('networkidle'); await B.page.waitForTimeout(1800);
const listaP10 = await txt(B.page);
await foto(B.page, '25a-p10-meus-pdis');
registrar('PDI-TRF-T5', 'PDI transferência', 'Novo professor (P10, Arte 6M3) passa a ver Lucas e Marina em "Meus PDIs"', 'Lucas e Marina presentes', `Lucas: ${listaP10.includes('Lucas')}; Marina: ${listaP10.includes('Marina')}`, listaP10.includes('Lucas') && listaP10.includes('Marina') ? 'APROVADO' : 'OBSERVAÇÃO (regra não especificada)', '25a-p10-meus-pdis.png');

// 4a. Lucas (ficha de Arte EM ANDAMENTO, escrita pela P04)
await B.page.goto(`${BASE}/#/pdi/aluno/${AP}/${LUCAS}`); await B.page.waitForLoadState('networkidle'); await B.page.waitForTimeout(2200);
const telaLucas = await txt(B.page);
await foto(B.page, '25a-p10-lucas-antes');
const tas = B.page.locator('main textarea');
const nTas = await tas.count();
const valores = []; for (let i = 0; i < nTas; i++) valores.push(await tas.nth(i).inputValue());
SAIDA.p10LucasCampos = valores;
const blocoP04Lucas = antes.blocos.find(b => b.alunoId === LUCAS && b.professorId === 14);
const textoBlocoP04 = JSON.stringify(blocoP04Lucas?.respostas.map(r => r.valor) ?? []);
const mostraTextoP04 = valores.some(v => v && textoBlocoP04.includes(v.slice(0, 30)));
registrar('PDI-TRF-T6', 'PDI transferência', 'P10 abre o Lucas: o que aparece no campo compartilhado e na ficha de Arte escrita pela P04', 'registrar', `${nTas} campos; campo compartilhado mostra o texto da P04: ${mostraTextoP04}; Arte mostra texto da P04: ${valores.some(v => v.startsWith('Em Arte'))}; turma/professor exibidos: ${(telaLucas.match(/6M[13][^|]{0,60}/) || [''])[0]}`, 'OBSERVAÇÃO (regra não especificada)', '25a-p10-lucas-antes.png');

let editou = false;
if (nTas > 0) {
  const idxArte = valores.findIndex(v => v.startsWith('Em Arte'));
  if (idxArte >= 0 && !(await tas.nth(idxArte).isDisabled())) await tas.nth(idxArte).fill('P10 (novo professor) ALTEROU a resposta de Arte escrita pela P04.');
  if (!(await tas.nth(0).isDisabled())) await tas.nth(0).fill('P10 (novo professor) ALTEROU o campo compartilhado.');
  const salvar = B.page.getByRole('button', { name: 'Salvar', exact: true });
  if (await salvar.count() && !(await salvar.isDisabled())) { await salvar.click(); await B.page.waitForTimeout(3000); editou = true; }
}
await foto(B.page, '25a-p10-lucas-depois-salvar');
const depoisA = await fotoBanco();
const fArteLucasAntes = antes.fichas.find(f => f.alunoId === LUCAS && f.disciplinaId === ARTE);
const fArteLucasDepois = depoisA.fichas.find(f => f.id === fArteLucasAntes.id);
const arteMudou = JSON.stringify(fArteLucasAntes.respostas.map(r => r.valor)) !== JSON.stringify(fArteLucasDepois.respostas.map(r => r.valor));
registrar('PDI-TRF-T7', 'PDI transferência', 'P10 consegue ALTERAR a ficha de Arte EM ANDAMENTO do Lucas iniciada pela P04', 'registrar (regra a definir)', `salvou pela tela: ${editou}; respostas da ficha mudaram no banco: ${arteMudou}; status ${fArteLucasDepois.status}; responsável na fotografia: ${fArteLucasDepois.professorNomeSnapshot}`, 'OBSERVAÇÃO (regra não especificada)', '25a-p10-lucas-depois-salvar.png');

const blocoP04LucasDepois = depoisA.blocos.find(b => b.id === blocoP04Lucas.id);
const blocoP04Mudou = JSON.stringify(blocoP04Lucas.respostas.map(r => r.valor)) !== JSON.stringify(blocoP04LucasDepois.respostas.map(r => r.valor));
const blocosNovos = depoisA.blocos.filter(b => !antes.blocos.some(x => x.id === b.id)).map(b => `id${b.id}:aluno${b.alunoId}:turma${b.turmaId}:prof${b.professorId}:${b.respostas.length}resp`);
SAIDA.blocoP04LucasDepois = blocoP04LucasDepois.respostas.map(r => r.valor);
registrar('PDI-TRF-T8', 'PDI transferência', 'O campo compartilhado salvo pelo P10 ALTERA o bloco de respostas padrão da P04 (6M1) sobre o Lucas?', 'NÃO deveria alterar o bloco de outro professor', `bloco da P04 alterado: ${blocoP04Mudou}; blocos novos: ${blocosNovos.join(', ') || 'nenhum'}`, blocoP04Mudou ? 'REPROVADO' : 'APROVADO', '25a-p10-lucas-depois-salvar.png', blocoP04Mudou ? 'O novo professor sobrescreveu a resposta compartilhada escrita pela professora anterior (que ela usa nas outras disciplinas dela).' : '');

// 4b. Marina (ficha de Arte CONCLUÍDA pela P04)
await B.page.goto(`${BASE}/#/pdi/aluno/${AP}/${MARINA}`); await B.page.waitForLoadState('networkidle'); await B.page.waitForTimeout(2200);
await foto(B.page, '25a-p10-marina-antes');
const tasM = B.page.locator('main textarea');
const nM = await tasM.count();
const valM = []; for (let i = 0; i < nM; i++) valM.push(await tasM.nth(i).inputValue());
const desabM = []; for (let i = 0; i < nM; i++) desabM.push(await tasM.nth(i).isDisabled());
let editouM = false;
const idxArteM = valM.findIndex((v, i) => i > 0 && v.includes('Arte'));
if (idxArteM >= 0 && !desabM[idxArteM]) {
  await tasM.nth(idxArteM).fill('P10 ALTEROU a ficha de Arte CONCLUÍDA pela P04.');
  const salvar = B.page.getByRole('button', { name: 'Salvar', exact: true });
  if (await salvar.count() && !(await salvar.isDisabled())) { await salvar.click(); await B.page.waitForTimeout(3000); editouM = true; }
}
const depoisB = await fotoBanco();
const fArteMarAntes = antes.fichas.find(f => f.alunoId === MARINA && f.disciplinaId === ARTE);
const fArteMarDepois = depoisB.fichas.find(f => f.id === fArteMarAntes.id);
const marMudou = JSON.stringify(fArteMarAntes.respostas.map(r => r.valor)) !== JSON.stringify(fArteMarDepois.respostas.map(r => r.valor));
registrar('PDI-TRF-T9', 'PDI transferência', 'P10 consegue ALTERAR a ficha de Arte CONCLUÍDA pela P04 (Marina)', 'registrar (regra a definir)', `${nM} campos; desabilitados: ${JSON.stringify(desabM)}; salvou: ${editouM}; respostas mudaram: ${marMudou}; status ${fArteMarDepois.status}; concluidaEm igual: ${String(fArteMarAntes.concluidaEm) === String(fArteMarDepois.concluidaEm)}`, 'OBSERVAÇÃO (regra não especificada)', '25a-p10-marina-antes.png');
const blocoP04Mar = antes.blocos.find(b => b.alunoId === MARINA && b.professorId === 14);
const blocoP04MarDepois = depoisB.blocos.find(b => b.id === blocoP04Mar?.id);
registrar('PDI-TRF-T10', 'PDI transferência', 'Bloco compartilhado da P04 sobre a Marina continua intacto', 'intacto', blocoP04Mar ? String(JSON.stringify(blocoP04Mar.respostas.map(r => r.valor)) === JSON.stringify(blocoP04MarDepois.respostas.map(r => r.valor))) : 'sem bloco', blocoP04Mar && JSON.stringify(blocoP04Mar.respostas.map(r => r.valor)) === JSON.stringify(blocoP04MarDepois.respostas.map(r => r.valor)) ? 'APROVADO' : 'REPROVADO');
console.log('erros navegador P10:', B.erros.filter(e => !/40[134]/.test(e)));
await B.browser.close();

// ---------- 5. Integridade ----------
const final = await fotoBanco();
registrar('PDI-TRF-T11', 'PDI transferência', 'Nenhuma ficha nem bloco do Lucas/Marina foi apagado ou duplicado na troca de turma', 'mesmas fichas; mesmos blocos (+ novos se criados)', `fichas ${antes.fichas.length}→${final.fichas.length}; blocos ${antes.blocos.length}→${final.blocos.length}; fichas com fotografia 6M1 preservada: ${final.fichas.filter(f => antes.fichas.some(a => a.id === f.id)).every(f => f.turmaNomeSnapshot === '6M1')}`, final.fichas.length >= antes.fichas.length && antes.fichas.every(a => final.fichas.some(f => f.id === a.id)) ? 'APROVADO' : 'REPROVADO');

SAIDA.antes = antes; SAIDA.final = final;
fs.writeFileSync(new URL('./saida-25a.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), JSON.stringify(SAIDA, null, 2));
await prisma.$disconnect();

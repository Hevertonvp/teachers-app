// Informática com formulário PDI só de Computação + Literatura com Modelo idêntico ao de Língua Portuguesa (17/11/2026),
// banco LOCAL. Cenário do roteiro 85 + P10 como professor de Informática (6º e 7º) e de Literatura (6º).
// Pré-requisito: Modelo de Literatura criado por backend/scripts/lancamento/criar-modelo-pdi-literatura.ts.
// Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparComputacao, montarCenario, criarAplicacao } from './85-perguntas-computacao.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '12345678'];
const P10 = ['p10@homolog.nexo', 'Nexo!Prof10-2026'];
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const r = (id, cen, esp, obs, ok, ev) => registrar(`INFLIT-${id}`, 'Informática e Literatura no PDI', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', ev);

await limparComputacao();
const c = await montarCenario();
const inf = await prisma.disciplina.findFirst({ where: { nome: 'Informática' } });
const lit = await prisma.disciplina.findFirst({ where: { nome: 'Literatura' } });
const lp = await prisma.disciplina.findFirst({ where: { nome: 'Língua Portuguesa' } });
const p10 = await prisma.pessoa.findUnique({ where: { email: P10[0] } });
const hoje = new Date(new Date().toISOString().slice(0, 10));
await prisma.vinculoEscolar.create({ data: { escolaId: c.escola.id, pessoaId: p10.id, dataInicio: hoje } });
for (const t of [c.t6, c.t7]) await prisma.professorTurmaDisciplina.create({ data: { turmaId: t.id, professorId: p10.id, disciplinaId: inf.id, dataInicio: hoje } });
await prisma.professorTurmaDisciplina.create({ data: { turmaId: c.t6.id, professorId: p10.id, disciplinaId: lit.id, dataInicio: hoje } });
await prisma.professorTurmaDisciplina.create({ data: { turmaId: c.t6.id, professorId: c.p04.id, disciplinaId: lp.id, dataInicio: hoje } });
const tSec = await token(SEC); const tP10 = await token(P10); const tP04 = await token(['p04@homolog.nexo', 'Nexo!Prof04-2026']);

const cat6 = (await api(tSec, 'GET', '/api/habilidades-curriculares/computacao?ano=6')).json;
const ef06co02 = cat6.find(h => h.codigo === 'EF06CO02');
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { habilidadeId: ef06co02.id, texto: `[ZZ-COMP] ${ef06co02.descricaoOficial}`, tipoResposta: 'SELECAO', opcoes: ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'] });
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { anos: [7], texto: '[ZZ-COMP] Quais habilidades de Computação o aluno consolidou?', tipoResposta: 'HABILIDADE_COMPUTACAO' });

const semInf = await criarAplicacao(tSec, c.escola.id, '2095-05-02', '2095-05-10', { incluirInformatica: false });
const ap = await criarAplicacao(tSec, c.escola.id, new Date().toISOString().slice(0, 10), '2026-12-15');
const modInf = ap.json.modelos.find(m => m.disciplinaId === inf.id);
r('1', 'Aplicação nova traz o formulário "Informática" (disciplina, sem Modelo); desmarcada, não traz', 'Informática, modelo nulo; desmarcada: nenhum', `${modInf?.disciplinaNome}, modelo ${modInf?.modeloId}; desmarcada: ${semInf.json.modelos.filter(m => m.disciplinaId === inf.id).length}`,
  modInf?.disciplinaNome === 'Informática' && modInf.modeloId === null && !modInf.atuacaoId && !semInf.json.modelos.some(m => m.disciplinaId === inf.id));
const snaps = (await api(tSec, 'GET', `/api/pdi-aplicacoes/${ap.json.id}/snapshot`)).json;
const sInf = snaps.find(m => m.disciplinaId === inf.id);
r('2', 'Formulário da Informática só tem perguntas de Computação', '2, todas de Computação', `${sInf.perguntas.length}: ${sInf.perguntas.map(p => p.codigo || p.tipoResposta).join(', ')}`,
  sInf.perguntas.length === 2 && sInf.perguntas.every(p => p.perguntaIdOriginal === null));

const meus = (await api(tP10, 'GET', '/api/pdi-fichas/meus-pdis')).json.filter(i => i.aplicacaoId === ap.json.id);
r('3', 'Professor de Informática/Literatura recebe: Informática (6º e 7º) e Literatura (6º)', 'Aluno6: Informática, Literatura; Aluno7: Informática', meus.map(i => `${i.alunoNome.split(' ')[0]}:${i.disciplinaNome}`).sort().join(', '),
  meus.length === 3 && meus.filter(i => i.disciplinaNome === 'Informática').length === 2 && meus.some(i => i.disciplinaNome === 'Literatura'));

const fInf = await api(tP10, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, disciplinaId: inf.id });
r('4', 'Ficha de Informática (6º): só a de Computação do 6º, sem perguntas padrão', 'EF06CO02; bloco padrão nulo', `${fInf.json?.perguntas?.map(p => p.codigo || p.tipoResposta).join(',')}; bloco ${fInf.json?.blocoPadrao}`,
  fInf.status === 200 && JSON.stringify(fInf.json.perguntas.map(p => p.codigo)) === '["EF06CO02"]' && fInf.json.blocoPadrao === null);
const salvo = await api(tP10, 'PUT', `/api/pdi-fichas/${fInf.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: fInf.json.perguntas[0].id, valor: { resposta: 'Consegue com mediação' } }], baseUpdatedAt: fInf.json.ficha.updatedAt ?? fInf.json.ficha.createdAt });
const concl = await api(tP10, 'POST', `/api/pdi-fichas/${fInf.json.ficha.id}/concluir`);
r('5', 'Professor de Informática responde e conclui', '200 / CONCLUIDA', `${salvo.status} / ${concl.json?.ficha?.status}`, salvo.status === 200 && concl.json?.ficha?.status === 'CONCLUIDA');

const sLit = snaps.find(m => m.disciplinaId === lit.id); const sLp = snaps.find(m => m.disciplinaId === lp.id);
const assin = (s) => JSON.stringify(s.perguntas.map(p => [p.secao, p.texto, p.tipoResposta, p.opcoes, p.ordem]));
r('6', 'Snapshot da Literatura idêntico ao de Língua Portuguesa (inclui as de Computação)', 'mesmas perguntas, mesma ordem', `Literatura ${sLit?.perguntas.length} × LP ${sLp?.perguntas.length}`,
  !!sLit && !!sLp && assin(sLit) === assin(sLp));
const fLit = await api(tP10, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, disciplinaId: lit.id });
const fLp = await api(tP04, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a6.id, disciplinaId: lp.id });
const textos = (f) => JSON.stringify([f.json?.perguntas?.map(p => p.texto), f.json?.blocoPadrao?.perguntas?.map(p => p.texto)]);
r('7', 'Ficha de Literatura igual à de Língua Portuguesa (perguntas e bloco padrão)', 'iguais', `Lit ${fLit.status} ${fLit.json?.perguntas?.length}+${fLit.json?.blocoPadrao?.perguntas?.length ?? 0}; LP ${fLp.status} ${fLp.json?.perguntas?.length}+${fLp.json?.blocoPadrao?.perguntas?.length ?? 0}`,
  fLit.status === 200 && fLp.status === 200 && textos(fLit) === textos(fLp));
const hLit = (await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${lit.id}&q=leitura`)).json;
const hLp = (await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${lp.id}&q=leitura`)).json;
r('8', 'Literatura usa os mesmos códigos BNCC/CRMG de Língua Portuguesa', 'mesmo componente e mesmos códigos', `${hLit.componente} ${hLit.resultados?.length} × ${hLp.componente} ${hLp.resultados?.length}`,
  // Banco local não tem o catálogo CRMG (só o de Computação): confere o componente, que é o que decide os códigos.
  hLit.componente === 'LINGUA_PORTUGUESA' && hLp.componente === 'LINGUA_PORTUGUESA' && JSON.stringify(hLit.resultados.map(h => h.codigo)) === JSON.stringify(hLp.resultados.map(h => h.codigo)));

const ind = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json.find(e => e.escolaId === c.escola.id);
// esperado: modelo do cenário (3 alunos) + LP (Aluno6) + Literatura (Aluno6) + Informática (Aluno6, Aluno7) = 7
r('9', 'Indicadores contam Informática e Literatura sem duplicar', 'esperado 7, concluídas 1', `esperado ${ind?.totalEsperado}, concluídas ${ind?.concluidas}`, ind?.totalEsperado === 7 && ind?.concluidas === 1);

const P = await abrir({ viewport: { width: 390, height: 844 } });
const p = P.page;
await login(p, ...P10);
await p.goto(`${BASE}/#/pdi/aluno/${ap.json.id}/${c.a7.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const form = await p.locator('main').innerText();
const opcoes7 = await p.locator('label', { hasText: /EF07CO\d\d/ }).count();
const largura = await p.evaluate(() => document.documentElement.scrollWidth);
await foto(p, '88-informatica-7ano-celular');
r('10', 'Tela (celular): formulário do aluno do 7º mostra Informática com as habilidades do 7º', 'Informática; 11 habilidades; sem rolagem lateral', `Informática: ${/Informática/.test(form)}; ${opcoes7} habilidades; largura ${largura}`,
  /Informática/.test(form) && opcoes7 === 11 && largura <= 390, '88-informatica-7ano-celular.png');
console.log('Erros de console:', P.erros.filter(e => !/favicon/.test(e)).slice(0, 5));
await P.browser.close();

await limparComputacao();
await prisma.$disconnect();

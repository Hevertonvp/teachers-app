// Perguntas de Computação do PDI (17/11/2026) — Etapa 1 pela API, banco LOCAL. Cria uma escola de teste com
// turmas de 6º, 7º ano e Infantil, um aluno PDI em cada, e o p04 como professor da disciplina de um Modelo
// ativo. Confere: catálogo oficial; cadastro (código/texto/ano do catálogo); só entra em Aplicação NOVA; cada
// aluno vê só as do seu ano; Infantil não vê; resposta com códigos só do ano; concluir exige as do ano; perguntas
// do Modelo iguais às de antes; Aplicação antiga intocada. Limpa tudo o que cria.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '12345678'];
const P04 = ['p04@homolog.nexo', 'Nexo!Prof04-2026'];
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const r = (id, cen, esp, obs, ok) => registrar(`COMP-${id}`, 'Perguntas de Computação', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO');

export async function limparComputacao() {
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-COMP' } }, select: { id: true } })).map(e => e.id);
  const aps = (await prisma.aplicacaoPdi.findMany({ where: { escolaId: { in: escolas } }, select: { id: true } })).map(a => a.id);
  const fichas = (await prisma.fichaPdi.findMany({ where: { aplicacaoId: { in: aps } }, select: { id: true } })).map(f => f.id);
  await prisma.historicoCorrecaoResposta.deleteMany({ where: { fichaId: { in: fichas } } });
  await prisma.correcaoFichaPdi.deleteMany({ where: { fichaId: { in: fichas } } });
  await prisma.respostaPdi.deleteMany({ where: { fichaId: { in: fichas } } });
  await prisma.fichaPdi.deleteMany({ where: { id: { in: fichas } } });
  const blocos = (await prisma.blocoRespostasPadraoPdi.findMany({ where: { aplicacaoId: { in: aps } }, select: { id: true } })).map(b => b.id);
  await prisma.respostaPadraoPdi.deleteMany({ where: { blocoId: { in: blocos } } });
  await prisma.blocoRespostasPadraoPdi.deleteMany({ where: { id: { in: blocos } } });
  const ams = (await prisma.aplicacaoModeloPdi.findMany({ where: { aplicacaoId: { in: aps } }, select: { id: true } })).map(m => m.id);
  await prisma.aplicacaoPerguntaPdi.deleteMany({ where: { aplicacaoModeloId: { in: ams } } });
  await prisma.aplicacaoModeloPerguntaPadraoPdi.deleteMany({ where: { aplicacaoModeloId: { in: ams } } });
  await prisma.aplicacaoPerguntaPadraoPdi.deleteMany({ where: { aplicacaoId: { in: aps } } });
  await prisma.aplicacaoModeloPdi.deleteMany({ where: { id: { in: ams } } });
  await prisma.fotografiaAplicacaoPdi.deleteMany({ where: { aplicacaoId: { in: aps } } }).catch(() => {});
  await prisma.aplicacaoPdi.deleteMany({ where: { id: { in: aps } } });
  const turmas = (await prisma.turma.findMany({ where: { escolaId: { in: escolas } }, select: { id: true } })).map(t => t.id);
  const alunos = (await prisma.alunoPdi.findMany({ where: { turmaId: { in: turmas } }, select: { id: true } })).map(a => a.id);
  await prisma.movimentacaoAlunoPdi.deleteMany({ where: { alunoId: { in: alunos } } });
  await prisma.alunoPdi.deleteMany({ where: { id: { in: alunos } } });
  await prisma.professorTurmaDisciplina.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.professorTurmaAtuacao.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.vinculoEscolar.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { id: { in: turmas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
  const perguntas = (await prisma.perguntaComputacaoPdi.findMany({ where: { createdBy: { not: null }, texto: { startsWith: '[ZZ-COMP]' } }, select: { id: true } })).map(p => p.id);
  await prisma.perguntaComputacaoPdi.deleteMany({ where: { id: { in: perguntas } } });
}

export async function montarCenario() {
  const escola = await prisma.escola.create({ data: { nome: `ZZ-COMP ${TAG}` } });
  const turma = (ano, etapa = 'FUNDAMENTAL') => prisma.turma.create({ data: {
    escolaId: escola.id, anoLetivo: 2095, etapa, anoSerie: etapa === 'FUNDAMENTAL' ? ano : null, segmento: etapa === 'FUNDAMENTAL' ? null : 'PRE_ESCOLA',
    turno: 'MANHA', identificador: 1, nome: etapa === 'FUNDAMENTAL' ? `${ano}M1` : 'Pré EI', identidadeChave: `ZZCOMP|${escola.id}|${etapa}|${ano}`,
  } });
  const t6 = await turma(6); const t7 = await turma(7); const tEi = await turma(0, 'EDUCACAO_INFANTIL');
  const aluno = (t, nome) => prisma.alunoPdi.create({ data: { nome: `${nome} ${TAG}`, turmaId: t.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0' } });
  const a6 = await aluno(t6, 'Aluno6'); const a7 = await aluno(t7, 'Aluno7'); const aEi = await aluno(tEi, 'AlunoEI');
  const p04 = await prisma.pessoa.findUnique({ where: { email: P04[0] } });
  const modelo = await prisma.modeloPdi.findFirst({ where: { status: 'ATIVA' }, orderBy: { id: 'asc' } });
  const hoje = new Date(new Date().toISOString().slice(0, 10));
  await prisma.vinculoEscolar.create({ data: { escolaId: escola.id, pessoaId: p04.id, dataInicio: hoje } });
  for (const t of [t6, t7, tEi]) await prisma.professorTurmaDisciplina.create({ data: { turmaId: t.id, professorId: p04.id, disciplinaId: modelo.disciplinaId, dataInicio: hoje } });
  return { escola, t6, t7, tEi, a6, a7, aEi, p04, modelo };
}

export const criarAplicacao = async (tSec, escolaId, dataInicio, dataFim, extra = {}) =>
  api(tSec, 'POST', '/api/pdi-aplicacoes', { escolaId, dataInicio, dataFim, ...extra });

const rodandoDireto = process.argv[1]?.endsWith('85-perguntas-computacao.mjs');
if (rodandoDireto) {
  await limparComputacao();
  const c = await montarCenario();
  const tSec = await token(SEC);
  const tP = await token(P04);

  // 1. Catálogo oficial
  const cat6 = await api(tSec, 'GET', '/api/habilidades-curriculares/computacao?ano=6');
  const todas = await api(tSec, 'GET', '/api/habilidades-curriculares/computacao');
  const ef06co02 = cat6.json.find(h => h.codigo === 'EF06CO02');
  r('1', 'Catálogo BNCC Computação: 82 habilidades (1º–9º), 10 do 6º ano, texto oficial', '82 / 10 / EF06CO02 "Elaborar algoritmos…"', `${todas.json.length} / ${cat6.json.length} / ${ef06co02?.descricaoOficial.slice(0, 40)}`,
    todas.json.length === 82 && cat6.json.length === 10 && ef06co02?.descricaoOficial.startsWith('Elaborar algoritmos que envolvam instruções sequenciais'));

  // 2. Aplicação ANTERIOR (sem perguntas de Computação cadastradas): referência das perguntas do Modelo
  const apAntiga = await criarAplicacao(tSec, c.escola.id, '2095-05-02', '2095-05-10');
  const fichaAntiga = await api(tP, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: apAntiga.json.id, alunoId: c.a6.id, disciplinaId: c.modelo.disciplinaId });
  const idsModelo = fichaAntiga.json.perguntas.map(p => p.texto ?? p.pergunta);

  // 3. Cadastro: pergunta sobre EF06CO02 (seleção) + pergunta "marcar habilidades" para 7º ano
  const sel = await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { habilidadeId: ef06co02.id, texto: `[ZZ-COMP] ${ef06co02.descricaoOficial}`, tipoResposta: 'SELECAO', opcoes: ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'], observacao: 'Obs livre' });
  const marcar = await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { anos: [7], texto: '[ZZ-COMP] Quais habilidades de Computação o aluno consolidou?', tipoResposta: 'HABILIDADE_COMPUTACAO' });
  const semHab = await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { texto: '[ZZ-COMP] x', tipoResposta: 'TEXTO' });
  const profTenta = await api(tP, 'POST', '/api/pdi-perguntas-computacao', { anos: [6], texto: '[ZZ-COMP] y', tipoResposta: 'HABILIDADE_COMPUTACAO' });
  r('2', 'Cadastro sobre uma habilidade: código e ano vêm do catálogo', 'EF06CO02 / [6]', `${sel.json?.codigo} / ${JSON.stringify(sel.json?.anos)}`, sel.status === 201 && sel.json.codigo === 'EF06CO02' && JSON.stringify(sel.json.anos) === '[6]');
  r('3', 'Cadastro "marcar habilidades" para o 7º ano; sem habilidade e sem ser "marcar" é recusado; professor não cadastra', '201 / 400 / 403', `${marcar.status} / ${semHab.status} / ${profTenta.status}`, marcar.status === 201 && semHab.status === 400 && profTenta.status === 403);

  // 4. Aplicação antiga NÃO recebe nada (snapshot congelado)
  const fichaAntigaDepois = await api(tP, 'GET', `/api/pdi-fichas/${apAntiga.json.id}/${c.a6.id}/${c.modelo.disciplinaId}`);
  r('4', 'Aplicação criada ANTES do cadastro não recebe a pergunta (não retroativo)', 'mesmas perguntas de antes', `${fichaAntigaDepois.json.perguntas.length} × ${fichaAntiga.json.perguntas.length}; computação: ${fichaAntigaDepois.json.perguntas.filter(p => p.computacao).length}`,
    fichaAntigaDepois.json.perguntas.length === fichaAntiga.json.perguntas.length && !fichaAntigaDepois.json.perguntas.some(p => p.computacao));

  // 5. Aplicação NOVA: aluno do 6º vê só a do 6º; 7º vê só a do 7º; Infantil não vê
  const hojeIso = new Date().toISOString().slice(0, 10);
  const apNova = await criarAplicacao(tSec, c.escola.id, hojeIso, '2026-12-15'); // vigente: dá para salvar
  const f6 = await api(tP, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: apNova.json.id, alunoId: c.a6.id, disciplinaId: c.modelo.disciplinaId });
  const f7 = await api(tP, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: apNova.json.id, alunoId: c.a7.id, disciplinaId: c.modelo.disciplinaId });
  const fEi = await api(tP, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: apNova.json.id, alunoId: c.aEi.id, disciplinaId: c.modelo.disciplinaId });
  const comp = (f) => f.json.perguntas.filter(p => p.computacao).map(p => p.codigo || p.tipoResposta);
  r('5', 'Aplicação nova: 6º ano recebe só a pergunta do 6º', '["EF06CO02"], ano 6', `${JSON.stringify(comp(f6))}, ano ${f6.json.ficha.anoSerie}`, JSON.stringify(comp(f6)) === '["EF06CO02"]' && f6.json.ficha.anoSerie === 6);
  r('6', 'Aplicação nova: 7º ano recebe só a do 7º (marcar habilidades)', '["HABILIDADE_COMPUTACAO"]', JSON.stringify(comp(f7)), JSON.stringify(comp(f7)) === '["HABILIDADE_COMPUTACAO"]');
  r('7', 'Aplicação nova: aluno da Educação Infantil não recebe pergunta de Computação', '[] e ano nulo', `${JSON.stringify(comp(fEi))}, ano ${fEi.json.ficha.anoSerie}`, comp(fEi).length === 0 && fEi.json.ficha.anoSerie === null);
  const modeloNova = f6.json.perguntas.filter(p => !p.computacao).map(p => p.texto ?? p.pergunta);
  r('8', 'Perguntas do Modelo continuam iguais (Computação é bloco adicional, no fim)', 'mesma lista + Computação por último', `${modeloNova.length} do Modelo × ${idsModelo.length} antes; última: ${f6.json.perguntas.at(-1).codigo}`,
    JSON.stringify(modeloNova) === JSON.stringify(idsModelo) && f6.json.perguntas.at(-1).codigo === 'EF06CO02');

  // 6. Resposta "marcar habilidades": só do ano do aluno
  const pMarcar = f7.json.perguntas.find(p => p.tipoResposta === 'HABILIDADE_COMPUTACAO');
  const cat7 = (await api(tSec, 'GET', '/api/habilidades-curriculares/computacao?ano=7')).json;
  const errado = await api(tP, 'PUT', `/api/pdi-fichas/${f7.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: pMarcar.id, valor: { habilidadeIds: [ef06co02.id] } }], baseUpdatedAt: f7.json.ficha.updatedAt ?? f7.json.ficha.createdAt });
  const certo = await api(tP, 'PUT', `/api/pdi-fichas/${f7.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: pMarcar.id, valor: { habilidadeIds: [cat7[0].id, cat7[1].id] } }], baseUpdatedAt: f7.json.ficha.updatedAt ?? f7.json.ficha.createdAt });
  const salvo = certo.json?.respostas?.find(x => x.aplicacaoPerguntaId === pMarcar.id)?.valor;
  r('9', 'Resposta com códigos: habilidade de outro ano é recusada; do 7º ano grava código e texto', '400; EF07CO01, EF07CO02', `${errado.status}; ${salvo?.habilidades?.map(h => h.codigo).join(', ')}`, errado.status === 400 && salvo?.habilidades?.length === 2 && salvo.habilidades.every(h => h.codigo.startsWith('EF07CO') && h.descricaoOficial));
  const outroAno = await api(tP, 'PUT', `/api/pdi-fichas/${f6.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: pMarcar.id, valor: { habilidadeIds: [cat7[0].id] } }], baseUpdatedAt: f6.json.ficha.updatedAt ?? f6.json.ficha.createdAt });
  r('10', 'Ficha do 6º não aceita resposta para a pergunta do 7º', '400', String(outroAno.status), outroAno.status === 400);

  // 7. Concluir exige a do ano
  const concl = await api(tP, 'POST', `/api/pdi-fichas/${f6.json.ficha.id}/concluir`);
  const msgConcl = `${concl.json?.message || concl.json?.error || ''}`;
  r('11', 'Concluir conta a pergunta de Computação do ano como obrigatória', '400 "faltam N"', `${concl.status} ${msgConcl}`.slice(0, 120), concl.status === 400 && /faltam/.test(msgConcl));

  // 8. Inativar/editar não muda o que já foi criado
  await api(tSec, 'POST', `/api/pdi-perguntas-computacao/${sel.json.id}/inativar`);
  const f6Depois = await api(tP, 'GET', `/api/pdi-fichas/${apNova.json.id}/${c.a6.id}/${c.modelo.disciplinaId}`);
  const exclUsada = await api(tSec, 'DELETE', `/api/pdi-perguntas-computacao/${sel.json.id}`);
  r('12', 'Inativar depois não tira a pergunta da Aplicação já criada; usada não pode ser excluída', 'continua; 400', `${comp(f6Depois).join(',')}; ${exclUsada.status}`, JSON.stringify(comp(f6Depois)) === '["EF06CO02"]' && exclUsada.status === 400);

  await limparComputacao();
  await prisma.$disconnect();
}

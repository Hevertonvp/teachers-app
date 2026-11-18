// Supervisora no PDI + avisos de entrega (18/11/2026), banco LOCAL, pela API:
//  - Supervisora (GESTOR) corrige/devolve Ficha PDI só da escola dela; selo e origem SUPERVISAO_DIRETA;
//  - avisos: Secretaria corrige/devolve → Supervisora; Supervisora corrige → Professor;
//  - Supervisora só consulta: Alunos PDI, professores, 1/3 (painel/folha) e Acompanhamento;
//  - avisos de entrega (100%, prazo amanhã, prazo vencido) sem repetir; 1/3 do Professor intacto.
// Apaga no fim as notificações, correções, históricos e conversas criados durante o teste.
import { execSync } from 'node:child_process';
import { prisma, URL_LOCAL } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340';
const INICIO = new Date();
const r = (id, cen, esp, obs, ok) => registrar(`SUP-${id}`, 'Supervisora PDI e avisos', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', '');
const token = async (email, senha = '12345678') => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };
const novas = (destinatarioId, tipo) => prisma.notificacao.findMany({ where: { destinatarioId, tipo, createdAt: { gte: INICIO } }, orderBy: { id: 'asc' } });
const job = (...args) => execSync(`npx tsx ../homologacao/91-avisos-job.mts ${args.join(' ')}`, { cwd: new URL('../backend/', import.meta.url), env: { ...process.env, DATABASE_URL: URL_LOCAL, DIRECT_URL: URL_LOCAL }, encoding: 'utf8' }).trim();

const SUP = 35, DIR = 36, ESCOLA = 1;
const tSec = await token('secretaria@escola.gov.br');
const tSup = await token('gestor.aur@homolog.nexo', 'Nexo!Homolog-2026');
const tDir = await token('diretora.aur@homolog.nexo', 'Nexo!Homolog-2026');
const sec = await prisma.pessoa.findUnique({ where: { email: 'secretaria@escola.gov.br' } });
const vinculosTemporarios = [];

try {
  // --- Correções do PDI: escopo -------------------------------------------------------------------
  const lista = await api(tSup, 'GET', '/api/correcoes-pdi?limite=100');
  const outra = await api(tSup, 'GET', '/api/correcoes-pdi?escolaId=13');
  r('1', 'Supervisora lista Correções > PDI: só fichas da escola dela; filtro de outra escola vem vazio', '200, todas da escola 1; []',
    `${lista.status}, ${lista.json?.length} fichas, escolas ${[...new Set((lista.json ?? []).map(f => f.escolaId))]}; outra: ${outra.json?.length}`,
    lista.status === 200 && lista.json.length > 0 && lista.json.every(f => f.escolaId === ESCOLA) && outra.json?.length === 0);

  const fichaFora = await prisma.fichaPdi.findFirst({ where: { status: 'CONCLUIDA', escolaId: { not: ESCOLA } } });
  const verFora = await api(tSup, 'GET', `/api/correcoes-pdi/${fichaFora.id}`);
  const corrFora = await api(tSup, 'PUT', `/api/correcoes-pdi/${fichaFora.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: 1, valor: { resposta: 'x' } }], baseUpdatedAt: new Date().toISOString() });
  const devFora = await api(tSup, 'POST', `/api/correcoes-pdi/${fichaFora.id}/devolver`, { observacao: 'x' });
  r('2', 'Supervisora NÃO vê, corrige nem devolve ficha de outra escola', '403 / 403 / 403', `${verFora.status} / ${corrFora.status} / ${devFora.status}`,
    verFora.status === 403 && corrFora.status === 403 && devFora.status === 403);

  const tDirCorr = await api(tDir, 'GET', '/api/correcoes-pdi');
  r('3', 'Diretora continua sem Correções > PDI', '403', `${tDirCorr.status}`, tDirCorr.status === 403);

  // --- Correção direta: Supervisora → Professor; Secretaria → Supervisora ----------------------------
  const fichas = lista.json;
  const corrigir = async (t, fichaId) => {
    const d = (await api(t, 'GET', `/api/correcoes-pdi/${fichaId}`)).json;
    const resp = new Map(d.respostas.map(x => [x.aplicacaoPerguntaId, x.valor]));
    const p = d.perguntas.find(q => !['ORIENTACAO', 'HABILIDADE_CRMG', 'HABILIDADE_COMPUTACAO'].includes(q.tipoResposta) && resp.get(q.id)?.resposta != null);
    if (!p) return { status: 0 };
    return api(t, 'PUT', `/api/correcoes-pdi/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: p.id, valor: resp.get(p.id) }], baseUpdatedAt: d.ficha.updatedAt ?? d.ficha.createdAt });
  };
  let fichaSup = null, cSup = null;
  for (const f of fichas) { cSup = await corrigir(tSup, f.id); if (cSup.status === 200) { fichaSup = f; break; } }
  const hist = fichaSup ? await prisma.historicoCorrecaoResposta.findFirst({ where: { fichaId: fichaSup.id, alteradoEm: { gte: INICIO } }, orderBy: { id: 'desc' } }) : null;
  const fichaDb = fichaSup ? await prisma.fichaPdi.findUnique({ where: { id: fichaSup.id } }) : null;
  const notProf = fichaDb ? await novas(fichaDb.professorResponsavelId, 'CORRECAO_FORMULARIO') : [];
  r('4', 'Supervisora corrige direto: grava origem SUPERVISAO_DIRETA, selo "supervisão" e avisa o Professor', '200; SUPERVISAO_DIRETA; supervisao; 1 aviso ao Professor',
    `${cSup?.status}; ${hist?.origem}; ${cSup?.json?.correcaoDireta?.por}; ${notProf.length} aviso(s) "${notProf[0]?.titulo ?? ''}"`,
    cSup?.status === 200 && hist?.origem === 'SUPERVISAO_DIRETA' && cSup.json.correcaoDireta?.por === 'supervisao' && notProf.length === 1 && notProf[0].titulo === 'PDI corrigido pela supervisão');
  const notSecDaSup = await novas(sec.id, 'CORRECAO_FORMULARIO');
  r('5', 'Correção da Supervisora NÃO avisa a Secretaria', '0', `${notSecDaSup.length}`, notSecDaSup.length === 0);

  const cSec1 = await corrigir(tSec, fichaSup.id);
  const cSec2 = await corrigir(tSec, fichaSup.id);
  const notSup = await novas(SUP, 'CORRECAO_FORMULARIO');
  r('6', 'Secretaria corrige direto: Supervisora recebe "Formulário do professor X corrigido pela Secretaria"; salvar de novo logo em seguida não repete', '200/200; 1 aviso',
    `${cSec1.status}/${cSec2.status}; ${notSup.length}: "${notSup[0]?.corpo ?? ''}"; selo ${cSec2.json?.correcaoDireta?.por}`,
    cSec1.status === 200 && cSec2.status === 200 && notSup.length === 1 && notSup[0].corpo.startsWith(`Formulário do professor ${fichaDb.professorNomeSnapshot} corrigido pela Secretaria`) && cSec2.json.correcaoDireta?.por === 'secretaria');
  const notDirCorr = await novas(DIR, 'CORRECAO_FORMULARIO');
  r('7', 'Diretora não recebe o aviso de correção', '0', `${notDirCorr.length}`, notDirCorr.length === 0);

  // --- Devoluções -------------------------------------------------------------------------------------
  // Fichas devolvíveis: aluno ATIVO ainda na escola da Aplicação, com professor ATIVO vinculado à turma
  // e disciplina (as da Aurora são de alunos transferidos). Se forem de outra escola, a Supervisora ganha
  // um vínculo TEMPORÁRIO com ela (apagado no fim).
  const candidatas = [];
  for (const f of await prisma.fichaPdi.findMany({ where: { status: 'CONCLUIDA', disciplinaId: { not: null } }, orderBy: { id: 'asc' } })) {
    const aluno = await prisma.alunoPdi.findUnique({ where: { id: f.alunoId }, include: { turma: true } });
    if (!aluno || aluno.status !== 'ATIVO' || aluno.turma.escolaId !== f.escolaId) continue;
    const ptd = await prisma.professorTurmaDisciplina.findFirst({ where: { turmaId: aluno.turmaId, disciplinaId: f.disciplinaId, status: 'ATIVO', professor: { status: 'ATIVO', perfil: 'PROFESSOR', vinculosEscolares: { some: { escolaId: f.escolaId, status: 'ATIVO' } } } } });
    const aberta = await prisma.correcaoFichaPdi.findFirst({ where: { fichaId: f.id, status: 'ABERTA' } });
    if (ptd && !aberta) candidatas.push(f);
    if (candidatas.length === 2) break;
  }
  if (candidatas.length === 2 && candidatas.some(f => f.escolaId !== ESCOLA)) {
    for (const escolaId of new Set(candidatas.map(f => f.escolaId).filter(id => id !== ESCOLA))) {
      vinculosTemporarios.push((await prisma.vinculoEscolar.create({ data: { pessoaId: SUP, escolaId, status: 'ATIVO', dataInicio: new Date(), createdBy: 'ZZSUP' } })).id);
    }
  }
  let devSec = null, fichaDevSec = candidatas[0] ?? null;
  if (fichaDevSec) devSec = await api(tSec, 'POST', `/api/correcoes-pdi/${fichaDevSec.id}/devolver`, { observacao: 'Teste ZZSUP: revisar.' });
  const notSupDev = (await novas(SUP, 'CORRECAO_FORMULARIO')).filter(n => n.titulo === 'PDI devolvido pela Secretaria');
  r('8', 'Secretaria devolve: Supervisora recebe "devolvido pela Secretaria"', '201; 1 aviso', `${devSec?.status} ${devSec?.json?.message ?? ''}; ${notSupDev.length}`, devSec?.status === 201 && notSupDev.length === 1);

  let devSup = null, fichaDevSup = candidatas[1] ?? null;
  if (fichaDevSup) devSup = await api(tSup, 'POST', `/api/correcoes-pdi/${fichaDevSup.id}/devolver`, { observacao: 'Teste ZZSUP: supervisão pede ajuste.' });
  const corrDevSup = fichaDevSup ? await prisma.correcaoFichaPdi.findFirst({ where: { fichaId: fichaDevSup.id, criadaEm: { gte: INICIO } } }) : null;
  const msgSup = corrDevSup ? await prisma.mensagem.findFirst({ where: { remetenteId: SUP, createdAt: { gte: INICIO } } }) : null;
  r('9', 'Supervisora devolve ficha da escola dela: correção registrada em nome dela e mensagem automática ao Professor', `201; criadaPor ${SUP}; mensagem enviada`,
    `${devSup?.status} ${devSup?.json?.message ?? ''}; criadaPor ${corrDevSup?.criadaPor}; mensagens ${devSup?.json?.mensagensEnviadas}; msg ${msgSup ? 'sim' : 'não'}`,
    devSup?.status === 201 && corrDevSup?.criadaPor === String(SUP) && devSup.json.mensagensEnviadas >= 1 && !!msgSup);
  // O vínculo temporário sai já aqui: os testes seguintes conferem "só a escola dela".
  await prisma.vinculoEscolar.deleteMany({ where: { id: { in: vinculosTemporarios } } });

  // --- Só leitura ---------------------------------------------------------------------------------------
  const turma = await prisma.turma.findFirst({ where: { escolaId: ESCOLA, status: 'ATIVA', tipo: 'REGULAR' } });
  const novoAluno = await api(tSup, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZSUP', turmaId: turma.id, responsavelNome: 'R', responsavelParentesco: 'Mãe', responsavelTelefone: '0' });
  const verAlunos = await api(tSup, 'GET', '/api/pdi-alunos');
  r('10', 'Supervisora não cadastra Aluno PDI, mas consulta a lista', '403 / 200', `${novoAluno.status} / ${verAlunos.status}`, novoAluno.status === 403 && verAlunos.status === 200);

  const profs = await api(tSup, 'GET', '/api/pessoas/professores');
  const criarProf = await api(tSup, 'POST', '/api/pessoas/professores', { nome: 'ZZSUP', email: 'zzsup@teste.local', cargos: [] });
  r('11', 'Supervisora consulta professores (só os da escola dela) e não cadastra', '200, escolas só da Aurora / 403',
    `${profs.status}, ${profs.json?.length} prof., escolas ${[...new Set((profs.json ?? []).flatMap(p => p.escolas.map(e => e.id)))]} / ${criarProf.status}`,
    profs.status === 200 && profs.json.length > 0 && profs.json.every(p => p.escolas.every(e => e.id === ESCOLA)) && criarProf.status === 403);

  // --- 1/3: consulta ----------------------------------------------------------------------------------------
  const ciclos = await api(tSup, 'GET', '/api/formulario-um-terco/ciclos');
  const painel = ciclos.json?.[0] ? await api(tSup, 'GET', `/api/formulario-um-terco/ciclos/${ciclos.json[0].id}/painel`) : { status: 0 };
  const linha = painel.json?.linhas?.find(l => l.entregaId);
  const folha = linha ? await api(tSup, 'GET', `/api/formulario-um-terco/ciclos/${ciclos.json[0].id}/entregas/${linha.professorId}/cargos/${linha.cargoId}`) : { status: 0 };
  r('12', 'Supervisora consulta o 1/3: ciclos, painel só com a escola dela e uma folha', '200 / 200 só Aurora / 200',
    `${ciclos.status} (${ciclos.json?.length}) / ${painel.status} escolas ${(painel.json?.porEscola ?? []).map(e => e.escolaId)} / ${folha.status}`,
    ciclos.status === 200 && painel.status === 200 && painel.json.porEscola.every(e => e.escolaId === ESCOLA) && painel.json.linhas.every(l => l.escolas.some(e => e.escolaId === ESCOLA)) && (folha.status === 200 || !linha));
  const devUm = linha ? await api(tSup, 'POST', `/api/formulario-um-terco/entregas/${linha.entregaId}/devolver`, { observacao: 'x' }) : { status: 403 };
  const corrUm = linha ? await api(tSup, 'PUT', `/api/correcoes-um-terco/${linha.entregaId}/respostas`, { respostas: [], baseUpdatedAt: null }) : { status: 403 };
  const novoCiclo = await api(tSup, 'POST', '/api/formulario-um-terco/ciclos', {});
  r('13', 'Supervisora NÃO devolve, NÃO corrige e NÃO cria ciclo do 1/3', '403 / 403 / 403', `${devUm.status} / ${corrUm.status} / ${novoCiclo.status}`, devUm.status === 403 && corrUm.status === 403 && novoCiclo.status === 403);
  const dirPainel = await api(tDir, 'GET', '/api/formulario-um-terco/ciclos');
  r('14', 'Diretora continua sem o painel do 1/3 (só Acompanhamento)', '403', `${dirPainel.status}`, dirPainel.status === 403);

  const acompOk = await api(tSup, 'GET', `/api/acompanhamento/escola/${ESCOLA}?ano=2026`);
  const acompFora = await api(tSup, 'GET', `/api/acompanhamento/escola/13?ano=2026`);
  r('15', 'Supervisora vê o Acompanhamento Escolar da escola dela, não de outra', '200 / 403', `${acompOk.status} / ${acompFora.status}`, acompOk.status === 200 && acompFora.status === 403);

  // --- Avisos de entrega -----------------------------------------------------------------------------------
  const antes = job('job', '2026-11-19T12:00:00Z'); // ciclo 1: prazo 20/11 → "prazo amanhã"
  const depois = job('job', '2026-11-19T12:30:00Z');
  const pSec = await novas(sec.id, 'ENTREGA_PRAZO_AMANHA'), pSup = await novas(SUP, 'ENTREGA_PRAZO_AMANHA'), pDir = await novas(DIR, 'ENTREGA_PRAZO_AMANHA');
  r('16', 'Véspera do prazo do 1/3: Secretaria recebe UM resumo; Diretora e Supervisora, o aviso da escola; rodar de novo não repete', '1 / 1 / 1',
    `${pSec.length} "${pSec[0]?.corpo?.slice(0, 80) ?? ''}" / ${pSup.length} "${pSup[0]?.corpo ?? ''}" / ${pDir.length} · ${antes} · ${depois}`,
    pSec.length === 1 && pSup.length === 1 && pDir.length === 1 && pSup[0].corpo.includes('Prazo: amanhã'));
  job('job', '2026-11-21T12:00:00Z');
  job('job', '2026-11-22T12:00:00Z');
  const aSec = await novas(sec.id, 'ENTREGA_ATRASADA'), aSup = await novas(SUP, 'ENTREGA_ATRASADA');
  r('17', 'Prazo vencido: aviso de atraso (1 só, mesmo rodando em dois dias seguidos)', '1 / 1', `${aSec.length} / ${aSup.length} "${aSup[0]?.corpo ?? ''}"`, aSec.length === 1 && aSup.length === 1);
  job('job', '2026-11-15T12:00:00Z');
  const longe = (await novas(sec.id, 'ENTREGA_PRAZO_AMANHA')).length;
  r('18', 'Fora da véspera e do atraso, nada é avisado', 'continua 1', `${longe}`, longe === 1);

  job('completa', ESCOLA); job('completa', ESCOLA);
  const cSecN = await novas(sec.id, 'ENTREGA_ESCOLA_COMPLETA'), cSupN = await novas(SUP, 'ENTREGA_ESCOLA_COMPLETA'), cDirN = await novas(DIR, 'ENTREGA_ESCOLA_COMPLETA');
  r('19', 'Escola a 100%: Secretaria, Diretora e Supervisora recebem uma vez só', '1 / 1 / 1', `${cSecN.length} / ${cSupN.length} / ${cDirN.length} "${cSupN[0]?.titulo ?? ''}"`, cSecN.length === 1 && cSupN.length === 1 && cDirN.length === 1);
  const resPdi = job('job', '2026-12-14T12:00:00Z'); job('job', '2026-12-14T13:00:00Z'); // Aplicações que vencem em 15/12
  const pdiSec = (await novas(sec.id, 'ENTREGA_PRAZO_AMANHA')).filter(n => n.titulo === 'PDI: prazo amanhã');
  const pdiSup = (await novas(SUP, 'ENTREGA_PRAZO_AMANHA')).filter(n => n.titulo === 'PDI: prazo amanhã');
  const pdiDir = (await novas(DIR, 'ENTREGA_PRAZO_AMANHA')).filter(n => n.titulo === 'PDI: prazo amanhã');
  r('21', 'Véspera do prazo do PDI: Secretaria recebe UM resumo das escolas; Diretora e Supervisora, só a escola delas; sem repetir', '1 / 1 / 1',
    `${pdiSec.length} "${pdiSec[0]?.corpo?.slice(0, 90) ?? ''}" / ${pdiSup.length} "${pdiSup[0]?.corpo ?? ''}" / ${pdiDir.length} · ${resPdi}`,
    pdiSec.length === 1 && pdiSup.length === 1 && pdiDir.length === 1 && pdiSup[0].corpo.startsWith('ZZ-HOMOLOG Escola Aurora'));
  job('pdi-completo', 1);
  const pdiCompleto = (await novas(sec.id, 'ENTREGA_ESCOLA_COMPLETA')).filter(n => n.titulo === 'PDI completo').length;
  r('20', 'PDI com fichas pendentes não dispara "completo"', '0', `${pdiCompleto}`, pdiCompleto === 0);
} finally {
  // Limpeza do que o teste criou (só depois de INICIO).
  await prisma.vinculoEscolar.deleteMany({ where: { id: { in: vinculosTemporarios } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: INICIO } } });
  await prisma.historicoCorrecaoResposta.deleteMany({ where: { alteradoEm: { gte: INICIO } } });
  await prisma.correcaoFichaPdi.deleteMany({ where: { criadaEm: { gte: INICIO } } });
  const conversas = (await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: INICIO } }, select: { id: true } })).map(c => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: conversas } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: conversas } } });
  await prisma.$disconnect();
}

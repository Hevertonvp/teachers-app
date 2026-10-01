import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { statusAposSalvarResposta } from '../../domain/anamnese.js';

export const anamnesesRouter = Router();

type Actor = { id: number; perfil: string };

// Resolve Aluno+Turma+Escola ATUAIS — igual ao mesmo trecho de pdiFichas.ts. A Anamnese é do
// aluno inteiro (nunca por disciplina, seção 34 do pedido), então não há Aplicação/Disciplina
// envolvida aqui.
async function buscarAluno(alunoId: number) {
  const aluno = await prisma.alunoPdi.findUnique({ where: { id: alunoId }, include: { turma: { include: { escola: true } } } });
  if (!aluno) throw new NotFoundError('Aluno não encontrado.');
  return aluno;
}

type Aluno = Awaited<ReturnType<typeof buscarAluno>>;

// Autorização — sempre por relação VIVA (seção 24/25 do pedido: snapshot nunca autoriza). Todos
// os perfis podem consultar dentro do próprio escopo (seção 33); só Secretaria escreve.
async function exigirAcessoAnamnese(actor: Actor, aluno: Aluno, opts: { exigirEscrita: boolean }) {
  const escolaId = aluno.turma.escolaId;

  if (actor.perfil === 'SECRETARIA') return;

  if (opts.exigirEscrita) {
    throw new ForbiddenError('Somente a Secretaria administra a Anamnese.');
  }

  if (actor.perfil === 'GESTOR' || actor.perfil === 'DIRETORA') {
    const vinculo = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculo) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    return;
  }

  if (actor.perfil === 'PROFESSOR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculoEscolar) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    // Anamnese é do aluno, não da disciplina (seção 34) — qualquer vínculo ATIVO na turma atual
    // do aluno, em qualquer disciplina, já basta.
    const algumPtd = await prisma.professorTurmaDisciplina.count({ where: { turmaId: aluno.turmaId, professorId: actor.id, status: 'ATIVO' } });
    if (algumPtd === 0) throw new ForbiddenError('Você não tem vínculo ativo com a turma deste aluno.');
    return;
  }

  if (actor.perfil === 'AUXILIAR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculoEscolar) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    const vinculoTurma = await prisma.auxiliarTurma.findFirst({ where: { turmaId: aluno.turmaId, auxiliarId: actor.id, status: 'ATIVO' } });
    if (!vinculoTurma) throw new ForbiddenError('Você não tem vínculo ativo com a turma deste aluno.');
    return;
  }

  throw new ForbiddenError('Você não tem permissão para acessar a Anamnese.');
}

const formatarAnamnese = (a: {
  id: number; alunoId: number; modeloAnamneseId: number; numeroVersao: number; status: string;
  anoEscolaridade: string | null; possuiLaudo: string | null; cid: string | null;
  responsaveisPdi: unknown;
  acompanhadoForaDaEscola: boolean | null; especialidadesAcompanhamento: unknown; especialidadeOutroTexto: string | null;
  usoContinuoMedicamento: boolean | null; medicamentoQual: string | null; medicamentoPrescritoPor: string | null;
  medicamentoQuando: string | null; medicamentoParaQue: string | null; medicamentoEfeitosColaterais: boolean | null;
  medicamentoEfeitosQuais: string | null;
  comoGostaDeSeDivertir: string | null; idadeInicioEscola: string | null; ondeComecou: string | null;
  percursoEscolar: string | null; frequentaSalaRecursos: boolean | null; frequenciaAtendimento: string | null;
  alunoNomeSnapshot: string; turmaId: number; turmaNomeSnapshot: string; escolaId: number; escolaNomeSnapshot: string;
  createdAt: Date; createdBy: string | null; updatedAt: Date | null; updatedBy: string | null;
  concluidaEm: Date | null; concluidaPor: string | null;
}) => ({
  id: a.id,
  alunoId: a.alunoId,
  modeloAnamneseId: a.modeloAnamneseId,
  numeroVersao: a.numeroVersao,
  status: a.status,
  anoEscolaridade: a.anoEscolaridade,
  possuiLaudo: a.possuiLaudo,
  cid: a.cid,
  responsaveisPdi: a.responsaveisPdi ?? [],
  acompanhadoForaDaEscola: a.acompanhadoForaDaEscola,
  especialidadesAcompanhamento: a.especialidadesAcompanhamento ?? [],
  especialidadeOutroTexto: a.especialidadeOutroTexto,
  usoContinuoMedicamento: a.usoContinuoMedicamento,
  medicamentoQual: a.medicamentoQual,
  medicamentoPrescritoPor: a.medicamentoPrescritoPor,
  medicamentoQuando: a.medicamentoQuando,
  medicamentoParaQue: a.medicamentoParaQue,
  medicamentoEfeitosColaterais: a.medicamentoEfeitosColaterais,
  medicamentoEfeitosQuais: a.medicamentoEfeitosQuais,
  comoGostaDeSeDivertir: a.comoGostaDeSeDivertir,
  idadeInicioEscola: a.idadeInicioEscola,
  ondeComecou: a.ondeComecou,
  percursoEscolar: a.percursoEscolar,
  frequentaSalaRecursos: a.frequentaSalaRecursos,
  frequenciaAtendimento: a.frequenciaAtendimento,
  alunoNome: a.alunoNomeSnapshot,
  turmaId: a.turmaId,
  turmaNome: a.turmaNomeSnapshot,
  escolaId: a.escolaId,
  escolaNome: a.escolaNomeSnapshot,
  createdAt: a.createdAt,
  createdBy: a.createdBy,
  updatedAt: a.updatedAt,
  updatedBy: a.updatedBy,
  concluidaEm: a.concluidaEm,
  concluidaPor: a.concluidaPor,
});

const formatarPerguntaSnapshot = (p: {
  id: number; secao: string; subsecao: string | null; texto: string; explicacao: string | null;
  tipoResposta: string; opcoes: unknown; complementar: unknown; ordem: number;
}) => ({
  id: p.id,
  secao: p.secao,
  subsecao: p.subsecao,
  texto: p.texto,
  explicacao: p.explicacao,
  tipoResposta: p.tipoResposta,
  opcoes: p.opcoes ?? [],
  complementar: p.complementar ?? null,
  ordem: p.ordem,
});

const formatarResposta = (r: {
  id: number; anamneseId: number; perguntaAnamneseId: number; valor: unknown;
  createdAt: Date; createdBy: string | null; updatedAt: Date | null; updatedBy: string | null;
}) => ({
  id: r.id,
  anamneseId: r.anamneseId,
  perguntaAnamneseId: r.perguntaAnamneseId,
  valor: r.valor,
  createdAt: r.createdAt,
  createdBy: r.createdBy,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
});

async function ehVersaoAtual(alunoId: number, numeroVersao: number) {
  const maisNova = await prisma.anamnese.count({ where: { alunoId, numeroVersao: { gt: numeroVersao } } });
  return maisNova === 0;
}

// Ficha completa "suficiente pra montar a tela" (mesmo padrão de montarRespostaCompleta em
// pdiFichas.ts): a Anamnese + as perguntas da versão do Modelo QUE FOI USADA (nunca do Modelo
// vivo atual) + as respostas já salvas + se é a versão atual (só ela pode ser editada).
async function montarDetalhe(anamnese: Awaited<ReturnType<typeof prisma.anamnese.findUniqueOrThrow>>) {
  const [perguntas, respostas, versaoAtual] = await Promise.all([
    prisma.perguntaAnamnese.findMany({ where: { modeloAnamneseId: anamnese.modeloAnamneseId }, orderBy: { ordem: 'asc' } }),
    prisma.respostaAnamnese.findMany({ where: { anamneseId: anamnese.id } }),
    ehVersaoAtual(anamnese.alunoId, anamnese.numeroVersao),
  ]);

  return {
    anamnese: formatarAnamnese(anamnese),
    perguntas: perguntas.map(formatarPerguntaSnapshot),
    respostas: respostas.map(formatarResposta),
    versaoAtual,
    editavel: versaoAtual,
  };
}

// Histórico + versão atual (com detalhe completo) de um aluno — seção 15/37 do pedido. Devolve
// `atual: null` quando o aluno ainda não tem nenhuma Anamnese (nunca cria aqui: consulta nunca
// materializa nada, ver seção 36).
anamnesesRouter.get('/aluno/:alunoId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const alunoId = Number(req.params.alunoId);
  const aluno = await buscarAluno(alunoId);
  await exigirAcessoAnamnese(actor, aluno, { exigirEscrita: false });

  const versoes = await prisma.anamnese.findMany({ where: { alunoId }, orderBy: { numeroVersao: 'desc' } });
  if (versoes.length === 0) {
    return res.json({ atual: null, historico: [] });
  }

  const [atualDetalhe, ...anteriores] = versoes;
  res.json({
    atual: await montarDetalhe(atualDetalhe),
    historico: anteriores.map((a) => formatarAnamnese(a)),
  });
});

anamnesesRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);
  const anamnese = await prisma.anamnese.findUnique({ where: { id } });
  if (!anamnese) throw new NotFoundError('Anamnese não encontrada.');
  const aluno = await buscarAluno(anamnese.alunoId);
  await exigirAcessoAnamnese(actor, aluno, { exigirEscrita: false });

  res.json(await montarDetalhe(anamnese));
});

const iniciarSchema = z.object({ alunoId: z.number().int() });

// Cria a PRÓXIMA versão (1ª se o aluno nunca teve, N+1 se já teve — seções 16-20 do pedido: é a
// mesma operação por trás de "Iniciar Anamnese" e "Criar nova versão", só o rótulo na tela muda
// conforme já existir ou não uma versão anterior). Sempre usa o Modelo ATIVO no momento; nunca
// depende dele mudar depois (seção 21 — o vínculo com a versão imutável já é o suficiente).
anamnesesRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria administra a Anamnese.');
  const { alunoId } = iniciarSchema.parse(req.body);
  const aluno = await buscarAluno(alunoId);

  const modeloAtivo = await prisma.modeloAnamnese.findFirst({ where: { status: 'ATIVA' } });
  if (!modeloAtivo) throw new ValidationError('Não existe nenhum Modelo de Anamnese ativo. Configure o modelo antes de iniciar uma Anamnese.');

  const ultima = await prisma.anamnese.findFirst({ where: { alunoId }, orderBy: { numeroVersao: 'desc' } });
  const proximaVersao = (ultima?.numeroVersao ?? 0) + 1;

  const criada = await prisma.anamnese.create({
    data: {
      alunoId,
      modeloAnamneseId: modeloAtivo.id,
      numeroVersao: proximaVersao,
      status: 'PENDENTE',
      responsaveisPdi: [],
      alunoNomeSnapshot: aluno.nome,
      turmaId: aluno.turmaId,
      turmaNomeSnapshot: aluno.turma.nome,
      escolaId: aluno.turma.escolaId,
      escolaNomeSnapshot: aluno.turma.escola.nome,
      createdBy: String(actor.id),
    },
  });

  res.status(201).json(await montarDetalhe(criada));
});

const valorRespostaSchema = z.object({
  resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  respostas: z.array(z.string()).nullish(),
  complementarTexto: z.string().nullish(),
});
const respostaItemSchema = z.object({ perguntaAnamneseId: z.number().int(), valor: valorRespostaSchema });
const dadosEstruturaisSchema = z.object({
  anoEscolaridade: z.string().trim().nullish(),
  possuiLaudo: z.enum(['SIM', 'NAO', 'EM_INVESTIGACAO']).nullish(),
  cid: z.string().trim().nullish(),
  responsaveisPdi: z.array(z.object({ cargo: z.string(), nome: z.string() })).optional(),
  acompanhadoForaDaEscola: z.boolean().nullish(),
  especialidadesAcompanhamento: z.array(z.string()).optional(),
  especialidadeOutroTexto: z.string().trim().nullish(),
  usoContinuoMedicamento: z.boolean().nullish(),
  medicamentoQual: z.string().trim().nullish(),
  medicamentoPrescritoPor: z.string().trim().nullish(),
  medicamentoQuando: z.string().trim().nullish(),
  medicamentoParaQue: z.string().trim().nullish(),
  medicamentoEfeitosColaterais: z.boolean().nullish(),
  medicamentoEfeitosQuais: z.string().trim().nullish(),
  comoGostaDeSeDivertir: z.string().trim().nullish(),
  idadeInicioEscola: z.string().trim().nullish(),
  ondeComecou: z.string().trim().nullish(),
  percursoEscolar: z.string().trim().nullish(),
  frequentaSalaRecursos: z.boolean().nullish(),
  frequenciaAtendimento: z.string().trim().nullish(),
});
const salvarSchema = z.object({
  estrutural: dadosEstruturaisSchema.optional(),
  respostas: z.array(respostaItemSchema).optional(),
});

async function exigirVersaoAtualEditavel(anamnese: { id: number; alunoId: number; numeroVersao: number }) {
  if (!(await ehVersaoAtual(anamnese.alunoId, anamnese.numeroVersao))) {
    throw new ValidationError('Esta é uma versão histórica da Anamnese — não pode mais ser editada. Crie uma nova versão.');
  }
}

// Salvamento parcial (seção 25 do pedido): tanto a parte estrutural quanto as respostas
// configuráveis podem ser enviadas juntas ou separadas, quantas vezes for preciso.
anamnesesRouter.put('/:id/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria administra a Anamnese.');
  const id = Number(req.params.id);
  const { estrutural, respostas } = salvarSchema.parse(req.body);

  const anamnese = await prisma.anamnese.findUnique({ where: { id } });
  if (!anamnese) throw new NotFoundError('Anamnese não encontrada.');
  await exigirVersaoAtualEditavel(anamnese);

  if (estrutural) {
    await prisma.anamnese.update({ where: { id }, data: { ...estrutural, updatedBy: String(actor.id) } });
  }

  if (respostas && respostas.length > 0) {
    const perguntasDoModelo = await prisma.perguntaAnamnese.findMany({ where: { modeloAnamneseId: anamnese.modeloAnamneseId } });
    const perguntasPorId = new Map(perguntasDoModelo.map((p) => [p.id, p]));
    if (respostas.some((item) => !perguntasPorId.has(item.perguntaAnamneseId))) {
      throw new ValidationError('Uma ou mais perguntas informadas não pertencem a esta Anamnese.');
    }
    const respostasAplicaveis = respostas.filter((item) => perguntasPorId.get(item.perguntaAnamneseId)!.tipoResposta !== 'ORIENTACAO');

    await prisma.$transaction(
      respostasAplicaveis.map((item) => prisma.respostaAnamnese.upsert({
        where: { anamneseId_perguntaAnamneseId: { anamneseId: id, perguntaAnamneseId: item.perguntaAnamneseId } },
        create: { anamneseId: id, perguntaAnamneseId: item.perguntaAnamneseId, valor: item.valor, createdBy: String(actor.id) },
        update: { valor: item.valor, updatedBy: String(actor.id) },
      })),
    );

    const novoStatus = statusAposSalvarResposta(anamnese.status as 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA', respostasAplicaveis.length > 0);
    if (novoStatus !== anamnese.status) {
      await prisma.anamnese.update({ where: { id }, data: { status: novoStatus, updatedBy: String(actor.id) } });
    }
  }

  const atualizada = await prisma.anamnese.findUniqueOrThrow({ where: { id } });
  res.json(await montarDetalhe(atualizada));
});

// Ação explícita de conclusão (seção 26 do pedido) — idempotente, igual a FichaPdi.
anamnesesRouter.post('/:id/concluir', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria administra a Anamnese.');
  const id = Number(req.params.id);

  const anamnese = await prisma.anamnese.findUnique({ where: { id } });
  if (!anamnese) throw new NotFoundError('Anamnese não encontrada.');
  await exigirVersaoAtualEditavel(anamnese);

  if (anamnese.status !== 'CONCLUIDA') {
    await prisma.anamnese.update({
      where: { id },
      data: { status: 'CONCLUIDA', concluidaEm: new Date(), concluidaPor: String(actor.id), updatedBy: String(actor.id) },
    });
  }

  const atualizada = await prisma.anamnese.findUniqueOrThrow({ where: { id } });
  res.json(await montarDetalhe(atualizada));
});

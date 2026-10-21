import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { statusAposRespostaDoAutor } from '../../domain/feedbackSistema.js';
import { criarNotificacao } from '../../lib/notificacoes.js';

export const feedbackSistemaRouter = Router();

type Actor = { id: number; perfil: string };

// Entidade PRÓPRIA, deliberadamente separada de Mensagem/ConversaMensagem (seção 15 do pedido) —
// canal técnico GLOBAL entre qualquer perfil autenticado e SUPORTE_SISTEMA, nunca escopado por
// escola/vínculo/hierarquia pedagógica. "Meus feedbacks" é sempre por autorId; a caixa global é
// exclusiva de SUPORTE_SISTEMA — nenhum outro perfil vê feedback de terceiros (seção 16).
function exigirSuporte(actor: Actor) {
  if (actor.perfil !== 'SUPORTE_SISTEMA') {
    throw new ForbiddenError('Somente o Suporte do Sistema pode acessar esta área.');
  }
}

const CATEGORIAS = ['ERRO_BUG', 'SUGESTAO_MELHORIA', 'DIFICULDADE_USO', 'LENTIDAO_TECNICO', 'OUTRO_PROBLEMA'] as const;
const STATUS = ['NOVO', 'EM_ANALISE', 'RESOLVIDO', 'NAO_E_PROBLEMA_DO_SISTEMA'] as const;
const PERFIS = ['SECRETARIA', 'GESTOR', 'DIRETORA', 'PROFESSOR', 'AUXILIAR', 'SUPORTE_SISTEMA'] as const;

// Contexto de escola só informativo (seção 6 do pedido: "quando disponível") — NUNCA usado para
// autorização. Primeiro vínculo ATIVO de quem está criando; Secretaria/SUPORTE_SISTEMA (sem
// vínculo nenhum) fica null, igual a qualquer perfil que porventura não tenha vínculo ativo.
async function resolverEscolaContexto(actor: Actor): Promise<number | null> {
  const vinculo = await prisma.vinculoEscolar.findFirst({
    where: { pessoaId: actor.id, status: 'ATIVO' },
    orderBy: { dataInicio: 'asc' },
    select: { escolaId: true },
  });
  return vinculo?.escolaId ?? null;
}

async function notificarTodoSuporte(feedbackId: number, titulo: string, corpo: string, excetoAutorId?: number) {
  const suportes = await prisma.pessoa.findMany({ where: { perfil: 'SUPORTE_SISTEMA', status: 'ATIVO' }, select: { id: true } });
  await Promise.all(
    suportes
      .filter((s) => s.id !== excetoAutorId)
      .map((s) => criarNotificacao(prisma, {
        destinatarioId: s.id,
        tipo: 'NOVO_FEEDBACK_SISTEMA',
        titulo,
        corpo,
        linkContexto: `/feedback-sistema/${feedbackId}`,
        metadata: { feedbackId },
      })),
  );
}

const formatarResumo = (f: {
  id: number; categoria: string; assunto: string; status: string; autorId: number;
  autorPerfilSnapshot: string; escolaId: number | null; createdAt: Date; updatedAt: Date | null;
  autor?: { nome: string } | null; escola?: { nome: string } | null;
}) => ({
  id: f.id,
  categoria: f.categoria,
  assunto: f.assunto,
  status: f.status,
  autorId: f.autorId,
  autorNome: f.autor?.nome ?? null,
  autorPerfil: f.autorPerfilSnapshot,
  escolaId: f.escolaId,
  escolaNome: f.escola?.nome ?? null,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});

const formatarMensagem = (m: { id: number; autorId: number; conteudo: string; createdAt: Date; autor?: { nome: string; perfil: string } | null }) => ({
  id: m.id,
  autorId: m.autorId,
  autorNome: m.autor?.nome ?? null,
  autorPerfil: m.autor?.perfil ?? null,
  conteudo: m.conteudo,
  createdAt: m.createdAt,
});

const formatarEvento = (e: { id: number; tipo: string; statusAnterior: string | null; statusNovo: string | null; autorId: number | null; createdAt: Date; autor?: { nome: string } | null }) => ({
  id: e.id,
  tipo: e.tipo,
  statusAnterior: e.statusAnterior,
  statusNovo: e.statusNovo,
  autorNome: e.autor?.nome ?? null, // null = sistema (reabertura automática)
  createdAt: e.createdAt,
});

async function montarDetalhe(feedbackId: number) {
  const [feedback, mensagens, eventos] = await Promise.all([
    prisma.feedbackSistema.findUniqueOrThrow({
      where: { id: feedbackId },
      include: { autor: { select: { nome: true } }, escola: { select: { nome: true } } },
    }),
    prisma.mensagemFeedbackSistema.findMany({
      where: { feedbackId },
      orderBy: { createdAt: 'asc' },
      include: { autor: { select: { nome: true, perfil: true } } },
    }),
    prisma.feedbackSistemaEvento.findMany({
      where: { feedbackId },
      orderBy: { createdAt: 'asc' },
      include: { autor: { select: { nome: true } } },
    }),
  ]);
  return {
    ...formatarResumo(feedback),
    descricao: feedback.descricao,
    rotaOrigem: feedback.rotaOrigem,
    userAgentResumo: feedback.userAgentResumo,
    tipoDispositivo: feedback.tipoDispositivo,
    mensagens: mensagens.map(formatarMensagem),
    eventos: eventos.map(formatarEvento),
  };
}

const criarFeedbackSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  assunto: z.string().trim().min(1, 'Informe o assunto.').max(200),
  descricao: z.string().trim().min(1, 'Informe a descrição.').max(4000),
  // Capturados automaticamente pelo frontend (seção 20 do pedido) — nunca digitados pelo usuário.
  rotaOrigem: z.string().trim().max(200).nullish(),
  userAgentResumo: z.string().trim().max(200).nullish(),
  tipoDispositivo: z.string().trim().max(20).nullish(),
});

// Qualquer perfil autenticado pode criar (seção 1 do pedido) — sem exigência de escola/vínculo.
feedbackSistemaRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const dados = criarFeedbackSchema.parse(req.body);
  const escolaId = await resolverEscolaContexto(actor);

  const criado = await prisma.$transaction(async (tx) => {
    const feedback = await tx.feedbackSistema.create({
      data: {
        autorId: actor.id,
        autorPerfilSnapshot: actor.perfil as (typeof PERFIS)[number],
        escolaId,
        categoria: dados.categoria,
        assunto: dados.assunto,
        descricao: dados.descricao,
        rotaOrigem: dados.rotaOrigem ?? null,
        userAgentResumo: dados.userAgentResumo ?? null,
        tipoDispositivo: dados.tipoDispositivo ?? null,
      },
    });
    await tx.feedbackSistemaEvento.create({ data: { feedbackId: feedback.id, tipo: 'CRIACAO', statusNovo: 'NOVO', autorId: actor.id } });
    return feedback;
  });

  await notificarTodoSuporte(criado.id, 'Novo feedback do sistema', `${criado.assunto}`);

  res.status(201).json(await montarDetalhe(criado.id));
});

// --- "Meus feedbacks" (qualquer perfil, só os próprios) — registradas ANTES de /:id, senão
// Express casaria "meus" como se fosse um :id (mesmo cuidado já usado em outras áreas do PDI).

feedbackSistemaRouter.get('/meus', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const feedbacks = await prisma.feedbackSistema.findMany({
    where: { autorId: actor.id },
    orderBy: { updatedAt: 'desc' },
    include: { autor: { select: { nome: true } }, escola: { select: { nome: true } } },
  });
  res.json(feedbacks.map(formatarResumo));
});

// Nunca confirma existência pra quem não é o autor (seção 16 do pedido) — 404 genérico, nunca 403.
feedbackSistemaRouter.get('/meus/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);
  const feedback = await prisma.feedbackSistema.findUnique({ where: { id } });
  if (!feedback || feedback.autorId !== actor.id) throw new NotFoundError('Feedback não encontrado.');
  res.json(await montarDetalhe(id));
});

const responderSchema = z.object({ conteudo: z.string().trim().min(1, 'Escreva uma mensagem.').max(2000) });

// Continuidade da conversa pelo autor (seção 17) — se o chamado já estava RESOLVIDO, reabre como
// EM_ANALISE automaticamente (decisão do usuário, sem padrão equivalente prévio no sistema).
feedbackSistemaRouter.post('/meus/:id/responder', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);
  const { conteudo } = responderSchema.parse(req.body);

  const feedback = await prisma.feedbackSistema.findUnique({ where: { id } });
  if (!feedback || feedback.autorId !== actor.id) throw new NotFoundError('Feedback não encontrado.');

  const novoStatus = statusAposRespostaDoAutor(feedback.status);
  await prisma.$transaction(async (tx) => {
    await tx.mensagemFeedbackSistema.create({ data: { feedbackId: id, autorId: actor.id, conteudo } });
    if (novoStatus !== feedback.status) {
      await tx.feedbackSistema.update({ where: { id }, data: { status: novoStatus } });
      await tx.feedbackSistemaEvento.create({ data: { feedbackId: id, tipo: 'REABERTURA_AUTOMATICA', statusAnterior: feedback.status, statusNovo: novoStatus, autorId: null } });
    } else {
      await tx.feedbackSistema.update({ where: { id }, data: { updatedAt: new Date() } });
    }
  });

  await notificarTodoSuporte(id, 'Nova mensagem em feedback do sistema', `Atualização no chamado "${feedback.assunto}"`);

  res.json(await montarDetalhe(id));
});

// --- Caixa do Suporte (exclusiva de SUPORTE_SISTEMA) ------------------------------------------

const listaQuerySchema = z.object({
  status: z.enum(STATUS).optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  autorPerfil: z.enum(PERFIS).optional(),
  escolaId: z.coerce.number().int().optional(),
  busca: z.string().trim().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
});

feedbackSistemaRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSuporte(actor);
  const filtros = listaQuerySchema.parse(req.query);

  const where: Prisma.FeedbackSistemaWhereInput = {
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
    ...(filtros.autorPerfil ? { autorPerfilSnapshot: filtros.autorPerfil } : {}),
    ...(filtros.escolaId ? { escolaId: filtros.escolaId } : {}),
    ...(filtros.busca ? {
      OR: [
        { assunto: { contains: filtros.busca, mode: 'insensitive' } },
        { autor: { nome: { contains: filtros.busca, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const feedbacks = await prisma.feedbackSistema.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: filtros.limite ?? 50,
    include: { autor: { select: { nome: true } }, escola: { select: { nome: true } } },
  });
  res.json(feedbacks.map(formatarResumo));
});

feedbackSistemaRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSuporte(actor);
  const id = Number(req.params.id);
  const feedback = await prisma.feedbackSistema.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('Feedback não encontrado.');
  res.json(await montarDetalhe(id));
});

// Resposta do Suporte (seção 11) — nunca muda o status por si só (seção 13 trata status como
// ação própria, explícita); o frontend pode disparar as duas chamadas em sequência se quiser.
feedbackSistemaRouter.post('/:id/responder', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSuporte(actor);
  const id = Number(req.params.id);
  const { conteudo } = responderSchema.parse(req.body);

  const feedback = await prisma.feedbackSistema.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('Feedback não encontrado.');

  await prisma.$transaction([
    prisma.mensagemFeedbackSistema.create({ data: { feedbackId: id, autorId: actor.id, conteudo } }),
    prisma.feedbackSistema.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);

  await criarNotificacao(prisma, {
    destinatarioId: feedback.autorId,
    tipo: 'RESPOSTA_FEEDBACK_SISTEMA',
    titulo: 'Nova resposta do suporte',
    corpo: `Seu feedback "${feedback.assunto}" recebeu uma resposta.`,
    linkContexto: `/feedback-sistema/meus/${id}`,
    metadata: { feedbackId: id },
  });

  res.json(await montarDetalhe(id));
});

const statusSchema = z.object({ status: z.enum(STATUS) });

// Mudança de status (seção 13) — sempre auditada (FeedbackSistemaEvento), idempotente (setar o
// mesmo status de novo só não gera evento à toa).
feedbackSistemaRouter.post('/:id/status', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSuporte(actor);
  const id = Number(req.params.id);
  const { status } = statusSchema.parse(req.body);

  const feedback = await prisma.feedbackSistema.findUnique({ where: { id } });
  if (!feedback) throw new NotFoundError('Feedback não encontrado.');
  if (feedback.status === status) return res.json(await montarDetalhe(id));

  await prisma.$transaction([
    prisma.feedbackSistema.update({ where: { id }, data: { status } }),
    prisma.feedbackSistemaEvento.create({ data: { feedbackId: id, tipo: 'MUDANCA_STATUS', statusAnterior: feedback.status, statusNovo: status, autorId: actor.id } }),
  ]);

  res.json(await montarDetalhe(id));
});

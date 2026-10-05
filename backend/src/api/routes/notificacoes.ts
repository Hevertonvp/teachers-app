import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { obterChavePublicaVapid } from '../../lib/webPush.js';

export const notificacoesRouter = Router();

type Actor = { id: number; perfil: string };

// --- GET / -------------------------------------------------------------------------------------
// Sempre só as notificações do PRÓPRIO autenticado (seção 42/65 do pedido) — destinatarioId nunca
// vem de query/body, só de res.locals.pessoa. Não lidas primeiro, depois mais recentes (seção 11).
notificacoesRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const limite = Math.min(Number(req.query.limite) || 50, 100);

  const notificacoes = await prisma.notificacao.findMany({
    where: { destinatarioId: actor.id },
    orderBy: [{ lidaEm: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
    take: limite,
  });

  res.json(notificacoes);
});

// --- GET /nao-lidas ------------------------------------------------------------------------------
notificacoesRouter.get('/nao-lidas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const total = await prisma.notificacao.count({ where: { destinatarioId: actor.id, lidaEm: null } });
  res.json({ total });
});

// --- POST /:id/marcar-lida -----------------------------------------------------------------------
notificacoesRouter.post('/:id/marcar-lida', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);

  const notificacao = await prisma.notificacao.findUnique({ where: { id } });
  if (!notificacao) throw new NotFoundError('Notificação não encontrada.');
  if (notificacao.destinatarioId !== actor.id) {
    throw new ForbiddenError('Você não pode marcar uma notificação de outra pessoa como lida.');
  }

  if (!notificacao.lidaEm) {
    await prisma.notificacao.update({ where: { id }, data: { lidaEm: new Date() } });
  }
  res.json({ ok: true });
});

// --- POST /marcar-todas-lidas ----------------------------------------------------------------
notificacoesRouter.post('/marcar-todas-lidas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  await prisma.notificacao.updateMany({
    where: { destinatarioId: actor.id, lidaEm: null },
    data: { lidaEm: new Date() },
  });
  res.json({ ok: true });
});

// --- GET /push/chave-publica -------------------------------------------------------------------
// Evita precisar manter a chave pública VAPID duplicada em build-time do frontend — fonte única
// no backend.
notificacoesRouter.get('/push/chave-publica', async (_req, res) => {
  res.json({ chavePublica: obterChavePublicaVapid() });
});

// --- POST /push/assinar ---------------------------------------------------------------------
const assinarPushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().max(300).optional(),
});

// pessoaId NUNCA vem do corpo (seção 65 do pedido: payload adulterado tentando assinar em nome de
// outra pessoa é ignorado) — sempre res.locals.pessoa.id. Upsert por `endpoint`: reassinar o mesmo
// navegador (inclusive sob outra conta) reatribui a assinatura em vez de duplicar.
notificacoesRouter.post('/push/assinar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { endpoint, keys, userAgent } = assinarPushSchema.parse(req.body);

  const assinatura = await prisma.assinaturaPush.upsert({
    where: { endpoint },
    update: { pessoaId: actor.id, p256dh: keys.p256dh, auth: keys.auth, userAgent, status: 'ATIVA' },
    create: { pessoaId: actor.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, status: 'ATIVA' },
  });

  res.status(201).json({ id: assinatura.id });
});

// --- POST /push/desassinar -------------------------------------------------------------------
const desassinarPushSchema = z.object({ endpoint: z.string().url() });

// Desativa só a assinatura DAQUELE endpoint/dispositivo — nunca os outros dispositivos da mesma
// pessoa (seção 15 do pedido). Nunca apaga a Central de Notificações.
notificacoesRouter.post('/push/desassinar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { endpoint } = desassinarPushSchema.parse(req.body);

  const assinatura = await prisma.assinaturaPush.findUnique({ where: { endpoint } });
  if (!assinatura || assinatura.pessoaId !== actor.id) {
    // Idempotente do ponto de vista do cliente: nada pra desativar (já não existe, ou nunca foi
    // dele) não é erro — ele só quer garantir que aquele dispositivo não recebe mais push.
    return res.json({ ok: true });
  }

  await prisma.assinaturaPush.update({ where: { endpoint }, data: { status: 'INATIVA' } });
  res.json({ ok: true });
});

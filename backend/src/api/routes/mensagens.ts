import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { exigeVinculoEscolarProprio, podeConversar, podeEnviarEmMassa, type PerfilMensagem } from '../../domain/mensagens.js';
import { textoNovaMensagem } from '../../domain/notificacoes.js';
import { criarNotificacao } from '../../lib/notificacoes.js';

export const mensagensRouter = Router();

type Actor = { id: number; perfil: string };

function comoPerfilMensagem(perfil: string): PerfilMensagem {
  return perfil as PerfilMensagem;
}

async function escolasAtivasDe(pessoaId: number): Promise<Set<number>> {
  const vinculos = await prisma.vinculoEscolar.findMany({ where: { pessoaId, status: 'ATIVO' }, select: { escolaId: true } });
  return new Set(vinculos.map((v) => v.escolaId));
}

// Confirma que `pessoa` (perfil + id) ainda pode participar de uma conversa naquela escola, AGORA
// — nunca a partir de ParticipanteConversa, que é só histórico (seção 7 do pedido: relação
// histórica nunca concede autorização, mesma filosofia de Ficha PDI).
async function temAcessoAtual(perfil: string, pessoaId: number, escolaId: number): Promise<boolean> {
  if (perfil === 'SECRETARIA') return true;
  const vinculo = await prisma.vinculoEscolar.findFirst({ where: { pessoaId, escolaId, status: 'ATIVO' } });
  return !!vinculo;
}

// --- GET /api/mensagens/destinatarios?escolaId= --------------------------------------------
// Devolve `escolas` (contextos onde o ator atual pode originar mensagem — pra Secretaria é
// irrelevante, ela nunca escolhe escola própria) e `destinatarios` já resolvidos pro contexto
// efetivo (escolaId informado, ou a única escola do ator, ou vazio se ambíguo e não informado).
mensagensRouter.get('/destinatarios', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const perfil = comoPerfilMensagem(actor.perfil);
  const escolaIdQuery = req.query.escolaId ? Number(req.query.escolaId) : undefined;

  if (perfil === 'SECRETARIA') {
    const diretoras = await prisma.pessoa.findMany({
      where: { perfil: 'DIRETORA', status: 'ATIVO' },
      include: { vinculosEscolares: { where: { status: 'ATIVO' }, include: { escola: true } } },
    });
    const destinatarios = diretoras.flatMap((d) =>
      d.vinculosEscolares.map((v) => ({ pessoaId: d.id, nome: d.nome, perfil: 'DIRETORA', escolaId: v.escolaId, escolaNome: v.escola.nome })),
    );
    return res.json({ escolas: [], destinatarios });
  }

  if (!exigeVinculoEscolarProprio(perfil)) {
    throw new ForbiddenError('Perfil sem permissão para consultar destinatários de Mensagens.');
  }

  const minhasEscolasIds = await escolasAtivasDe(actor.id);
  if (minhasEscolasIds.size === 0) return res.json({ escolas: [], destinatarios: [] });

  const minhasEscolas = await prisma.escola.findMany({ where: { id: { in: [...minhasEscolasIds] } }, select: { id: true, nome: true } });

  const escolaEfetiva = escolaIdQuery ?? (minhasEscolasIds.size === 1 ? [...minhasEscolasIds][0] : undefined);
  if (escolaEfetiva === undefined) {
    return res.json({ escolas: minhasEscolas, destinatarios: [] });
  }
  if (!minhasEscolasIds.has(escolaEfetiva)) {
    throw new ForbiddenError('Você não tem vínculo ativo com esta escola.');
  }

  const perfisAlvo: PerfilMensagem[] =
    perfil === 'DIRETORA' ? ['GESTOR', 'PROFESSOR', 'AUXILIAR'] :
    perfil === 'GESTOR' ? ['DIRETORA', 'PROFESSOR', 'AUXILIAR'] :
    ['DIRETORA', 'GESTOR']; // PROFESSOR / AUXILIAR

  const pessoasDaEscola = await prisma.pessoa.findMany({
    where: { status: 'ATIVO', perfil: { in: perfisAlvo }, vinculosEscolares: { some: { escolaId: escolaEfetiva, status: 'ATIVO' } } },
    select: { id: true, nome: true, perfil: true },
  });
  const destinatarios = pessoasDaEscola
    .filter((p) => podeConversar(perfil, comoPerfilMensagem(p.perfil)))
    .map((p) => ({ pessoaId: p.id, nome: p.nome, perfil: p.perfil, escolaId: escolaEfetiva, escolaNome: minhasEscolas.find((e) => e.id === escolaEfetiva)?.nome }));

  // DIRETORA/GESTOR também podem falar "pra cima"/"pro lado" conforme a matriz — Diretora com
  // Secretaria, Gestor com Diretora já cobertos acima via perfisAlvo; Secretaria não tem
  // VinculoEscolar então entra à parte.
  if (perfil === 'DIRETORA') {
    const secretarias = await prisma.pessoa.findMany({ where: { perfil: 'SECRETARIA', status: 'ATIVO' }, select: { id: true, nome: true, perfil: true } });
    destinatarios.push(...secretarias.map((s) => ({ pessoaId: s.id, nome: s.nome, perfil: s.perfil, escolaId: escolaEfetiva, escolaNome: minhasEscolas.find((e) => e.id === escolaEfetiva)?.nome })));
  }

  res.json({ escolas: minhasEscolas, destinatarios });
});

// --- POST /api/mensagens/conversas ----------------------------------------------------------
const destinatarioSchema = z.object({ pessoaId: z.number().int(), escolaId: z.number().int() });
const criarConversaSchema = z.object({
  destinatarios: z.array(destinatarioSchema).min(1).max(100),
  assunto: z.string().trim().min(1).max(200),
  conteudo: z.string().trim().min(1).max(5000),
});

// Validação TODA antes de persistir qualquer coisa (seção 31 do pedido: tudo ou nada — nunca
// envia parcial). Cada destinatário cria sua PRÓPRIA ConversaMensagem privada (seção 5/33: envio
// em massa nunca vira grupo) — `loteId` só agrupa informativamente quando há mais de um.
mensagensRouter.post('/conversas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const perfilAtor = comoPerfilMensagem(actor.perfil);
  const { destinatarios, assunto, conteudo } = criarConversaSchema.parse(req.body);

  if (destinatarios.length > 1 && !podeEnviarEmMassa(perfilAtor)) {
    throw new ForbiddenError('Seu perfil só pode enviar mensagens individualmente, não em massa.');
  }

  // Dedup (mesma pessoa+escola repetida no payload não deveria gerar 2 conversas idênticas).
  const chaves = new Set<string>();
  for (const d of destinatarios) {
    const chave = `${d.pessoaId}:${d.escolaId}`;
    if (chaves.has(chave)) throw new ValidationError('Destinatário repetido na mesma requisição.');
    chaves.add(chave);
  }

  const minhasEscolas = exigeVinculoEscolarProprio(perfilAtor) ? await escolasAtivasDe(actor.id) : null;

  const pessoas = await prisma.pessoa.findMany({ where: { id: { in: destinatarios.map((d) => d.pessoaId) } } });
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p]));

  const validados: { pessoaId: number; escolaId: number; perfil: PerfilMensagem; nome: string }[] = [];
  for (const d of destinatarios) {
    const pessoa = pessoaPorId.get(d.pessoaId);
    if (!pessoa || pessoa.status !== 'ATIVO') {
      throw new NotFoundError(`Destinatário (pessoaId=${d.pessoaId}) não encontrado ou inativo.`);
    }
    if (d.pessoaId === actor.id) {
      throw new ValidationError('Você não pode iniciar uma conversa consigo mesmo.');
    }
    const perfilDestino = comoPerfilMensagem(pessoa.perfil);
    if (!podeConversar(perfilAtor, perfilDestino)) {
      throw new ForbiddenError(`Seu perfil (${perfilAtor}) não pode conversar com ${perfilDestino}.`);
    }
    // Lado do ator: precisa ter vínculo ativo na escola declarada (exceto Secretaria).
    if (minhasEscolas && !minhasEscolas.has(d.escolaId)) {
      throw new ForbiddenError('Você não tem vínculo ativo com a escola informada para este destinatário.');
    }
    // Lado do destinatário: idem (exceto se ELE for Secretaria).
    if (exigeVinculoEscolarProprio(perfilDestino)) {
      const vinculoDestino = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: d.pessoaId, escolaId: d.escolaId, status: 'ATIVO' } });
      if (!vinculoDestino) {
        throw new ValidationError(`${pessoa.nome} não tem vínculo ativo com a escola informada.`);
      }
    }
    validados.push({ pessoaId: d.pessoaId, escolaId: d.escolaId, perfil: perfilDestino, nome: pessoa.nome });
  }

  const loteId = validados.length > 1 ? randomUUID() : null;

  const criadas = await prisma.$transaction(async (tx) => {
    const resultado = [];
    for (const destino of validados) {
      const conversa = await tx.conversaMensagem.create({
        data: { escolaId: destino.escolaId, assunto, loteId, createdBy: String(actor.id) },
      });
      await tx.participanteConversa.createMany({
        data: [
          { conversaId: conversa.id, pessoaId: actor.id },
          { conversaId: conversa.id, pessoaId: destino.pessoaId },
        ],
      });
      await tx.mensagem.create({ data: { conversaId: conversa.id, remetenteId: actor.id, conteudo } });
      resultado.push({ conversaId: conversa.id, destinatarioId: destino.pessoaId, destinatarioNome: destino.nome, escolaId: destino.escolaId });
    }
    return resultado;
  });

  // Notificação interna (+ Push best-effort) para CADA destinatário individualmente — mesmo em
  // lote, cada um recebe a sua própria, ninguém sabe dos outros (seção 20 do pedido). Nunca para
  // quem enviou (seção 19). Roda depois da transação principal já ter sido confirmada: uma falha
  // aqui (criarNotificacao nunca lança) não pode desfazer nem atrasar o envio da Mensagem em si.
  const remetente = await prisma.pessoa.findUnique({ where: { id: actor.id }, select: { nome: true } });
  const { titulo, corpo } = textoNovaMensagem(remetente?.nome ?? 'alguém');
  await Promise.all(
    criadas.map((c) =>
      criarNotificacao(prisma, {
        destinatarioId: c.destinatarioId,
        tipo: 'NOVA_MENSAGEM',
        titulo,
        corpo,
        linkContexto: `/mensagens?conversa=${c.conversaId}`,
        metadata: { conversaId: c.conversaId },
      }),
    ),
  );

  res.status(201).json({ loteId, conversas: criadas });
});

// --- Leitura de uma Conversa (thread completa) ----------------------------------------------
async function buscarParticipacao(actorId: number, conversaId: number) {
  const participacao = await prisma.participanteConversa.findUnique({ where: { conversaId_pessoaId: { conversaId, pessoaId: actorId } } });
  if (!participacao) throw new ForbiddenError('Você não participa desta conversa.');
  return participacao;
}

async function exigirAcessoConversa(actor: Actor, conversaId: number) {
  const conversa = await prisma.conversaMensagem.findUnique({ where: { id: conversaId } });
  if (!conversa) throw new NotFoundError('Conversa não encontrada.');
  await buscarParticipacao(actor.id, conversaId); // precisa ter participado (histórico)
  const acessoAgora = await temAcessoAtual(actor.perfil, actor.id, conversa.escolaId);
  if (!acessoAgora) {
    throw new ForbiddenError('Você não tem mais vínculo ativo com a escola desta conversa.');
  }
  return conversa;
}

const formatarMensagem = (m: { id: number; conversaId: number; remetenteId: number; conteudo: string; lidaEm: Date | null; createdAt: Date; remetente?: { nome: string; perfil: string } }) => ({
  id: m.id,
  conversaId: m.conversaId,
  remetenteId: m.remetenteId,
  remetenteNome: m.remetente?.nome,
  remetentePerfil: m.remetente?.perfil,
  conteudo: m.conteudo,
  lidaEm: m.lidaEm,
  createdAt: m.createdAt,
});

async function marcarComoLida(actorId: number, conversaId: number) {
  await prisma.mensagem.updateMany({
    where: { conversaId, remetenteId: { not: actorId }, lidaEm: null },
    data: { lidaEm: new Date() },
  });
}

mensagensRouter.get('/conversas/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const conversaId = Number(req.params.id);
  const conversa = await exigirAcessoConversa(actor, conversaId);

  // Abrir a conversa marca como lida o que o OUTRO lado mandou (seção 10 do pedido).
  await marcarComoLida(actor.id, conversaId);

  const [mensagens, participantes, escola] = await Promise.all([
    prisma.mensagem.findMany({ where: { conversaId }, include: { remetente: { select: { nome: true, perfil: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.participanteConversa.findMany({ where: { conversaId }, include: { pessoa: { select: { id: true, nome: true, perfil: true } } } }),
    prisma.escola.findUnique({ where: { id: conversa.escolaId }, select: { nome: true } }),
  ]);

  const outro = participantes.find((p) => p.pessoaId !== actor.id)?.pessoa ?? null;

  res.json({
    id: conversa.id,
    assunto: conversa.assunto,
    escolaId: conversa.escolaId,
    escolaNome: escola?.nome,
    loteId: conversa.loteId,
    outraPessoa: outro,
    mensagens: mensagens.map(formatarMensagem),
  });
});

// --- POST /conversas/:id/respostas ----------------------------------------------------------
const responderSchema = z.object({ conteudo: z.string().trim().min(1).max(5000) });

mensagensRouter.post('/conversas/:id/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const conversaId = Number(req.params.id);
  const { conteudo } = responderSchema.parse(req.body);

  await exigirAcessoConversa(actor, conversaId); // revalida vínculo atual antes de responder (seção 32)

  const outro = await prisma.participanteConversa.findFirst({ where: { conversaId, pessoaId: { not: actor.id } } });

  const mensagem = await prisma.$transaction(async (tx) => {
    const criada = await tx.mensagem.create({
      data: { conversaId, remetenteId: actor.id, conteudo },
      include: { remetente: { select: { nome: true, perfil: true } } },
    });
    await tx.conversaMensagem.update({ where: { id: conversaId }, data: { updatedAt: new Date() } });
    // Atividade nova faz a conversa reaparecer pro destinatário, mesmo se ele tinha ocultado
    // (seção 45 do pedido — "nova atividade deve fazer a conversa reaparecer").
    if (outro) {
      await tx.participanteConversa.update({ where: { id: outro.id }, data: { ocultaEm: null } });
    }
    return criada;
  });

  // Resposta em thread também é "nova mensagem" (seção 19 do pedido) — notifica só o OUTRO
  // participante, nunca quem acabou de responder.
  if (outro) {
    const remetente = await prisma.pessoa.findUnique({ where: { id: actor.id }, select: { nome: true } });
    const { titulo, corpo } = textoNovaMensagem(remetente?.nome ?? 'alguém');
    await criarNotificacao(prisma, {
      destinatarioId: outro.pessoaId,
      tipo: 'NOVA_MENSAGEM',
      titulo,
      corpo,
      linkContexto: `/mensagens?conversa=${conversaId}`,
      metadata: { conversaId },
    });
  }

  res.status(201).json(formatarMensagem(mensagem));
});

// --- POST /conversas/:id/marcar-lida ---------------------------------------------------------
mensagensRouter.post('/conversas/:id/marcar-lida', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const conversaId = Number(req.params.id);
  await exigirAcessoConversa(actor, conversaId);
  await marcarComoLida(actor.id, conversaId);
  res.json({ ok: true });
});

// --- POST /conversas/:id/ocultar (Excluir para mim) -------------------------------------------
mensagensRouter.post('/conversas/:id/ocultar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const conversaId = Number(req.params.id);
  await exigirAcessoConversa(actor, conversaId);
  await prisma.participanteConversa.update({
    where: { conversaId_pessoaId: { conversaId, pessoaId: actor.id } },
    data: { ocultaEm: new Date() },
  });
  res.json({ ok: true });
});

// --- GET /api/mensagens/conversas -------------------------------------------------------------
// Caixa de entrada + Enviadas num fetch só (seção 13: a tela decide o recorte por aba a partir de
// `iniciadaPorMim`, mesmo padrão já usado no mock antigo, só que com dado real agora).
mensagensRouter.get('/conversas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;

  const participacoes = await prisma.participanteConversa.findMany({
    where: { pessoaId: actor.id, ocultaEm: null },
    include: {
      conversa: {
        include: {
          participantes: { include: { pessoa: { select: { id: true, nome: true, perfil: true } } } },
          mensagens: { orderBy: { createdAt: 'desc' }, take: 1 },
          escola: { select: { nome: true } },
        },
      },
    },
  });

  const minhasEscolas = exigeVinculoEscolarProprio(comoPerfilMensagem(actor.perfil)) ? await escolasAtivasDe(actor.id) : null;

  const linhas = [];
  for (const part of participacoes) {
    const conversa = part.conversa;
    if (minhasEscolas && !minhasEscolas.has(conversa.escolaId)) continue; // perdeu vínculo — some da caixa operacional

    const outro = conversa.participantes.find((p) => p.pessoaId !== actor.id)?.pessoa ?? null;
    const ultimaMensagem = conversa.mensagens[0] ?? null;
    const naoLidas = await prisma.mensagem.count({ where: { conversaId: conversa.id, remetenteId: { not: actor.id }, lidaEm: null } });
    const primeiraMensagem = await prisma.mensagem.findFirst({ where: { conversaId: conversa.id }, orderBy: { createdAt: 'asc' }, select: { remetenteId: true } });

    linhas.push({
      id: conversa.id,
      assunto: conversa.assunto,
      escolaId: conversa.escolaId,
      escolaNome: conversa.escola.nome,
      loteId: conversa.loteId,
      outraPessoa: outro,
      ultimaMensagemTrecho: ultimaMensagem?.conteudo.slice(0, 110) ?? '',
      ultimaMensagemEm: ultimaMensagem?.createdAt ?? conversa.createdAt,
      naoLidas,
      iniciadaPorMim: primeiraMensagem?.remetenteId === actor.id,
      updatedAt: conversa.updatedAt ?? conversa.createdAt,
    });
  }

  // Não lidas primeiro, depois mais recentes (seção 12 do pedido).
  linhas.sort((a, b) => (b.naoLidas > 0 ? 1 : 0) - (a.naoLidas > 0 ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json(linhas);
});

// --- GET /api/mensagens/nao-lidas -------------------------------------------------------------
mensagensRouter.get('/nao-lidas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;

  const participacoes = await prisma.participanteConversa.findMany({ where: { pessoaId: actor.id, ocultaEm: null }, select: { conversaId: true, conversa: { select: { escolaId: true } } } });
  const minhasEscolas = exigeVinculoEscolarProprio(comoPerfilMensagem(actor.perfil)) ? await escolasAtivasDe(actor.id) : null;
  const conversaIdsValidas = participacoes.filter((p) => !minhasEscolas || minhasEscolas.has(p.conversa.escolaId)).map((p) => p.conversaId);

  if (conversaIdsValidas.length === 0) return res.json({ total: 0 });

  const total = await prisma.mensagem.count({ where: { conversaId: { in: conversaIdsValidas }, remetenteId: { not: actor.id }, lidaEm: null } });
  res.json({ total });
});

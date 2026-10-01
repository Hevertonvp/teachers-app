import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export const anamneseModelosRouter = Router();
export const anamnesePerguntasRouter = Router();

type Actor = { id: number; perfil: string };

// Administrar o Modelo/Pergunta de Anamnese é exclusivo da Secretaria (seção 32 do pedido) — sem
// exceção de leitura para nenhum outro perfil (diferente do que existiu por um tempo em
// ModeloPdi): ninguém mais precisa ler o Modelo vivo, só a própria Anamnese do aluno (que já leva
// consigo a versão do Modelo usada).
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar o Modelo de Anamnese.');
  }
}

const formatarPergunta = (p: {
  id: number; modeloAnamneseId: number; secao: string; subsecao: string | null; texto: string;
  explicacao: string | null; tipoResposta: string; opcoes: unknown; complementar: unknown;
  ordem: number; status: string;
}) => ({
  id: p.id,
  modeloAnamneseId: p.modeloAnamneseId,
  secao: p.secao,
  subsecao: p.subsecao,
  texto: p.texto,
  explicacao: p.explicacao,
  tipoResposta: p.tipoResposta,
  opcoes: p.opcoes ?? [],
  complementar: p.complementar ?? null,
  ordem: p.ordem,
  status: p.status,
});

const formatarModelo = (m: {
  id: number; nome: string; versao: number; status: string;
  perguntas?: Parameters<typeof formatarPergunta>[0][];
}) => ({
  id: m.id,
  nome: m.nome,
  versao: m.versao,
  status: m.status,
  ...(m.perguntas ? { perguntas: m.perguntas.map(formatarPergunta).sort((a, b) => a.ordem - b.ordem) } : {}),
});

// Lista TODAS as versões (histórico completo) — a ATIVA sempre tem status='ATIVA'; as demais são
// as versões anteriores, preservadas e imutáveis (seção 4 do pedido).
anamneseModelosRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const modelos = await prisma.modeloAnamnese.findMany({ orderBy: { versao: 'desc' } });
  res.json(modelos.map((m) => formatarModelo(m)));
});

anamneseModelosRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const modelo = await prisma.modeloAnamnese.findUnique({ where: { id: Number(req.params.id) }, include: { perguntas: true } });
  if (!modelo) throw new NotFoundError('Modelo de Anamnese não encontrado.');
  res.json(formatarModelo(modelo));
});

// Resolve ONDE uma edição estrutural deve realmente acontecer (seções 5/6 do pedido): se o
// Modelo ATIVO ainda não tem nenhuma Anamnese vinculada, edita nele mesmo, sem gerar versão nova
// (mesma lógica de ModeloPdi nunca usado ainda). Se já tem, clona Modelo+todas as Perguntas pra
// uma versão nova (a atual vira INATIVA/histórica, imutável), e devolve um tradutor de
// perguntaId antigo->novo, pra quem chamou continuar a edição na pergunta CORRESPONDENTE da
// versão nova, nunca na antiga.
async function resolverEdicaoModelo(tx: Prisma.TransactionClient, actor: Actor) {
  const atual = await tx.modeloAnamnese.findFirst({ where: { status: 'ATIVA' } });
  if (!atual) throw new NotFoundError('Nenhum Modelo de Anamnese ativo encontrado.');

  const emUso = (await tx.anamnese.count({ where: { modeloAnamneseId: atual.id } })) > 0;
  if (!emUso) {
    return { modeloId: atual.id, versionou: false, traduzirPergunta: (id: number) => id };
  }

  const perguntas = await tx.perguntaAnamnese.findMany({ where: { modeloAnamneseId: atual.id } });
  // A antiga precisa virar INATIVA ANTES de criar a nova como ATIVA — o índice único parcial
  // (no máximo uma linha com status='ATIVA') rejeitaria as duas coexistindo, mesmo que só por um
  // instante dentro da mesma transação.
  await tx.modeloAnamnese.update({ where: { id: atual.id }, data: { status: 'INATIVA', updatedBy: String(actor.id) } });
  const novoModelo = await tx.modeloAnamnese.create({
    data: { nome: atual.nome, versao: atual.versao + 1, status: 'ATIVA', createdBy: String(actor.id) },
  });

  // `createMany` (1 round-trip) em vez de um `create` por pergunta (57+ round-trips ao Neon,
  // estourava o timeout da transação — mesmo problema já visto em AplicacaoPdi). O mapa
  // id-antigo->id-novo é reconstruído casando por `ordem`, que é copiada verbatim e é única
  // dentro de cada Modelo — não precisa do id de retorno do createMany (que o Postgres não dá).
  await tx.perguntaAnamnese.createMany({
    data: perguntas.map((p) => ({
      modeloAnamneseId: novoModelo.id,
      secao: p.secao,
      subsecao: p.subsecao,
      texto: p.texto,
      explicacao: p.explicacao,
      tipoResposta: p.tipoResposta,
      opcoes: p.opcoes ?? undefined,
      complementar: p.complementar ?? undefined,
      ordem: p.ordem,
      status: p.status,
      createdBy: String(actor.id),
    })),
  });
  const novasPerguntas = await tx.perguntaAnamnese.findMany({ where: { modeloAnamneseId: novoModelo.id } });
  const novaIdPorOrdem = new Map(novasPerguntas.map((p) => [p.ordem, p.id]));
  const mapa = new Map<number, number>();
  for (const p of perguntas) {
    const novoId = novaIdPorOrdem.get(p.ordem);
    if (novoId) mapa.set(p.id, novoId);
  }

  return {
    modeloId: novoModelo.id,
    versionou: true,
    traduzirPergunta: (id: number) => {
      const traduzido = mapa.get(id);
      if (!traduzido) throw new ValidationError('Esta pergunta não pertence à versão atual do Modelo de Anamnese.');
      return traduzido;
    },
  };
}

const dadosPerguntaSchema = z.object({
  secao: z.string().trim().min(1),
  subsecao: z.string().trim().nullish(),
  texto: z.string().trim().min(1, 'Informe o texto da pergunta.'),
  explicacao: z.string().trim().nullish(),
  tipoResposta: z.enum(['TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO', 'SELECAO_MULTIPLA']),
  opcoes: z.array(z.string()).default([]),
  complementar: z.object({ gatilho: z.union([z.string(), z.boolean()]), label: z.string() }).nullish(),
});

// Criar pergunta sempre acontece na versão CORRETA (edita in-place ou já cria na versão nova
// clonada) — nunca precisa traduzir id porque é uma linha nova.
anamneseModelosRouter.post('/perguntas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = dadosPerguntaSchema.parse(req.body);

  const criada = await prisma.$transaction(async (tx) => {
    const { modeloId } = await resolverEdicaoModelo(tx, actor);
    const ultima = await tx.perguntaAnamnese.findFirst({ where: { modeloAnamneseId: modeloId }, orderBy: { ordem: 'desc' } });
    return tx.perguntaAnamnese.create({
      data: {
        modeloAnamneseId: modeloId,
        secao: dados.secao,
        subsecao: dados.subsecao ?? null,
        texto: dados.texto,
        explicacao: dados.explicacao ?? null,
        tipoResposta: dados.tipoResposta,
        opcoes: dados.opcoes,
        complementar: dados.complementar ?? undefined,
        ordem: (ultima?.ordem ?? 0) + 1,
        status: 'ATIVA',
        createdBy: String(actor.id),
      },
    });
  }, { timeout: 20000 });

  res.status(201).json(formatarPergunta(criada));
});

anamnesePerguntasRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const perguntaIdOriginal = Number(req.params.id);
  const dados = dadosPerguntaSchema.parse(req.body);

  const atualizada = await prisma.$transaction(async (tx) => {
    const { traduzirPergunta } = await resolverEdicaoModelo(tx, actor);
    const id = traduzirPergunta(perguntaIdOriginal);
    return tx.perguntaAnamnese.update({
      where: { id },
      data: {
        secao: dados.secao,
        subsecao: dados.subsecao ?? null,
        texto: dados.texto,
        explicacao: dados.explicacao ?? null,
        tipoResposta: dados.tipoResposta,
        opcoes: dados.opcoes,
        complementar: dados.complementar ?? undefined,
        updatedBy: String(actor.id),
      },
    });
  }, { timeout: 20000 });

  res.json(formatarPergunta(atualizada));
});

async function mudarStatusPergunta(actor: Actor, perguntaIdOriginal: number, status: 'ATIVA' | 'INATIVA') {
  return prisma.$transaction(async (tx) => {
    const { traduzirPergunta } = await resolverEdicaoModelo(tx, actor);
    const id = traduzirPergunta(perguntaIdOriginal);
    const atual = await tx.perguntaAnamnese.findUniqueOrThrow({ where: { id } });
    if (atual.status === status) {
      throw new ValidationError(status === 'INATIVA' ? 'Esta pergunta já está inativa.' : 'Esta pergunta já está ativa.');
    }
    return tx.perguntaAnamnese.update({ where: { id }, data: { status, updatedBy: String(actor.id) } });
  }, { timeout: 20000 });
}

anamnesePerguntasRouter.post('/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPergunta(await mudarStatusPergunta(actor, Number(req.params.id), 'INATIVA')));
});

anamnesePerguntasRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPergunta(await mudarStatusPergunta(actor, Number(req.params.id), 'ATIVA')));
});

const reordenarSchema = z.object({
  ordens: z.array(z.object({ id: z.number().int(), ordem: z.number().int() })).min(1),
});

// Transacional (seção 10 do pedido) — todas as ordens novas são aplicadas, ou nenhuma. Cada id
// do payload é traduzido pra versão correta antes de aplicar.
anamneseModelosRouter.post('/perguntas/reordenar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const { ordens } = reordenarSchema.parse(req.body);

  const atualizadas = await prisma.$transaction(async (tx) => {
    const { modeloId, traduzirPergunta } = await resolverEdicaoModelo(tx, actor);
    for (const item of ordens) {
      const id = traduzirPergunta(item.id);
      await tx.perguntaAnamnese.update({ where: { id }, data: { ordem: item.ordem, updatedBy: String(actor.id) } });
    }
    return tx.perguntaAnamnese.findMany({ where: { modeloAnamneseId: modeloId }, orderBy: { ordem: 'asc' } });
  }, { timeout: 20000 });

  res.json(atualizadas.map(formatarPergunta));
});

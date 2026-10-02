import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export const pdiModelosRouter = Router();
export const pdiPerguntasRouter = Router();

type Actor = { id: number; perfil: string };

// Gerenciar (criar/editar/inativar/reativar/perguntas/reordenar) é exclusivo da Secretaria —
// Gestor, Diretora, Professor e Auxiliar nunca administram isso (seção 8/25 do pedido). Sem
// exceção de escopo por escola: Modelo é uma configuração de rede, não por escola.
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar Modelos PDI.');
  }
}

// LEITURA (GET) também é exclusiva da Secretaria. A exceção que existia aqui para o Gestor (ele
// precisava ler quais modelos estavam ativos para montar o snapshot de uma Aplicação no
// frontend) deixou de fazer sentido: a criação de Aplicação PDI agora é um endpoint real do
// backend (POST /api/pdi-aplicacoes) que lê os Modelos diretamente via Prisma, sem depender mais
// desta rota — correção explícita pedida na tarefa de Aplicações/Reaberturas PDI (seção 1).
function exigirLeituraModelos(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Você não tem permissão para consultar Modelos PDI.');
  }
}

const formatarPergunta = (pergunta: {
  id: number; modeloId: number; secao: string; subsecao: string | null; codigo: string | null;
  texto: string; indicador: string | null; origem: string; tipoResposta: string;
  opcoes: unknown; complementar: unknown; ordem: number; status: string;
}) => ({
  id: pergunta.id,
  modeloId: pergunta.modeloId,
  secao: pergunta.secao,
  subsecao: pergunta.subsecao,
  codigo: pergunta.codigo,
  texto: pergunta.texto,
  indicador: pergunta.indicador,
  origem: pergunta.origem,
  tipoResposta: pergunta.tipoResposta,
  opcoes: pergunta.opcoes ?? [],
  complementar: pergunta.complementar ?? null,
  ordem: pergunta.ordem,
  status: pergunta.status,
});

const formatarModelo = (modelo: {
  id: number; nome: string; disciplinaId: number; status: string;
  createdAt: Date; updatedAt: Date | null;
  disciplina: { nome: string };
  perguntas?: Parameters<typeof formatarPergunta>[0][];
  usadoEmAplicacao?: boolean;
}) => ({
  id: modelo.id,
  nome: modelo.nome,
  disciplinaId: modelo.disciplinaId,
  disciplinaNome: modelo.disciplina.nome,
  status: modelo.status,
  createdAt: modelo.createdAt,
  updatedAt: modelo.updatedAt,
  ...(modelo.perguntas ? { perguntas: modelo.perguntas.map(formatarPergunta).sort((a, b) => a.ordem - b.ordem) } : {}),
  ...(modelo.usadoEmAplicacao !== undefined ? { usadoEmAplicacao: modelo.usadoEmAplicacao } : {}),
});

pdiModelosRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraModelos(actor);
  const { disciplinaId, status } = req.query;

  // Inclui perguntas sempre (não só no GET /:id) — usado pela tela de gestão de Modelos da
  // Secretaria, que sempre precisa ver as perguntas de cada modelo na mesma listagem; volume é
  // pequeno (dezenas de perguntas por modelo), sem necessidade de endpoint separado.
  const modelos = await prisma.modeloPdi.findMany({
    where: {
      ...(disciplinaId ? { disciplinaId: Number(disciplinaId) } : {}),
      ...(status === 'ATIVA' || status === 'INATIVA' ? { status } : {}),
    },
    include: { disciplina: true, perguntas: true },
    orderBy: { nome: 'asc' },
  });

  // Usado em alguma Aplicação (snapshot existe) — só informativo, para a tela de Histórico
  // distinguir o que pode ser apagado fisicamente do que só pode ser arquivado (ver DELETE /:id).
  const usos = await prisma.aplicacaoModeloPdi.groupBy({ by: ['modeloIdOriginal'], _count: true });
  const usados = new Set(usos.map((u) => u.modeloIdOriginal));

  res.json(modelos.map((m) => formatarModelo({ ...m, usadoEmAplicacao: usados.has(m.id) })));
});

pdiModelosRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const modelo = await prisma.modeloPdi.findUnique({
    where: { id: Number(req.params.id) },
    include: { disciplina: true, perguntas: true },
  });
  if (!modelo) throw new NotFoundError('Modelo não encontrado.');
  res.json(formatarModelo(modelo));
});

const criarModeloSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  disciplinaId: z.number().int(),
  // Default true: preserva o comportamento de sempre (nenhuma tela existente que já chama este
  // endpoint precisa mudar). Secretaria pode desmarcar e começar o modelo vazio.
  carregarPerguntasPadrao: z.boolean().default(true),
});

// Cria o modelo e, na MESMA transação, as perguntas padrão (se `carregarPerguntasPadrao`) — nunca
// deixa o modelo "pela metade" se a criação das perguntas falhar. A unicidade de "um ATIVO por
// disciplina" é garantida pelo índice único parcial no Postgres (ver schema.prisma); checamos
// antes aqui só para devolver uma mensagem clara em vez de um erro genérico de constraint. Fonte
// das perguntas padrão é a tabela PerguntaPdiPadrao (editável pela Secretaria em Configurações),
// nunca mais um array fixo no código — ver pdiPerguntasPadrao.ts.
pdiModelosRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = criarModeloSchema.parse(req.body);

  const disciplina = await prisma.disciplina.findUnique({ where: { id: dados.disciplinaId } });
  if (!disciplina) throw new NotFoundError('Disciplina não encontrada.');

  const existente = await prisma.modeloPdi.findFirst({ where: { disciplinaId: dados.disciplinaId, status: 'ATIVA' } });
  if (existente) throw new ConflictError('Já existe um modelo PDI ativo para esta disciplina.');

  const perguntasPadrao = dados.carregarPerguntasPadrao
    ? await prisma.perguntaPdiPadrao.findMany({ where: { status: 'ATIVA' }, orderBy: { ordem: 'asc' } })
    : [];

  const criado = await prisma.$transaction(async (tx) => {
    const modelo = await tx.modeloPdi.create({
      data: { nome: dados.nome, disciplinaId: dados.disciplinaId, status: 'ATIVA', createdBy: String(actor.id) },
    });
    if (perguntasPadrao.length > 0) {
      await tx.perguntaPdi.createMany({
        data: perguntasPadrao.map((pergunta, index) => ({
          modeloId: modelo.id,
          secao: pergunta.secao,
          subsecao: pergunta.subsecao,
          codigo: pergunta.codigo,
          texto: pergunta.texto,
          indicador: pergunta.indicador,
          origem: pergunta.origem,
          tipoResposta: pergunta.tipoResposta,
          opcoes: pergunta.opcoes ?? [],
          complementar: pergunta.complementar ?? undefined,
          ordem: index + 1,
          status: 'ATIVA',
          createdBy: String(actor.id),
        })),
      });
    }
    return modelo;
  });

  const completo = await prisma.modeloPdi.findUnique({ where: { id: criado.id }, include: { disciplina: true, perguntas: true } });
  res.status(201).json(formatarModelo(completo!));
});

async function buscarModelo(id: number) {
  const modelo = await prisma.modeloPdi.findUnique({ where: { id }, include: { disciplina: true } });
  if (!modelo) throw new NotFoundError('Modelo não encontrado.');
  return modelo;
}

pdiModelosRouter.post('/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await buscarModelo(id);
  if (atual.status !== 'ATIVA') throw new ValidationError('Este modelo já está inativo.');

  const atualizado = await prisma.modeloPdi.update({ where: { id }, data: { status: 'INATIVA', updatedBy: String(actor.id) } });
  res.json(formatarModelo({ ...atualizado, disciplina: atual.disciplina }));
});

// Reativar NUNCA inativa outro modelo silenciosamente (seção 27 do pedido) — se já existe um
// ativo na disciplina, bloqueia e a Secretaria decide explicitamente qual fica.
pdiModelosRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await buscarModelo(id);
  if (atual.status !== 'INATIVA') throw new ValidationError('Este modelo já está ativo.');

  const outroAtivo = await prisma.modeloPdi.findFirst({ where: { disciplinaId: atual.disciplinaId, status: 'ATIVA' } });
  if (outroAtivo) {
    throw new ConflictError(`Já existe um modelo PDI ativo para esta disciplina ("${outroAtivo.nome}"). Inative-o antes de reativar este.`);
  }

  const atualizado = await prisma.modeloPdi.update({ where: { id }, data: { status: 'ATIVA', updatedBy: String(actor.id) } });
  res.json(formatarModelo({ ...atualizado, disciplina: atual.disciplina }));
});

// "Excluir" na UI — o comportamento real depende de uso histórico, decidido aqui no backend
// (nunca confiar no frontend): nunca usado em nenhuma Aplicação (nenhum snapshot em
// AplicacaoModeloPdi) → apaga fisicamente o Modelo e suas Perguntas; já usado → vira o mesmo
// efeito de INATIVA de sempre (nunca apaga, histórico preservado), só que exposto como "Excluir"
// porque o objetivo prático da Secretaria é tirar da área de trabalho, não reativar depois.
pdiModelosRouter.delete('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await buscarModelo(id);

  const usos = await prisma.aplicacaoModeloPdi.count({ where: { modeloIdOriginal: id } });

  if (usos === 0) {
    await prisma.$transaction([
      prisma.perguntaPdi.deleteMany({ where: { modeloId: id } }),
      prisma.modeloPdi.delete({ where: { id } }),
    ]);
    return res.json({ removidoFisicamente: true, arquivado: false });
  }

  if (atual.status === 'ATIVA') {
    await prisma.modeloPdi.update({ where: { id }, data: { status: 'INATIVA', updatedBy: String(actor.id) } });
  }
  res.json({ removidoFisicamente: false, arquivado: true });
});

const dadosPerguntaSchema = z.object({
  secao: z.string().trim().min(1),
  subsecao: z.string().trim().nullish(),
  codigo: z.string().trim().nullish(),
  texto: z.string().trim().min(1, 'Informe o texto da pergunta.'),
  indicador: z.string().trim().nullish(),
  origem: z.enum(['ESTRUTURADA', 'HABILIDADE', 'ORIENTACAO', 'QUALITATIVA', 'PERSONALIZADA']).default('PERSONALIZADA'),
  tipoResposta: z.enum(['TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO']),
  opcoes: z.array(z.string()).default([]),
  complementar: z.object({ gatilho: z.union([z.string(), z.boolean()]), label: z.string() }).nullish(),
});

pdiModelosRouter.post('/:id/perguntas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const modeloId = Number(req.params.id);
  const modelo = await prisma.modeloPdi.findUnique({ where: { id: modeloId } });
  if (!modelo) throw new NotFoundError('Modelo não encontrado.');
  const dados = dadosPerguntaSchema.parse(req.body);

  const ultima = await prisma.perguntaPdi.findFirst({ where: { modeloId }, orderBy: { ordem: 'desc' } });
  const criada = await prisma.perguntaPdi.create({
    data: {
      modeloId,
      secao: dados.secao,
      subsecao: dados.subsecao ?? null,
      codigo: dados.codigo ?? null,
      texto: dados.texto,
      indicador: dados.indicador ?? null,
      origem: dados.origem,
      tipoResposta: dados.tipoResposta,
      opcoes: dados.opcoes,
      complementar: dados.complementar ?? undefined,
      ordem: (ultima?.ordem ?? 0) + 1,
      status: 'ATIVA',
      createdBy: String(actor.id),
    },
  });
  res.status(201).json(formatarPergunta(criada));
});

const reordenarSchema = z.object({
  ordens: z.array(z.object({ id: z.number().int(), ordem: z.number().int() })).min(1),
});

// Transacional (seção 23 do pedido) — ou todas as ordens novas são aplicadas, ou nenhuma.
pdiModelosRouter.post('/:id/perguntas/reordenar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const modeloId = Number(req.params.id);
  const { ordens } = reordenarSchema.parse(req.body);

  const perguntasDoModelo = await prisma.perguntaPdi.findMany({ where: { modeloId }, select: { id: true } });
  const idsValidos = new Set(perguntasDoModelo.map((p) => p.id));
  if (ordens.some((item) => !idsValidos.has(item.id))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem a este modelo.');
  }

  await prisma.$transaction(
    ordens.map((item) => prisma.perguntaPdi.update({ where: { id: item.id }, data: { ordem: item.ordem, updatedBy: String(actor.id) } })),
  );

  const atualizadas = await prisma.perguntaPdi.findMany({ where: { modeloId }, orderBy: { ordem: 'asc' } });
  res.json(atualizadas.map(formatarPergunta));
});

pdiPerguntasRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await prisma.perguntaPdi.findUnique({ where: { id } });
  if (!atual) throw new NotFoundError('Pergunta não encontrada.');
  const dados = dadosPerguntaSchema.parse(req.body);

  const atualizada = await prisma.perguntaPdi.update({
    where: { id },
    data: {
      secao: dados.secao,
      subsecao: dados.subsecao ?? null,
      codigo: dados.codigo ?? null,
      texto: dados.texto,
      indicador: dados.indicador ?? null,
      origem: dados.origem,
      tipoResposta: dados.tipoResposta,
      opcoes: dados.opcoes,
      complementar: dados.complementar ?? undefined,
      updatedBy: String(actor.id),
      version: { increment: 1 },
    },
  });
  res.json(formatarPergunta(atualizada));
});

async function mudarStatusPergunta(actor: Actor, id: number, status: 'ATIVA' | 'INATIVA') {
  const atual = await prisma.perguntaPdi.findUnique({ where: { id } });
  if (!atual) throw new NotFoundError('Pergunta não encontrada.');
  if (atual.status === status) {
    throw new ValidationError(status === 'INATIVA' ? 'Esta pergunta já está inativa.' : 'Esta pergunta já está ativa.');
  }
  return prisma.perguntaPdi.update({ where: { id }, data: { status, updatedBy: String(actor.id) } });
}

pdiPerguntasRouter.post('/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPergunta(await mudarStatusPergunta(actor, Number(req.params.id), 'INATIVA')));
});

pdiPerguntasRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPergunta(await mudarStatusPergunta(actor, Number(req.params.id), 'ATIVA')));
});

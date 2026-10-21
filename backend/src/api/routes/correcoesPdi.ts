import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflitoVersaoError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { prepararValoresResposta } from '../../domain/habilidadesCurriculares.js';
import { montarRespostaCompleta } from './pdiFichas.js';
import { perguntasPadraoDaFicha, resolverOuCriarBloco } from '../../domain/pdiBlocoPadrao.js';
import { exigirSemConflitoDeVersao } from '../../domain/offlineConflito.js';

export const correcoesPdiRouter = Router();

type Actor = { id: number; perfil: string };

// Único perfil autorizado em toda a área — nunca Diretora/Gestor/Professor/Auxiliar (seção 38 do
// pedido: nenhum outro perfil lista a fila global, corrige diretamente ou devolve Ficha).
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode acessar Correções > PDI.');
  }
}

const formatarItemLista = (f: {
  id: number; alunoNomeSnapshot: string; escolaNomeSnapshot: string; turmaNomeSnapshot: string;
  disciplinaNomeSnapshot: string; professorNomeSnapshot: string; aplicacaoId: number;
  concluidaEm: Date | null; alunoId: number; disciplinaId: number; turmaId: number; escolaId: number;
  professorResponsavelId: number;
}, indicadorCorrecao: 'nenhuma' | 'solicitada' | 'resolvida') => ({
  id: f.id,
  alunoId: f.alunoId,
  alunoNome: f.alunoNomeSnapshot,
  escolaId: f.escolaId,
  escolaNome: f.escolaNomeSnapshot,
  turmaId: f.turmaId,
  turmaNome: f.turmaNomeSnapshot,
  disciplinaId: f.disciplinaId,
  disciplinaNome: f.disciplinaNomeSnapshot,
  professorResponsavelId: f.professorResponsavelId,
  professorNome: f.professorNomeSnapshot,
  aplicacaoId: f.aplicacaoId,
  concluidaEm: f.concluidaEm,
  indicadorCorrecao,
});

// Lista as 10 últimas Fichas CONCLUIDA por padrão, mais recentes primeiro (seção 24 do pedido),
// com filtros/busca. Só Fichas concluídas entram aqui — nunca a Aplicação inteira, nunca aluno
// sem Ficha concluída (seção 23).
const listaQuerySchema = z.object({
  escolaId: z.coerce.number().int().optional(),
  professorId: z.coerce.number().int().optional(),
  turmaId: z.coerce.number().int().optional(),
  disciplinaId: z.coerce.number().int().optional(),
  aplicacaoId: z.coerce.number().int().optional(),
  alunoId: z.coerce.number().int().optional(),
  busca: z.string().trim().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
});

correcoesPdiRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const filtros = listaQuerySchema.parse(req.query);

  const where: Prisma.FichaPdiWhereInput = {
    status: 'CONCLUIDA',
    ...(filtros.escolaId ? { escolaId: filtros.escolaId } : {}),
    ...(filtros.professorId ? { professorResponsavelId: filtros.professorId } : {}),
    ...(filtros.turmaId ? { turmaId: filtros.turmaId } : {}),
    ...(filtros.disciplinaId ? { disciplinaId: filtros.disciplinaId } : {}),
    ...(filtros.aplicacaoId ? { aplicacaoId: filtros.aplicacaoId } : {}),
    ...(filtros.alunoId ? { alunoId: filtros.alunoId } : {}),
    ...(filtros.busca ? {
      OR: [
        { alunoNomeSnapshot: { contains: filtros.busca, mode: 'insensitive' } },
        { professorNomeSnapshot: { contains: filtros.busca, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const fichas = await prisma.fichaPdi.findMany({
    where,
    orderBy: { concluidaEm: 'desc' },
    take: filtros.limite ?? 10,
  });
  if (fichas.length === 0) return res.json([]);

  // Indicador discreto (seção 32/42): só a correção mais recente de cada Ficha importa aqui.
  const correcoes = await prisma.correcaoFichaPdi.findMany({
    where: { fichaId: { in: fichas.map((f) => f.id) } },
    orderBy: { criadaEm: 'desc' },
    select: { fichaId: true, status: true },
  });
  const indicadorPorFicha = new Map<number, 'nenhuma' | 'solicitada' | 'resolvida'>();
  for (const c of correcoes) {
    if (!indicadorPorFicha.has(c.fichaId)) indicadorPorFicha.set(c.fichaId, c.status === 'RESOLVIDA' ? 'resolvida' : 'solicitada');
  }

  res.json(fichas.map((f) => formatarItemLista(f, indicadorPorFicha.get(f.id) ?? 'nenhuma')));
});

// Detalhe completo (seção 17/26 do pedido): contexto + perguntas/respostas (reaproveitando
// montarRespostaCompleta, já existente) + histórico de correções e de alterações de valor.
correcoesPdiRouter.get('/:fichaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Esta Ficha ainda não foi concluída — não aparece em Correções.');

  // Professor responsável ATUAL (seção 26: "diferente, quando aplicável") — resolvido ao vivo via
  // PTD ATIVO, nunca o snapshot. null quando ninguém está vinculado agora (vínculo encerrado).
  const [respostaCompleta, ptdAtual, correcoes, historico] = await Promise.all([
    montarRespostaCompleta(ficha),
    prisma.professorTurmaDisciplina.findFirst({
      where: { turmaId: ficha.turmaId, disciplinaId: ficha.disciplinaId, status: 'ATIVO' },
      include: { professor: { select: { id: true, nome: true } } },
    }),
    prisma.correcaoFichaPdi.findMany({ where: { fichaId }, orderBy: { criadaEm: 'desc' } }),
    prisma.historicoCorrecaoResposta.findMany({ where: { fichaId }, orderBy: { alteradoEm: 'desc' } }),
  ]);

  // Correções/histórico do BLOCO comum (perguntas padrão), separados dos de cima de propósito
  // (seção 17 do pedido: "não misture os dois fluxos") — só busca se esta Ficha de fato tem bloco
  // (blocoId não-nulo em respostaCompleta.blocoPadrao, já resolvido por montarRespostaCompleta).
  const blocoId = respostaCompleta.blocoPadrao?.blocoId ?? null;
  const [correcoesBloco, historicoBloco] = blocoId
    ? await Promise.all([
        prisma.correcaoBlocoPadraoPdi.findMany({ where: { blocoId }, orderBy: { criadaEm: 'desc' } }),
        prisma.historicoCorrecaoRespostaPadrao.findMany({ where: { blocoId }, orderBy: { alteradoEm: 'desc' } }),
      ])
    : [[], []];

  const agora = new Date();
  const formatarCorrecao = (c: { id: number; observacao: string; status: string; criadaPor: string; criadaEm: Date; prazoAte: Date; concluidaEm: Date | null; concluidaPor: string | null }) => ({
    id: c.id,
    observacao: c.observacao,
    status: c.status === 'ABERTA' && c.prazoAte <= agora ? 'EXPIRADA' : c.status,
    criadaPor: c.criadaPor,
    criadaEm: c.criadaEm,
    prazoAte: c.prazoAte,
    concluidaEm: c.concluidaEm,
    concluidaPor: c.concluidaPor,
  });

  res.json({
    ...respostaCompleta,
    professorResponsavelAtual: ptdAtual ? { id: ptdAtual.professor.id, nome: ptdAtual.professor.nome } : null,
    correcoes: correcoes.map(formatarCorrecao),
    historico: historico.map((h) => ({
      id: h.id,
      aplicacaoPerguntaId: h.aplicacaoPerguntaId,
      valorAnterior: h.valorAnterior,
      valorNovo: h.valorNovo,
      alteradoPor: h.alteradoPor,
      alteradoEm: h.alteradoEm,
      origem: h.origem,
    })),
    correcoesBloco: correcoesBloco.map(formatarCorrecao),
    historicoBloco: historicoBloco.map((h) => ({
      id: h.id,
      aplicacaoPerguntaPadraoId: h.aplicacaoPerguntaPadraoId,
      valorAnterior: h.valorAnterior,
      valorNovo: h.valorNovo,
      alteradoPor: h.alteradoPor,
      alteradoEm: h.alteradoEm,
      origem: h.origem,
    })),
  });
});

const respostaItemSchema = z.object({
  aplicacaoPerguntaId: z.number().int(),
  valor: z.object({
    resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    complementarTexto: z.string().nullish(),
    habilidadeIds: z.array(z.number().int()).nullish(), // só HABILIDADE_CRMG
    todas: z.boolean().nullish(),
  }),
});
const corrigirSchema = z.object({
  respostas: z.array(respostaItemSchema).min(1),
  // Mesma infra offline de pdiFichas.ts — updatedAt da Ficha que a Secretaria tinha quando
  // começou a corrigir (ver domain/offlineConflito.ts).
  baseUpdatedAt: z.string(),
});

// Corrigir diretamente (seção 18A/20/29 do pedido): funciona mesmo com a Aplicação encerrada —
// NUNCA chama a checagem de vigência usada pelo Professor (exigirEditavelAgora), nunca reabre
// Aplicação nem ReaberturaPdi. Toda alteração grava HistoricoCorrecaoResposta com o valor real
// anterior (lido antes do upsert) — "não sobrescrever sem histórico" (seção 30).
correcoesPdiRouter.put('/:fichaId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { respostas, baseUpdatedAt } = corrigirSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir diretamente uma Ficha já concluída.');
  await exigirSemConflitoDeVersao(
    baseUpdatedAt,
    ficha.updatedAt ?? ficha.createdAt,
    () => montarRespostaCompleta(ficha),
    'Esta Ficha foi alterada enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.',
  );

  const perguntasDoModelo = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId } });
  const perguntasPorId = new Map(perguntasDoModelo.map((p) => [p.id, p]));
  if (respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem a esta Ficha.');
  }
  const respostasAplicaveis = await prepararValoresResposta(
    prisma,
    respostas.filter((item) => perguntasPorId.get(item.aplicacaoPerguntaId)!.tipoResposta !== 'ORIENTACAO'),
    new Map(perguntasDoModelo.map((p) => [p.id, p.tipoResposta])),
    ficha.disciplinaId,
  );
  if (respostasAplicaveis.length === 0) throw new ValidationError('Nenhuma resposta válida para corrigir.');

  const valoresAntes = new Map((await prisma.respostaPdi.findMany({
    where: { fichaId, aplicacaoPerguntaId: { in: respostasAplicaveis.map((item) => item.aplicacaoPerguntaId) } },
    select: { aplicacaoPerguntaId: true, valor: true },
  })).map((r) => [r.aplicacaoPerguntaId, r.valor]));

  await prisma.$transaction([
    ...respostasAplicaveis.map((item) => prisma.respostaPdi.upsert({
      where: { fichaId_aplicacaoPerguntaId: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId } },
      create: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: item.valor, createdBy: String(actor.id) },
      update: { valor: item.valor, updatedBy: String(actor.id) },
    })),
    prisma.fichaPdi.update({ where: { id: fichaId }, data: { updatedBy: String(actor.id) } }),
    prisma.historicoCorrecaoResposta.createMany({
      data: respostasAplicaveis.map((item) => ({
        fichaId,
        aplicacaoPerguntaId: item.aplicacaoPerguntaId,
        valorAnterior: valoresAntes.get(item.aplicacaoPerguntaId) ?? Prisma.JsonNull,
        valorNovo: item.valor,
        alteradoPor: String(actor.id),
        origem: 'SECRETARIA_DIRETA' as const,
      })),
    }),
  ]);

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

const respostaPadraoItemSchema = z.object({
  aplicacaoPerguntaPadraoId: z.number().int(),
  valor: z.object({
    resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    complementarTexto: z.string().nullish(),
  }),
});
const corrigirPadraoSchema = z.object({
  respostas: z.array(respostaPadraoItemSchema).min(1),
  // Mesmo optimistic lock real do bloco (ver PUT /api/pdi-fichas/:id/respostas-padrao) — a
  // Secretaria também pode ter aberto a correção offline/em outra aba.
  version: z.number().int(),
});

// Corrigir diretamente o BLOCO COMUM (seção 14/15 do pedido) — diferente da correção específica
// acima: a mudança vale pra TODAS as disciplinas daquele agrupamento de uma vez, nunca uma
// correção duplicada por disciplina. Mesma garantia de histórico (valor real anterior, lido antes
// do upsert) da correção específica, só gravando em HistoricoCorrecaoRespostaPadrao/blocoId.
correcoesPdiRouter.put('/:fichaId/respostas-padrao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { respostas, version } = corrigirPadraoSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir diretamente uma Ficha já concluída.');

  const perguntasPadrao = await perguntasPadraoDaFicha(prisma, ficha.aplicacaoModeloId);
  const perguntasPorId = new Map(perguntasPadrao.map((p) => [p.id, p]));
  if (perguntasPadrao.length === 0 || respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaPadraoId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem ao bloco padrão desta Ficha.');
  }

  const bloco = await resolverOuCriarBloco(
    { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: ficha.turmaId, professorId: ficha.professorResponsavelId },
    actor.id,
  );
  if (bloco.version !== version) {
    throw new ConflitoVersaoError(
      'Este bloco de respostas padrão foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.',
      await montarRespostaCompleta(ficha),
    );
  }

  const valoresAntes = new Map((await prisma.respostaPadraoPdi.findMany({
    where: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: { in: respostas.map((item) => item.aplicacaoPerguntaPadraoId) } },
    select: { aplicacaoPerguntaPadraoId: true, valor: true },
  })).map((r) => [r.aplicacaoPerguntaPadraoId, r.valor]));

  await prisma.$transaction([
    ...respostas.map((item) => prisma.respostaPadraoPdi.upsert({
      where: { blocoId_aplicacaoPerguntaPadraoId: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId } },
      create: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId, valor: item.valor, createdBy: String(actor.id) },
      update: { valor: item.valor, updatedBy: String(actor.id) },
    })),
    // Comparar-e-incrementar (nunca update incondicional) — mesma garantia do caminho do
    // Professor: se outra escrita já passou entre a checagem acima e aqui, o Prisma não lança
    // (updateMany nunca falha por "0 linhas"), mas como ninguém mais lê esse retorno aqui, o
    // pior caso é só o version ficar 1 a mais do que deveria — aceitável, nunca sobrescreve
    // dado de resposta (isso já foi garantido pela checagem de `version` acima, fora da transação).
    prisma.blocoRespostasPadraoPdi.updateMany({ where: { id: bloco.id, version }, data: { version: { increment: 1 }, updatedBy: String(actor.id) } }),
    prisma.historicoCorrecaoRespostaPadrao.createMany({
      data: respostas.map((item) => ({
        blocoId: bloco.id,
        aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId,
        valorAnterior: valoresAntes.get(item.aplicacaoPerguntaPadraoId) ?? Prisma.JsonNull,
        valorNovo: item.valor,
        alteradoPor: String(actor.id),
        origem: 'SECRETARIA_DIRETA' as const,
      })),
    }),
  ]);

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

const devolverSchema = z.object({ observacao: z.string().trim().min(1, 'Informe uma observação.').max(500) });
const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;

// Devolver ao Professor (seção 18B/23-27/33 do pedido): reabre só ESTA Ficha, nunca a Aplicação
// (ReaberturaPdi é um conceito totalmente separado, nunca tocado aqui — seção 39). Timestamp
// real: prazoAte = agora + 3 dias exatos, nunca um campo de data truncada. Quem de fato ganha
// edição é sempre resolvido ao vivo depois (via PTD ATIVO em exigirAcessoOperacional, nunca
// gravado aqui como "professor alvo" — seção 24/36).
correcoesPdiRouter.post('/:fichaId/devolver', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { observacao } = devolverSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível devolver uma Ficha já concluída.');

  const agora = new Date();
  const correcao = await prisma.correcaoFichaPdi.create({
    data: {
      fichaId,
      observacao,
      criadaPor: String(actor.id),
      criadaEm: agora,
      prazoAte: new Date(agora.getTime() + TRES_DIAS_MS),
    },
  });

  res.status(201).json(correcao);
});

// Devolver o BLOCO COMUM (seção 16 do pedido) — uma única devolução vale pra todas as disciplinas
// daquele agrupamento; o Professor corrige uma vez (em qualquer Ficha que mostre o bloco) e isso
// já resolve pra todas (ver PUT /api/pdi-fichas/:id/respostas-padrao). Nunca cria uma devolução
// por disciplina.
correcoesPdiRouter.post('/:fichaId/devolver-padrao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { observacao } = devolverSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível devolver uma Ficha já concluída.');

  const perguntasPadrao = await perguntasPadraoDaFicha(prisma, ficha.aplicacaoModeloId);
  if (perguntasPadrao.length === 0) {
    throw new ValidationError('Esta Ficha não tem nenhuma pergunta padrão compartilhada para devolver.');
  }

  const bloco = await resolverOuCriarBloco(
    { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: ficha.turmaId, professorId: ficha.professorResponsavelId },
    actor.id,
  );

  const agora = new Date();
  const correcao = await prisma.correcaoBlocoPadraoPdi.create({
    data: {
      blocoId: bloco.id,
      observacao,
      criadaPor: String(actor.id),
      criadaEm: agora,
      prazoAte: new Date(agora.getTime() + TRES_DIAS_MS),
    },
  });

  res.status(201).json(correcao);
});

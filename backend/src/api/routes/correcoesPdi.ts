import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { montarRespostaCompleta } from './pdiFichas.js';

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

  const agora = new Date();
  res.json({
    ...respostaCompleta,
    professorResponsavelAtual: ptdAtual ? { id: ptdAtual.professor.id, nome: ptdAtual.professor.nome } : null,
    correcoes: correcoes.map((c) => ({
      id: c.id,
      observacao: c.observacao,
      status: c.status === 'ABERTA' && c.prazoAte <= agora ? 'EXPIRADA' : c.status,
      criadaPor: c.criadaPor,
      criadaEm: c.criadaEm,
      prazoAte: c.prazoAte,
      concluidaEm: c.concluidaEm,
      concluidaPor: c.concluidaPor,
    })),
    historico: historico.map((h) => ({
      id: h.id,
      aplicacaoPerguntaId: h.aplicacaoPerguntaId,
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
  }),
});
const corrigirSchema = z.object({ respostas: z.array(respostaItemSchema).min(1) });

// Corrigir diretamente (seção 18A/20/29 do pedido): funciona mesmo com a Aplicação encerrada —
// NUNCA chama a checagem de vigência usada pelo Professor (exigirEditavelAgora), nunca reabre
// Aplicação nem ReaberturaPdi. Toda alteração grava HistoricoCorrecaoResposta com o valor real
// anterior (lido antes do upsert) — "não sobrescrever sem histórico" (seção 30).
correcoesPdiRouter.put('/:fichaId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { respostas } = corrigirSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir diretamente uma Ficha já concluída.');

  const perguntasDoModelo = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId } });
  const perguntasPorId = new Map(perguntasDoModelo.map((p) => [p.id, p]));
  if (respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem a esta Ficha.');
  }
  const respostasAplicaveis = respostas.filter((item) => perguntasPorId.get(item.aplicacaoPerguntaId)!.tipoResposta !== 'ORIENTACAO');
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

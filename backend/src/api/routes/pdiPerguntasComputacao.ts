import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { marcarDesativacao } from '../../lib/desativacao.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { SECAO_COMPUTACAO_PADRAO } from '../../domain/perguntasComputacao.js';

// Perguntas de Computação do PDI (17/11/2026, Configurações) — ver domain/perguntasComputacao.ts.
// Só a Secretaria administra. Valem para Aplicações criadas DEPOIS (nunca retroativas): editar,
// inativar ou excluir aqui não muda nenhuma Aplicação/Ficha já criada.
export const pdiPerguntasComputacaoRouter = Router();

type Actor = { id: number; perfil: string };

function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode gerenciar as perguntas de Computação.');
}

const formatar = (p: Awaited<ReturnType<typeof prisma.perguntaComputacaoPdi.findUniqueOrThrow>> & { habilidade?: { descricaoOficial: string } | null }) => ({
  id: p.id,
  habilidadeId: p.habilidadeId,
  habilidadeTexto: p.habilidade?.descricaoOficial ?? null,
  codigo: p.codigo,
  anos: [...p.anos].sort((a, b) => a - b),
  secao: p.secao,
  texto: p.texto,
  observacao: p.observacao,
  tipoResposta: p.tipoResposta,
  opcoes: p.opcoes ?? [],
  complementar: p.complementar ?? null,
  ordem: p.ordem,
  status: p.status,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});
const incluir = { habilidade: { select: { descricaoOficial: true } } } as const;

// Dois jeitos (decisão do usuário, 17/11/2026):
//  - sobre UMA habilidade do catálogo (habilidadeId): código e ano vêm do catálogo; tipo livre;
//  - HABILIDADE_COMPUTACAO: a resposta é marcar habilidades do ano do aluno; anos escolhidos aqui.
const dadosSchema = z.object({
  habilidadeId: z.number().int().nullish(),
  anos: z.array(z.number().int().min(1).max(9)).default([]),
  secao: z.string().trim().max(100).nullish(),
  texto: z.string().trim().min(1, 'Informe o texto da pergunta.'),
  observacao: z.string().trim().max(2000).nullish(),
  tipoResposta: z.enum(['TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO', 'HABILIDADE_COMPUTACAO']),
  opcoes: z.array(z.string()).default([]),
  complementar: z.object({ gatilho: z.union([z.string(), z.boolean()]), label: z.string() }).nullish(),
});

async function validar(dados: z.infer<typeof dadosSchema>) {
  const opcoes = dados.tipoResposta === 'SELECAO' ? dados.opcoes.map((o) => o.trim()).filter(Boolean) : [];
  if (dados.tipoResposta === 'SELECAO' && opcoes.length < 2) throw new ValidationError('Cadastre ao menos duas opções.');
  const complementar = (dados.tipoResposta === 'SELECAO' || dados.tipoResposta === 'MARCACAO') ? (dados.complementar ?? null) : null;
  if (complementar && !complementar.label.trim()) throw new ValidationError('Informe o texto do campo complementar.');

  if (dados.tipoResposta === 'HABILIDADE_COMPUTACAO') {
    const anos = [...new Set(dados.anos)].sort((a, b) => a - b);
    if (anos.length === 0) throw new ValidationError('Marque ao menos um ano.');
    return { habilidadeId: null, codigo: null, anos, opcoes, complementar };
  }
  if (!dados.habilidadeId) throw new ValidationError('Escolha a habilidade da BNCC Computação.');
  const habilidade = await prisma.habilidadeCurricular.findUnique({ where: { id: dados.habilidadeId } });
  if (!habilidade || !habilidade.ativa || habilidade.componente !== 'COMPUTACAO') throw new ValidationError('Habilidade não encontrada no catálogo da BNCC Computação.');
  return { habilidadeId: habilidade.id, codigo: habilidade.codigo, anos: habilidade.anosEscolares, opcoes, complementar };
}

pdiPerguntasComputacaoRouter.get('/', async (_req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const perguntas = await prisma.perguntaComputacaoPdi.findMany({ orderBy: { ordem: 'asc' }, include: incluir });
  res.json(perguntas.map(formatar));
});

pdiPerguntasComputacaoRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = dadosSchema.parse(req.body);
  const v = await validar(dados);
  const ultima = await prisma.perguntaComputacaoPdi.findFirst({ orderBy: { ordem: 'desc' } });
  const criada = await prisma.perguntaComputacaoPdi.create({
    data: {
      ...v, complementar: v.complementar ?? undefined,
      secao: dados.secao || SECAO_COMPUTACAO_PADRAO, texto: dados.texto, observacao: dados.observacao || null,
      tipoResposta: dados.tipoResposta, ordem: (ultima?.ordem ?? 0) + 1, createdBy: String(actor.id),
    },
    include: incluir,
  });
  res.status(201).json(formatar(criada));
});

async function buscar(id: number) {
  const p = await prisma.perguntaComputacaoPdi.findUnique({ where: { id } });
  if (!p) throw new NotFoundError('Pergunta de Computação não encontrada.');
  return p;
}

// Editar vale só para as próximas Aplicações (as já criadas guardam a cópia congelada).
pdiPerguntasComputacaoRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  await buscar(id);
  const dados = dadosSchema.parse(req.body);
  const v = await validar(dados);
  const atualizada = await prisma.perguntaComputacaoPdi.update({
    where: { id },
    data: {
      ...v, complementar: v.complementar ?? undefined,
      secao: dados.secao || SECAO_COMPUTACAO_PADRAO, texto: dados.texto, observacao: dados.observacao || null,
      tipoResposta: dados.tipoResposta, updatedBy: String(actor.id), version: { increment: 1 },
    },
    include: incluir,
  });
  res.json(formatar(atualizada));
});

async function mudarStatus(actor: Actor, id: number, status: 'ATIVA' | 'INATIVA') {
  const atual = await buscar(id);
  if (atual.status === status) throw new ValidationError(status === 'INATIVA' ? 'Esta pergunta já está inativa.' : 'Esta pergunta já está ativa.');
  return prisma.perguntaComputacaoPdi.update({ where: { id }, data: { status, ...marcarDesativacao(status === 'ATIVA', actor.id), updatedBy: String(actor.id) }, include: incluir });
}
pdiPerguntasComputacaoRouter.post('/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatar(await mudarStatus(actor, Number(req.params.id), 'INATIVA')));
});
pdiPerguntasComputacaoRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatar(await mudarStatus(actor, Number(req.params.id), 'ATIVA')));
});

// Excluir de vez só se nunca entrou em nenhuma Aplicação; usada = inativar.
pdiPerguntasComputacaoRouter.delete('/:id', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const id = Number(req.params.id);
  await buscar(id);
  const usada = await prisma.aplicacaoPerguntaPdi.findFirst({ where: { perguntaComputacaoIdOriginal: id }, select: { id: true } });
  if (usada) throw new ValidationError('Esta pergunta já entrou em uma Aplicação. Inative-a.');
  await prisma.perguntaComputacaoPdi.delete({ where: { id } });
  res.json({ removidoFisicamente: true });
});

const reordenarSchema = z.object({ ordens: z.array(z.object({ id: z.number().int(), ordem: z.number().int() })).min(1) });
pdiPerguntasComputacaoRouter.post('/reordenar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const { ordens } = reordenarSchema.parse(req.body);
  const ids = new Set((await prisma.perguntaComputacaoPdi.findMany({ select: { id: true } })).map((p) => p.id));
  if (ordens.some((o) => !ids.has(o.id))) throw new ValidationError('Uma ou mais perguntas informadas não existem.');
  await prisma.$transaction(ordens.map((o) => prisma.perguntaComputacaoPdi.update({ where: { id: o.id }, data: { ordem: o.ordem, updatedBy: String(actor.id) } })));
  res.json((await prisma.perguntaComputacaoPdi.findMany({ orderBy: { ordem: 'asc' }, include: incluir })).map(formatar));
});

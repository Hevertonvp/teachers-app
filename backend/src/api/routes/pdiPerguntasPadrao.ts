import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export const pdiPerguntasPadraoRouter = Router();

type Actor = { id: number; perfil: string };

// Template GLOBAL (nenhuma disciplina/escola) — só a Secretaria administra, mesmo recorte de
// Modelos PDI. CRUD completo de verdade (inclusive DELETE físico, bloqueado só quando alguma
// PerguntaPdi.padraoOriginalId ainda referencia esta pergunta — ver DELETE abaixo): ela é lida/
// copiada no momento de criar um ModeloPdi (ver pdiModelos.ts) e, desde o bloco de respostas
// padrão compartilhado, também pode ganhar vínculo de volta (PerguntaPdi.padraoOriginalId).
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar as perguntas padrão.');
  }
}

const formatarPerguntaPadrao = (p: {
  id: number; secao: string; subsecao: string | null; codigo: string | null; texto: string;
  indicador: string | null; origem: string; tipoResposta: string; opcoes: unknown;
  complementar: unknown; ordem: number; status: string; trimestre: number | null; compartilhada: boolean; createdAt: Date; updatedAt: Date | null;
}) => ({
  id: p.id,
  secao: p.secao,
  subsecao: p.subsecao,
  codigo: p.codigo,
  texto: p.texto,
  indicador: p.indicador,
  origem: p.origem,
  tipoResposta: p.tipoResposta,
  opcoes: p.opcoes ?? [],
  complementar: p.complementar ?? null,
  ordem: p.ordem,
  status: p.status,
  trimestre: p.trimestre,
  compartilhada: p.compartilhada,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

pdiPerguntasPadraoRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const perguntas = await prisma.perguntaPdiPadrao.findMany({ orderBy: { ordem: 'asc' } });
  res.json(perguntas.map(formatarPerguntaPadrao));
});

const dadosPerguntaSchema = z.object({
  secao: z.string().trim().min(1),
  subsecao: z.string().trim().nullish(),
  codigo: z.string().trim().nullish(),
  texto: z.string().trim().min(1, 'Informe o texto da pergunta.'),
  indicador: z.string().trim().nullish(),
  origem: z.enum(['ESTRUTURADA', 'HABILIDADE', 'ORIENTACAO', 'QUALITATIVA', 'PERSONALIZADA']).default('PERSONALIZADA'),
  tipoResposta: z.enum(['TEXTO', 'SELECAO', 'MARCACAO', 'NUMERO', 'ORIENTACAO', 'HABILIDADE_CRMG']),
  opcoes: z.array(z.string()).default([]),
  complementar: z.object({ gatilho: z.union([z.string(), z.boolean()]), label: z.string() }).nullish(),
  trimestre: z.number().int().min(1).max(3).nullish(), // null = qualquer trimestre
  // Omitido = criar: true (comportamento de sempre); editar: mantém o valor atual — nunca reclassifica
  // em silêncio uma pergunta só porque um cliente antigo não mandou o campo.
  compartilhada: z.boolean().optional(),
});

// HABILIDADE_CRMG pode ser pergunta padrão (nasce em todo Modelo), mas NUNCA compartilhada: é
// sempre isolada por disciplina (componente curricular da Ficha) — compartilhar entre disciplinas
// quebraria esse isolamento. Mesma regra repetida como CHECK no banco.
function exigirCrmgNaoCompartilhada(tipoResposta: string, compartilhada: boolean) {
  if (tipoResposta === 'HABILIDADE_CRMG' && compartilhada) {
    throw new ValidationError('Habilidades do CRMG são sempre específicas de cada disciplina: podem ser pergunta padrão, mas nunca com resposta compartilhada entre disciplinas.');
  }
}

pdiPerguntasPadraoRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = dadosPerguntaSchema.parse(req.body);
  const compartilhada = dados.compartilhada ?? true;
  exigirCrmgNaoCompartilhada(dados.tipoResposta, compartilhada);

  const ultima = await prisma.perguntaPdiPadrao.findFirst({ orderBy: { ordem: 'desc' } });
  const criada = await prisma.perguntaPdiPadrao.create({
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
      trimestre: dados.trimestre ?? null,
      compartilhada,
      ordem: (ultima?.ordem ?? 0) + 1,
      status: 'ATIVA',
      createdBy: String(actor.id),
    },
  });
  res.status(201).json(formatarPerguntaPadrao(criada));
});

async function buscarPerguntaPadrao(id: number) {
  const pergunta = await prisma.perguntaPdiPadrao.findUnique({ where: { id } });
  if (!pergunta) throw new NotFoundError('Pergunta padrão não encontrada.');
  return pergunta;
}

pdiPerguntasPadraoRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await buscarPerguntaPadrao(id);
  const dados = dadosPerguntaSchema.parse(req.body);
  // Vale a partir da PRÓXIMA Aplicação criada (o snapshot decide bloco comum x disciplina) —
  // Aplicações já criadas continuam como foram congeladas.
  const compartilhada = dados.compartilhada ?? atual.compartilhada;
  exigirCrmgNaoCompartilhada(dados.tipoResposta, compartilhada);

  const atualizada = await prisma.perguntaPdiPadrao.update({
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
      trimestre: dados.trimestre ?? null,
      compartilhada,
      updatedBy: String(actor.id),
    },
  });
  res.json(formatarPerguntaPadrao(atualizada));
});

async function mudarStatusPerguntaPadrao(actor: Actor, id: number, status: 'ATIVA' | 'INATIVA') {
  const atual = await buscarPerguntaPadrao(id);
  if (atual.status === status) {
    throw new ValidationError(status === 'INATIVA' ? 'Esta pergunta já está inativa.' : 'Esta pergunta já está ativa.');
  }
  return prisma.perguntaPdiPadrao.update({ where: { id }, data: { status, updatedBy: String(actor.id) } });
}

pdiPerguntasPadraoRouter.post('/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPerguntaPadrao(await mudarStatusPerguntaPadrao(actor, Number(req.params.id), 'INATIVA')));
});

pdiPerguntasPadraoRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  res.json(formatarPerguntaPadrao(await mudarStatusPerguntaPadrao(actor, Number(req.params.id), 'ATIVA')));
});

// DELETE físico de verdade — bloqueado só quando alguma PerguntaPdi.padraoOriginalId ainda
// referencia esta pergunta (FK Restrict), nunca quando ela só foi copiada sem vínculo (legado
// anterior ao bloco de respostas padrão — isso continua podendo ser excluído livremente, igual
// a antes).
pdiPerguntasPadraoRouter.delete('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  await buscarPerguntaPadrao(id);
  const vinculada = await prisma.perguntaPdi.findFirst({ where: { padraoOriginalId: id }, select: { id: true } });
  if (vinculada) {
    throw new ValidationError('Esta pergunta padrão está vinculada a pergunta(s) de Modelo PDI (bloco de respostas compartilhado) e não pode ser excluída. Inative-a em vez disso.');
  }
  await prisma.perguntaPdiPadrao.delete({ where: { id } });
  res.json({ removidoFisicamente: true });
});

const reordenarSchema = z.object({
  ordens: z.array(z.object({ id: z.number().int(), ordem: z.number().int() })).min(1),
});

pdiPerguntasPadraoRouter.post('/reordenar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const { ordens } = reordenarSchema.parse(req.body);

  const existentes = await prisma.perguntaPdiPadrao.findMany({ select: { id: true } });
  const idsValidos = new Set(existentes.map((p) => p.id));
  if (ordens.some((item) => !idsValidos.has(item.id))) {
    throw new ValidationError('Uma ou mais perguntas informadas não existem.');
  }

  await prisma.$transaction(
    ordens.map((item) => prisma.perguntaPdiPadrao.update({ where: { id: item.id }, data: { ordem: item.ordem, updatedBy: String(actor.id) } })),
  );

  const atualizadas = await prisma.perguntaPdiPadrao.findMany({ orderBy: { ordem: 'asc' } });
  res.json(atualizadas.map(formatarPerguntaPadrao));
});

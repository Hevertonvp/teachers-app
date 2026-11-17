import type { Turma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { NIVEL_ANTIGO_NO_CATALOGO, validarECalcularTurma, validarECalcularTurmaInfantilLocal, type DadosTurma } from '../../domain/turma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { prisma } from '../../lib/prisma.js';
import { marcarDesativacao } from '../../lib/desativacao.js';

export const turmasRouter = Router();

type Actor = { id: number; perfil: string };

// Turma é configuração de rede — só a Secretaria administra (criar/editar/inativar/reativar),
// igual Escola (ver escolas.ts). Gestor/Diretora/Professor/Auxiliar nunca escrevem aqui; esta
// tarefa não amplia a permissão deles. Leitura (GET) continua sem restrição.
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar Turmas.');
  }
}

const salvarTurmaSchema = z.object({
  escolaId: z.number().int(),
  anoLetivo: z.number().int(),
  etapa: z.enum(['FUNDAMENTAL', 'EDUCACAO_INFANTIL']),
  anoSerie: z.number().int().nullish(),
  segmento: z.enum(['CRECHE', 'PRE_ESCOLA']).nullish(),
  nivel: z.enum(['BERCARIO_I', 'BERCARIO_II', 'MATERNAL_I', 'MATERNAL_II', 'PRE_I', 'PRE_II']).nullish(),
  turno: z.enum(['MANHA', 'TARDE']),
  identificador: z.number().int(),
  nivelLocalId: z.number().int().nullish(), // 16/11/2026: nível local da Educação Infantil (catálogo)
});

type SalvarTurmaInput = z.infer<typeof salvarTurmaSchema>;

function paraDadosTurma(input: SalvarTurmaInput): DadosTurma {
  if (input.etapa === 'FUNDAMENTAL') {
    if (input.anoSerie == null) throw new ValidationError('anoSerie é obrigatório para Ensino Fundamental.');
    return {
      etapa: 'FUNDAMENTAL',
      escolaId: input.escolaId,
      anoLetivo: input.anoLetivo,
      anoSerie: input.anoSerie,
      turno: input.turno,
      identificador: input.identificador,
    };
  }

  if (input.segmento == null || input.nivel == null) {
    throw new ValidationError('segmento e nivel são obrigatórios para Educação Infantil.');
  }
  return {
    etapa: 'EDUCACAO_INFANTIL',
    escolaId: input.escolaId,
    anoLetivo: input.anoLetivo,
    segmento: input.segmento,
    nivel: input.nivel,
    turno: input.turno,
    identificador: input.identificador,
  };
}

function mensagemConflito(conflito: Turma): string {
  // 16/11/2026: mensagens curtas (sem explicar a regra).
  return conflito.status === 'INATIVA'
    ? `A turma ${conflito.nome} já existe (inativa). Reative-a.`
    : `A turma ${conflito.nome} já existe nesta escola.`;
}

// Monta os campos gravados da turma (16/11/2026). Caminhos:
// - Fundamental: igual a antes; se a escola tem etapas informadas, o ano precisa ser oferecido.
// - Infantil com nível LOCAL (nivelLocalId): a escola precisa ter etapas informadas e oferecer aquele nível.
// - Infantil antiga (segmento + nível enum): só em escola sem etapas informadas, ou para EDITAR turma antiga.
// Nada converte turma antiga para nível local.
async function montarTurma(input: SalvarTurmaInput, existente: Turma | null) {
  const escola = await prisma.escola.findUnique({ where: { id: input.escolaId }, include: { niveisInfantil: { select: { nivelId: true } } } });
  if (!escola) throw new NotFoundError('Escola não encontrada.');
  // 16/11/2026: escola inativa não recebe turma (criar ou mover para ela). Editar turma que já está nela continua.
  if (escola.status !== 'ATIVA' && (!existente || existente.escolaId !== escola.id)) throw new ValidationError('Esta escola está inativa.');
  const informada = escola.etapasOferecidas.length > 0;
  const base = { escolaId: input.escolaId, anoLetivo: input.anoLetivo, etapa: input.etapa, turno: input.turno, identificador: input.identificador };

  if (input.etapa === 'FUNDAMENTAL') {
    const dados = paraDadosTurma(input);
    const calculado = validarECalcularTurma(dados);
    if (informada && dados.etapa === 'FUNDAMENTAL' && !escola.anosFundamental.includes(dados.anoSerie)) {
      throw new ValidationError(`Esta escola não oferece o ${dados.anoSerie}º ano. Ajuste em Escolas.`);
    }
    return { ...base, ...calculado, anoSerie: dados.etapa === 'FUNDAMENTAL' ? dados.anoSerie : null, segmento: null, nivel: null, nivelLocalId: null };
  }

  if (informada && !escola.etapasOferecidas.includes('EDUCACAO_INFANTIL')) throw new ValidationError('Esta escola não oferece Educação Infantil. Ajuste em Escolas.');
  if (input.nivelLocalId != null) {
    if (!informada) throw new ValidationError('Informe as etapas e os níveis da escola (em Escolas) antes de usar estes níveis.');
    const nivel = await prisma.nivelInfantilLocal.findUnique({ where: { id: input.nivelLocalId } });
    if (!nivel) throw new NotFoundError('Nível da Educação Infantil não encontrado.');
    if (!escola.niveisInfantil.some((n) => n.nivelId === nivel.id)) throw new ValidationError(`Esta escola não oferece ${nivel.nome}. Ajuste em Escolas.`);
    const calculado = validarECalcularTurmaInfantilLocal({ escolaId: input.escolaId, anoLetivo: input.anoLetivo, nivelLocal: nivel, turno: input.turno, identificador: input.identificador });
    return { ...base, ...calculado, anoSerie: null, segmento: nivel.faixa, nivel: null, nivelLocalId: nivel.id };
  }
  const turmaAntiga = existente && existente.etapa === 'EDUCACAO_INFANTIL' && existente.nivelLocalId === null;
  if (informada && !turmaAntiga) throw new ValidationError('Escolha o nível da turma entre os que a escola oferece.');
  const dados = paraDadosTurma(input);
  const calculado = validarECalcularTurma(dados);
  // 16/11/2026: o nível antigo com equivalente no catálogo (Pré I/II = 1º/2º Período) fica ligado a ele.
  const equivalente = dados.etapa === 'EDUCACAO_INFANTIL' ? NIVEL_ANTIGO_NO_CATALOGO[dados.nivel] : undefined;
  const nivelLocalId = equivalente ? (await prisma.nivelInfantilLocal.findUnique({ where: { nome: equivalente } }))?.id ?? null : null;
  return {
    ...base, ...calculado, anoSerie: null,
    segmento: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.segmento : null,
    nivel: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.nivel : null,
    nivelLocalId,
  };
}

async function buscarConflito(identidadeChave: string, ignorarId?: number) {
  return prisma.turma.findFirst({
    where: { identidadeChave, ...(ignorarId ? { NOT: { id: ignorarId } } : {}) },
  });
}

turmasRouter.get('/', async (req, res) => {
  const { escolaId, anoLetivo, etapa, status } = req.query;
  const turmas = await prisma.turma.findMany({
    where: {
      ...(escolaId ? { escolaId: Number(escolaId) } : {}),
      ...(anoLetivo ? { anoLetivo: Number(anoLetivo) } : {}),
      ...(etapa ? { etapa: etapa as 'FUNDAMENTAL' | 'EDUCACAO_INFANTIL' } : {}),
      ...(status ? { status: status as 'ATIVA' | 'INATIVA' } : {}),
    },
    orderBy: { nome: 'asc' },
  });
  res.json(turmas);
});

turmasRouter.get('/:id', async (req, res) => {
  const turma = await prisma.turma.findUnique({ where: { id: Number(req.params.id) } });
  if (!turma) throw new NotFoundError('Turma não encontrada.');
  res.json(turma);
});

turmasRouter.post('/', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const input = salvarTurmaSchema.parse(req.body);
  const dados = await montarTurma(input, null);

  const conflito = await buscarConflito(dados.identidadeChave);
  if (conflito) throw new ConflictError(mensagemConflito(conflito));

  const turma = await prisma.turma.create({ data: { ...dados, status: 'ATIVA' } });

  res.status(201).json(turma);
});

turmasRouter.put('/:id', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  const input = salvarTurmaSchema.parse(req.body);
  const dados = await montarTurma(input, existente);

  const conflito = await buscarConflito(dados.identidadeChave, id);
  if (conflito) throw new ConflictError(mensagemConflito(conflito));

  const turma = await prisma.turma.update({ where: { id }, data: { ...dados, updatedAt: new Date(), version: { increment: 1 } } });

  res.json(turma);
});

turmasRouter.post('/:id/inativar', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  const turma = await prisma.turma.update({
    where: { id },
    data: { status: 'INATIVA', ...marcarDesativacao(false, (res.locals.pessoa as Actor).id), updatedAt: new Date(), version: { increment: 1 } },
  });
  res.json(turma);
});

turmasRouter.post('/:id/reativar', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  // 16/11/2026: escola com etapas informadas só reativa turma do que ela oferece.
  const escola = await prisma.escola.findUnique({ where: { id: existente.escolaId }, include: { niveisInfantil: { select: { nivelId: true } } } });
  if (escola && escola.status !== 'ATIVA') throw new ConflictError('Esta escola está inativa.');
  if (escola && escola.etapasOferecidas.length) {
    const coberta = existente.etapa === 'FUNDAMENTAL'
      ? !!existente.anoSerie && escola.anosFundamental.includes(existente.anoSerie)
      : escola.etapasOferecidas.includes('EDUCACAO_INFANTIL') && (existente.nivelLocalId === null || escola.niveisInfantil.some((n) => n.nivelId === existente.nivelLocalId));
    if (!coberta) throw new ConflictError(`A escola não oferece mais o que a turma ${existente.nome} usa. Ajuste em Escolas antes de reativar.`);
  }

  // Mesma regra da criação: reativar não pode fazer duas turmas ocuparem a mesma identidade.
  const conflito = await buscarConflito(existente.identidadeChave, id);
  if (conflito) {
    throw new ConflictError(
      `Já existe outra turma (${conflito.nome}, ${conflito.status === 'ATIVA' ? 'ativa' : 'inativa'}) com essa mesma combinação — ajuste-a antes de reativar esta.`,
    );
  }

  const turma = await prisma.turma.update({
    where: { id },
    data: { status: 'ATIVA', ...marcarDesativacao(true, (res.locals.pessoa as Actor).id), updatedAt: new Date(), version: { increment: 1 } },
  });
  res.json(turma);
});

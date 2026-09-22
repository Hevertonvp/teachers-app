import type { Turma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { validarECalcularTurma, type DadosTurma } from '../../domain/turma.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { prisma } from '../../lib/prisma.js';

export const turmasRouter = Router();

const salvarTurmaSchema = z.object({
  escolaId: z.number().int(),
  anoLetivo: z.number().int(),
  etapa: z.enum(['FUNDAMENTAL', 'EDUCACAO_INFANTIL']),
  anoSerie: z.number().int().nullish(),
  segmento: z.enum(['CRECHE', 'PRE_ESCOLA']).nullish(),
  nivel: z.enum(['BERCARIO_I', 'BERCARIO_II', 'MATERNAL_I', 'MATERNAL_II', 'PRE_I', 'PRE_II']).nullish(),
  turno: z.enum(['MANHA', 'TARDE']),
  identificador: z.number().int(),
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
  return conflito.status === 'INATIVA'
    ? `Já existe uma turma com essa configuração neste ano letivo (${conflito.nome}, inativa). Reative a turma existente em vez de criar uma nova.`
    : `Já existe uma turma ativa com essa combinação de escola, ano letivo, série/segmento, turno e identificador (${conflito.nome}).`;
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
  const input = salvarTurmaSchema.parse(req.body);
  const dados = paraDadosTurma(input);
  const { nome, identidadeChave } = validarECalcularTurma(dados);

  const conflito = await buscarConflito(identidadeChave);
  if (conflito) throw new ConflictError(mensagemConflito(conflito));

  const turma = await prisma.turma.create({
    data: {
      escolaId: input.escolaId,
      anoLetivo: input.anoLetivo,
      etapa: input.etapa,
      anoSerie: dados.etapa === 'FUNDAMENTAL' ? dados.anoSerie : null,
      segmento: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.segmento : null,
      nivel: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.nivel : null,
      turno: input.turno,
      identificador: input.identificador,
      nome,
      identidadeChave,
      status: 'ATIVA',
    },
  });

  res.status(201).json(turma);
});

turmasRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  const input = salvarTurmaSchema.parse(req.body);
  const dados = paraDadosTurma(input);
  const { nome, identidadeChave } = validarECalcularTurma(dados);

  const conflito = await buscarConflito(identidadeChave, id);
  if (conflito) throw new ConflictError(mensagemConflito(conflito));

  const turma = await prisma.turma.update({
    where: { id },
    data: {
      escolaId: input.escolaId,
      anoLetivo: input.anoLetivo,
      etapa: input.etapa,
      anoSerie: dados.etapa === 'FUNDAMENTAL' ? dados.anoSerie : null,
      segmento: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.segmento : null,
      nivel: dados.etapa === 'EDUCACAO_INFANTIL' ? dados.nivel : null,
      turno: input.turno,
      identificador: input.identificador,
      nome,
      identidadeChave,
      updatedAt: new Date(),
      version: { increment: 1 },
    },
  });

  res.json(turma);
});

turmasRouter.post('/:id/inativar', async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  const turma = await prisma.turma.update({
    where: { id },
    data: { status: 'INATIVA', updatedAt: new Date(), version: { increment: 1 } },
  });
  res.json(turma);
});

turmasRouter.post('/:id/reativar', async (req, res) => {
  const id = Number(req.params.id);
  const existente = await prisma.turma.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Turma não encontrada.');

  // Mesma regra da criação: reativar não pode fazer duas turmas ocuparem a mesma identidade.
  const conflito = await buscarConflito(existente.identidadeChave, id);
  if (conflito) {
    throw new ConflictError(
      `Já existe outra turma (${conflito.nome}, ${conflito.status === 'ATIVA' ? 'ativa' : 'inativa'}) com essa mesma combinação — ajuste-a antes de reativar esta.`,
    );
  }

  const turma = await prisma.turma.update({
    where: { id },
    data: { status: 'ATIVA', updatedAt: new Date(), version: { increment: 1 } },
  });
  res.json(turma);
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, exigirSecretariaOuDiretora, type Actor } from './pessoas.js';

export const auxiliarTurmaRouter = Router();

const formatarVinculo = (vinculo: {
  id: number; turmaId: number; auxiliarId: number;
  status: string; dataInicio: Date; dataFim: Date | null;
  turma: { nome: string; escolaId: number };
}) => ({
  id: vinculo.id,
  turmaId: vinculo.turmaId,
  turmaNome: vinculo.turma.nome,
  escolaId: vinculo.turma.escolaId,
  auxiliarId: vinculo.auxiliarId,
  status: vinculo.status,
  dataInicio: vinculo.dataInicio,
  dataFim: vinculo.dataFim,
});

// Diferente de Professor, Auxiliar não tem VinculoEscolar nesta etapa (não foi pedido) — o único
// escopo que existe de verdade é o da escola DA TURMA, checado aqui contra quem está pedindo.
async function exigirEscolaNoEscopo(actor: Actor, escolaId: number) {
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(escolaId)) {
    throw new ForbiddenError('Você só pode gerenciar vínculos de Auxiliar das escolas sob sua administração.');
  }
}

auxiliarTurmaRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);
  const { auxiliarId, turmaId } = req.query;

  const vinculos = await prisma.auxiliarTurma.findMany({
    where: {
      ...(auxiliarId ? { auxiliarId: Number(auxiliarId) } : {}),
      ...(turmaId ? { turmaId: Number(turmaId) } : {}),
      ...(permitidas ? { turma: { escolaId: { in: permitidas } } } : {}),
    },
    include: { turma: true },
    orderBy: { dataInicio: 'desc' },
  });

  res.json(vinculos.map(formatarVinculo));
});

const criarVinculoSchema = z.object({
  turmaId: z.number().int(),
  auxiliarId: z.number().int(),
});

// No máximo um vínculo ATIVO por turma (garantido por índice único parcial no Postgres, ver
// schema.prisma) — trocar de Auxiliar encerra o antigo e cria um novo na mesma transação. Um
// mesmo Auxiliar pode ter várias turmas ativas ao mesmo tempo: de propósito, nada aqui impede
// isso.
auxiliarTurmaRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const { turmaId, auxiliarId } = criarVinculoSchema.parse(req.body);

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) throw new NotFoundError('Turma não encontrada.');
  if (turma.status !== 'ATIVA') throw new ValidationError('Não é possível criar vínculo de Auxiliar em uma turma inativa.');

  await exigirEscolaNoEscopo(actor, turma.escolaId);

  const auxiliar = await prisma.pessoa.findUnique({ where: { id: auxiliarId } });
  if (!auxiliar || auxiliar.perfil !== 'AUXILIAR') throw new NotFoundError('Auxiliar não encontrado.');
  if (auxiliar.status !== 'ATIVO') throw new ValidationError('Este Auxiliar está inativo.');

  const atual = await prisma.auxiliarTurma.findFirst({ where: { turmaId, status: 'ATIVO' } });

  if (atual && atual.auxiliarId === auxiliarId) {
    return res.json(formatarVinculo({ ...atual, turma }));
  }

  const novo = await prisma.$transaction(async (tx) => {
    if (atual) {
      await tx.auxiliarTurma.update({ where: { id: atual.id }, data: { status: 'ENCERRADO', dataFim: new Date() } });
    }
    return tx.auxiliarTurma.create({ data: { turmaId, auxiliarId, status: 'ATIVO', dataInicio: new Date() } });
  });

  res.status(201).json(formatarVinculo({ ...novo, turma }));
});

auxiliarTurmaRouter.post('/:id/encerrar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const id = Number(req.params.id);

  const vinculo = await prisma.auxiliarTurma.findUnique({ where: { id }, include: { turma: true } });
  if (!vinculo) throw new NotFoundError('Vínculo não encontrado.');
  await exigirEscolaNoEscopo(actor, vinculo.turma.escolaId);
  if (vinculo.status !== 'ATIVO') throw new ValidationError('Este vínculo já está encerrado.');

  const atualizado = await prisma.auxiliarTurma.update({ where: { id }, data: { status: 'ENCERRADO', dataFim: new Date() } });
  res.json(formatarVinculo({ ...atualizado, turma: vinculo.turma }));
});

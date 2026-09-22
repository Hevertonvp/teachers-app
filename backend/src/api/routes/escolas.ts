import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

export const escolasRouter = Router();

const salvarEscolaSchema = z.object({
  nome: z.string().trim().min(1, 'Nome da escola é obrigatório.'),
});

escolasRouter.get('/', async (_req, res) => {
  const escolas = await prisma.escola.findMany({ orderBy: { nome: 'asc' } });
  res.json(escolas);
});

escolasRouter.get('/:id', async (req, res) => {
  const escola = await prisma.escola.findUnique({ where: { id: Number(req.params.id) } });
  if (!escola) throw new NotFoundError('Escola não encontrada.');
  res.json(escola);
});

escolasRouter.post('/', async (req, res) => {
  const { nome } = salvarEscolaSchema.parse(req.body);
  const escola = await prisma.escola.create({ data: { nome } });
  res.status(201).json(escola);
});

escolasRouter.put('/:id', async (req, res) => {
  const { nome } = salvarEscolaSchema.parse(req.body);
  const id = Number(req.params.id);

  const existente = await prisma.escola.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Escola não encontrada.');

  const escola = await prisma.escola.update({
    where: { id },
    data: { nome, updatedAt: new Date(), version: { increment: 1 } },
  });
  res.json(escola);
});

escolasRouter.post('/:id/inativar', async (req, res) => {
  res.json(await mudarStatus(req.params.id, 'INATIVA'));
});

escolasRouter.post('/:id/reativar', async (req, res) => {
  res.json(await mudarStatus(req.params.id, 'ATIVA'));
});

async function mudarStatus(idParam: string, status: 'ATIVA' | 'INATIVA') {
  const id = Number(idParam);
  const existente = await prisma.escola.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Escola não encontrada.');
  if (Number.isNaN(id)) throw new ValidationError('Id inválido.');

  return prisma.escola.update({
    where: { id },
    data: { status, updatedAt: new Date(), version: { increment: 1 } },
  });
}

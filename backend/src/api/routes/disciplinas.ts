import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const disciplinasRouter = Router();

disciplinasRouter.get('/', async (_req, res) => {
  const disciplinas = await prisma.disciplina.findMany({ orderBy: { nome: 'asc' } });
  res.json(disciplinas);
});

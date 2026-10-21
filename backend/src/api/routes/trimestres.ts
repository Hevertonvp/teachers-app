import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';

export const trimestresRouter = Router();

type Actor = { id: number; perfil: string };

// Calendário de trimestres (Configurações > Trimestres). Leitura liberada a qualquer perfil
// autenticado (a tela mostra o calendário a todos); alteração só pela Secretaria.
const formatar = (p: { trimestre: number; dataInicio: Date; dataFim: Date }) => ({
  trimestre: p.trimestre,
  dataInicio: p.dataInicio.toISOString().slice(0, 10),
  dataFim: p.dataFim.toISOString().slice(0, 10),
});

trimestresRouter.get('/', async (_req, res) => {
  const periodos = await prisma.periodoTrimestre.findMany({ orderBy: { trimestre: 'asc' } });
  res.json(periodos.map(formatar));
});

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
const atualizarSchema = z.object({ dataInicio: dataIso.optional(), dataFim: dataIso.optional() });

trimestresRouter.put('/:trimestre', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode alterar o calendário de trimestres.');
  const trimestre = Number(req.params.trimestre);
  const atual = await prisma.periodoTrimestre.findUnique({ where: { trimestre } });
  if (!atual) throw new NotFoundError('Trimestre não encontrado.');
  const dados = atualizarSchema.parse(req.body);
  const dataInicio = dados.dataInicio ? new Date(`${dados.dataInicio}T00:00:00Z`) : atual.dataInicio;
  const dataFim = dados.dataFim ? new Date(`${dados.dataFim}T00:00:00Z`) : atual.dataFim;
  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) throw new ValidationError('Data inválida.');
  const atualizado = await prisma.periodoTrimestre.update({ where: { trimestre }, data: { dataInicio, dataFim, updatedBy: String(actor.id) } });
  res.json(formatar(atualizado));
});

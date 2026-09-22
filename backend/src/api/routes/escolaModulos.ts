import { ModuloSistema } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

export const escolaModulosRouter = Router();

async function garantirEscolaExiste(escolaId: number) {
  const existe = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!existe) throw new NotFoundError('Escola não encontrada.');
}

function validarModulo(valor: string): ModuloSistema {
  if (!Object.values(ModuloSistema).includes(valor as ModuloSistema)) {
    throw new ValidationError(`Módulo '${valor}' desconhecido.`);
  }
  return valor as ModuloSistema;
}

// Sempre retorna uma linha por módulo conhecido (enum ModuloSistema), mesmo que a escola ainda
// não tenha nenhuma linha em escola_modulos para ele — nesse caso ativo = false.
escolaModulosRouter.get('/:escolaId/modulos', async (req, res) => {
  const escolaId = Number(req.params.escolaId);
  await garantirEscolaExiste(escolaId);

  const habilitados = await prisma.escolaModulo.findMany({ where: { escolaId } });
  const porModulo = new Map(habilitados.map((m) => [m.modulo, m.ativo]));

  const resposta = Object.values(ModuloSistema).map((modulo) => ({
    modulo,
    ativo: porModulo.get(modulo) ?? false,
  }));

  res.json(resposta);
});

escolaModulosRouter.post('/:escolaId/modulos/:modulo/habilitar', async (req, res) => {
  res.json(await definirStatus(req.params.escolaId, req.params.modulo, true));
});

escolaModulosRouter.post('/:escolaId/modulos/:modulo/desabilitar', async (req, res) => {
  res.json(await definirStatus(req.params.escolaId, req.params.modulo, false));
});

async function definirStatus(escolaIdParam: string, moduloParam: string, ativo: boolean) {
  const escolaId = Number(escolaIdParam);
  await garantirEscolaExiste(escolaId);
  const modulo = validarModulo(moduloParam);

  const existente = await prisma.escolaModulo.findUnique({
    where: { escolaId_modulo: { escolaId, modulo } },
  });

  if (existente) {
    return prisma.escolaModulo.update({ where: { id: existente.id }, data: { ativo } });
  }
  return prisma.escolaModulo.create({ data: { escolaId, modulo, ativo } });
}

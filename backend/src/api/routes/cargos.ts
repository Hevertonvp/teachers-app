import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { alterarCargo, criarCargo, encerrarCargo, lerData, listarCargosFormatados, validarComposicaoNoBanco } from '../../lib/cargos.js';
import { escolasPermitidas, exigirSecretariaOuDiretora, type Actor } from './pessoas.js';

// Cargos do Professor (decisão do usuário, 12/11/2026) — parte do cadastro administrativo do Professor,
// montado em /api/pessoas. Consulta: Secretaria e Diretora (no escopo dela). Criar, alterar e encerrar:
// SÓ a Secretaria (Diretora não altera cargos por enquanto).
export const cargosRouter = Router();

const exigirSecretaria = (actor: Actor) => {
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria cadastra, altera ou encerra cargos.');
};

async function buscarProfessor(actor: Actor, id: number) {
  const professor = await prisma.pessoa.findUnique({ where: { id } });
  if (!Number.isInteger(id) || !professor || professor.perfil !== 'PROFESSOR') throw new NotFoundError('Professor não encontrado.');
  const permitidas = await escolasPermitidas(actor);
  if (permitidas) {
    const vinculado = await prisma.vinculoEscolar.count({ where: { pessoaId: id, status: 'ATIVO', escolaId: { in: permitidas } } });
    if (vinculado === 0) throw new ForbiddenError('Este professor não está vinculado a uma escola sob sua administração.');
  }
  return professor;
}

cargosRouter.get('/professores/:id/cargos', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const professor = await buscarProfessor(actor, Number(req.params.id));
  // Encerrados só sob pedido (consulta histórica) — a tela normal mostra apenas os ativos.
  res.json(await listarCargosFormatados(prisma, professor.id, { incluirEncerrados: req.query.incluirEncerrados === '1' }));
});

const novoCargoSchema = z.object({ dataInicio: z.string(), composicao: z.unknown() });

cargosRouter.post('/professores/:id/cargos', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const professor = await buscarProfessor(actor, Number(req.params.id));
  const dados = novoCargoSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    const composicao = await validarComposicaoNoBanco(tx, dados.composicao);
    await criarCargo(tx, professor.id, { dataInicio: lerData(dados.dataInicio, 'Início do cargo'), composicao }, actor.id);
  });
  res.status(201).json(await listarCargosFormatados(prisma, professor.id));
});

const alterarCargoSchema = z.object({ dataInicio: z.string().optional(), composicao: z.unknown().optional(), baseUpdatedAt: z.string().nullish() });

cargosRouter.put('/professores/:id/cargos/:cargoId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const professor = await buscarProfessor(actor, Number(req.params.id));
  const dados = alterarCargoSchema.parse(req.body);
  await prisma.$transaction((tx) => alterarCargo(tx, professor.id, Number(req.params.cargoId), dados, actor.id));
  res.json(await listarCargosFormatados(prisma, professor.id));
});

const encerrarSchema = z.object({ dataFim: z.string() });

cargosRouter.post('/professores/:id/cargos/:cargoId/encerrar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const professor = await buscarProfessor(actor, Number(req.params.id));
  const { dataFim } = encerrarSchema.parse(req.body);
  await prisma.$transaction((tx) => encerrarCargo(tx, professor.id, Number(req.params.cargoId), dataFim, actor.id));
  res.json(await listarCargosFormatados(prisma, professor.id));
});

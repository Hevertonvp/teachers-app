import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors.js';

// Catálogo de ATUAÇÕES PEDAGÓGICAS do cargo (decisão do usuário, 12/11/2026): Professor Regente, Oficina do
// Brincar, Professor de Intervenção… Não são disciplinas. Consulta: Secretaria e Diretora (que vê os cargos).
// Cadastrar, renomear e ativar/desativar: só a Secretaria (Configurações). Nunca apaga: inativa some das listas
// de escolha, mas continua nos cargos e nas folhas antigos (que guardam o nome na própria foto).
export const atuacoesPedagogicasRouter = Router();

type Actor = { id: number; perfil: string };
const exigirSecretaria = (actor: Actor) => { if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria cadastra atuações pedagógicas.'); };
const formatar = (a: { id: number; nome: string; status: string }) => ({ id: a.id, nome: a.nome, status: a.status === 'ATIVA' ? 'ativa' : 'inativa' });
const ehNomeRepetido = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

atuacoesPedagogicasRouter.get('/', async (_req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (!['SECRETARIA', 'DIRETORA'].includes(actor.perfil)) throw new ForbiddenError('Sem acesso às atuações pedagógicas.');
  const lista = await prisma.atuacaoPedagogica.findMany({ orderBy: { nome: 'asc' } });
  res.json(lista.map(formatar));
});

const nomeSchema = z.string().trim().min(2, 'Escreva o nome da atuação.').max(100, 'Use no máximo 100 caracteres.');

// Nome único sem diferenciar maiúsculas/minúsculas ("professor regente" = "Professor Regente").
async function exigirNomeLivre(nome: string, ignorarId?: number) {
  const igual = await prisma.atuacaoPedagogica.findFirst({ where: { nome: { equals: nome, mode: 'insensitive' }, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (igual) throw new ConflictError(`Já existe a atuação "${igual.nome}".`);
}

atuacoesPedagogicasRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const nome = nomeSchema.parse(req.body?.nome);
  await exigirNomeLivre(nome);
  try {
    res.status(201).json(formatar(await prisma.atuacaoPedagogica.create({ data: { nome, createdBy: String(actor.id) } })));
  } catch (e) {
    if (ehNomeRepetido(e)) throw new ConflictError(`Já existe a atuação "${nome}".`);
    throw e;
  }
});

const alterarSchema = z.object({ nome: nomeSchema.optional(), status: z.enum(['ativa', 'inativa']).optional() });

atuacoesPedagogicasRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const dados = alterarSchema.parse(req.body);
  const atual = Number.isInteger(id) ? await prisma.atuacaoPedagogica.findUnique({ where: { id } }) : null;
  if (!atual) throw new NotFoundError('Atuação não encontrada.');
  if (dados.nome) await exigirNomeLivre(dados.nome, id);
  const salva = await prisma.atuacaoPedagogica.update({
    where: { id },
    data: { ...(dados.nome ? { nome: dados.nome } : {}), ...(dados.status ? { status: dados.status === 'ativa' ? 'ATIVA' : 'INATIVA' } : {}), updatedBy: String(actor.id) },
  });
  res.json(formatar(salva));
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, exigirSecretariaOuDiretora, type Actor } from './pessoas.js';

export const professorTurmaDisciplinaRouter = Router();

const formatarVinculo = (vinculo: {
  id: number; turmaId: number; professorId: number; disciplinaId: number;
  status: string; dataInicio: Date; dataFim: Date | null;
  turma: { nome: string; escolaId: number };
  disciplina: { nome: string };
}) => ({
  id: vinculo.id,
  turmaId: vinculo.turmaId,
  turmaNome: vinculo.turma.nome,
  escolaId: vinculo.turma.escolaId,
  professorId: vinculo.professorId,
  disciplinaId: vinculo.disciplinaId,
  disciplinaNome: vinculo.disciplina.nome,
  status: vinculo.status,
  dataInicio: vinculo.dataInicio,
  dataFim: vinculo.dataFim,
});

// Verifica se a escola da turma está dentro do escopo de quem pergunta — mesma regra usada em
// pessoas.ts para professores, aqui aplicada à escola DA TURMA (nunca confiar em nada vindo do
// frontend: Diretora só opera dentro das escolas onde tem VinculoEscolar ATIVO como DIRETORA).
async function exigirEscolaNoEscopo(actor: Actor, escolaId: number) {
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(escolaId)) {
    throw new ForbiddenError('Você só pode gerenciar vínculos pedagógicos das escolas sob sua administração.');
  }
}

professorTurmaDisciplinaRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);
  const { professorId, turmaId } = req.query;

  const vinculos = await prisma.professorTurmaDisciplina.findMany({
    where: {
      ...(professorId ? { professorId: Number(professorId) } : {}),
      ...(turmaId ? { turmaId: Number(turmaId) } : {}),
      ...(permitidas ? { turma: { escolaId: { in: permitidas } } } : {}),
    },
    include: { turma: true, disciplina: true },
    orderBy: { dataInicio: 'desc' },
  });

  res.json(vinculos.map(formatarVinculo));
});

const criarVinculoSchema = z.object({
  turmaId: z.number().int(),
  professorId: z.number().int(),
  disciplinaId: z.number().int(),
});

// Cria (ou substitui) o vínculo ATIVO de uma turma+disciplina. Regras (ver pedido de vínculos
// pedagógicos): turma precisa estar ATIVA; professor precisa já ter VinculoEscolar ATIVO na
// escola da turma (senão a pessoa apareceria lecionando numa escola à qual nunca foi vinculada —
// o fluxo correto é sempre vincular à escola primeiro, depois à turma/disciplina); no máximo um
// vínculo ATIVO por (turmaId, disciplinaId) — trocar de professor encerra o antigo e cria um novo
// na mesma transação (a unicidade é garantida por índice único parcial no Postgres, ver
// schema.prisma).
professorTurmaDisciplinaRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const { turmaId, professorId, disciplinaId } = criarVinculoSchema.parse(req.body);

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) throw new NotFoundError('Turma não encontrada.');
  if (turma.status !== 'ATIVA') throw new ValidationError('Não é possível criar vínculos pedagógicos em uma turma inativa.');

  await exigirEscolaNoEscopo(actor, turma.escolaId);

  const professor = await prisma.pessoa.findUnique({ where: { id: professorId } });
  if (!professor || professor.perfil !== 'PROFESSOR') throw new NotFoundError('Professor não encontrado.');
  if (professor.status !== 'ATIVO') throw new ValidationError('Este professor está inativo.');

  const vinculoEscolar = await prisma.vinculoEscolar.findFirst({
    where: { pessoaId: professorId, escolaId: turma.escolaId, status: 'ATIVO' },
  });
  if (!vinculoEscolar) {
    throw new ValidationError('Este professor ainda não tem vínculo ativo com a escola desta turma. Vincule-o à escola antes de atribuir turma/disciplina.');
  }

  const disciplina = await prisma.disciplina.findUnique({ where: { id: disciplinaId } });
  if (!disciplina) throw new NotFoundError('Disciplina não encontrada.');

  const atual = await prisma.professorTurmaDisciplina.findFirst({ where: { turmaId, disciplinaId, status: 'ATIVO' } });

  if (atual && atual.professorId === professorId) {
    // Já é este professor — idempotente, não cria segundo vínculo nem mexe em dataInicio.
    return res.json(formatarVinculo({ ...atual, turma, disciplina }));
  }

  const novo = await prisma.$transaction(async (tx) => {
    if (atual) {
      await tx.professorTurmaDisciplina.update({ where: { id: atual.id }, data: { status: 'ENCERRADO', dataFim: new Date() } });
    }
    return tx.professorTurmaDisciplina.create({
      data: { turmaId, professorId, disciplinaId, status: 'ATIVO', dataInicio: new Date() },
    });
  });

  res.status(201).json(formatarVinculo({ ...novo, turma, disciplina }));
});

professorTurmaDisciplinaRouter.post('/:id/encerrar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const id = Number(req.params.id);

  const vinculo = await prisma.professorTurmaDisciplina.findUnique({ where: { id }, include: { turma: true, disciplina: true } });
  if (!vinculo) throw new NotFoundError('Vínculo não encontrado.');
  await exigirEscolaNoEscopo(actor, vinculo.turma.escolaId);
  if (vinculo.status !== 'ATIVO') throw new ValidationError('Este vínculo já está encerrado.');

  const atualizado = await prisma.professorTurmaDisciplina.update({ where: { id }, data: { status: 'ENCERRADO', dataFim: new Date() } });
  res.json(formatarVinculo({ ...atualizado, turma: vinculo.turma, disciplina: vinculo.disciplina }));
});

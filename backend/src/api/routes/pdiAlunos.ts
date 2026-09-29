import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, type Actor } from './pessoas.js';

export const pdiAlunosRouter = Router();

// Leitura: Secretaria (rede toda), Gestor e Diretora (só as próprias escolas, via
// escolasPermitidas). Escrita: só Secretaria e Gestor — Diretora tem apenas consulta nesta etapa
// (não foi definida edição pra ela). Professor/Auxiliar não acessam este router ainda — o acesso
// deles será derivado por ProfessorTurmaDisciplina/AuxiliarTurma num próximo bloco.
function exigirLeitura(actor: Actor) {
  if (!['SECRETARIA', 'GESTOR', 'DIRETORA'].includes(actor.perfil)) {
    throw new ForbiddenError('Você não tem permissão para consultar Alunos PDI.');
  }
}

function exigirEscrita(actor: Actor) {
  if (!['SECRETARIA', 'GESTOR'].includes(actor.perfil)) {
    throw new ForbiddenError('Você não tem permissão para gerenciar Alunos PDI.');
  }
}

const formatarAluno = (aluno: {
  id: number; nome: string; turmaId: number;
  responsavelNome: string; responsavelParentesco: string; responsavelTelefone: string;
  status: string; createdAt: Date; updatedAt: Date | null;
  turma: { nome: string; escolaId: number; escola?: { nome: string } };
}) => ({
  id: aluno.id,
  nome: aluno.nome,
  turmaId: aluno.turmaId,
  turmaNome: aluno.turma.nome,
  escolaId: aluno.turma.escolaId,
  escolaNome: aluno.turma.escola?.nome,
  responsavelNome: aluno.responsavelNome,
  responsavelParentesco: aluno.responsavelParentesco,
  responsavelTelefone: aluno.responsavelTelefone,
  status: aluno.status,
  createdAt: aluno.createdAt,
  updatedAt: aluno.updatedAt,
});

// Escola nunca é um filtro confiável vindo solto do frontend — combinamos sempre com o escopo de
// quem pergunta (interseção, nunca substituição) e resolvemos tudo contra turma.escolaId.
function escolaIdsEfetivos(permitidas: number[] | null, escolaIdFiltro?: string): number[] | null {
  let efetivos = permitidas;
  if (escolaIdFiltro) {
    const num = Number(escolaIdFiltro);
    efetivos = efetivos ? efetivos.filter((id) => id === num) : [num];
  }
  return efetivos;
}

pdiAlunosRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeitura(actor);
  const permitidas = await escolasPermitidas(actor);
  const { escolaId, turmaId, status, busca } = req.query;
  const efetivos = escolaIdsEfetivos(permitidas, escolaId as string | undefined);
  // Qualquer valor fora do enum (ex.: "todos", usado por convenção no frontend pra "sem filtro")
  // é ignorado silenciosamente em vez de virar erro 500 do Postgres.
  const statusValido = status === 'ATIVO' || status === 'ARQUIVADO' ? status : undefined;

  const alunos = await prisma.alunoPdi.findMany({
    where: {
      ...(turmaId ? { turmaId: Number(turmaId) } : {}),
      ...(statusValido ? { status: statusValido } : {}),
      ...(busca ? { nome: { contains: String(busca), mode: 'insensitive' } } : {}),
      ...(efetivos ? { turma: { escolaId: { in: efetivos } } } : {}),
    },
    include: { turma: { include: { escola: true } } },
    orderBy: { nome: 'asc' },
  });

  res.json(alunos.map(formatarAluno));
});

async function buscarAlunoNoEscopo(actor: Actor, id: number) {
  const aluno = await prisma.alunoPdi.findUnique({ where: { id }, include: { turma: { include: { escola: true } } } });
  if (!aluno) throw new NotFoundError('Aluno não encontrado.');
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(aluno.turma.escolaId)) {
    throw new ForbiddenError('Você não tem acesso a este aluno.');
  }
  return aluno;
}

pdiAlunosRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeitura(actor);
  const aluno = await buscarAlunoNoEscopo(actor, Number(req.params.id));
  res.json(formatarAluno(aluno));
});

const dadosAlunoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  turmaId: z.number().int(),
  responsavelNome: z.string().trim().min(1, 'Nome do responsável é obrigatório.'),
  responsavelParentesco: z.string().trim().min(1, 'Parentesco é obrigatório.'),
  responsavelTelefone: z.string().trim().min(1, 'Telefone do responsável é obrigatório.'),
});

async function validarTurmaNoEscopo(actor: Actor, turmaId: number) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId }, include: { escola: true } });
  if (!turma) throw new NotFoundError('Turma não encontrada.');
  if (turma.status !== 'ATIVA') throw new ValidationError('Não é possível vincular o aluno a uma turma inativa.');
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(turma.escolaId)) {
    throw new ForbiddenError('Você só pode gerenciar Alunos PDI das escolas sob sua administração.');
  }
  return turma;
}

pdiAlunosRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirEscrita(actor);
  const dados = dadosAlunoSchema.parse(req.body);
  const turma = await validarTurmaNoEscopo(actor, dados.turmaId);

  const criado = await prisma.alunoPdi.create({
    data: { ...dados, status: 'ATIVO', createdBy: String(actor.id) },
  });

  res.status(201).json(formatarAluno({ ...criado, turma }));
});

// Trocar de turma aqui só muda o cadastro atual (seção 9/10 do pedido) — não existe ainda
// snapshot/histórico de matrícula porque fichas ainda não existem no backend.
pdiAlunosRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirEscrita(actor);
  const id = Number(req.params.id);
  await buscarAlunoNoEscopo(actor, id); // garante escopo na escola ATUAL antes de qualquer mudança
  const dados = dadosAlunoSchema.parse(req.body);
  const turma = await validarTurmaNoEscopo(actor, dados.turmaId); // e na escola NOVA, se mudou

  const atualizado = await prisma.alunoPdi.update({
    where: { id },
    data: { ...dados, updatedBy: String(actor.id), version: { increment: 1 } },
  });

  res.json(formatarAluno({ ...atualizado, turma }));
});

async function mudarStatusAluno(actor: Actor, id: number, status: 'ATIVO' | 'ARQUIVADO') {
  const atual = await buscarAlunoNoEscopo(actor, id);
  if (atual.status === status) {
    throw new ValidationError(status === 'ARQUIVADO' ? 'Este aluno já está arquivado.' : 'Este aluno já está ativo.');
  }
  const atualizado = await prisma.alunoPdi.update({
    where: { id },
    data: { status, updatedBy: String(actor.id) },
  });
  return { ...atualizado, turma: atual.turma };
}

pdiAlunosRouter.post('/:id/arquivar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirEscrita(actor);
  res.json(formatarAluno(await mudarStatusAluno(actor, Number(req.params.id), 'ARQUIVADO')));
});

pdiAlunosRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirEscrita(actor);
  res.json(formatarAluno(await mudarStatusAluno(actor, Number(req.params.id), 'ATIVO')));
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, type Actor } from './pessoas.js';

export const pdiAlunosRouter = Router();

// Leitura da LISTAGEM (GET /): Secretaria (rede toda), Gestor e Diretora (só as próprias escolas,
// via escolasPermitidas) — escopo por ESCOLA, que faz sentido pra quem administra/supervisiona a
// escola inteira. Auxiliar NUNCA usa este endpoint: o escopo dele é por TURMA (AuxiliarTurma), não
// por escola — misturar os dois aqui daria a ele visão de turmas que não são suas só por
// compartilharem a escola. Auxiliar tem sua própria listagem em GET /meus-alunos e leitura
// individual em GET /:id (ver exigirLeituraIndividual/buscarAlunoNoEscopo abaixo). Professor não
// acessa nenhum dos dois: ele nunca precisa consultar Aluno PDI diretamente, só através do fluxo
// de Ficha PDI (que resolve aluno internamente via Prisma).
function exigirLeitura(actor: Actor) {
  if (!['SECRETARIA', 'GESTOR', 'DIRETORA'].includes(actor.perfil)) {
    throw new ForbiddenError('Você não tem permissão para consultar Alunos PDI.');
  }
}

// Leitura INDIVIDUAL (GET /:id) — mesmo grupo de exigirLeitura, mais Auxiliar e Professor, cujo
// escopo mais estreito (a própria turma) é aplicado dentro de buscarAlunoNoEscopo, nunca aqui.
// Professor entrou aqui na tarefa de Anamnese real (seção 33/34 do pedido): a página de Anamnese
// precisa buscar os dados básicos do aluno antes de mostrar a consulta.
function exigirLeituraIndividual(actor: Actor) {
  if (!['SECRETARIA', 'GESTOR', 'DIRETORA', 'AUXILIAR', 'PROFESSOR'].includes(actor.perfil)) {
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

  // Auxiliar tem escopo mais estreito que os demais perfis daqui: precisa de VinculoEscolar ATIVO
  // com a escola E de AuxiliarTurma ATIVO com a turma ATUAL do aluno — não basta a escola (ver
  // exigirLeitura acima). Nunca usa escolasPermitidas, que só enxerga o nível de escola.
  if (actor.perfil === 'AUXILIAR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId: aluno.turma.escolaId, status: 'ATIVO' } });
    const vinculoTurma = vinculoEscolar && await prisma.auxiliarTurma.findFirst({ where: { auxiliarId: actor.id, turmaId: aluno.turmaId, status: 'ATIVO' } });
    if (!vinculoTurma) throw new ForbiddenError('Você não tem acesso a este aluno.');
    return aluno;
  }

  // Professor: mesma regra usada em Anamnese (qualquer vínculo ATIVO na turma atual do aluno, em
  // qualquer disciplina — Anamnese é do aluno, não da disciplina, ver domain/anamnese.ts).
  if (actor.perfil === 'PROFESSOR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId: aluno.turma.escolaId, status: 'ATIVO' } });
    const algumPtd = vinculoEscolar && await prisma.professorTurmaDisciplina.count({ where: { turmaId: aluno.turmaId, professorId: actor.id, status: 'ATIVO' } });
    if (!algumPtd) throw new ForbiddenError('Você não tem acesso a este aluno.');
    return aluno;
  }

  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(aluno.turma.escolaId)) {
    throw new ForbiddenError('Você não tem acesso a este aluno.');
  }
  return aluno;
}

// Listagem unificada do Auxiliar (seções 14-17 do pedido): VinculoEscolar ATIVO → AuxiliarTurma
// ATIVO → Turma ATIVA → AlunoPdi ATIVO — nunca AuxiliarAluno (não existe) nem o mock
// pdiAuxiliaresVinculos. Precisa vir ANTES de GET /:id na definição das rotas, senão o Express
// tentaria casar "meus-alunos" como se fosse um :id.
pdiAlunosRouter.get('/meus-alunos', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'AUXILIAR') {
    throw new ForbiddenError('Este endpoint é exclusivo do Auxiliar de Aprendizagem.');
  }

  const vinculosEscolares = await prisma.vinculoEscolar.findMany({ where: { pessoaId: actor.id, status: 'ATIVO' }, select: { escolaId: true } });
  const escolaIds = vinculosEscolares.map((v) => v.escolaId);
  if (escolaIds.length === 0) return res.json([]);

  const auxiliarTurmas = await prisma.auxiliarTurma.findMany({
    where: { auxiliarId: actor.id, status: 'ATIVO', turma: { escolaId: { in: escolaIds }, status: 'ATIVA' } },
    select: { turmaId: true },
  });
  if (auxiliarTurmas.length === 0) return res.json([]);

  const alunos = await prisma.alunoPdi.findMany({
    where: { turmaId: { in: auxiliarTurmas.map((t) => t.turmaId) }, status: 'ATIVO' },
    include: { turma: { include: { escola: true } } },
    orderBy: { nome: 'asc' },
  });

  res.json(alunos.map(formatarAluno));
});

pdiAlunosRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraIndividual(actor);
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

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { diaDeHojeSp } from '../../lib/cargos.js';
import { atuacaoTemTurmas } from '../../domain/cargos.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, exigirSecretariaOuDiretora, type Actor } from './pessoas.js';
import { ATUACOES_COM_FORMULARIO_PDI, responsavelDaAtuacao } from '../../domain/pdiAtuacao.js';

// Professor ↔ Turma por ATUAÇÃO pedagógica, sem disciplina (decisão do usuário, 16/11/2026): "Regente da 1M1".
// Mesmas permissões do vínculo por disciplina (professorTurmaDisciplina.ts): leitura para Secretaria, Diretora,
// Gestor e o próprio Professor; criar/encerrar só Secretaria e Diretora (no escopo das suas escolas).
// Diferenças: não substitui ninguém (a turma pode ter dois regentes) e recusa atuação sem turma
// (Biblioteca, Professor de Intervenção, Eventual — ATUACOES_SEM_TURMA em domain/cargos.ts).
export const professorTurmaAtuacaoRouter = Router();

const formatarVinculo = (v: {
  id: number; turmaId: number; professorId: number; atuacaoId: number;
  status: string; dataInicio: Date; dataFim: Date | null;
  turma: { nome: string; escolaId: number };
  professor: { nome: string };
  atuacao: { nome: string };
}) => ({
  id: v.id,
  turmaId: v.turmaId,
  turmaNome: v.turma.nome,
  escolaId: v.turma.escolaId,
  professorId: v.professorId,
  professorNome: v.professor.nome,
  atuacaoId: v.atuacaoId,
  atuacaoNome: v.atuacao.nome,
  status: v.status,
  dataInicio: v.dataInicio,
  dataFim: v.dataFim,
});

function exigirLeitura(actor: Actor) {
  if (!['SECRETARIA', 'DIRETORA', 'GESTOR', 'PROFESSOR'].includes(actor.perfil)) {
    throw new ForbiddenError('Você não tem permissão para consultar vínculos pedagógicos.');
  }
}

async function exigirEscolaNoEscopo(actor: Actor, escolaId: number) {
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(escolaId)) {
    throw new ForbiddenError('Você só pode gerenciar vínculos pedagógicos das escolas sob sua administração.');
  }
}

const incluir = { turma: true, professor: true, atuacao: true } as const;

professorTurmaAtuacaoRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeitura(actor);
  const permitidas = await escolasPermitidas(actor);
  const { professorId, turmaId } = req.query;
  // PROFESSOR só lê os próprios (nunca o professorId da query).
  const professorIdFiltro = actor.perfil === 'PROFESSOR' ? actor.id : professorId ? Number(professorId) : undefined;
  const vinculos = await prisma.professorTurmaAtuacao.findMany({
    where: {
      ...(professorIdFiltro ? { professorId: professorIdFiltro } : {}),
      ...(turmaId ? { turmaId: Number(turmaId) } : {}),
      ...(permitidas ? { turma: { escolaId: { in: permitidas } } } : {}),
    },
    include: incluir,
    orderBy: { dataInicio: 'desc' },
  });
  res.json(vinculos.map(formatarVinculo));
});

const criarSchema = z.object({
  turmaId: z.number().int(),
  professorId: z.number().int(),
  atuacaoId: z.number().int(),
});

// Cria o vínculo ATIVO (idempotente: se já existe para o mesmo professor, turma e atuação, devolve o existente).
// Regras iguais ao vínculo por disciplina: turma ATIVA, professor ATIVO e com vínculo escolar ATIVO na escola
// da turma. Além disso: atuação existente, ativa e que tenha turmas.
professorTurmaAtuacaoRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const { turmaId, professorId, atuacaoId } = criarSchema.parse(req.body);

  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) throw new NotFoundError('Turma não encontrada.');
  if (turma.status !== 'ATIVA') throw new ValidationError('Não é possível criar vínculos pedagógicos em uma turma inativa.');
  await exigirEscolaNoEscopo(actor, turma.escolaId);

  const professor = await prisma.pessoa.findUnique({ where: { id: professorId } });
  if (!professor || professor.perfil !== 'PROFESSOR') throw new NotFoundError('Professor não encontrado.');
  if (professor.status !== 'ATIVO') throw new ValidationError('Este professor está inativo.');

  const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: professorId, escolaId: turma.escolaId, status: 'ATIVO' } });
  if (!vinculoEscolar) throw new ValidationError('Este professor ainda não tem vínculo ativo com a escola desta turma.');

  const atuacao = await prisma.atuacaoPedagogica.findUnique({ where: { id: atuacaoId } });
  if (!atuacao) throw new NotFoundError('Atuação pedagógica não encontrada.');
  if (atuacao.status !== 'ATIVA') throw new ValidationError('Esta atuação pedagógica está inativa.');
  if (!atuacaoTemTurmas(atuacao.nome)) throw new ValidationError(`${atuacao.nome} não se liga a turmas.`);

  const atual = await prisma.professorTurmaAtuacao.findFirst({ where: { professorId, turmaId, atuacaoId, status: 'ATIVO' } });
  if (atual) return res.json(formatarVinculo({ ...atual, turma, professor, atuacao }));

  const novo = await prisma.professorTurmaAtuacao.create({
    data: { turmaId, professorId, atuacaoId, status: 'ATIVO', dataInicio: diaDeHojeSp(), createdBy: String(actor.id) },
  });
  // Atuação com formulário PDI (Professor TAE, 17/11/2026): a turma pode ter mais de um, mas o PDI fica com o
  // ligado primeiro — avisa quem está ligando (mensagem curta, decisão do usuário). Nada é bloqueado.
  let aviso: string | null = null;
  if (ATUACOES_COM_FORMULARIO_PDI.includes(atuacao.nome)) {
    const responsavel = await responsavelDaAtuacao(prisma, turmaId, atuacaoId);
    if (responsavel && responsavel.professorId !== professorId) aviso = `A ${turma.nome} já tem TAE (${responsavel.professor.nome}). O PDI fica com ele(a).`;
  }
  res.status(201).json({ ...formatarVinculo({ ...novo, turma, professor, atuacao }), aviso });
});

professorTurmaAtuacaoRouter.post('/:id/encerrar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const id = Number(req.params.id);
  const vinculo = await prisma.professorTurmaAtuacao.findUnique({ where: { id }, include: incluir });
  if (!vinculo) throw new NotFoundError('Vínculo não encontrado.');
  await exigirEscolaNoEscopo(actor, vinculo.turma.escolaId);
  if (vinculo.status !== 'ATIVO') throw new ValidationError('Este vínculo já está encerrado.');
  const atualizado = await prisma.professorTurmaAtuacao.update({ where: { id }, data: { status: 'ENCERRADO', dataFim: diaDeHojeSp() } });
  res.json(formatarVinculo({ ...atualizado, turma: vinculo.turma, professor: vinculo.professor, atuacao: vinculo.atuacao }));
});

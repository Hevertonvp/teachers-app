import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, exigirSecretariaOuDiretora, type Actor } from './pessoas.js';

export const vinculosEscolaresRouter = Router();

const PERFIS_ESCOPO_DIRETORA = ['PROFESSOR', 'AUXILIAR'];

// Diretora só gerencia vínculo escolar de Professor/Auxiliar, e só dentro das próprias escolas
// (ver seção 11 do pedido). Diretora/Gestor são sempre exclusivos da Secretaria — mesmo corte já
// usado em canManagePessoas no frontend (Supervisores(as)/Diretores(as) só pra Secretaria).
async function exigirEscopoParaPessoa(actor: Actor, pessoa: { perfil: string }, escolaId: number) {
  if (!PERFIS_ESCOPO_DIRETORA.includes(pessoa.perfil)) {
    if (actor.perfil !== 'SECRETARIA') {
      throw new ForbiddenError('Apenas a Secretaria pode gerenciar vínculos escolares de Diretoras(as)/Supervisoras(es).');
    }
    return;
  }
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(escolaId)) {
    throw new ForbiddenError('Você só pode gerenciar vínculos escolares das escolas sob sua administração.');
  }
}

const formatarVinculo = (vinculo: {
  id: number; pessoaId: number; escolaId: number;
  status: string; dataInicio: Date; dataFim: Date | null;
  escola: { nome: string };
}) => ({
  id: vinculo.id,
  pessoaId: vinculo.pessoaId,
  escolaId: vinculo.escolaId,
  escolaNome: vinculo.escola.nome,
  status: vinculo.status,
  dataInicio: vinculo.dataInicio,
  dataFim: vinculo.dataFim,
});

// Lista os vínculos (ativos + históricos) de UMA pessoa. Diretora só vê os das próprias escolas —
// nunca os vínculos dela em escolas fora do seu escopo (mesma regra de privacidade de /professores).
vinculosEscolaresRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const { pessoaId } = req.query;
  if (!pessoaId) throw new ValidationError('Informe pessoaId.');
  const permitidas = await escolasPermitidas(actor);

  const vinculos = await prisma.vinculoEscolar.findMany({
    where: {
      pessoaId: Number(pessoaId),
      ...(permitidas ? { escolaId: { in: permitidas } } : {}),
    },
    include: { escola: true },
    orderBy: { dataInicio: 'desc' },
  });

  res.json(vinculos.map(formatarVinculo));
});

const criarVinculoSchema = z.object({
  pessoaId: z.number().int(),
  escolaId: z.number().int(),
});

// Cria um VinculoEscolar novo pra uma pessoa já existente (nunca cria Pessoa — ver seção 14 do
// pedido). Só PROFESSOR e AUXILIAR passam por aqui: Professor também pode ganhar escola nova pelo
// fluxo de "Cadastrar professor" já existente (POST /pessoas/professores), que continua intocado;
// este endpoint cobre o caso que faltava — dar a um Auxiliar já cadastrado o primeiro (ou mais um)
// vínculo escolar. Idempotente: se já existe um vínculo ATIVO pra essa combinação, devolve ele em
// vez de duplicar.
vinculosEscolaresRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { pessoaId, escolaId } = criarVinculoSchema.parse(req.body);

  const pessoa = await prisma.pessoa.findUnique({ where: { id: pessoaId } });
  if (!pessoa) throw new NotFoundError('Pessoa não encontrada.');
  if (!['PROFESSOR', 'AUXILIAR'].includes(pessoa.perfil)) {
    throw new ValidationError('Este endpoint só cria vínculo escolar para Professor ou Auxiliar.');
  }

  await exigirEscopoParaPessoa(actor, pessoa, escolaId);

  const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!escola) throw new NotFoundError('Escola não encontrada.');

  const existente = await prisma.vinculoEscolar.findFirst({ where: { pessoaId, escolaId, status: 'ATIVO' } });
  if (existente) {
    return res.json(formatarVinculo({ ...existente, escola }));
  }

  const criado = await prisma.vinculoEscolar.create({
    data: { pessoaId, escolaId, status: 'ATIVO', dataInicio: new Date(), createdBy: String(actor.id) },
  });

  res.status(201).json(formatarVinculo({ ...criado, escola }));
});

// Encerra o vínculo escolar E, na MESMA transação, encerra os vínculos operacionais ativos que
// dependiam dele (ProfessorTurmaDisciplina/AuxiliarTurma daquela escola) — nunca deixamos um
// vínculo pedagógico "órfão" ativo numa escola onde a pessoa não tem mais acesso operacional (ver
// seção 7/8 do pedido). Vínculos de OUTRAS escolas não são tocados. Encerrar vínculo escolar NUNCA
// inativa a Pessoa (são conceitos diferentes — ver seção 6).
vinculosEscolaresRouter.post('/:id/encerrar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);

  const vinculo = await prisma.vinculoEscolar.findUnique({ where: { id }, include: { escola: true, pessoa: true } });
  if (!vinculo) throw new NotFoundError('Vínculo não encontrado.');
  await exigirEscopoParaPessoa(actor, vinculo.pessoa, vinculo.escolaId);
  if (vinculo.status !== 'ATIVO') throw new ValidationError('Este vínculo já está encerrado.');

  const agora = new Date();
  const atualizado = await prisma.$transaction(async (tx) => {
    const resultado = await tx.vinculoEscolar.update({ where: { id }, data: { status: 'ENCERRADO', dataFim: agora } });

    if (vinculo.pessoa.perfil === 'PROFESSOR') {
      await tx.professorTurmaDisciplina.updateMany({
        where: { professorId: vinculo.pessoaId, status: 'ATIVO', turma: { escolaId: vinculo.escolaId } },
        data: { status: 'ENCERRADO', dataFim: agora },
      });
    } else if (vinculo.pessoa.perfil === 'AUXILIAR') {
      await tx.auxiliarTurma.updateMany({
        where: { auxiliarId: vinculo.pessoaId, status: 'ATIVO', turma: { escolaId: vinculo.escolaId } },
        data: { status: 'ENCERRADO', dataFim: agora },
      });
    }

    return resultado;
  });

  res.json(formatarVinculo({ ...atualizado, escola: vinculo.escola }));
});

// Reativar NÃO ressuscita vínculos pedagógicos/AuxiliarTurma antigos daquela escola (ver seção 10
// do pedido) — só o VinculoEscolar volta a ATIVO. Quem precisar de vínculo operacional de novo
// tem que criá-lo explicitamente depois.
vinculosEscolaresRouter.post('/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const id = Number(req.params.id);

  const vinculo = await prisma.vinculoEscolar.findUnique({ where: { id }, include: { escola: true, pessoa: true } });
  if (!vinculo) throw new NotFoundError('Vínculo não encontrado.');
  await exigirEscopoParaPessoa(actor, vinculo.pessoa, vinculo.escolaId);
  if (vinculo.status !== 'ENCERRADO') throw new ValidationError('Este vínculo já está ativo.');

  const atualizado = await prisma.vinculoEscolar.update({ where: { id }, data: { status: 'ATIVO', dataFim: null } });
  res.json(formatarVinculo({ ...atualizado, escola: vinculo.escola }));
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { calcularExpiracaoSenhaTemporaria, gerarSenhaTemporaria } from '../../domain/senhaTemporaria.js';
import bcrypt from 'bcryptjs';

export const pessoasRouter = Router();

export type Actor = { id: number; perfil: string };

// Secretaria administra a rede inteira; Diretora só as escolas onde tem vínculo ATIVO como
// DIRETORA. Único jeito de saber isso é consultando o banco — nunca confiar em nada vindo do
// frontend (ver seção 17 do pedido de autenticação).
export async function escolasPermitidas(actor: Actor): Promise<number[] | null> {
  if (actor.perfil === 'SECRETARIA') return null; // null = sem filtro (todas)
  const vinculos = await prisma.vinculoEscolar.findMany({
    where: { pessoaId: actor.id, status: 'ATIVO' },
    select: { escolaId: true },
  });
  return vinculos.map((v) => v.escolaId);
}

export function exigirSecretariaOuDiretora(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA' && actor.perfil !== 'DIRETORA') {
    throw new ForbiddenError('Você não tem permissão para gerenciar professores.');
  }
}

const formatarPessoa = (pessoa: { id: number; nome: string; email: string; perfil: string; status: string }) => ({
  id: pessoa.id,
  nome: pessoa.nome,
  email: pessoa.email,
  perfil: pessoa.perfil,
  status: pessoa.status,
});

// Escolas que o próprio usuário logado pode administrar — usado pra popular o seletor de escolas
// na tela de cadastro (a Diretora nunca vê a lista completa da rede).
pessoasRouter.get('/minhas-escolas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);

  const escolas = await prisma.escola.findMany({
    where: permitidas ? { id: { in: permitidas } } : { status: 'ATIVA' },
    orderBy: { nome: 'asc' },
  });
  res.json(escolas.map((e) => ({ id: e.id, nome: e.nome })));
});

// Lista professores dentro do escopo de quem pergunta: Secretaria vê todos; Diretora só quem tem
// vínculo ATIVO numa escola dela — e, mesmo assim, só enxerga os vínculos dela nesse professor,
// nunca os vínculos dele em outras escolas (ver seções 5/6 do pedido).
pessoasRouter.get('/professores', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);

  const professores = await prisma.pessoa.findMany({
    where: {
      perfil: 'PROFESSOR',
      ...(permitidas ? { vinculosEscolares: { some: { status: 'ATIVO', escolaId: { in: permitidas } } } } : {}),
    },
    orderBy: { nome: 'asc' },
    include: { vinculosEscolares: { where: { status: 'ATIVO' }, include: { escola: true } } },
  });

  res.json(professores.map((professor) => ({
    ...formatarPessoa(professor),
    senhaTemporaria: professor.senhaTemporaria,
    escolas: professor.vinculosEscolares
      .filter((vinculo) => !permitidas || permitidas.includes(vinculo.escolaId))
      .map((vinculo) => ({ id: vinculo.escola.id, nome: vinculo.escola.nome })),
  })));
});

const criarOuVincularProfessorSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido.'),
  escolaIds: z.array(z.number().int().positive()).min(1, 'Selecione ao menos uma escola.'),
});

async function validarEscopoEscolas(actor: Actor, escolaIds: number[]) {
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && escolaIds.some((id) => !permitidas.includes(id))) {
    throw new ForbiddenError('Você só pode vincular professores às escolas sob sua administração.');
  }
}

// Cria um professor novo OU vincula um professor já existente (mesmo e-mail) a escola(s) novas —
// nunca duas contas para o mesmo e-mail (ver seções 3/9 do pedido). Diretora só age dentro do
// próprio escopo de escolas, verificado aqui, nunca confiando em nada vindo do frontend.
pessoasRouter.post('/professores', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const { nome, email, escolaIds } = criarOuVincularProfessorSchema.parse(req.body);
  const emailNormalizado = email.toLowerCase();

  await validarEscopoEscolas(actor, escolaIds);

  const existente = await prisma.pessoa.findUnique({ where: { email: emailNormalizado } });

  if (existente && existente.perfil !== 'PROFESSOR') {
    throw new ConflictError('Já existe uma conta com este e-mail, de outro perfil. Procure a Secretaria.');
  }

  if (existente) {
    const vinculosAtivos = await prisma.vinculoEscolar.findMany({
      where: { pessoaId: existente.id, status: 'ATIVO' },
      select: { escolaId: true },
    });
    const jaVinculadas = new Set(vinculosAtivos.map((v) => v.escolaId));
    const novasEscolas = escolaIds.filter((id) => !jaVinculadas.has(id));

    if (novasEscolas.length === 0) {
      return res.json({ pessoa: formatarPessoa(existente), senhaTemporaria: null, mensagem: 'Este professor já está vinculado a todas as escolas selecionadas.' });
    }

    await prisma.$transaction(async (tx) => {
      for (const escolaId of novasEscolas) {
        await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: existente.id, status: 'ATIVO', dataInicio: new Date(), createdBy: String(actor.id) } });
        await tx.pessoaEvento.create({ data: { pessoaId: existente.id, tipo: 'VINCULO_CRIADO', autorId: actor.id, detalhe: `Escola #${escolaId}` } });
      }
    });

    return res.status(201).json({ pessoa: formatarPessoa(existente), senhaTemporaria: null, mensagem: 'Professor já existente vinculado com sucesso.' });
  }

  if (!nome) throw new ValidationError('Nome é obrigatório para cadastrar um novo professor.');

  const senhaTemporariaTexto = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemporariaTexto, 10);
  const senhaTemporariaExpiraEm = calcularExpiracaoSenhaTemporaria();

  const criado = await prisma.$transaction(async (tx) => {
    const pessoa = await tx.pessoa.create({
      data: {
        nome, email: emailNormalizado, perfil: 'PROFESSOR', status: 'ATIVO',
        senhaHash, senhaTemporaria: true, senhaTemporariaExpiraEm,
        createdBy: String(actor.id),
      },
    });
    await tx.pessoaEvento.create({ data: { pessoaId: pessoa.id, tipo: 'CRIACAO', autorId: actor.id } });
    for (const escolaId of escolaIds) {
      await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: pessoa.id, status: 'ATIVO', dataInicio: new Date(), createdBy: String(actor.id) } });
      await tx.pessoaEvento.create({ data: { pessoaId: pessoa.id, tipo: 'VINCULO_CRIADO', autorId: actor.id, detalhe: `Escola #${escolaId}` } });
    }
    return pessoa;
  });

  res.status(201).json({ pessoa: formatarPessoa(criado), senhaTemporaria: senhaTemporariaTexto });
});

async function buscarProfessorNoEscopo(actor: Actor, id: number) {
  const professor = await prisma.pessoa.findUnique({ where: { id } });
  if (!professor || professor.perfil !== 'PROFESSOR') throw new NotFoundError('Professor não encontrado.');

  const permitidas = await escolasPermitidas(actor);
  if (permitidas) {
    const vinculado = await prisma.vinculoEscolar.count({ where: { pessoaId: id, status: 'ATIVO', escolaId: { in: permitidas } } });
    if (vinculado === 0) throw new ForbiddenError('Este professor não está vinculado a uma escola sob sua administração.');
  }
  return professor;
}

// Gera uma nova senha temporária (reset administrativo) — invalida a anterior e qualquer sessão
// aberta na hora (authVersion), e coloca a conta de volta em "pendente de primeiro acesso".
pessoasRouter.post('/professores/:id/resetar-senha', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const id = Number(req.params.id);
  await buscarProfessorNoEscopo(actor, id);

  const senhaTemporariaTexto = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemporariaTexto, 10);
  const senhaTemporariaExpiraEm = calcularExpiracaoSenhaTemporaria();

  await prisma.$transaction(async (tx) => {
    await tx.pessoa.update({
      where: { id },
      data: { senhaHash, senhaTemporaria: true, senhaTemporariaExpiraEm, authVersion: { increment: 1 } },
    });
    await tx.pessoaEvento.create({ data: { pessoaId: id, tipo: 'RESET_SENHA', autorId: actor.id } });
  });

  res.json({ senhaTemporaria: senhaTemporariaTexto });
});

async function mudarStatusProfessor(actor: Actor, id: number, status: 'ATIVO' | 'INATIVO') {
  await buscarProfessorNoEscopo(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.pessoa.update({
      where: { id },
      // Inativar precisa derrubar sessões abertas na hora; reativar não precisa revogar nada.
      data: status === 'INATIVO' ? { status, authVersion: { increment: 1 } } : { status },
    });
    await tx.pessoaEvento.create({ data: { pessoaId: id, tipo: status === 'INATIVO' ? 'INATIVACAO' : 'REATIVACAO', autorId: actor.id } });
  });
}

pessoasRouter.post('/professores/:id/inativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  await mudarStatusProfessor(actor, Number(req.params.id), 'INATIVO');
  res.json({ ok: true });
});

pessoasRouter.post('/professores/:id/reativar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  await mudarStatusProfessor(actor, Number(req.params.id), 'ATIVO');
  res.json({ ok: true });
});

// Lista de Auxiliares pra popular o seletor de "vincular Auxiliar à turma" (ver
// auxiliarTurma.ts). Sem escopo por escola: diferente de Professor, Auxiliar não tem hoje um
// conceito de VinculoEscolar (não foi pedido nesta etapa) — quem limita o alcance de verdade é o
// escopo da TURMA (escolasPermitidas), checado em auxiliarTurma.ts na hora de criar o vínculo.
pessoasRouter.get('/auxiliares', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const auxiliares = await prisma.pessoa.findMany({
    where: { perfil: 'AUXILIAR', status: 'ATIVO' },
    orderBy: { nome: 'asc' },
  });
  res.json(auxiliares.map(formatarPessoa));
});

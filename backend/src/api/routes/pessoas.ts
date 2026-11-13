import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { calcularExpiracaoSenhaTemporaria, gerarSenhaTemporaria } from '../../domain/senhaTemporaria.js';
import bcrypt from 'bcryptjs';
import { lerComposicao, MAX_CARGOS_ATIVOS } from '../../domain/cargos.js';
import { criarCargo, lerData, travarVinculosEscolares, validarComposicaoNoBanco, diaDeHojeSp } from '../../lib/cargos.js';

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

// Gestor, Diretora e Auxiliar são administrados só pela Secretaria (mais restrito que Professor,
// que também aceita Diretora) — decisão explícita do usuário.
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Apenas a Secretaria pode gerenciar esta conta.');
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
    include: {
      vinculosEscolares: { where: { status: 'ATIVO' }, include: { escola: true } },
      cargos: { where: { status: 'ATIVO' }, select: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1, select: { composicao: true } } } },
    },
  });

  res.json(professores.map((professor) => {
    const escolas = professor.vinculosEscolares
      .filter((vinculo) => !permitidas || permitidas.includes(vinculo.escolaId))
      .map((vinculo) => ({ id: vinculo.escola.id, nome: vinculo.escola.nome }));
    // Escolas com vínculo ativo que não estão em nenhum cargo ativo (versão atual) — alerta de cadastro
    // incompleto para a Secretaria resolver (decisão do usuário, 12/11/2026). Só leitura; vazio quando o
    // professor não tem cargo (aí o alerta é "Sem cargo").
    const nosCargos = new Set(professor.cargos.flatMap((c) => lerComposicao(c.versoes[0]?.composicao).map((p) => p.escolaId)));
    return {
      ...formatarPessoa(professor),
      senhaTemporaria: professor.senhaTemporaria,
      // Professor sem cargo ativo = cadastro incompleto para a Secretaria corrigir (decisão de 12/11/2026).
      cargosAtivos: professor.cargos.length,
      escolas,
      escolasForaDosCargos: professor.cargos.length === 0 ? [] : escolas.filter((e) => !nosCargos.has(e.id)),
    };
  }));
});

const criarOuVincularProfessorSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido.'),
  escolaIds: z.array(z.number().int().positive()).default([]),
  // Cargos (12/11/2026, só Secretaria): 1 ou 2, cada um com início e composição escolas → disciplinas.
  // As escolas dos cargos viram vínculos escolares automaticamente.
  cargos: z.array(z.object({ dataInicio: z.string(), composicao: z.unknown() })).max(MAX_CARGOS_ATIVOS, `No máximo ${MAX_CARGOS_ATIVOS} cargos.`).optional(),
});

async function validarEscopoEscolas(actor: Actor, escolaIds: number[]) {
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && escolaIds.some((id) => !permitidas.includes(id))) {
    throw new ForbiddenError('Você só pode vincular professores às escolas sob sua administração.');
  }
}

// Cria um professor novo, sempre com cargo(s) — nunca duas contas para o mesmo e-mail.
// MUDOU em 13/11/2026 (decisão do usuário): a escola do Professor vem do cargo, então SÓ a Secretaria
// cadastra Professor, sempre com cargo; as escolas são as dos cargos (`escolaIds` do corpo é ignorado).
// A Diretora não cadastra nem vincula Professor. Professor já existente: muda pelos cargos dele.
pessoasRouter.post('/professores', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria cadastra professor (a escola do professor vem do cargo).');
  const { nome, email, cargos } = criarOuVincularProfessorSchema.parse(req.body);
  const emailNormalizado = email.toLowerCase();

  // Cargos validados antes de tudo; as escolas deles entram nos vínculos.
  const cargosValidos = cargos?.length
    ? await Promise.all(cargos.map(async (c) => ({ dataInicio: lerData(c.dataInicio, 'Início do cargo'), composicao: await validarComposicaoNoBanco(prisma, c.composicao) })))
    : [];
  const escolaIds = [...new Set(cargosValidos.flatMap((c) => c.composicao.map((i) => i.escolaId)))];
  if (escolaIds.length === 0) throw new ValidationError('Cadastre ao menos um cargo, com a escola.');

  await validarEscopoEscolas(actor, escolaIds);

  const existente = await prisma.pessoa.findUnique({ where: { email: emailNormalizado } });

  if (existente && existente.perfil !== 'PROFESSOR') {
    throw new ConflictError('Já existe uma conta com este e-mail, de outro perfil. Procure a Secretaria.');
  }
  if (existente) {
    throw new ConflictError('Já existe um Professor com este e-mail. Para mudar as escolas ou os cargos dele, use "Cargos e escolas" na lista de professores.');
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
      await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: pessoa.id, status: 'ATIVO', dataInicio: diaDeHojeSp(), createdBy: String(actor.id) } });
      await tx.pessoaEvento.create({ data: { pessoaId: pessoa.id, tipo: 'VINCULO_CRIADO', autorId: actor.id, detalhe: `Escola #${escolaId}` } });
    }
    // Os vínculos acima já cobrem as escolas dos cargos; criarCargo só reusa (nunca duplica).
    for (const cargo of cargosValidos) await criarCargo(tx, pessoa.id, cargo, actor.id);
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

// Lista de Auxiliares pra popular o seletor de "vincular Auxiliar à turma/escola" (ver
// auxiliarTurma.ts e vinculosEscolares.ts). Escopada igual a /professores desde que o cadastro
// real de Auxiliar existe (POST /auxiliares abaixo sempre cria com pelo menos 1 VinculoEscolar,
// então não há mais o caso de "auxiliar sem vínculo nenhum" que justificava a lista irrestrita
// de antes).
pessoasRouter.get('/auxiliares', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretariaOuDiretora(actor);
  const permitidas = await escolasPermitidas(actor);

  const auxiliares = await prisma.pessoa.findMany({
    where: {
      perfil: 'AUXILIAR',
      status: 'ATIVO',
      ...(permitidas ? { vinculosEscolares: { some: { status: 'ATIVO', escolaId: { in: permitidas } } } } : {}),
    },
    orderBy: { nome: 'asc' },
    include: { vinculosEscolares: { where: { status: 'ATIVO' }, include: { escola: true } } },
  });

  res.json(auxiliares.map((auxiliar) => ({
    ...formatarPessoa(auxiliar),
    escolas: auxiliar.vinculosEscolares
      .filter((vinculo) => !permitidas || permitidas.includes(vinculo.escolaId))
      .map((vinculo) => ({ id: vinculo.escola.id, nome: vinculo.escola.nome })),
  })));
});

// --- Gestor / Diretora / Auxiliar: CRUD real (sempre Secretaria) -----------------------------
//
// Mesmo padrão de criar-ou-vincular já usado em /professores (ver linhas acima), só parametrizado
// por perfil — nunca chama nem altera o código do Professor. Diretora tem uma regra adicional:
// é limitada a exatamente 1 escola (cargo real, uma diretora por escola), então uma Diretora já
// existente que já tenha uma escola ativa não pode ser vinculada a uma segunda — vira conflito,
// nunca um vínculo extra silencioso.
type PerfilGerenciavel = 'GESTOR' | 'DIRETORA' | 'AUXILIAR';

async function criarOuVincularPessoaComLogin(
  actor: Actor,
  perfil: PerfilGerenciavel,
  { nome, email, escolaIds }: { nome?: string; email: string; escolaIds: number[] },
) {
  const emailNormalizado = email.toLowerCase();
  const existente = await prisma.pessoa.findUnique({ where: { email: emailNormalizado } });

  if (existente && existente.perfil !== perfil) {
    throw new ConflictError('Já existe uma conta com este e-mail, de outro perfil. Procure a Secretaria.');
  }

  if (existente) {
    const vinculosAtivos = await prisma.vinculoEscolar.findMany({
      where: { pessoaId: existente.id, status: 'ATIVO' },
      select: { escolaId: true },
    });
    if (perfil === 'DIRETORA' && vinculosAtivos.length > 0) {
      throw new ConflictError('Esta diretora já administra outra escola. Encerre o vínculo atual antes de vincular a uma nova.');
    }
    const jaVinculadas = new Set(vinculosAtivos.map((v) => v.escolaId));
    const novasEscolas = escolaIds.filter((id) => !jaVinculadas.has(id));

    if (novasEscolas.length === 0) {
      return { status: 200 as const, body: { pessoa: formatarPessoa(existente), senhaTemporaria: null, mensagem: 'Esta pessoa já está vinculada a todas as escolas selecionadas.' } };
    }

    await prisma.$transaction(async (tx) => {
      for (const escolaId of novasEscolas) {
        await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: existente.id, status: 'ATIVO', dataInicio: diaDeHojeSp(), createdBy: String(actor.id) } });
        await tx.pessoaEvento.create({ data: { pessoaId: existente.id, tipo: 'VINCULO_CRIADO', autorId: actor.id, detalhe: `Escola #${escolaId}` } });
      }
    });

    return { status: 201 as const, body: { pessoa: formatarPessoa(existente), senhaTemporaria: null, mensagem: 'Pessoa já existente vinculada com sucesso.' } };
  }

  if (!nome) throw new ValidationError('Nome é obrigatório para cadastrar uma nova pessoa.');

  const senhaTemporariaTexto = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemporariaTexto, 10);
  const senhaTemporariaExpiraEm = calcularExpiracaoSenhaTemporaria();

  const criado = await prisma.$transaction(async (tx) => {
    const pessoa = await tx.pessoa.create({
      data: {
        nome, email: emailNormalizado, perfil, status: 'ATIVO',
        senhaHash, senhaTemporaria: true, senhaTemporariaExpiraEm,
        createdBy: String(actor.id),
      },
    });
    await tx.pessoaEvento.create({ data: { pessoaId: pessoa.id, tipo: 'CRIACAO', autorId: actor.id } });
    for (const escolaId of escolaIds) {
      await tx.vinculoEscolar.create({ data: { escolaId, pessoaId: pessoa.id, status: 'ATIVO', dataInicio: diaDeHojeSp(), createdBy: String(actor.id) } });
      await tx.pessoaEvento.create({ data: { pessoaId: pessoa.id, tipo: 'VINCULO_CRIADO', autorId: actor.id, detalhe: `Escola #${escolaId}` } });
    }
    return pessoa;
  });

  return { status: 201 as const, body: { pessoa: formatarPessoa(criado), senhaTemporaria: senhaTemporariaTexto } };
}

async function buscarPessoaNoEscopo(perfil: PerfilGerenciavel, id: number) {
  const pessoa = await prisma.pessoa.findUnique({ where: { id } });
  if (!pessoa || pessoa.perfil !== perfil) throw new NotFoundError('Pessoa não encontrada.');
  return pessoa;
}

async function mudarStatusPessoa(actor: Actor, perfil: PerfilGerenciavel, id: number, status: 'ATIVO' | 'INATIVO') {
  await buscarPessoaNoEscopo(perfil, id);
  await prisma.$transaction(async (tx) => {
    await tx.pessoa.update({
      where: { id },
      data: status === 'INATIVO' ? { status, authVersion: { increment: 1 } } : { status },
    });
    await tx.pessoaEvento.create({ data: { pessoaId: id, tipo: status === 'INATIVO' ? 'INATIVACAO' : 'REATIVACAO', autorId: actor.id } });
  });
}

async function resetarSenhaPessoa(actor: Actor, perfil: PerfilGerenciavel, id: number) {
  await buscarPessoaNoEscopo(perfil, id);
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

  return senhaTemporariaTexto;
}

function listarPessoasPorPerfil(perfil: PerfilGerenciavel) {
  return async (_req: Request, res: Response) => {
    const actor = res.locals.pessoa as Actor;
    exigirSecretaria(actor);
    const permitidas = await escolasPermitidas(actor);

    const pessoas = await prisma.pessoa.findMany({
      where: { perfil },
      orderBy: { nome: 'asc' },
      include: { vinculosEscolares: { where: { status: 'ATIVO' }, include: { escola: true } } },
    });

    res.json(pessoas.map((pessoa) => ({
      ...formatarPessoa(pessoa),
      senhaTemporaria: pessoa.senhaTemporaria,
      escolas: pessoa.vinculosEscolares
        .filter((vinculo) => !permitidas || permitidas.includes(vinculo.escolaId))
        .map((vinculo) => ({ id: vinculo.escola.id, nome: vinculo.escola.nome })),
    })));
  };
}

const criarOuVincularGestorSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido.'),
  escolaIds: z.array(z.number().int().positive()).min(1, 'Selecione ao menos uma escola.'),
});

const criarOuVincularDiretoraSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido.'),
  escolaIds: z.array(z.number().int().positive()).length(1, 'Diretora deve ter exatamente uma escola.'),
});

const criarOuVincularAuxiliarSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().email('E-mail inválido.'),
  escolaIds: z.array(z.number().int().positive()).min(1, 'Selecione ao menos uma escola.'),
});

pessoasRouter.get('/gestores', listarPessoasPorPerfil('GESTOR'));
pessoasRouter.get('/diretoras', listarPessoasPorPerfil('DIRETORA'));

pessoasRouter.post('/gestores', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = criarOuVincularGestorSchema.parse(req.body);
  const resultado = await criarOuVincularPessoaComLogin(actor, 'GESTOR', dados);
  res.status(resultado.status).json(resultado.body);
});

pessoasRouter.post('/diretoras', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = criarOuVincularDiretoraSchema.parse(req.body);
  const resultado = await criarOuVincularPessoaComLogin(actor, 'DIRETORA', dados);
  res.status(resultado.status).json(resultado.body);
});

pessoasRouter.post('/auxiliares', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = criarOuVincularAuxiliarSchema.parse(req.body);
  const resultado = await criarOuVincularPessoaComLogin(actor, 'AUXILIAR', dados);
  res.status(resultado.status).json(resultado.body);
});

for (const [caminho, perfil] of [['gestores', 'GESTOR'], ['diretoras', 'DIRETORA'], ['auxiliares', 'AUXILIAR']] as const) {
  pessoasRouter.post(`/${caminho}/:id/resetar-senha`, async (req, res) => {
    const actor = res.locals.pessoa as Actor;
    exigirSecretaria(actor);
    const senhaTemporaria = await resetarSenhaPessoa(actor, perfil, Number(req.params.id));
    res.json({ senhaTemporaria });
  });

  pessoasRouter.post(`/${caminho}/:id/inativar`, async (req, res) => {
    const actor = res.locals.pessoa as Actor;
    exigirSecretaria(actor);
    await mudarStatusPessoa(actor, perfil, Number(req.params.id), 'INATIVO');
    res.json({ ok: true });
  });

  pessoasRouter.post(`/${caminho}/:id/reativar`, async (req, res) => {
    const actor = res.locals.pessoa as Actor;
    exigirSecretaria(actor);
    await mudarStatusPessoa(actor, perfil, Number(req.params.id), 'ATIVO');
    res.json({ ok: true });
  });
}

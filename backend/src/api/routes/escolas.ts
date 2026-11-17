import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { marcarDesativacao } from '../../lib/desativacao.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { anoDaEtapa } from '../../domain/turma.js';

export const escolasRouter = Router();
export const niveisInfantilRouter = Router();

type Actor = { id: number; perfil: string };

// Escola é configuração de rede — só a Secretaria administra (criar/editar/inativar/reativar).
// Gestor, Diretora, Professor e Auxiliar nunca escrevem aqui, mesmo que o botão esteja escondido
// no frontend (a garantia real é sempre no backend). Leitura (GET) continua sem restrição.
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar Escolas.');
  }
}

// Estrutura da escola (16/11/2026): etapas oferecidas, anos do Fundamental e níveis da Educação Infantil. Campos
// OPCIONAIS no envio: quem manda só o nome (cliente antigo) não mexe na estrutura. Etapas vazias = "não informadas".
const salvarEscolaSchema = z.object({
  nome: z.string().trim().min(1, 'Nome da escola é obrigatório.'),
  etapasOferecidas: z.array(z.enum(['EDUCACAO_INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II'])).optional(),
  anosFundamental: z.array(z.number().int().min(1).max(9)).optional(),
  niveisInfantilIds: z.array(z.number().int()).optional(),
});
type SalvarEscola = z.infer<typeof salvarEscolaSchema>;

const incluirNiveis = { niveisInfantil: { select: { nivelId: true } } } as const;
const formatar = (e: Prisma.EscolaGetPayload<{ include: typeof incluirNiveis }>) => {
  const { niveisInfantil, ...resto } = e;
  return { ...resto, niveisInfantilIds: niveisInfantil.map((n) => n.nivelId).sort((a, b) => a - b) };
};

// Normaliza e valida a estrutura enviada. Devolve null quando o envio não trouxe estrutura (não mexer).
async function lerEstrutura(dados: SalvarEscola) {
  if (dados.etapasOferecidas === undefined) return null;
  const etapas = [...new Set(dados.etapasOferecidas)];
  const anos = [...new Set(dados.anosFundamental ?? [])].sort((a, b) => a - b);
  const niveis = [...new Set(dados.niveisInfantilIds ?? [])];
  for (const ano of anos) {
    if (!etapas.includes(anoDaEtapa(ano))) throw new ValidationError(`O ${ano}º ano é do ${anoDaEtapa(ano) === 'FUNDAMENTAL_I' ? 'Fundamental I' : 'Fundamental II'}, que não está marcado.`);
  }
  if (etapas.includes('FUNDAMENTAL_I') && !anos.some((a) => a <= 5)) throw new ValidationError('Marque ao menos um ano do Fundamental I.');
  if (etapas.includes('FUNDAMENTAL_II') && !anos.some((a) => a >= 6)) throw new ValidationError('Marque ao menos um ano do Fundamental II.');
  if (niveis.length && !etapas.includes('EDUCACAO_INFANTIL')) throw new ValidationError('Níveis da Educação Infantil só com a etapa marcada.');
  if (niveis.length) {
    const existentes = await prisma.nivelInfantilLocal.findMany({ where: { id: { in: niveis } } });
    if (existentes.length !== niveis.length) throw new ValidationError('Nível da Educação Infantil não encontrado.');
  }
  return { etapas, anos, niveis };
}

// Não deixa a escola deixar de oferecer o que ainda tem turma ATIVA (aviso antes de qualquer saída em cascata;
// nada é desativado sozinho). Só vale quando a estrutura está informada.
async function exigirTurmasCobertas(escolaId: number, estrutura: NonNullable<Awaited<ReturnType<typeof lerEstrutura>>>) {
  if (estrutura.etapas.length === 0) return;
  // Integral (17/11/2026) não depende das etapas/anos que a escola oferece.
  const turmas = await prisma.turma.findMany({ where: { escolaId, status: 'ATIVA', tipo: 'REGULAR' }, select: { nome: true, etapa: true, anoSerie: true, nivelLocalId: true } });
  const fora = turmas.filter((t) => (t.etapa === 'FUNDAMENTAL'
    ? !(t.anoSerie && estrutura.anos.includes(t.anoSerie))
    : !estrutura.etapas.includes('EDUCACAO_INFANTIL') || (t.nivelLocalId !== null && !estrutura.niveis.includes(t.nivelLocalId))));
  if (fora.length) {
    const nomes = fora.map((t) => t.nome).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    throw new ConflictError(`Desative antes as turmas: ${nomes.slice(0, 8).join(', ')}${nomes.length > 8 ? '…' : ''}.`);
  }
}

escolasRouter.get('/', async (_req, res) => {
  const escolas = await prisma.escola.findMany({ orderBy: { nome: 'asc' }, include: incluirNiveis });
  res.json(escolas.map(formatar));
});

escolasRouter.get('/:id', async (req, res) => {
  const escola = await prisma.escola.findUnique({ where: { id: Number(req.params.id) }, include: incluirNiveis });
  if (!escola) throw new NotFoundError('Escola não encontrada.');
  res.json(formatar(escola));
});

escolasRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = salvarEscolaSchema.parse(req.body);
  const estrutura = await lerEstrutura(dados);
  const escola = await prisma.escola.create({
    data: {
      nome: dados.nome,
      ...(estrutura ? {
        etapasOferecidas: estrutura.etapas, anosFundamental: estrutura.anos,
        niveisInfantil: { create: estrutura.niveis.map((nivelId) => ({ nivelId })) },
      } : {}),
    },
    include: incluirNiveis,
  });
  res.status(201).json(formatar(escola));
});

escolasRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = salvarEscolaSchema.parse(req.body);
  const id = Number(req.params.id);

  const existente = await prisma.escola.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Escola não encontrada.');
  const estrutura = await lerEstrutura(dados);
  if (estrutura) await exigirTurmasCobertas(id, estrutura);

  const escola = await prisma.$transaction(async (tx) => {
    if (estrutura) {
      await tx.escolaNivelInfantil.deleteMany({ where: { escolaId: id, nivelId: { notIn: estrutura.niveis } } });
      const ja = (await tx.escolaNivelInfantil.findMany({ where: { escolaId: id }, select: { nivelId: true } })).map((n) => n.nivelId);
      const novos = estrutura.niveis.filter((n) => !ja.includes(n));
      if (novos.length) await tx.escolaNivelInfantil.createMany({ data: novos.map((nivelId) => ({ escolaId: id, nivelId })) });
    }
    return tx.escola.update({
      where: { id },
      data: {
        nome: dados.nome,
        ...(estrutura ? { etapasOferecidas: estrutura.etapas, anosFundamental: estrutura.anos } : {}),
        updatedAt: new Date(), version: { increment: 1 },
      },
      include: incluirNiveis,
    });
  });
  res.json(formatar(escola));
});

escolasRouter.post('/:id/inativar', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  res.json(await mudarStatus(req.params.id, 'INATIVA', (res.locals.pessoa as Actor).id));
});

escolasRouter.post('/:id/reativar', async (req, res) => {
  exigirSecretaria(res.locals.pessoa as Actor);
  res.json(await mudarStatus(req.params.id, 'ATIVA', (res.locals.pessoa as Actor).id));
});

async function mudarStatus(idParam: string, status: 'ATIVA' | 'INATIVA', autorId: number) {
  const id = Number(idParam);
  const existente = await prisma.escola.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Escola não encontrada.');
  if (Number.isNaN(id)) throw new ValidationError('Id inválido.');

  return formatar(await prisma.escola.update({
    where: { id },
    data: { status, ...marcarDesativacao(status === 'ATIVA', autorId), updatedAt: new Date(), version: { increment: 1 } },
    include: incluirNiveis,
  }));
}

// Catálogo de níveis da Educação Infantil (leitura para todos os perfis logados).
niveisInfantilRouter.get('/', async (_req, res) => {
  const niveis = await prisma.nivelInfantilLocal.findMany({ orderBy: { ordem: 'asc' } });
  res.json(niveis.map((n) => ({ id: n.id, nome: n.nome, faixa: n.faixa, ordem: n.ordem, status: n.status === 'ATIVA' ? 'ativa' : 'inativa' })));
});

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, ValidationError } from '../../domain/errors.js';
import { lerComposicao } from '../../domain/cargos.js';

// Desativados e encerrados por área (decisão do usuário, 15/11/2026): lista paginada, mais recentes
// primeiro, SÓ para a Secretaria. Nada aqui altera dados: as ações (Reativar etc.) usam as rotas de
// sempre de cada área. Ciclos do 1/3 e Aplicações PDI não passam por aqui: a tela já recebe a lista
// completa (com reaberturas) e pagina no navegador.
export const desativadosRouter = Router();

type Actor = { id: number; perfil: string };

export type LinhaDesativada = {
  tipo: string;
  id: number;
  titulo: string;
  detalhe: string;
  // manual = desativado/inativado/arquivado por alguém; encerrado = vínculo/cargo encerrado.
  motivo: 'manual' | 'encerrado';
  data: string | null;
  por: string | null;
  // Campos para as ações da tela (ids de referência).
  ref?: Record<string, number | string | null>;
};

const PERFIS = ['PROFESSOR', 'DIRETORA', 'GESTOR', 'AUXILIAR', 'SECRETARIA', 'SUPORTE_SISTEMA'] as const;
const ROTULO_PERFIL: Record<string, string> = { PROFESSOR: 'Professor(a)', DIRETORA: 'Diretora', GESTOR: 'Gestor(a)', AUXILIAR: 'Auxiliar', SECRETARIA: 'Secretaria', SUPORTE_SISTEMA: 'Suporte' };

type Pagina = { skip: number; take: number };
type Resultado = { total: number; linhas: Omit<LinhaDesativada, 'por'>[]; autores: (string | null)[] };

// Cada tipo: contagem + página, ordenada pela data de desativação/encerramento (mais recente primeiro).
const TIPOS: Record<string, (p: Pagina, q: Record<string, unknown>) => Promise<Resultado>> = {
  escolas: async ({ skip, take }) => {
    const where = { status: 'INATIVA' as const };
    const [total, rows] = await Promise.all([prisma.escola.count({ where }), prisma.escola.findMany({ where, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'escolas', id: r.id, titulo: r.nome, detalhe: '', motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
  turmas: async ({ skip, take }) => {
    const where = { status: 'INATIVA' as const };
    const [total, rows] = await Promise.all([prisma.turma.count({ where }), prisma.turma.findMany({ where, include: { escola: { select: { nome: true } } }, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'turmas', id: r.id, titulo: r.nome, detalhe: `${r.escola.nome} · ${r.anoLetivo}`, motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
  pessoas: async ({ skip, take }, q) => {
    const perfil = typeof q.perfil === 'string' && (PERFIS as readonly string[]).includes(q.perfil) ? (q.perfil as (typeof PERFIS)[number]) : undefined;
    const where = { status: 'INATIVO' as const, perfil: perfil ?? { in: ['PROFESSOR', 'DIRETORA', 'GESTOR', 'AUXILIAR'] as (typeof PERFIS)[number][] } };
    const [total, rows] = await Promise.all([prisma.pessoa.count({ where }), prisma.pessoa.findMany({ where, select: { id: true, nome: true, email: true, perfil: true, desativadoEm: true, desativadoPor: true }, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'pessoas', id: r.id, titulo: r.nome, detalhe: `${ROTULO_PERFIL[r.perfil] ?? r.perfil} · ${r.email}`, motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null, ref: { perfil: r.perfil } })) };
  },
  cargos: async ({ skip, take }) => {
    const where = { status: 'ENCERRADO' as const };
    const [total, rows] = await Promise.all([
      prisma.cargoProfessor.count({ where }),
      prisma.cargoProfessor.findMany({ where, include: { professor: { select: { nome: true } }, versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } }, orderBy: [{ encerradoEm: { sort: 'desc', nulls: 'last' } }, { dataFim: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take }),
    ]);
    const escolaIds = [...new Set(rows.flatMap((r) => lerComposicao(r.versoes[0]?.composicao).map((i) => i.escolaId)))];
    const escolas = new Map((escolaIds.length ? await prisma.escola.findMany({ where: { id: { in: escolaIds } }, select: { id: true, nome: true } }) : []).map((e) => [e.id, e.nome]));
    return { total, autores: rows.map((r) => r.encerradoPor), linhas: rows.map((r) => ({ tipo: 'cargos', id: r.id, titulo: r.professor.nome, detalhe: `Cargo encerrado · ${lerComposicao(r.versoes[0]?.composicao).map((i) => escolas.get(i.escolaId) ?? `Escola #${i.escolaId}`).join(', ')}`, motivo: 'encerrado', data: (r.encerradoEm ?? r.dataFim)?.toISOString() ?? null, ref: { professorId: r.professorId } })) };
  },
  'vinculos-escolares': async ({ skip, take }) => {
    const where = { status: 'ENCERRADO' as const };
    const [total, rows] = await Promise.all([prisma.vinculoEscolar.count({ where }), prisma.vinculoEscolar.findMany({ where, include: { pessoa: { select: { nome: true, perfil: true } }, escola: { select: { nome: true } } }, orderBy: [{ dataFim: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map(() => null), linhas: rows.map((r) => ({ tipo: 'vinculos-escolares', id: r.id, titulo: r.pessoa.nome, detalhe: `${ROTULO_PERFIL[r.pessoa.perfil] ?? r.pessoa.perfil} · saiu da ${r.escola.nome}`, motivo: 'encerrado', data: r.dataFim?.toISOString() ?? null, ref: { perfil: r.pessoa.perfil } })) };
  },
  'turmas-professor': async ({ skip, take }) => {
    const where = { status: 'ENCERRADO' as const };
    const [total, rows] = await Promise.all([prisma.professorTurmaDisciplina.count({ where }), prisma.professorTurmaDisciplina.findMany({ where, include: { professor: { select: { nome: true } }, turma: { select: { nome: true, escola: { select: { nome: true } } } }, disciplina: { select: { nome: true } } }, orderBy: [{ dataFim: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map(() => null), linhas: rows.map((r) => ({ tipo: 'turmas-professor', id: r.id, titulo: r.professor.nome, detalhe: `${r.disciplina.nome} · ${r.turma.nome} · ${r.turma.escola.nome}`, motivo: 'encerrado', data: r.dataFim?.toISOString() ?? null })) };
  },
  'turmas-auxiliar': async ({ skip, take }) => {
    const where = { status: 'ENCERRADO' as const };
    const [total, rows] = await Promise.all([prisma.auxiliarTurma.count({ where }), prisma.auxiliarTurma.findMany({ where, include: { auxiliar: { select: { nome: true } }, turma: { select: { nome: true, escola: { select: { nome: true } } } } }, orderBy: [{ dataFim: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map(() => null), linhas: rows.map((r) => ({ tipo: 'turmas-auxiliar', id: r.id, titulo: r.auxiliar.nome, detalhe: `Auxiliar · ${r.turma.nome} · ${r.turma.escola.nome}`, motivo: 'encerrado', data: r.dataFim?.toISOString() ?? null })) };
  },
  atuacoes: async ({ skip, take }) => {
    const where = { status: 'INATIVA' as const };
    const [total, rows] = await Promise.all([prisma.atuacaoPedagogica.count({ where }), prisma.atuacaoPedagogica.findMany({ where, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'atuacoes', id: r.id, titulo: r.nome, detalhe: 'Atuação pedagógica', motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
  'perguntas-padrao': async ({ skip, take }) => {
    const where = { status: 'INATIVA' as const };
    const [total, rows] = await Promise.all([prisma.perguntaPdiPadrao.count({ where }), prisma.perguntaPdiPadrao.findMany({ where, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'perguntas-padrao', id: r.id, titulo: r.texto, detalhe: [r.secao, r.subsecao].filter(Boolean).join(' › '), motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
  'alunos-pdi': async ({ skip, take }) => {
    const where = { status: 'ARQUIVADO' as const };
    const [total, rows] = await Promise.all([prisma.alunoPdi.count({ where }), prisma.alunoPdi.findMany({ where, include: { turma: { select: { nome: true, escola: { select: { nome: true } } } } }, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'alunos-pdi', id: r.id, titulo: r.nome, detalhe: `${r.turma.nome} · ${r.turma.escola.nome}`, motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
  'modelos-pdi': async ({ skip, take }) => {
    const where = { status: 'INATIVA' as const };
    const [total, rows] = await Promise.all([prisma.modeloPdi.count({ where }), prisma.modeloPdi.findMany({ where, include: { disciplina: { select: { nome: true } } }, orderBy: [{ desativadoEm: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip, take })]);
    return { total, autores: rows.map((r) => r.desativadoPor), linhas: rows.map((r) => ({ tipo: 'modelos-pdi', id: r.id, titulo: r.nome, detalhe: r.disciplina.nome, motivo: 'manual', data: r.desativadoEm?.toISOString() ?? null })) };
  },
};

desativadosRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria vê os desativados.');
  const tipo = String(req.query.tipo ?? '');
  const carregar = TIPOS[tipo];
  if (!carregar) throw new ValidationError(`Tipo inválido. Use: ${Object.keys(TIPOS).join(', ')}.`);
  const porPagina = Math.min(Math.max(Number(req.query.porPagina) || 20, 1), 100);
  const pagina = Math.max(Math.floor(Number(req.query.pagina) || 1), 1);
  const { total, linhas, autores } = await carregar({ skip: (pagina - 1) * porPagina, take: porPagina }, req.query as Record<string, unknown>);

  // Nome de quem desativou (o campo guarda o id da pessoa; registros antigos podem não ter).
  const ids = [...new Set(autores.map((a) => Number(a)).filter((n) => Number.isInteger(n) && n > 0))];
  const nomes = new Map((ids.length ? await prisma.pessoa.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : []).map((p) => [p.id, p.nome]));
  const itens: LinhaDesativada[] = linhas.map((l, i) => ({ ...l, por: nomes.get(Number(autores[i])) ?? null }));
  res.json({ itens, total, pagina, porPagina });
});

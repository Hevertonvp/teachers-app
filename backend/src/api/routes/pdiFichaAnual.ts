import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { escolasPermitidas, type Actor } from './pessoas.js';

export const pdiFichaAnualRouter = Router();

// Resolve o aluno + confirma vínculo ATUAL válido de quem consulta (seção 18/19 do pedido: o
// histórico pertence ao aluno, mas autorização é sempre pelo vínculo de HOJE, nunca histórico —
// sair da escola A pra B nunca deixa a escola A com acesso só porque participou do passado).
// Para PROFESSOR, devolve também quais disciplinas ele enxerga hoje (só as que tem
// ProfessorTurmaDisciplina ATIVO na turma ATUAL do aluno) — ele só vê, dentro da Ficha Anual, as
// próprias disciplinas; as de outros professores ficam ocultas pra ele, nunca um 403 na tela
// inteira. `null` = sem filtro de disciplina (demais perfis veem tudo do aluno).
async function resolverAcessoAluno(actor: Actor, alunoId: number) {
  const aluno = await prisma.alunoPdi.findUnique({ where: { id: alunoId }, include: { turma: { include: { escola: true } } } });
  if (!aluno) throw new NotFoundError('Aluno não encontrado.');
  const escolaId = aluno.turma.escolaId;

  if (actor.perfil === 'SECRETARIA') return { aluno, disciplinasPermitidas: null as number[] | null };

  if (actor.perfil === 'GESTOR' || actor.perfil === 'DIRETORA') {
    const permitidas = await escolasPermitidas(actor);
    if (permitidas && !permitidas.includes(escolaId)) throw new ForbiddenError('Você não tem acesso a este aluno.');
    return { aluno, disciplinasPermitidas: null as number[] | null };
  }

  if (actor.perfil === 'PROFESSOR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculoEscolar) throw new ForbiddenError('Você não tem acesso a este aluno.');
    const ptds = await prisma.professorTurmaDisciplina.findMany({
      where: { professorId: actor.id, turmaId: aluno.turmaId, status: 'ATIVO' },
      select: { disciplinaId: true },
    });
    if (ptds.length === 0) throw new ForbiddenError('Você não tem vínculo pedagógico atual com este aluno.');
    return { aluno, disciplinasPermitidas: ptds.map((p) => p.disciplinaId) };
  }

  if (actor.perfil === 'AUXILIAR') {
    const vinculoEscolar = await prisma.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    const vinculoTurma = vinculoEscolar && await prisma.auxiliarTurma.findFirst({ where: { auxiliarId: actor.id, turmaId: aluno.turmaId, status: 'ATIVO' } });
    if (!vinculoTurma) throw new ForbiddenError('Você não tem acesso a este aluno.');
    return { aluno, disciplinasPermitidas: null as number[] | null };
  }

  throw new ForbiddenError('Você não tem permissão para consultar a Ficha Anual PDI.');
}

// Mesmo idioma de obterOuCriarFichaReal (pdiFichas.ts): nunca usa upsert (o branch de update
// poderia por engano sobrescrever abertaEm/status já existentes); se outra requisição venceu a
// corrida (P2002 na unique alunoId+ano), busca a vencedora fora da transação abortada.
async function obterOuCriarFichaAnual(alunoId: number, ano: number, actorId: number) {
  const chave = { alunoId_ano: { alunoId, ano } };
  const existente = await prisma.fichaAnualPdi.findUnique({ where: chave });
  if (existente) return existente;

  try {
    return await prisma.fichaAnualPdi.create({ data: { alunoId, ano, createdBy: String(actorId) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const vencedora = await prisma.fichaAnualPdi.findUnique({ where: chave });
      if (vencedora) return vencedora;
    }
    throw err;
  }
}

// --- Configuração mínima de fechamento automático do ciclo (seção 16/decisão 3 do plano) -------
// Registradas ANTES de /:alunoId/:ano — senão o Express casaria "ciclo" como se fosse um alunoId
// (mesmo cuidado já usado em pdiAlunos.ts::GET /meus-alunos).

pdiFichaAnualRouter.get('/ciclo/:ano', async (req, res) => {
  const ano = Number(req.params.ano);
  const ciclo = await prisma.cicloAnualPdi.findUnique({ where: { ano } });
  res.json(ciclo ?? { ano, dataEncerramento: null });
});

const cicloSchema = z.object({ dataEncerramento: z.coerce.date().nullable() });

pdiFichaAnualRouter.put('/ciclo/:ano', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode configurar o encerramento do ciclo anual.');
  const ano = Number(req.params.ano);
  const { dataEncerramento } = cicloSchema.parse(req.body);
  const ciclo = await prisma.cicloAnualPdi.upsert({
    where: { ano },
    create: { ano, dataEncerramento, createdBy: String(actor.id) },
    update: { dataEncerramento, updatedBy: String(actor.id) },
  });
  res.json(ciclo);
});

// --- Ficha Anual PDI ------------------------------------------------------------------------

// Consolidado leve (seção 43/56 do pedido): nunca devolve respostas completas, só o suficiente
// pra montar a tela (status por Ficha, indicador discreto de correção). Abrir um período/
// disciplina continua usando a rota de Ficha já existente (GET /api/pdi-fichas/:aplicacaoId/
// :alunoId/:disciplinaId), reaproveitada sem mudar nada nela.
pdiFichaAnualRouter.get('/:alunoId/:ano', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const alunoId = Number(req.params.alunoId);
  const ano = Number(req.params.ano);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ValidationError('Ano inválido.');

  const { aluno, disciplinasPermitidas } = await resolverAcessoAluno(actor, alunoId);

  const [fichaAnual, todasFichas, movimentacoes] = await Promise.all([
    obterOuCriarFichaAnual(alunoId, ano, actor.id),
    prisma.fichaPdi.findMany({
      where: { alunoId },
      include: { aplicacao: { select: { id: true, nome: true, dataInicio: true, dataFim: true } } },
    }),
    prisma.movimentacaoAlunoPdi.findMany({
      where: { alunoId },
      include: { turma: { include: { escola: true } } },
      orderBy: { dataInicio: 'asc' },
    }),
  ]);

  // "ano" de uma Ficha é sempre o ano civil de AplicacaoPdi.dataInicio — nunca persistido,
  // decisão sinalizada no plano. Volume por aluno é sempre pequeno (poucas dezenas de Fichas no
  // máximo), filtrar em memória é mais simples e seguro que EXTRACT(YEAR) via SQL cru.
  const fichasDoAno = todasFichas.filter((f) => f.aplicacao.dataInicio.getUTCFullYear() === ano);
  const fichasVisiveis = disciplinasPermitidas
    ? fichasDoAno.filter((f) => disciplinasPermitidas.includes(f.disciplinaId))
    : fichasDoAno;

  const fichaIds = fichasVisiveis.map((f) => f.id);
  const correcoesPorFicha = new Map<number, { status: string; prazoAte: Date }>();
  if (fichaIds.length > 0) {
    const correcoes = await prisma.correcaoFichaPdi.findMany({
      where: { fichaId: { in: fichaIds } },
      orderBy: { criadaEm: 'desc' },
      select: { fichaId: true, status: true, prazoAte: true },
    });
    // Só a mais recente de cada Ficha importa pro indicador discreto do anual (seção 32/42) — o
    // histórico completo de devoluções só aparece ao abrir a Ficha em Correções > PDI.
    for (const c of correcoes) if (!correcoesPorFicha.has(c.fichaId)) correcoesPorFicha.set(c.fichaId, c);
  }

  const agora = new Date();
  type ItemFicha = { fichaId: number; disciplinaId: number; disciplinaNome: string; escolaNome: string; turmaNome: string; professorNome: string; status: string; concluidaEm: Date | null; indicadorCorrecao: 'nenhuma' | 'solicitada' | 'resolvida' };
  const periodos = new Map<number, { aplicacaoId: number; aplicacaoNome: string | null; dataInicio: Date; dataFim: Date; fichas: ItemFicha[] }>();
  for (const f of fichasVisiveis) {
    if (!periodos.has(f.aplicacaoId)) {
      periodos.set(f.aplicacaoId, { aplicacaoId: f.aplicacaoId, aplicacaoNome: f.aplicacao.nome, dataInicio: f.aplicacao.dataInicio, dataFim: f.aplicacao.dataFim, fichas: [] });
    }
    const correcao = correcoesPorFicha.get(f.id);
    let indicadorCorrecao: ItemFicha['indicadorCorrecao'] = 'nenhuma';
    if (correcao) indicadorCorrecao = correcao.status === 'RESOLVIDA' ? 'resolvida' : 'solicitada';
    void agora; // "EXPIRADA" não muda o indicador discreto do anual — só o detalhe em Correções precisa dessa distinção fina.
    periodos.get(f.aplicacaoId)!.fichas.push({
      fichaId: f.id,
      disciplinaId: f.disciplinaId,
      disciplinaNome: f.disciplinaNomeSnapshot,
      escolaNome: f.escolaNomeSnapshot,
      turmaNome: f.turmaNomeSnapshot,
      professorNome: f.professorNomeSnapshot,
      status: f.status,
      concluidaEm: f.concluidaEm,
      indicadorCorrecao,
    });
  }

  res.json({
    fichaAnual: {
      id: fichaAnual.id,
      alunoId: fichaAnual.alunoId,
      ano: fichaAnual.ano,
      status: fichaAnual.status,
      abertaEm: fichaAnual.abertaEm,
      fechadaEm: fichaAnual.fechadaEm,
      fechadaPor: fichaAnual.fechadaPor,
    },
    aluno: { id: aluno.id, nome: aluno.nome, status: aluno.status },
    periodos: [...periodos.values()].sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime()),
    movimentacoes: movimentacoes.map((m) => ({
      turmaId: m.turmaId,
      turmaNome: m.turma.nome,
      escolaNome: m.turma.escola.nome,
      dataInicio: m.dataInicio,
      dataFim: m.dataFim,
    })),
  });
});

// Fechamento manual — só Secretaria (decisão sinalizada no plano: mesmo padrão de quem já
// administra Aplicações/Modelos PDI hoje). Idempotente: fechar uma já FECHADA só devolve o
// estado atual, nunca erro.
pdiFichaAnualRouter.post('/:alunoId/:ano/fechar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'SECRETARIA') throw new ForbiddenError('Somente a Secretaria pode fechar a Ficha Anual PDI.');
  const alunoId = Number(req.params.alunoId);
  const ano = Number(req.params.ano);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ValidationError('Ano inválido.');

  const fichaAnual = await obterOuCriarFichaAnual(alunoId, ano, actor.id);
  if (fichaAnual.status === 'FECHADA') return res.json(fichaAnual);

  const atualizada = await prisma.fichaAnualPdi.update({
    where: { id: fichaAnual.id },
    data: { status: 'FECHADA', fechadaEm: new Date(), fechadaPor: String(actor.id) },
  });
  res.json(atualizada);
});

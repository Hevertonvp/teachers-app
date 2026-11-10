import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ConflitoVersaoError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { formatarCorrecao, idsDePessoasDasCorrecoes, OBSERVACAO_MAX, PRAZO_CORRECAO_MS, situacaoCorrecao, textoMensagemCorrecao, type SituacaoCorrecao } from '../../domain/correcoes.js';
import { criarMensagensDeCorrecao, nomesDePessoas, notificarMensagensDeCorrecao } from '../../lib/mensagemCorrecao.js';
import { prepararValoresResposta } from '../../domain/habilidadesCurriculares.js';
import { montarRespostaCompleta } from './pdiFichas.js';
import { perguntasPadraoDaFicha, resolverOuCriarBloco } from '../../domain/pdiBlocoPadrao.js';
import { exigirSemConflitoDeVersao } from '../../domain/offlineConflito.js';

export const correcoesPdiRouter = Router();

type Actor = { id: number; perfil: string };

// Único perfil autorizado em toda a área — nunca Diretora/Gestor/Professor/Auxiliar (seção 38 do
// pedido: nenhum outro perfil lista a fila global, corrige diretamente ou devolve Ficha).
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode acessar Correções > PDI.');
  }
}

const formatarItemLista = (f: {
  id: number; alunoNomeSnapshot: string; escolaNomeSnapshot: string; turmaNomeSnapshot: string;
  disciplinaNomeSnapshot: string; professorNomeSnapshot: string; aplicacaoId: number;
  concluidaEm: Date | null; alunoId: number; disciplinaId: number; turmaId: number; escolaId: number;
  professorResponsavelId: number;
}, indicadorCorrecao: 'nenhuma' | SituacaoCorrecao) => ({
  id: f.id,
  alunoId: f.alunoId,
  alunoNome: f.alunoNomeSnapshot,
  escolaId: f.escolaId,
  escolaNome: f.escolaNomeSnapshot,
  turmaId: f.turmaId,
  turmaNome: f.turmaNomeSnapshot,
  disciplinaId: f.disciplinaId,
  disciplinaNome: f.disciplinaNomeSnapshot,
  professorResponsavelId: f.professorResponsavelId,
  professorNome: f.professorNomeSnapshot,
  aplicacaoId: f.aplicacaoId,
  concluidaEm: f.concluidaEm,
  indicadorCorrecao,
});

// Lista as 10 últimas Fichas CONCLUIDA por padrão, mais recentes primeiro (seção 24 do pedido),
// com filtros/busca. Só Fichas concluídas entram aqui — nunca a Aplicação inteira, nunca aluno
// sem Ficha concluída (seção 23).
const listaQuerySchema = z.object({
  escolaId: z.coerce.number().int().optional(),
  professorId: z.coerce.number().int().optional(),
  turmaId: z.coerce.number().int().optional(),
  disciplinaId: z.coerce.number().int().optional(),
  aplicacaoId: z.coerce.number().int().optional(),
  alunoId: z.coerce.number().int().optional(),
  busca: z.string().trim().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
  correcao: z.enum(['em_andamento']).optional(),
});

correcoesPdiRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const filtros = listaQuerySchema.parse(req.query);

  const where: Prisma.FichaPdiWhereInput = {
    status: 'CONCLUIDA',
    ...(filtros.escolaId ? { escolaId: filtros.escolaId } : {}),
    ...(filtros.professorId ? { professorResponsavelId: filtros.professorId } : {}),
    ...(filtros.turmaId ? { turmaId: filtros.turmaId } : {}),
    ...(filtros.disciplinaId ? { disciplinaId: filtros.disciplinaId } : {}),
    ...(filtros.aplicacaoId ? { aplicacaoId: filtros.aplicacaoId } : {}),
    ...(filtros.alunoId ? { alunoId: filtros.alunoId } : {}),
    ...(filtros.busca ? {
      OR: [
        { alunoNomeSnapshot: { contains: filtros.busca, mode: 'insensitive' } },
        { professorNomeSnapshot: { contains: filtros.busca, mode: 'insensitive' } },
      ],
    } : {}),
  };

  // Filtro "só com correção em andamento" (fluxo de correções, 10/11/2026): Fichas cuja correção mais
  // recente (da própria Ficha ou do bloco comum dela) aguarda o professor ou a conferência.
  if (filtros.correcao === 'em_andamento') {
    const pendente = { OR: [{ status: 'ABERTA' as const }, { status: 'RESOLVIDA' as const, conferencia: null }] };
    const [daFicha, doBloco] = await Promise.all([
      prisma.correcaoFichaPdi.findMany({ where: pendente, select: { fichaId: true } }),
      prisma.correcaoBlocoPadraoPdi.findMany({ where: pendente, select: { bloco: { select: { aplicacaoId: true, alunoId: true, turmaId: true } } } }),
    ]);
    where.AND = [{ OR: [{ id: { in: daFicha.map((c) => c.fichaId) } }, ...doBloco.map((c) => ({ aplicacaoId: c.bloco.aplicacaoId, alunoId: c.bloco.alunoId, turmaId: c.bloco.turmaId }))] }];
  }

  const fichas = await prisma.fichaPdi.findMany({
    where,
    orderBy: { concluidaEm: 'desc' },
    take: filtros.limite ?? (filtros.correcao ? 100 : 10),
  });
  if (fichas.length === 0) return res.json([]);

  // Indicador discreto: a correção mais recente da Ficha; sem ela, a do bloco comum do aluno.
  const [correcoes, correcoesBloco] = await Promise.all([
    prisma.correcaoFichaPdi.findMany({ where: { fichaId: { in: fichas.map((f) => f.id) } }, orderBy: { criadaEm: 'desc' }, select: { fichaId: true, status: true, prazoAte: true, conferencia: true } }),
    prisma.correcaoBlocoPadraoPdi.findMany({
      where: { bloco: { OR: fichas.map((f) => ({ aplicacaoId: f.aplicacaoId, alunoId: f.alunoId, turmaId: f.turmaId })) } },
      orderBy: { criadaEm: 'desc' }, select: { status: true, prazoAte: true, conferencia: true, bloco: { select: { aplicacaoId: true, alunoId: true, turmaId: true } } },
    }),
  ]);
  const indicadorPorFicha = new Map<number, SituacaoCorrecao>();
  for (const c of correcoes) if (!indicadorPorFicha.has(c.fichaId)) indicadorPorFicha.set(c.fichaId, situacaoCorrecao(c));
  const indicadorPorBloco = new Map<string, SituacaoCorrecao>();
  for (const c of correcoesBloco) { const k = `${c.bloco.aplicacaoId}-${c.bloco.alunoId}-${c.bloco.turmaId}`; if (!indicadorPorBloco.has(k)) indicadorPorBloco.set(k, situacaoCorrecao(c)); }

  res.json(fichas.map((f) => formatarItemLista(f, indicadorPorFicha.get(f.id) ?? indicadorPorBloco.get(`${f.aplicacaoId}-${f.alunoId}-${f.turmaId}`) ?? 'nenhuma')));
});

// Detalhe completo (seção 17/26 do pedido): contexto + perguntas/respostas (reaproveitando
// montarRespostaCompleta, já existente) + histórico de correções e de alterações de valor.
correcoesPdiRouter.get('/:fichaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Esta Ficha ainda não foi concluída — não aparece em Correções.');

  // Professor responsável ATUAL (seção 26: "diferente, quando aplicável") — resolvido ao vivo via
  // PTD ATIVO, nunca o snapshot. null quando ninguém está vinculado agora (vínculo encerrado).
  const [respostaCompleta, ptdAtual, correcoes, historico] = await Promise.all([
    montarRespostaCompleta(ficha),
    prisma.professorTurmaDisciplina.findFirst({
      where: { turmaId: ficha.turmaId, disciplinaId: ficha.disciplinaId, status: 'ATIVO' },
      include: { professor: { select: { id: true, nome: true } } },
    }),
    prisma.correcaoFichaPdi.findMany({ where: { fichaId }, orderBy: { criadaEm: 'desc' } }),
    prisma.historicoCorrecaoResposta.findMany({ where: { fichaId }, orderBy: { alteradoEm: 'desc' } }),
  ]);

  // Correções/histórico do BLOCO comum (perguntas padrão), separados dos de cima de propósito
  // (seção 17 do pedido: "não misture os dois fluxos") — só busca se esta Ficha de fato tem bloco
  // (blocoId não-nulo em respostaCompleta.blocoPadrao, já resolvido por montarRespostaCompleta).
  const blocoId = respostaCompleta.blocoPadrao?.blocoId ?? null;
  const [correcoesBloco, historicoBloco] = blocoId
    ? await Promise.all([
        prisma.correcaoBlocoPadraoPdi.findMany({ where: { blocoId }, orderBy: { criadaEm: 'desc' } }),
        prisma.historicoCorrecaoRespostaPadrao.findMany({ where: { blocoId }, orderBy: { alteradoEm: 'desc' } }),
      ])
    : [[], []];

  const nomes = await nomesDePessoas(prisma, idsDePessoasDasCorrecoes([...correcoes, ...correcoesBloco]));
  const formatar = (c: Parameters<typeof formatarCorrecao>[0]) => formatarCorrecao(c, nomes);

  res.json({
    ...respostaCompleta,
    professorResponsavelAtual: ptdAtual ? { id: ptdAtual.professor.id, nome: ptdAtual.professor.nome } : null,
    correcoes: correcoes.map(formatar),
    historico: historico.map((h) => ({
      id: h.id,
      aplicacaoPerguntaId: h.aplicacaoPerguntaId,
      valorAnterior: h.valorAnterior,
      valorNovo: h.valorNovo,
      alteradoPor: h.alteradoPor,
      alteradoEm: h.alteradoEm,
      origem: h.origem,
    })),
    correcoesBloco: correcoesBloco.map(formatar),
    historicoBloco: historicoBloco.map((h) => ({
      id: h.id,
      aplicacaoPerguntaPadraoId: h.aplicacaoPerguntaPadraoId,
      valorAnterior: h.valorAnterior,
      valorNovo: h.valorNovo,
      alteradoPor: h.alteradoPor,
      alteradoEm: h.alteradoEm,
      origem: h.origem,
    })),
  });
});

const respostaItemSchema = z.object({
  aplicacaoPerguntaId: z.number().int(),
  valor: z.object({
    resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    complementarTexto: z.string().nullish(),
    habilidadeIds: z.array(z.number().int()).nullish(), // só HABILIDADE_CRMG
    todas: z.boolean().nullish(),
  }),
});
const corrigirSchema = z.object({
  respostas: z.array(respostaItemSchema).min(1),
  // Mesma infra offline de pdiFichas.ts — updatedAt da Ficha que a Secretaria tinha quando
  // começou a corrigir (ver domain/offlineConflito.ts).
  baseUpdatedAt: z.string(),
});

// Corrigir diretamente (seção 18A/20/29 do pedido): funciona mesmo com a Aplicação encerrada —
// NUNCA chama a checagem de vigência usada pelo Professor (exigirEditavelAgora), nunca reabre
// Aplicação nem ReaberturaPdi. Toda alteração grava HistoricoCorrecaoResposta com o valor real
// anterior (lido antes do upsert) — "não sobrescrever sem histórico" (seção 30).
correcoesPdiRouter.put('/:fichaId/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { respostas, baseUpdatedAt } = corrigirSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir diretamente uma Ficha já concluída.');
  await exigirSemConflitoDeVersao(
    baseUpdatedAt,
    ficha.updatedAt ?? ficha.createdAt,
    () => montarRespostaCompleta(ficha),
    'Esta Ficha foi alterada enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.',
  );

  const perguntasDoModelo = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId } });
  const perguntasPorId = new Map(perguntasDoModelo.map((p) => [p.id, p]));
  if (respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem a esta Ficha.');
  }
  const respostasAplicaveis = await prepararValoresResposta(
    prisma,
    respostas.filter((item) => perguntasPorId.get(item.aplicacaoPerguntaId)!.tipoResposta !== 'ORIENTACAO'),
    new Map(perguntasDoModelo.map((p) => [p.id, p.tipoResposta])),
    ficha.disciplinaId,
  );
  if (respostasAplicaveis.length === 0) throw new ValidationError('Nenhuma resposta válida para corrigir.');

  const valoresAntes = new Map((await prisma.respostaPdi.findMany({
    where: { fichaId, aplicacaoPerguntaId: { in: respostasAplicaveis.map((item) => item.aplicacaoPerguntaId) } },
    select: { aplicacaoPerguntaId: true, valor: true },
  })).map((r) => [r.aplicacaoPerguntaId, r.valor]));

  await prisma.$transaction([
    ...respostasAplicaveis.map((item) => prisma.respostaPdi.upsert({
      where: { fichaId_aplicacaoPerguntaId: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId } },
      create: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: item.valor, createdBy: String(actor.id) },
      update: { valor: item.valor, updatedBy: String(actor.id) },
    })),
    prisma.fichaPdi.update({ where: { id: fichaId }, data: { updatedBy: String(actor.id) } }),
    prisma.historicoCorrecaoResposta.createMany({
      data: respostasAplicaveis.map((item) => ({
        fichaId,
        aplicacaoPerguntaId: item.aplicacaoPerguntaId,
        valorAnterior: valoresAntes.get(item.aplicacaoPerguntaId) ?? Prisma.JsonNull,
        valorNovo: item.valor,
        alteradoPor: String(actor.id),
        origem: 'SECRETARIA_DIRETA' as const,
      })),
    }),
  ]);

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

const respostaPadraoItemSchema = z.object({
  aplicacaoPerguntaPadraoId: z.number().int(),
  valor: z.object({
    resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    complementarTexto: z.string().nullish(),
  }),
});
const corrigirPadraoSchema = z.object({
  respostas: z.array(respostaPadraoItemSchema).min(1),
  // Mesmo optimistic lock real do bloco (ver PUT /api/pdi-fichas/:id/respostas-padrao) — a
  // Secretaria também pode ter aberto a correção offline/em outra aba.
  version: z.number().int(),
});

// Corrigir diretamente o BLOCO COMUM (seção 14/15 do pedido) — diferente da correção específica
// acima: a mudança vale pra TODAS as disciplinas daquele agrupamento de uma vez, nunca uma
// correção duplicada por disciplina. Mesma garantia de histórico (valor real anterior, lido antes
// do upsert) da correção específica, só gravando em HistoricoCorrecaoRespostaPadrao/blocoId.
correcoesPdiRouter.put('/:fichaId/respostas-padrao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { respostas, version } = corrigirPadraoSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível corrigir diretamente uma Ficha já concluída.');

  const perguntasPadrao = await perguntasPadraoDaFicha(prisma, ficha.aplicacaoModeloId);
  const perguntasPorId = new Map(perguntasPadrao.map((p) => [p.id, p]));
  if (perguntasPadrao.length === 0 || respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaPadraoId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem ao bloco padrão desta Ficha.');
  }

  const bloco = await resolverOuCriarBloco(
    { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: ficha.turmaId, professorId: ficha.professorResponsavelId },
    actor.id,
  );
  if (bloco.version !== version) {
    throw new ConflitoVersaoError(
      'Este bloco de respostas padrão foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.',
      await montarRespostaCompleta(ficha),
    );
  }

  const valoresAntes = new Map((await prisma.respostaPadraoPdi.findMany({
    where: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: { in: respostas.map((item) => item.aplicacaoPerguntaPadraoId) } },
    select: { aplicacaoPerguntaPadraoId: true, valor: true },
  })).map((r) => [r.aplicacaoPerguntaPadraoId, r.valor]));

  await prisma.$transaction([
    ...respostas.map((item) => prisma.respostaPadraoPdi.upsert({
      where: { blocoId_aplicacaoPerguntaPadraoId: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId } },
      create: { blocoId: bloco.id, aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId, valor: item.valor, createdBy: String(actor.id) },
      update: { valor: item.valor, updatedBy: String(actor.id) },
    })),
    // Comparar-e-incrementar (nunca update incondicional) — mesma garantia do caminho do
    // Professor: se outra escrita já passou entre a checagem acima e aqui, o Prisma não lança
    // (updateMany nunca falha por "0 linhas"), mas como ninguém mais lê esse retorno aqui, o
    // pior caso é só o version ficar 1 a mais do que deveria — aceitável, nunca sobrescreve
    // dado de resposta (isso já foi garantido pela checagem de `version` acima, fora da transação).
    prisma.blocoRespostasPadraoPdi.updateMany({ where: { id: bloco.id, version }, data: { version: { increment: 1 }, updatedBy: String(actor.id) } }),
    prisma.historicoCorrecaoRespostaPadrao.createMany({
      data: respostas.map((item) => ({
        blocoId: bloco.id,
        aplicacaoPerguntaPadraoId: item.aplicacaoPerguntaPadraoId,
        valorAnterior: valoresAntes.get(item.aplicacaoPerguntaPadraoId) ?? Prisma.JsonNull,
        valorNovo: item.valor,
        alteradoPor: String(actor.id),
        origem: 'SECRETARIA_DIRETA' as const,
      })),
    }),
  ]);

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

// ===== Devolver ao Professor, conferir e aceitar (fluxo de correções, 10/11/2026) ==============
// Secretaria escreve "o que precisa ser corrigido" (obrigatório) -> prazo FIXO de 3 dias corridos a
// partir de agora -> mensagem automática na caixa do Professor responsável ATUAL (PTD ATIVO da
// turma+disciplina da Ficha), com o botão "Abrir formulário". Reabre só ESTA Ficha (ou só o bloco),
// nunca a Aplicação (ReaberturaPdi não é tocada). Devoluções ilimitadas, uma de cada vez: enquanto
// houver uma ABERTA, outra é recusada (o duplo clique cai aqui também, porque a Ficha é travada).
// Se a anterior estava "recebida" (enviada e ainda não conferida), ela fica registrada como DEVOLVIDA.
const devolverSchema = z.object({ observacao: z.string().trim().min(1, 'Escreva o que precisa ser corrigido.').max(OBSERVACAO_MAX, `Use no máximo ${OBSERVACAO_MAX} caracteres.`) });

// Quem recebe = quem CONSEGUE corrigir pela regra de acesso que já existe (pdiFichas.ts,
// resolverContexto/exigirAcessoOperacional): o professor com vínculo ATIVO na turma ATUAL do aluno,
// nesta disciplina, e só se o aluno ainda está na escola da Aplicação. Aluno transferido de escola
// (ou sem professor agora): ninguém consegue editar aquela Ficha, então a devolução é recusada com
// explicação, em vez de mandar mensagem para quem não teria como corrigir.
async function professoresQuePodemCorrigir(db: Prisma.TransactionClient, ficha: { alunoId: number; aplicacaoId: number; disciplinaId: number }): Promise<{ ids: number[]; turmaAtualId: number | null; motivo: string | null }> {
  const [aluno, aplicacao] = await Promise.all([
    db.alunoPdi.findUnique({ where: { id: ficha.alunoId }, include: { turma: true } }),
    db.aplicacaoPdi.findUniqueOrThrow({ where: { id: ficha.aplicacaoId }, select: { escolaId: true } }),
  ]);
  if (!aluno || aluno.status !== 'ATIVO') return { ids: [], turmaAtualId: null, motivo: 'O aluno não está ativo. Use a correção direta.' };
  if (aluno.turma.escolaId !== aplicacao.escolaId) return { ids: [], turmaAtualId: null, motivo: 'O aluno foi transferido para outra escola; nenhum professor consegue editar esta Ficha agora. Use a correção direta.' };
  const ptds = await db.professorTurmaDisciplina.findMany({
    where: { turmaId: aluno.turmaId, disciplinaId: ficha.disciplinaId, status: 'ATIVO', professor: { status: 'ATIVO', perfil: 'PROFESSOR', vinculosEscolares: { some: { escolaId: aplicacao.escolaId, status: 'ATIVO' } } } },
    select: { professorId: true },
  });
  const ids = [...new Set(ptds.map((p) => p.professorId))];
  return { ids, turmaAtualId: aluno.turmaId, motivo: ids.length ? null : 'Nenhum professor tem vínculo ativo com a turma atual do aluno nesta disciplina. Use a correção direta.' };
}

async function identificacaoDaFicha(db: Prisma.TransactionClient, ficha: { aplicacaoId: number; alunoNomeSnapshot: string; escolaNomeSnapshot: string; turmaNomeSnapshot: string }) {
  const aplicacao = await db.aplicacaoPdi.findUniqueOrThrow({ where: { id: ficha.aplicacaoId }, select: { nome: true, trimestre: true } });
  const nomeAplicacao = aplicacao.nome || (aplicacao.trimestre ? `${aplicacao.trimestre}º trimestre` : `Aplicação ${ficha.aplicacaoId}`);
  return { nomeAplicacao, linhas: [`Aluno(a): ${ficha.alunoNomeSnapshot}`, `Escola: ${ficha.escolaNomeSnapshot}`, `Turma: ${ficha.turmaNomeSnapshot}`] };
}

correcoesPdiRouter.post('/:fichaId/devolver', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { observacao } = devolverSchema.parse(req.body);

  const { correcao, criadas } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM fichas_pdi WHERE id = ${fichaId} FOR UPDATE`;
    const ficha = await tx.fichaPdi.findUnique({ where: { id: fichaId } });
    if (!ficha) throw new NotFoundError('Ficha não encontrada.');
    if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível devolver uma Ficha já concluída.');
    const aberta = await tx.correcaoFichaPdi.findFirst({ where: { fichaId, status: 'ABERTA' } });
    if (aberta) throw new ConflictError('Esta Ficha já tem uma correção aguardando o professor. Aguarde o envio para devolver de novo.');
    const quem = await professoresQuePodemCorrigir(tx, ficha);
    if (quem.motivo) throw new ValidationError(quem.motivo);
    const destinatarios = quem.ids;

    const agora = new Date();
    await tx.correcaoFichaPdi.updateMany({ where: { fichaId, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'DEVOLVIDA', conferidaEm: agora, conferidaPor: String(actor.id) } });
    const nova = await tx.correcaoFichaPdi.create({ data: { fichaId, observacao, criadaPor: String(actor.id), criadaEm: agora, prazoAte: new Date(agora.getTime() + PRAZO_CORRECAO_MS) } });
    const id = await identificacaoDaFicha(tx, ficha);
    const msgs = await criarMensagensDeCorrecao(tx, {
      remetenteId: actor.id, destinatarioIds: destinatarios, escolasPreferidas: [ficha.escolaId],
      assunto: `Correção pendente · PDI · ${ficha.alunoNomeSnapshot} · ${ficha.disciplinaNomeSnapshot}`,
      conteudo: textoMensagemCorrecao({ formulario: `PDI (${id.nomeAplicacao})`, identificacao: [...id.linhas, `Disciplina: ${ficha.disciplinaNomeSnapshot}`], observacao, prazoAte: nova.prazoAte }),
      link: `/pdi/aluno/${ficha.aplicacaoId}/${ficha.alunoId}`,
    });
    return { correcao: nova, criadas: msgs };
  });
  await notificarMensagensDeCorrecao(prisma, actor.id, criadas, `correcao-pdi-${correcao.id}`);
  res.status(201).json({ ...formatarCorrecao(correcao), mensagensEnviadas: criadas.length });
});

// Devolver o BLOCO COMUM — uma devolução vale para todas as disciplinas daquele agrupamento; o
// Professor corrige uma vez e envia por "Enviar correção" em qualquer Ficha do aluno.
correcoesPdiRouter.post('/:fichaId/devolver-padrao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const { observacao } = devolverSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  if (ficha.status !== 'CONCLUIDA') throw new ValidationError('Só é possível devolver uma Ficha já concluída.');
  const perguntasPadrao = await perguntasPadraoDaFicha(prisma, ficha.aplicacaoModeloId);
  if (perguntasPadrao.length === 0) throw new ValidationError('Esta Ficha não tem nenhuma pergunta padrão compartilhada para devolver.');
  const bloco = await resolverOuCriarBloco(
    { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: ficha.turmaId, professorId: ficha.professorResponsavelId },
    actor.id,
  );

  const { correcao, criadas } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM blocos_respostas_padrao_pdi WHERE id = ${bloco.id} FOR UPDATE`;
    const aberta = await tx.correcaoBlocoPadraoPdi.findFirst({ where: { blocoId: bloco.id, status: 'ABERTA' } });
    if (aberta) throw new ConflictError('As perguntas comuns deste aluno já têm uma correção aguardando o professor. Aguarde o envio para devolver de novo.');
    // Quem recebe: o dono do bloco, desde que ele ainda seja quem edita este bloco hoje (o professor
    // edita o bloco da turma ATUAL do aluno — ver identidadeBlocoAtual). Senão, ninguém conseguiria
    // corrigir este bloco: a devolução é recusada com explicação.
    const quem = await professoresQuePodemCorrigir(tx, ficha);
    if (quem.motivo) throw new ValidationError(quem.motivo);
    if (quem.turmaAtualId !== bloco.turmaId || !quem.ids.includes(bloco.professorId)) {
      throw new ValidationError('Estas perguntas comuns são de outra turma ou de outro professor (o aluno mudou de turma ou o professor foi trocado); ninguém consegue editá-las agora. Use a correção direta.');
    }
    const destinatarios = [bloco.professorId];

    const agora = new Date();
    await tx.correcaoBlocoPadraoPdi.updateMany({ where: { blocoId: bloco.id, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'DEVOLVIDA', conferidaEm: agora, conferidaPor: String(actor.id) } });
    const nova = await tx.correcaoBlocoPadraoPdi.create({ data: { blocoId: bloco.id, observacao, criadaPor: String(actor.id), criadaEm: agora, prazoAte: new Date(agora.getTime() + PRAZO_CORRECAO_MS) } });
    const id = await identificacaoDaFicha(tx, ficha);
    const msgs = await criarMensagensDeCorrecao(tx, {
      remetenteId: actor.id, destinatarioIds: destinatarios, escolasPreferidas: [ficha.escolaId],
      assunto: `Correção pendente · PDI · ${ficha.alunoNomeSnapshot} · perguntas comuns`,
      conteudo: textoMensagemCorrecao({ formulario: `PDI (${id.nomeAplicacao})`, identificacao: [...id.linhas, 'Parte: perguntas comuns (valem para todas as disciplinas)'], observacao, prazoAte: nova.prazoAte }),
      link: `/pdi/aluno/${ficha.aplicacaoId}/${ficha.alunoId}`,
    });
    return { correcao: nova, criadas: msgs };
  });
  await notificarMensagensDeCorrecao(prisma, actor.id, criadas, `correcao-pdi-bloco-${correcao.id}`);
  res.status(201).json({ ...formatarCorrecao(correcao), mensagensEnviadas: criadas.length });
});

// Aceitar a correção recebida: só a mais recente, só se o Professor já enviou e ninguém conferiu
// ainda. O updateMany com a condição completa não aceita duas vezes.
correcoesPdiRouter.post('/:fichaId/aceitar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const ultima = await prisma.correcaoFichaPdi.findFirst({ where: { fichaId }, orderBy: { criadaEm: 'desc' } });
  if (!ultima || ultima.status !== 'RESOLVIDA' || ultima.conferencia) throw new ConflictError('Não há correção recebida aguardando conferência nesta Ficha.');
  await prisma.correcaoFichaPdi.updateMany({ where: { id: ultima.id, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'ACEITA', conferidaEm: new Date(), conferidaPor: String(actor.id) } });
  res.json(formatarCorrecao(await prisma.correcaoFichaPdi.findUniqueOrThrow({ where: { id: ultima.id } })));
});

correcoesPdiRouter.post('/:fichaId/aceitar-padrao', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const fichaId = Number(req.params.fichaId);
  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');
  const blocoId = (await montarRespostaCompleta(ficha)).blocoPadrao?.blocoId ?? null;
  const ultima = blocoId ? await prisma.correcaoBlocoPadraoPdi.findFirst({ where: { blocoId }, orderBy: { criadaEm: 'desc' } }) : null;
  if (!ultima || ultima.status !== 'RESOLVIDA' || ultima.conferencia) throw new ConflictError('Não há correção recebida das perguntas comuns aguardando conferência.');
  await prisma.correcaoBlocoPadraoPdi.updateMany({ where: { id: ultima.id, status: 'RESOLVIDA', conferencia: null }, data: { conferencia: 'ACEITA', conferidaEm: new Date(), conferidaPor: String(actor.id) } });
  res.json(formatarCorrecao(await prisma.correcaoBlocoPadraoPdi.findUniqueOrThrow({ where: { id: ultima.id } })));
});

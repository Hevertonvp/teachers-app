import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { hojeComoData, statusVigencia, vigenciasSobrepoem } from '../../domain/pdiAplicacoes.js';
import { escolasPermitidas } from './pessoas.js';

export const pdiAplicacoesRouter = Router();

type Actor = { id: number; perfil: string };

// Gerenciar (criar/editar/reabrir) é exclusivo da Secretaria — Gestor e Diretora só consultam
// dentro do próprio escopo de escola, Professor/Auxiliar nem isso ainda (seção 1 do pedido,
// corrigindo a lacuna que a tarefa anterior de Modelos deixou aberta para Aplicações).
function exigirSecretaria(actor: Actor) {
  if (actor.perfil !== 'SECRETARIA') {
    throw new ForbiddenError('Somente a Secretaria pode gerenciar Aplicações PDI.');
  }
}

// Auxiliar entrou aqui quando a tela dele passou a consultar PDI por disciplina no perfil do
// aluno (ver AuxiliarAlunoPerfilPage.jsx) — escopado do mesmo jeito que Gestor/Diretora
// (VinculoEscolar ATIVO com a escola, via escolasPermitidas), já que Aplicação é por ESCOLA
// inteira, não por turma; a restrição mais estreita por turma já acontece na Ficha em si.
function exigirLeituraAplicacoes(actor: Actor) {
  if (!['SECRETARIA', 'GESTOR', 'DIRETORA', 'AUXILIAR'].includes(actor.perfil)) {
    throw new ForbiddenError('Você não tem permissão para consultar Aplicações PDI.');
  }
}

const formatarAplicacao = (aplicacao: {
  id: number; escolaId: number; nome: string | null; dataInicio: Date; dataFim: Date;
  escola?: { nome: string };
  modelos?: { modeloIdOriginal: number; nome: string; disciplinaId: number; disciplinaNome: string }[];
  reaberturas?: { dataInicio: Date; dataFim: Date }[];
}) => ({
  id: aplicacao.id,
  escolaId: aplicacao.escolaId,
  escolaNome: aplicacao.escola?.nome ?? null,
  nome: aplicacao.nome,
  dataInicio: aplicacao.dataInicio,
  dataFim: aplicacao.dataFim,
  status: statusVigencia(aplicacao),
  // Versão leve (sem perguntas) do snapshot — só o suficiente para a UI mostrar quais
  // disciplinas esta Aplicação cobre (badges). O snapshot completo com perguntas mora em
  // GET /:id/snapshot, carregado à parte quando realmente precisar (seção 34 do pedido).
  ...(aplicacao.modelos ? {
    modelos: aplicacao.modelos.map((m) => ({ modeloId: m.modeloIdOriginal, nome: m.nome, disciplinaId: m.disciplinaId, disciplinaNome: m.disciplinaNome })),
  } : {}),
  // Calculado na hora a partir de ReaberturaPdi — nunca um status persistido novo (a tela principal
  // de Aplicações usa isto pra saber se uma Aplicação ENCERRADA deve voltar a aparecer na visão
  // operacional por ter uma janela de reabertura ativa agora; ver FormularioPdiPage.jsx).
  ...(aplicacao.reaberturas ? {
    reaberturaAtivaAgora: aplicacao.reaberturas.some((r) => {
      const hoje = hojeComoData();
      return hoje >= r.dataInicio && hoje <= r.dataFim;
    }),
  } : {}),
});

const formatarReabertura = (r: {
  id: number; aplicacaoId: number; dataInicio: Date; dataFim: Date;
  solicitadoPorTipo: string; motivo: string | null; createdAt: Date;
}) => ({
  id: r.id,
  aplicacaoId: r.aplicacaoId,
  dataInicio: r.dataInicio,
  dataFim: r.dataFim,
  solicitadoPorTipo: r.solicitadoPorTipo,
  motivo: r.motivo,
  createdAt: r.createdAt,
});

const formatarPerguntaSnapshot = (p: {
  id: number; perguntaIdOriginal: number; secao: string; subsecao: string | null; codigo: string | null;
  texto: string; indicador: string | null; origem: string; tipoResposta: string;
  opcoes: unknown; complementar: unknown; ordem: number;
}) => ({
  id: p.id,
  perguntaIdOriginal: p.perguntaIdOriginal,
  secao: p.secao,
  subsecao: p.subsecao,
  codigo: p.codigo,
  texto: p.texto,
  indicador: p.indicador,
  origem: p.origem,
  tipoResposta: p.tipoResposta,
  opcoes: p.opcoes ?? [],
  complementar: p.complementar ?? null,
  ordem: p.ordem,
});

const formatarModeloSnapshot = (m: {
  id: number; modeloIdOriginal: number; nome: string; disciplinaId: number; disciplinaNome: string;
  perguntas: Parameters<typeof formatarPerguntaSnapshot>[0][];
}) => ({
  id: m.id,
  modeloIdOriginal: m.modeloIdOriginal,
  nome: m.nome,
  disciplinaId: m.disciplinaId,
  disciplinaNome: m.disciplinaNome,
  perguntas: m.perguntas.map(formatarPerguntaSnapshot).sort((a, b) => a.ordem - b.ordem),
});

async function escopoWhere(actor: Actor, escolaIdFiltro?: number) {
  const permitidas = await escolasPermitidas(actor);
  if (escolaIdFiltro !== undefined && permitidas && !permitidas.includes(escolaIdFiltro)) {
    throw new ForbiddenError('Você não tem acesso a esta escola.');
  }
  if (escolaIdFiltro !== undefined) return { escolaId: escolaIdFiltro };
  if (permitidas) return { escolaId: { in: permitidas } };
  return {};
}

pdiAplicacoesRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraAplicacoes(actor);
  const escolaIdFiltro = req.query.escolaId ? Number(req.query.escolaId) : undefined;
  const where = await escopoWhere(actor, escolaIdFiltro);

  const aplicacoes = await prisma.aplicacaoPdi.findMany({
    where,
    include: {
      escola: true,
      modelos: { select: { modeloIdOriginal: true, nome: true, disciplinaId: true, disciplinaNome: true } },
      reaberturas: { select: { dataInicio: true, dataFim: true } },
    },
    orderBy: { dataInicio: 'desc' },
  });
  res.json(aplicacoes.map(formatarAplicacao));
});

// --- GET /indicadores ------------------------------------------------------------------------
// Indicadores REAIS de preenchimento de PDI, um por escola (dashboard da Secretaria/Gestor/
// Diretora — nunca mock). Precisa vir ANTES de "GET /:id" no arquivo: senão o Express entende
// "indicadores" como valor de :id. "Esperado" é recalculado AO VIVO a partir de
// ProfessorTurmaDisciplina/AlunoPdi ATIVOS — mesma filosofia (e mesmo cálculo) já usada no job de
// prazo de PDI (jobs/pdiPrazoJob.ts): uma Ficha nunca criada ainda conta como pendente, nunca é
// omitida do total só por não ter linha no banco.
//
// Tudo em lote (4 queries no total, nunca por escola): a primeira versão fazia até 3 queries POR
// escola — numa rede com ~35 escolas isso virou ~5-6s de resposta (cada round-trip até o Neon
// custa uns 100-200ms daqui), ruim pra um widget de dashboard. Junta tudo, agrupa em memória.
pdiAplicacoesRouter.get('/indicadores', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraAplicacoes(actor);
  const permitidas = await escolasPermitidas(actor);

  const escolas = await prisma.escola.findMany({
    where: { status: 'ATIVA', ...(permitidas ? { id: { in: permitidas } } : {}) },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
  if (escolas.length === 0) return res.json([]);
  const escolaIds = escolas.map((e) => e.id);

  // 1) Todas as Aplicações de todas as escolas em scope, de uma vez — e a "ativa agora" de cada
  // escola, calculada em memória (statusVigencia é puro, sem I/O).
  const todasAplicacoes = await prisma.aplicacaoPdi.findMany({
    where: { escolaId: { in: escolaIds } },
    include: { modelos: { select: { disciplinaId: true } } },
  });
  const aplicacaoAtivaPorEscola = new Map<number, (typeof todasAplicacoes)[number]>();
  for (const aplicacao of todasAplicacoes) {
    if (statusVigencia(aplicacao) === 'active') aplicacaoAtivaPorEscola.set(aplicacao.escolaId, aplicacao);
  }
  const escolasComAplicacaoAtiva = [...aplicacaoAtivaPorEscola.keys()];

  if (escolasComAplicacaoAtiva.length === 0) {
    return res.json(escolas.map((escola) => ({ escolaId: escola.id, escolaNome: escola.nome, aplicacaoId: null, aplicacaoNome: null, totalEsperado: 0, concluidas: 0 })));
  }

  const aplicacaoIdsAtivas = [...aplicacaoAtivaPorEscola.values()].map((a) => a.id);

  // 2) Todo ProfessorTurmaDisciplina ATIVO de turma ATIVA, só das escolas que têm Aplicação ativa
  // agora (sem filtrar por disciplina aqui — disciplinas variam por escola, o filtro acontece em
  // memória no passo 4) — e, em paralelo, todas as Fichas CONCLUIDA dessas Aplicações: nenhuma
  // depende da outra, então não precisam esperar em sequência (cada round-trip até o Neon custa
  // uns 100-500ms+ daqui; evitar encadear os independentes economiza isso de verdade).
  const [ptds, fichasConcluidas] = await Promise.all([
    prisma.professorTurmaDisciplina.findMany({
      where: { status: 'ATIVO', turma: { escolaId: { in: escolasComAplicacaoAtiva }, status: 'ATIVA' } },
      select: { turmaId: true, disciplinaId: true, turma: { select: { escolaId: true } } },
    }),
    prisma.fichaPdi.findMany({
      where: { aplicacaoId: { in: aplicacaoIdsAtivas }, status: 'CONCLUIDA' },
      select: { aplicacaoId: true, alunoId: true, disciplinaId: true },
    }),
  ]);
  const turmaIds = [...new Set(ptds.map((p) => p.turmaId))];

  // 3) Todo AlunoPdi ATIVO dessas turmas, de uma vez.
  const alunos = turmaIds.length
    ? await prisma.alunoPdi.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, select: { id: true, turmaId: true } })
    : [];
  const alunosPorTurma = new Map<number, number[]>();
  for (const aluno of alunos) {
    if (!alunosPorTurma.has(aluno.turmaId)) alunosPorTurma.set(aluno.turmaId, []);
    alunosPorTurma.get(aluno.turmaId)!.push(aluno.id);
  }

  // 4) Candidatos (aluno×disciplina) por escola, em memória.
  const candidatosPorEscola = new Map<number, Set<string>>();
  for (const ptd of ptds) {
    const escolaId = ptd.turma.escolaId;
    const aplicacaoDaEscola = aplicacaoAtivaPorEscola.get(escolaId);
    if (!aplicacaoDaEscola) continue;
    const disciplinaIdsDaAplicacao = new Set(aplicacaoDaEscola.modelos.map((m) => m.disciplinaId));
    if (!disciplinaIdsDaAplicacao.has(ptd.disciplinaId)) continue;
    if (!candidatosPorEscola.has(escolaId)) candidatosPorEscola.set(escolaId, new Set());
    const candidatos = candidatosPorEscola.get(escolaId)!;
    for (const alunoId of alunosPorTurma.get(ptd.turmaId) ?? []) {
      candidatos.add(`${alunoId}-${ptd.disciplinaId}`);
    }
  }

  // 5) Agrupa as Fichas CONCLUIDA buscadas no passo 2 por Aplicação.
  const concluidasPorAplicacao = new Map<number, Set<string>>();
  for (const ficha of fichasConcluidas) {
    if (!concluidasPorAplicacao.has(ficha.aplicacaoId)) concluidasPorAplicacao.set(ficha.aplicacaoId, new Set());
    concluidasPorAplicacao.get(ficha.aplicacaoId)!.add(`${ficha.alunoId}-${ficha.disciplinaId}`);
  }

  const resultado = escolas.map((escola) => {
    const ativa = aplicacaoAtivaPorEscola.get(escola.id);
    if (!ativa) return { escolaId: escola.id, escolaNome: escola.nome, aplicacaoId: null, aplicacaoNome: null, totalEsperado: 0, concluidas: 0 };

    const candidatos = candidatosPorEscola.get(escola.id) ?? new Set<string>();
    const concluidasDaAplicacao = concluidasPorAplicacao.get(ativa.id) ?? new Set<string>();
    let concluidas = 0;
    for (const chave of candidatos) if (concluidasDaAplicacao.has(chave)) concluidas++;

    return { escolaId: escola.id, escolaNome: escola.nome, aplicacaoId: ativa.id, aplicacaoNome: ativa.nome, totalEsperado: candidatos.size, concluidas };
  });

  res.json(resultado);
});

async function buscarAplicacaoNoEscopo(actor: Actor, id: number) {
  const aplicacao = await prisma.aplicacaoPdi.findUnique({
    where: { id },
    include: { escola: true, modelos: { select: { modeloIdOriginal: true, nome: true, disciplinaId: true, disciplinaNome: true } } },
  });
  if (!aplicacao) throw new NotFoundError('Aplicação não encontrada.');
  const permitidas = await escolasPermitidas(actor);
  if (permitidas && !permitidas.includes(aplicacao.escolaId)) {
    throw new ForbiddenError('Você não tem acesso a esta aplicação.');
  }
  return aplicacao;
}

pdiAplicacoesRouter.get('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraAplicacoes(actor);
  const aplicacao = await buscarAplicacaoNoEscopo(actor, Number(req.params.id));
  res.json(formatarAplicacao(aplicacao));
});

// Estrutura pesada (modelos + perguntas) separada do GET simples, para o mesmo padrão sugerido
// no pedido (seção 34) — a listagem não precisa carregar isso toda vez.
pdiAplicacoesRouter.get('/:id/snapshot', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraAplicacoes(actor);
  const aplicacao = await buscarAplicacaoNoEscopo(actor, Number(req.params.id));
  const modelos = await prisma.aplicacaoModeloPdi.findMany({
    where: { aplicacaoId: aplicacao.id },
    include: { perguntas: true },
  });
  res.json(modelos.map(formatarModeloSnapshot));
});

function validarPeriodo(dataInicio: Date, dataFim: Date) {
  if (dataInicio > dataFim) throw new ValidationError('A data de início não pode ser depois da data de fim.');
}

// Só na CRIAÇÃO (nunca na edição — uma Aplicação já existente pode legitimamente ter começado no
// passado só porque o tempo passou desde que foi criada; reeditar outro campo dela não pode
// quebrar por causa disso). Vigência nova precisa começar hoje ou depois — não faz sentido abrir
// um prazo de preenchimento que já nasce vencido.
function exigirInicioNaoNoPassado(dataInicio: Date) {
  if (dataInicio < hojeComoData()) {
    throw new ValidationError('A data de início não pode ser no passado — a vigência precisa começar a partir de hoje.');
  }
}

// Sobreposição é sempre dentro da MESMA escola (seção 13/14 do pedido — escolas diferentes com
// datas idênticas são permitidas). Fronteiras iguais contam como sobreposição (vigenciasSobrepoem
// já cobre isso). `ignorarId` existe para a própria aplicação não colidir consigo mesma na edição.
async function validarSemSobreposicao(escolaId: number, periodo: { dataInicio: Date; dataFim: Date }, ignorarId?: number) {
  const existentes = await prisma.aplicacaoPdi.findMany({
    where: { escolaId, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true, dataInicio: true, dataFim: true },
  });
  const conflito = existentes.find((existente) => vigenciasSobrepoem(periodo, existente));
  if (conflito) {
    throw new ConflictError('Já existe uma Aplicação PDI para esta escola com período sobreposto.');
  }
}

async function exigirEscolaAtiva(escolaId: number) {
  const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!escola) throw new NotFoundError('Escola não encontrada.');
  if (escola.status !== 'ATIVA') throw new ValidationError('Não é possível fazer isso para uma escola inativa.');
  return escola;
}

const criarAplicacaoSchema = z.object({
  escolaId: z.number().int(),
  nome: z.string().trim().min(1).nullish(),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
});

// Cria a Aplicação e, na MESMA transação, o snapshot imutável de todos os Modelos ATIVOS (com
// suas perguntas ATIVAS) — seções 3-9 do pedido. Disciplina sem modelo ativo é simplesmente
// ignorada (nunca substituída, seção 10); se NENHUM modelo estiver ativo, bloqueia por completo
// em vez de criar uma aplicação vazia (seção 11).
pdiAplicacoesRouter.post('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const dados = criarAplicacaoSchema.parse(req.body);
  validarPeriodo(dados.dataInicio, dados.dataFim);
  exigirInicioNaoNoPassado(dados.dataInicio);
  await exigirEscolaAtiva(dados.escolaId);
  await validarSemSobreposicao(dados.escolaId, dados);

  const modelosAtivos = await prisma.modeloPdi.findMany({
    where: { status: 'ATIVA' },
    include: { disciplina: true, perguntas: { where: { status: 'ATIVA' } } },
  });
  if (modelosAtivos.length === 0) {
    throw new ValidationError('Não existe nenhum Modelo PDI ativo. Cadastre ao menos um modelo antes de criar uma Aplicação.');
  }

  // Timeout maior que o padrão (5s): o snapshot percorre todo Modelo+Pergunta ATIVA de uma vez
  // (dezenas de round-trips ao Neon), e o padrão estourava com o volume real de modelos.
  const criada = await prisma.$transaction(async (tx) => {
    const aplicacao = await tx.aplicacaoPdi.create({
      data: {
        escolaId: dados.escolaId,
        nome: dados.nome ?? null,
        dataInicio: dados.dataInicio,
        dataFim: dados.dataFim,
        createdBy: String(actor.id),
      },
    });

    for (const modelo of modelosAtivos) {
      const aplicacaoModelo = await tx.aplicacaoModeloPdi.create({
        data: {
          aplicacaoId: aplicacao.id,
          modeloIdOriginal: modelo.id,
          nome: modelo.nome,
          disciplinaId: modelo.disciplinaId,
          disciplinaNome: modelo.disciplina.nome,
        },
      });
      if (modelo.perguntas.length > 0) {
        await tx.aplicacaoPerguntaPdi.createMany({
          data: modelo.perguntas.map((pergunta) => ({
            aplicacaoModeloId: aplicacaoModelo.id,
            perguntaIdOriginal: pergunta.id,
            secao: pergunta.secao,
            subsecao: pergunta.subsecao,
            codigo: pergunta.codigo,
            texto: pergunta.texto,
            indicador: pergunta.indicador,
            origem: pergunta.origem,
            tipoResposta: pergunta.tipoResposta,
            opcoes: pergunta.opcoes ?? [],
            complementar: pergunta.complementar ?? undefined,
            ordem: pergunta.ordem,
          })),
        });
      }
    }
    return aplicacao;
  }, { timeout: 20000 });

  const completa = await prisma.aplicacaoPdi.findUnique({
    where: { id: criada.id },
    include: { escola: true, modelos: { select: { modeloIdOriginal: true, nome: true, disciplinaId: true, disciplinaNome: true } } },
  });
  res.status(201).json(formatarAplicacao(completa!));
});

const editarAplicacaoSchema = z.object({
  nome: z.string().trim().min(1).nullish(),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
});

// Edição NUNCA toca no snapshot (seção 16) — só nome/datas. Sobreposição ignora a própria
// aplicação; escola não precisa estar ativa para editar (só para criar, seção 28) — histórico
// continua navegável mesmo se a escola for inativada depois.
pdiAplicacoesRouter.put('/:id', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const id = Number(req.params.id);
  const atual = await prisma.aplicacaoPdi.findUnique({ where: { id } });
  if (!atual) throw new NotFoundError('Aplicação não encontrada.');

  const dados = editarAplicacaoSchema.parse(req.body);
  validarPeriodo(dados.dataInicio, dados.dataFim);
  await validarSemSobreposicao(atual.escolaId, dados, id);

  const atualizada = await prisma.aplicacaoPdi.update({
    where: { id },
    data: { nome: dados.nome ?? null, dataInicio: dados.dataInicio, dataFim: dados.dataFim, updatedBy: String(actor.id) },
    include: { escola: true, modelos: { select: { modeloIdOriginal: true, nome: true, disciplinaId: true, disciplinaNome: true } } },
  });
  res.json(formatarAplicacao(atualizada));
});

pdiAplicacoesRouter.get('/:id/reaberturas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirLeituraAplicacoes(actor);
  const aplicacao = await buscarAplicacaoNoEscopo(actor, Number(req.params.id));
  const reaberturas = await prisma.reaberturaPdi.findMany({ where: { aplicacaoId: aplicacao.id }, orderBy: { dataInicio: 'asc' } });
  res.json(reaberturas.map(formatarReabertura));
});

const criarReaberturaSchema = z.object({
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  solicitadoPorTipo: z.enum(['SECRETARIA', 'GESTOR', 'DIRETORA', 'PROFESSOR', 'AUXILIAR']),
  motivo: z.string().trim().min(1).nullish(),
});

// Reabertura nunca altera dataInicio/dataFim da Aplicação original (seção 19) — é sempre um
// evento novo e separado, ilimitado em quantidade. Precisa começar estritamente depois do fim
// ORIGINAL (nunca do fim da última reabertura — seção 24: nunca uma segunda janela paralela à
// vigência normal) e não pode colidir com outra Aplicação da mesma escola nem com outra
// reabertura da mesma Aplicação (seções 22/23). Por começar sempre depois do fim original, uma
// reabertura nunca sobrepõe sua própria Aplicação-mãe — não precisa de `ignorarId` nessa checagem.
pdiAplicacoesRouter.post('/:id/reaberturas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  exigirSecretaria(actor);
  const aplicacaoId = Number(req.params.id);
  const aplicacao = await prisma.aplicacaoPdi.findUnique({ where: { id: aplicacaoId } });
  if (!aplicacao) throw new NotFoundError('Aplicação não encontrada.');

  const dados = criarReaberturaSchema.parse(req.body);
  validarPeriodo(dados.dataInicio, dados.dataFim);
  await exigirEscolaAtiva(aplicacao.escolaId);

  if (dados.dataInicio <= aplicacao.dataFim) {
    throw new ValidationError('A reabertura só pode começar depois do fim da vigência original da Aplicação.');
  }

  await validarSemSobreposicao(aplicacao.escolaId, dados);

  const outrasReaberturas = await prisma.reaberturaPdi.findMany({
    where: { aplicacaoId },
    select: { dataInicio: true, dataFim: true },
  });
  const conflitoReabertura = outrasReaberturas.find((r) => vigenciasSobrepoem(dados, r));
  if (conflitoReabertura) {
    throw new ConflictError('Já existe uma reabertura desta Aplicação com período sobreposto.');
  }

  const criada = await prisma.reaberturaPdi.create({
    data: {
      aplicacaoId,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      solicitadoPorTipo: dados.solicitadoPorTipo,
      motivo: dados.motivo ?? null,
      createdBy: String(actor.id),
    },
  });
  res.status(201).json(formatarReabertura(criada));
});

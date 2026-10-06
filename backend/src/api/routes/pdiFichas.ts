import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import { isAplicacaoEditavelAgora, statusVigencia } from '../../domain/pdiAplicacoes.js';
import { editavelParaProfessor, fichaEditavelAgora, statusAposSalvarResposta, statusVisualItem } from '../../domain/pdiFichas.js';
import { escolasPermitidas } from './pessoas.js';

export const pdiFichasRouter = Router();

type Actor = { id: number; perfil: string };
type Cliente = typeof prisma | Prisma.TransactionClient;

// Resolve toda a identidade (Aplicação, Aluno+Turma+Escola ATUAIS, Disciplina, snapshot da
// Aplicação para a disciplina, Professor responsável ATIVO) — nunca lança por falta de Professor
// responsável aqui (isso só bloqueia CRIAÇÃO, não leitura de uma Ficha já existente — ver seção
// 11 do pedido). `ptd` vem null quando não há vínculo ativo; quem decide se isso é bloqueante é
// quem chama esta função.
// As 4 primeiras buscas não dependem uma da outra (cada uma só precisa de um id já recebido por
// parâmetro) — rodar em paralelo em vez de 1 por vez economiza ~4 round-trips reais por chamada.
// Só `ptd` depende de verdade de outra (precisa de `aluno.turmaId`, que só existe depois de
// `aluno` resolver), por isso fica de fora do Promise.all. Antes disto, salvar UMA resposta de
// Ficha PDI fazia ~12 consultas em sequência (contando as outras funções chamadas depois desta) —
// cada uma pagando a latência real até o Neon, daí a demora perceptível por clique relatada em
// teste manual.
async function resolverContexto(client: Cliente, aplicacaoId: number, alunoId: number, disciplinaId: number) {
  const [aplicacao, aluno, disciplina, aplicacaoModelo] = await Promise.all([
    client.aplicacaoPdi.findUnique({ where: { id: aplicacaoId } }),
    client.alunoPdi.findUnique({ where: { id: alunoId }, include: { turma: { include: { escola: true } } } }),
    client.disciplina.findUnique({ where: { id: disciplinaId } }),
    // Nunca lê o ModeloPdi vivo — só o snapshot já congelado na Aplicação (seção 12 do pedido).
    client.aplicacaoModeloPdi.findFirst({ where: { aplicacaoId, disciplinaId } }),
  ]);

  if (!aplicacao) throw new NotFoundError('Aplicação não encontrada.');
  if (!aluno) throw new NotFoundError('Aluno não encontrado.');
  if (aluno.turma.escolaId !== aplicacao.escolaId) {
    throw new ValidationError('Esta aplicação não pertence à escola atual deste aluno.');
  }
  if (!disciplina) throw new NotFoundError('Disciplina não encontrada.');
  if (!aplicacaoModelo) {
    throw new ValidationError('Esta Aplicação não possui um Modelo PDI desta disciplina no snapshot. Não é possível abrir esta Ficha.');
  }

  const ptd = await client.professorTurmaDisciplina.findFirst({
    where: { turmaId: aluno.turmaId, disciplinaId, status: 'ATIVO' },
    include: { professor: true },
  });

  return { aplicacao, aluno, disciplina, aplicacaoModelo, ptd };
}

type Contexto = Awaited<ReturnType<typeof resolverContexto>>;

// Autorização operacional — NUNCA usa o snapshot da Ficha (seção 23 do pedido: o snapshot é só
// histórico, não concede acesso). Sempre resolve contra o estado ATUAL de VinculoEscolar/
// ProfessorTurmaDisciplina/AuxiliarTurma.
async function exigirAcessoOperacional(client: Cliente, actor: Actor, contexto: Contexto, opts: { exigirEscrita: boolean }) {
  const escolaId = contexto.aluno.turma.escolaId;

  if (actor.perfil === 'SECRETARIA') {
    if (opts.exigirEscrita) throw new ForbiddenError('A Secretaria não preenche Fichas PDI nesta etapa — apenas consulta.');
    return;
  }

  if (actor.perfil === 'GESTOR') {
    const vinculo = await client.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculo) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    return;
  }

  if (actor.perfil === 'PROFESSOR') {
    const vinculoEscolar = await client.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculoEscolar) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    // Professor só acessa (leitura OU escrita) a própria turma/disciplina, agora — ver exemplo do
    // Carlos na seção 23: o nome no snapshot não dá acesso a quem não é mais o responsável hoje.
    if (!contexto.ptd || contexto.ptd.professorId !== actor.id) {
      throw new ForbiddenError('Você não é o professor responsável por esta turma e disciplina.');
    }
    return;
  }

  if (actor.perfil === 'DIRETORA') {
    if (opts.exigirEscrita) throw new ForbiddenError('Diretora não preenche nem edita Fichas PDI — apenas consulta.');
    const vinculo = await client.vinculoEscolar.findFirst({ where: { pessoaId: actor.id, escolaId, status: 'ATIVO' } });
    if (!vinculo) throw new ForbiddenError('Você não tem vínculo ativo com a escola deste aluno.');
    return;
  }

  if (actor.perfil === 'AUXILIAR') {
    if (opts.exigirEscrita) throw new ForbiddenError('Auxiliar não preenche nem edita Fichas PDI — apenas consulta.');
    const vinculoTurma = await client.auxiliarTurma.findFirst({ where: { auxiliarId: actor.id, turmaId: contexto.aluno.turmaId, status: 'ATIVO' } });
    if (!vinculoTurma) throw new ForbiddenError('Você não tem vínculo ativo com a turma deste aluno.');
    return;
  }

  throw new ForbiddenError('Você não tem permissão para acessar Fichas PDI.');
}

// Existe uma CorrecaoFichaPdi (devolução individual, ver pdiFichaAnual.ts/correcoesPdi.ts) ainda
// dentro do prazo de 3 dias pra esta Ficha? "EXPIRADA" nunca é um valor gravado — é só isto aqui
// dando false depois de prazoAte passar (mesmo padrão de statusVigencia/domain/pdiAplicacoes.ts).
async function existeCorrecaoIndividualAtiva(client: Cliente, fichaId: number): Promise<boolean> {
  const correcao = await client.correcaoFichaPdi.findFirst({
    where: { fichaId, status: 'ABERTA', prazoAte: { gt: new Date() } },
    select: { id: true },
  });
  return !!correcao;
}

// Devolve se há (ou não) uma janela de correção individual ativa — quem chama usa isso pra saber
// se deve logar HistoricoCorrecaoResposta (PUT /respostas) ou resolver a correção (POST /concluir),
// evitando uma segunda consulta idêntica logo depois.
async function exigirEditavelAgora(
  client: Cliente,
  ficha: { id: number; escolaId: number; aplicacaoId: number },
  aplicacao: { dataInicio: Date; dataFim: Date; status: string },
): Promise<boolean> {
  const [escola, reaberturas, correcaoIndividualAtiva] = await Promise.all([
    client.escola.findUniqueOrThrow({ where: { id: ficha.escolaId } }),
    client.reaberturaPdi.findMany({ where: { aplicacaoId: ficha.aplicacaoId }, select: { dataInicio: true, dataFim: true } }),
    existeCorrecaoIndividualAtiva(client, ficha.id),
  ]);
  // Aplicação removida (INATIVA — ver DELETE /api/pdi-aplicacoes/:id) nunca é editável, mesmo
  // dentro da vigência original, com reabertura ativa, ou com correção individual ativa: saiu de
  // circulação de propósito. Editável = vigência normal OU correção individual ativa (seção 38/41
  // do pedido de Ficha Anual/Correções) — nunca substitui a regra de vigência, só soma a ela.
  const editavel = aplicacao.status === 'ATIVA' && fichaEditavelAgora(
    escola.status === 'ATIVA',
    editavelParaProfessor(isAplicacaoEditavelAgora(aplicacao, reaberturas), correcaoIndividualAtiva),
  );
  if (!editavel) {
    throw new ValidationError('Esta Ficha PDI não está editável no momento (fora da vigência, sem reabertura ativa, ou a Aplicação foi removida).');
  }
  return correcaoIndividualAtiva;
}

const formatarFicha = (f: {
  id: number; aplicacaoId: number; aplicacaoModeloId: number; alunoId: number; disciplinaId: number;
  professorResponsavelId: number; alunoNomeSnapshot: string; turmaId: number; turmaNomeSnapshot: string;
  escolaId: number; escolaNomeSnapshot: string; disciplinaNomeSnapshot: string; professorNomeSnapshot: string;
  aplicacaoDataInicioSnapshot: Date; aplicacaoDataFimSnapshot: Date; status: string;
  createdAt: Date; createdBy: string | null; updatedAt: Date | null; updatedBy: string | null;
  concluidaEm: Date | null; concluidaPor: string | null;
}) => ({
  id: f.id,
  aplicacaoId: f.aplicacaoId,
  aplicacaoModeloId: f.aplicacaoModeloId,
  alunoId: f.alunoId,
  disciplinaId: f.disciplinaId,
  professorResponsavelId: f.professorResponsavelId,
  alunoNome: f.alunoNomeSnapshot,
  turmaId: f.turmaId,
  turmaNome: f.turmaNomeSnapshot,
  escolaId: f.escolaId,
  escolaNome: f.escolaNomeSnapshot,
  disciplinaNome: f.disciplinaNomeSnapshot,
  professorNome: f.professorNomeSnapshot,
  aplicacaoDataInicio: f.aplicacaoDataInicioSnapshot,
  aplicacaoDataFim: f.aplicacaoDataFimSnapshot,
  status: f.status,
  createdAt: f.createdAt,
  createdBy: f.createdBy,
  updatedAt: f.updatedAt,
  updatedBy: f.updatedBy,
  concluidaEm: f.concluidaEm,
  concluidaPor: f.concluidaPor,
});

const formatarPerguntaSnapshot = (p: {
  id: number; perguntaIdOriginal: number; secao: string; subsecao: string | null; codigo: string | null;
  texto: string; indicador: string | null; origem: string; tipoResposta: string; opcoes: unknown;
  complementar: unknown; ordem: number;
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

const formatarResposta = (r: {
  id: number; fichaId: number; aplicacaoPerguntaId: number; valor: unknown;
  createdAt: Date; createdBy: string | null; updatedAt: Date | null; updatedBy: string | null;
}) => ({
  id: r.id,
  fichaId: r.fichaId,
  aplicacaoPerguntaId: r.aplicacaoPerguntaId,
  valor: r.valor,
  createdAt: r.createdAt,
  createdBy: r.createdBy,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
});

// Resposta única "suficiente pra montar a tela" (seção 31 do pedido): ficha + perguntas do
// snapshot (nunca do Modelo vivo) + respostas já salvas + se está editável agora (calculado com a
// Aplicação/Reaberturas REAIS atuais, nunca com o snapshot congelado da própria Ficha).
// Exportada: reaproveitada por correcoesPdi.ts no detalhe de uma Ficha (GET /api/correcoes-pdi/:fichaId)
// — mesmo formato "suficiente pra montar a tela" usado aqui, sem duplicar a lógica.
export async function montarRespostaCompleta(ficha: Awaited<ReturnType<typeof prisma.fichaPdi.findUniqueOrThrow>>) {
  const [perguntas, respostas, aplicacao, reaberturas, escola, correcaoIndividualAtiva] = await Promise.all([
    prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId }, orderBy: { ordem: 'asc' } }),
    prisma.respostaPdi.findMany({ where: { fichaId: ficha.id } }),
    prisma.aplicacaoPdi.findUniqueOrThrow({ where: { id: ficha.aplicacaoId } }),
    prisma.reaberturaPdi.findMany({ where: { aplicacaoId: ficha.aplicacaoId }, select: { dataInicio: true, dataFim: true } }),
    prisma.escola.findUniqueOrThrow({ where: { id: ficha.escolaId } }),
    existeCorrecaoIndividualAtiva(prisma, ficha.id),
  ]);

  return {
    ficha: formatarFicha(ficha),
    perguntas: perguntas.map(formatarPerguntaSnapshot),
    respostas: respostas.map(formatarResposta),
    editavelAgora: aplicacao.status === 'ATIVA' && fichaEditavelAgora(
      escola.status === 'ATIVA',
      editavelParaProfessor(isAplicacaoEditavelAgora(aplicacao, reaberturas), correcaoIndividualAtiva),
    ),
  };
}

const obterOuCriarSchema = z.object({
  aplicacaoId: z.number().int(),
  alunoId: z.number().int(),
  disciplinaId: z.number().int(),
});

// P2002 do Postgres/Prisma, mas só quando é mesmo a constraint única de identidade da Ficha
// (aplicacaoId+alunoId+disciplinaId) — nunca trata um P2002 de outra entidade/constraint como
// "corrida de criação de Ficha" (ver catch abaixo, que depende disto pra não mascarar erro real).
function ehConflitoDeIdentidadeDaFicha(err: Prisma.PrismaClientKnownRequestError): boolean {
  const meta = err.meta as { target?: string[] | string; modelName?: string } | undefined;
  if (meta?.modelName && meta.modelName !== 'FichaPdi') return false;
  const campos = ['aplicacaoId', 'alunoId', 'disciplinaId'];
  const target = meta?.target;
  if (Array.isArray(target)) return campos.every((c) => target.includes(c));
  if (typeof target === 'string') return campos.every((c) => target.includes(c));
  return false;
}

// Criação SOB DEMANDA, idempotente e segura contra concorrência (seções 3-6 do pedido): resolve
// todo o contexto + tenta criar dentro de uma transação. Se outra requisição venceu a corrida
// (unique constraint), o Postgres aborta a transação inteira (qualquer comando novo dentro dela
// falharia com 25P02 — "current transaction is aborted") — por isso a recuperação do P2002 NUNCA
// pode rodar dentro da mesma `tx`: precisa ser uma operação nova, fora dela, com o Prisma normal.
// Nunca usa `upsert` aqui de propósito — o branch de update de um upsert poderia, por engano
// futuro, sobrescrever o contexto congelado.
pdiFichasRouter.post('/obter-ou-criar', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { aplicacaoId, alunoId, disciplinaId } = obterOuCriarSchema.parse(req.body);
  const chave = { aplicacaoId_alunoId_disciplinaId: { aplicacaoId, alunoId, disciplinaId } };

  let ficha: Awaited<ReturnType<typeof prisma.fichaPdi.findUniqueOrThrow>>;
  try {
    ficha = await prisma.$transaction(async (tx) => {
      const contexto = await resolverContexto(tx, aplicacaoId, alunoId, disciplinaId);

      const existente = await tx.fichaPdi.findUnique({ where: chave });
      if (existente) {
        // Mesmo já existindo, a autorização é obrigatória aqui também — nunca pular esta checagem
        // só porque a Ficha já existe, senão qualquer ator autenticado poderia "abrir" a Ficha de
        // outra escola/turma pedindo por uma combinação que já foi criada por outra pessoa.
        await exigirAcessoOperacional(tx, actor, contexto, { exigirEscrita: true });
        return existente;
      }

      // A partir daqui é sempre uma CRIAÇÃO nova — só agora o Professor responsável é obrigatório
      // (seção 11) e o aluno precisa estar ATIVO (uma Ficha nova nunca nasce para aluno arquivado;
      // Fichas já existentes continuam legíveis normalmente).
      if (!contexto.ptd) {
        throw new ValidationError('Não existe Professor responsável ativo para esta turma e disciplina. Configure o vínculo antes de abrir esta Ficha PDI.');
      }
      if (contexto.aluno.status !== 'ATIVO') {
        throw new ValidationError('Não é possível abrir uma nova Ficha PDI para um aluno arquivado.');
      }

      await exigirAcessoOperacional(tx, actor, contexto, { exigirEscrita: true });

      return tx.fichaPdi.create({
        data: {
          aplicacaoId,
          aplicacaoModeloId: contexto.aplicacaoModelo.id,
          alunoId,
          disciplinaId,
          professorResponsavelId: contexto.ptd.professorId,
          alunoNomeSnapshot: contexto.aluno.nome,
          turmaId: contexto.aluno.turmaId,
          turmaNomeSnapshot: contexto.aluno.turma.nome,
          escolaId: contexto.aluno.turma.escolaId,
          escolaNomeSnapshot: contexto.aluno.turma.escola.nome,
          disciplinaNomeSnapshot: contexto.aplicacaoModelo.disciplinaNome,
          professorNomeSnapshot: contexto.ptd.professor.nome,
          aplicacaoDataInicioSnapshot: contexto.aplicacao.dataInicio,
          aplicacaoDataFimSnapshot: contexto.aplicacao.dataFim,
          status: 'PENDENTE',
          createdBy: String(actor.id),
        },
      });
    }, { timeout: 15000 });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002' || !ehConflitoDeIdentidadeDaFicha(err)) {
      throw err; // erro real (autorização, validação, outra constraint) — nunca mascarar.
    }

    // Outra requisição criou primeiro (corrida Professor/Gestor/duplo clique) — busca a Ficha
    // vencedora com uma operação NOVA, fora da transação abortada. Só trata como sucesso se ela
    // realmente existir; e reaplica a mesma checagem de autorização que a requisição perdedora já
    // tinha passado antes de tentar criar, nunca pulando essa etapa.
    const existente = await prisma.fichaPdi.findUnique({ where: chave });
    if (!existente) throw err; // estado inconsistente de verdade — não mascarar.

    const contexto = await resolverContexto(prisma, aplicacaoId, alunoId, disciplinaId);
    await exigirAcessoOperacional(prisma, actor, contexto, { exigirEscrita: true });
    ficha = existente;
  }

  res.json(await montarRespostaCompleta(ficha));
});

// Listagem unificada do Professor (seções 2-6 do pedido) — não depende de Ficha existir: gera
// todas as combinações operacionalmente disponíveis a partir dos vínculos ATIVOS de hoje
// (VinculoEscolar → ProfessorTurmaDisciplina → Turma ATIVA → AlunoPdi ATIVO → Aplicação da
// mesma escola com snapshot da disciplina) e só DEPOIS cruza com as Fichas que já existem.
// Sem N+1: no máximo 6 queries no total, nunca uma por aluno/aplicação/disciplina.
pdiFichasRouter.get('/meus-pdis', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  if (actor.perfil !== 'PROFESSOR') {
    throw new ForbiddenError('Este endpoint é exclusivo do Professor.');
  }

  const vinculosEscolares = await prisma.vinculoEscolar.findMany({ where: { pessoaId: actor.id, status: 'ATIVO' }, select: { escolaId: true } });
  const escolaIdsPermitidas = vinculosEscolares.map((v) => v.escolaId);
  if (escolaIdsPermitidas.length === 0) return res.json([]);

  const ptds = await prisma.professorTurmaDisciplina.findMany({
    where: { professorId: actor.id, status: 'ATIVO', turma: { escolaId: { in: escolaIdsPermitidas }, status: 'ATIVA' } },
    include: { turma: { include: { escola: true } } },
  });
  if (ptds.length === 0) return res.json([]);

  const turmaIds = [...new Set(ptds.map((p) => p.turmaId))];
  const escolaIdsDasTurmas = [...new Set(ptds.map((p) => p.turma.escolaId))];

  const [alunos, aplicacoes] = await Promise.all([
    prisma.alunoPdi.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' } }),
    prisma.aplicacaoPdi.findMany({
      where: { escolaId: { in: escolaIdsDasTurmas }, status: 'ATIVA' }, // removida (INATIVA) nunca aparece em Meus PDIs
      include: { modelos: { select: { disciplinaId: true, disciplinaNome: true } } },
    }),
  ]);

  // Candidatos: para cada vínculo (turma+disciplina) ATIVO hoje, cada aluno ATIVO da turma ×
  // cada Aplicação da MESMA escola que tenha snapshot daquela disciplina — Aplicações encerradas
  // aparecem normalmente aqui (leitura histórica de quem ainda ministra a turma/disciplina, seção
  // 27 do pedido); só some quando o vínculo em si deixa de existir.
  const candidatos: { aplicacaoId: number; alunoId: number; disciplinaId: number; ptd: (typeof ptds)[number] }[] = [];
  for (const ptd of ptds) {
    const alunosDaTurma = alunos.filter((a) => a.turmaId === ptd.turmaId);
    if (alunosDaTurma.length === 0) continue;
    const aplicacoesDaEscola = aplicacoes.filter((a) => a.escolaId === ptd.turma.escolaId);
    for (const aplicacao of aplicacoesDaEscola) {
      if (!aplicacao.modelos.some((m) => m.disciplinaId === ptd.disciplinaId)) continue;
      for (const aluno of alunosDaTurma) {
        candidatos.push({ aplicacaoId: aplicacao.id, alunoId: aluno.id, disciplinaId: ptd.disciplinaId, ptd });
      }
    }
  }
  if (candidatos.length === 0) return res.json([]);

  const aplicacaoIds = [...new Set(candidatos.map((c) => c.aplicacaoId))];
  const [fichasExistentes, reaberturas] = await Promise.all([
    prisma.fichaPdi.findMany({
      where: { OR: candidatos.map((c) => ({ aplicacaoId: c.aplicacaoId, alunoId: c.alunoId, disciplinaId: c.disciplinaId })) },
    }),
    prisma.reaberturaPdi.findMany({ where: { aplicacaoId: { in: aplicacaoIds } }, select: { aplicacaoId: true, dataInicio: true, dataFim: true } }),
  ]);

  const fichaPorChave = new Map(fichasExistentes.map((f) => [`${f.aplicacaoId}-${f.alunoId}-${f.disciplinaId}`, f]));
  const alunoPorId = new Map(alunos.map((a) => [a.id, a]));
  const aplicacaoPorId = new Map(aplicacoes.map((a) => [a.id, a]));
  const reaberturasPorAplicacao = new Map<number, { dataInicio: Date; dataFim: Date }[]>();
  reaberturas.forEach((r) => {
    if (!reaberturasPorAplicacao.has(r.aplicacaoId)) reaberturasPorAplicacao.set(r.aplicacaoId, []);
    reaberturasPorAplicacao.get(r.aplicacaoId)!.push(r);
  });

  const linhas = candidatos.map((c) => {
    const ficha = fichaPorChave.get(`${c.aplicacaoId}-${c.alunoId}-${c.disciplinaId}`);
    const aluno = alunoPorId.get(c.alunoId)!;
    const aplicacao = aplicacaoPorId.get(c.aplicacaoId)!;
    const modelo = aplicacao.modelos.find((m) => m.disciplinaId === c.disciplinaId)!;
    const editavelAgora = fichaEditavelAgora(
      c.ptd.turma.escola.status === 'ATIVA',
      isAplicacaoEditavelAgora(aplicacao, reaberturasPorAplicacao.get(c.aplicacaoId) || []),
    );
    return {
      aplicacaoId: c.aplicacaoId,
      aplicacaoNome: aplicacao.nome,
      alunoId: c.alunoId,
      alunoNome: aluno.nome,
      escolaId: c.ptd.turma.escolaId,
      escolaNome: c.ptd.turma.escola.nome,
      turmaId: c.ptd.turmaId,
      turmaNome: c.ptd.turma.nome,
      disciplinaId: c.disciplinaId,
      disciplinaNome: modelo.disciplinaNome,
      dataInicio: aplicacao.dataInicio,
      dataFim: aplicacao.dataFim,
      statusVigencia: statusVigencia(aplicacao),
      existeFicha: !!ficha,
      fichaId: ficha?.id ?? null,
      statusFicha: ficha?.status ?? null,
      editavelAgora,
      statusVisual: statusVisualItem((ficha?.status as 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA') ?? null, editavelAgora, statusVigencia(aplicacao)),
    };
  });

  res.json(linhas);
});

// Leitura pura — NUNCA cria (seção 25 do pedido: Diretora/Secretaria/Auxiliar só consultam).
// 404 se a Ficha ainda não existir, em vez de materializá-la.
pdiFichasRouter.get('/:aplicacaoId/:alunoId/:disciplinaId', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const aplicacaoId = Number(req.params.aplicacaoId);
  const alunoId = Number(req.params.alunoId);
  const disciplinaId = Number(req.params.disciplinaId);

  const contexto = await resolverContexto(prisma, aplicacaoId, alunoId, disciplinaId);
  await exigirAcessoOperacional(prisma, actor, contexto, { exigirEscrita: false });

  const ficha = await prisma.fichaPdi.findUnique({ where: { aplicacaoId_alunoId_disciplinaId: { aplicacaoId, alunoId, disciplinaId } } });
  if (!ficha) throw new NotFoundError('Esta Ficha PDI ainda não foi criada.');

  res.json(await montarRespostaCompleta(ficha));
});

// Listagem/consulta de Fichas já existentes, escopada por perfil (seção 21 do pedido). Sempre
// via relação VIVA aluno→turma (nunca os campos *Snapshot da própria Ficha, que são congelados e
// não devem servir de base pra autorização — seção 24): assim, se Carlos parar de lecionar uma
// turma/disciplina, as Fichas dela somem da consulta dele mesmo que o snapshot ainda diga "Carlos"
// (e passam a aparecer pra quem assumiu, Ana, sem nenhuma Ficha nova ser criada — seção 26).
pdiFichasRouter.get('/', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const { alunoId, aplicacaoId, status } = req.query;
  const statusValido = status === 'PENDENTE' || status === 'EM_ANDAMENTO' || status === 'CONCLUIDA' ? status : undefined;

  const where: Prisma.FichaPdiWhereInput = {
    ...(alunoId ? { alunoId: Number(alunoId) } : {}),
    ...(aplicacaoId ? { aplicacaoId: Number(aplicacaoId) } : {}),
    ...(statusValido ? { status: statusValido } : {}),
  };

  if (actor.perfil === 'PROFESSOR') {
    const ptds = await prisma.professorTurmaDisciplina.findMany({ where: { professorId: actor.id, status: 'ATIVO' }, select: { turmaId: true, disciplinaId: true } });
    if (ptds.length === 0) return res.json([]);
    where.OR = ptds.map((p) => ({ aluno: { turmaId: p.turmaId }, disciplinaId: p.disciplinaId }));
  } else if (actor.perfil === 'GESTOR' || actor.perfil === 'DIRETORA' || actor.perfil === 'SECRETARIA') {
    const permitidas = await escolasPermitidas(actor);
    if (permitidas) where.aluno = { turma: { escolaId: { in: permitidas } } };
  } else if (actor.perfil === 'AUXILIAR') {
    const vinculosEscolares = await prisma.vinculoEscolar.findMany({ where: { pessoaId: actor.id, status: 'ATIVO' }, select: { escolaId: true } });
    const escolaIds = vinculosEscolares.map((v) => v.escolaId);
    if (escolaIds.length === 0) return res.json([]);
    const auxiliarTurmas = await prisma.auxiliarTurma.findMany({ where: { auxiliarId: actor.id, status: 'ATIVO', turma: { escolaId: { in: escolaIds } } }, select: { turmaId: true } });
    if (auxiliarTurmas.length === 0) return res.json([]);
    where.aluno = { turmaId: { in: auxiliarTurmas.map((t) => t.turmaId) } };
  } else {
    throw new ForbiddenError('Você não tem permissão para consultar Fichas PDI.');
  }

  const fichas = await prisma.fichaPdi.findMany({ where, orderBy: { updatedAt: 'desc' } });
  res.json(fichas.map(formatarFicha));
});

const respostaItemSchema = z.object({
  aplicacaoPerguntaId: z.number().int(),
  valor: z.object({
    resposta: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    complementarTexto: z.string().nullish(),
  }),
});
const salvarRespostasSchema = z.object({ respostas: z.array(respostaItemSchema).min(1) });

// Salvamento parcial (seções 17/18 do pedido): qualquer subconjunto de respostas, quantas vezes
// quiser, sem exigir o formulário completo. Perguntas informativas (ORIENTACAO) nunca geram
// resposta — silenciosamente ignoradas se vierem no payload por engano do frontend.
pdiFichasRouter.put('/:id/respostas', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const fichaId = Number(req.params.id);
  const { respostas } = salvarRespostasSchema.parse(req.body);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');

  // perguntasDoModelo só depende de ficha.aplicacaoModeloId (já em mãos) — nada a ver com
  // contexto/autorização, então roda em paralelo com resolverContexto em vez de depois dele.
  const [contexto, perguntasDoModelo] = await Promise.all([
    resolverContexto(prisma, ficha.aplicacaoId, ficha.alunoId, ficha.disciplinaId),
    prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId } }),
  ]);
  // As duas checagens de autorização são independentes entre si (nenhuma usa o resultado da
  // outra) — também em paralelo. `correcaoIndividualAtiva` vem do retorno de exigirEditavelAgora
  // (evita reconsultar a mesma coisa duas vezes).
  const [, correcaoIndividualAtiva] = await Promise.all([
    exigirAcessoOperacional(prisma, actor, contexto, { exigirEscrita: true }),
    exigirEditavelAgora(prisma, ficha, contexto.aplicacao),
  ]);

  const perguntasPorId = new Map(perguntasDoModelo.map((p) => [p.id, p]));
  if (respostas.some((item) => !perguntasPorId.has(item.aplicacaoPerguntaId))) {
    throw new ValidationError('Uma ou mais perguntas informadas não pertencem a esta Ficha.');
  }
  const respostasAplicaveis = respostas.filter((item) => perguntasPorId.get(item.aplicacaoPerguntaId)!.tipoResposta !== 'ORIENTACAO');

  // Auditoria (seção 30/38 do pedido de Correções): só lê o valor "antes" quando há uma correção
  // individual ativa — no preenchimento normal (sem nenhuma devolução em aberto) nada disto roda,
  // comportamento idêntico ao de antes desta feature existir.
  const valoresAntes = correcaoIndividualAtiva
    ? new Map((await prisma.respostaPdi.findMany({
        where: { fichaId, aplicacaoPerguntaId: { in: respostasAplicaveis.map((item) => item.aplicacaoPerguntaId) } },
        select: { aplicacaoPerguntaId: true, valor: true },
      })).map((r) => [r.aplicacaoPerguntaId, r.valor]))
    : null;

  await prisma.$transaction(
    respostasAplicaveis.map((item) => prisma.respostaPdi.upsert({
      where: { fichaId_aplicacaoPerguntaId: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId } },
      create: { fichaId, aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: item.valor, createdBy: String(actor.id) },
      update: { valor: item.valor, updatedBy: String(actor.id) },
    })),
  );

  if (valoresAntes) {
    await prisma.historicoCorrecaoResposta.createMany({
      data: respostasAplicaveis.map((item) => ({
        fichaId,
        aplicacaoPerguntaId: item.aplicacaoPerguntaId,
        valorAnterior: valoresAntes.get(item.aplicacaoPerguntaId) ?? Prisma.JsonNull,
        valorNovo: item.valor,
        alteradoPor: String(actor.id),
        origem: 'PROFESSOR_POS_DEVOLUCAO' as const,
      })),
    });
  }

  // updatedBy/updatedAt da Ficha precisam refletir quem de fato salvou algo aqui, mesmo quando o
  // status não muda (ex.: editar uma resposta de uma Ficha já CONCLUIDA) — nunca só quando há
  // transição de status, senão a auditoria da Ficha fica presa no último editor de STATUS, não no
  // último editor de DADO. updatedBy é só auditoria de autoria; não mexe em professorResponsavelId/
  // snapshots/createdBy/concluidaPor.
  const novoStatus = statusAposSalvarResposta(ficha.status as 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA', respostasAplicaveis.length > 0);
  if (respostasAplicaveis.length > 0) {
    await prisma.fichaPdi.update({
      where: { id: fichaId },
      data: { ...(novoStatus !== ficha.status ? { status: novoStatus } : {}), updatedBy: String(actor.id) },
    });
  }

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

// Ação explícita de conclusão (seção 20 do pedido) — idempotente: concluir uma Ficha já CONCLUIDA
// não é erro, só devolve o estado atual. Continua exigindo estar dentro da vigência/reabertura
// atual, igual ao salvamento de respostas. NUNCA conclui com pergunta sem resposta: só vira
// CONCLUIDA quando toda pergunta que exige resposta (tudo, exceto ORIENTACAO — essa é só texto
// informativo, nunca gera RespostaPdi) já tem uma linha salva. "Respondida" usa o mesmo critério
// que o resto do sistema já usa pra decidir PENDENTE→EM_ANDAMENTO (existe uma RespostaPdi pra
// aquela pergunta), nunca uma regra nova de "valor não-vazio" — ficaria inconsistente com como o
// preenchimento parcial já é tratado em todo o resto do fluxo. Ficha incompleta nunca é bloqueada
// de continuar sendo editada — ela só não vira CONCLUIDA; "reabrir e continuar" já é automático,
// porque nada muda de estado quando a conclusão é recusada.
pdiFichasRouter.post('/:id/concluir', async (req, res) => {
  const actor = res.locals.pessoa as Actor;
  const fichaId = Number(req.params.id);

  const ficha = await prisma.fichaPdi.findUnique({ where: { id: fichaId } });
  if (!ficha) throw new NotFoundError('Ficha não encontrada.');

  const contexto = await resolverContexto(prisma, ficha.aplicacaoId, ficha.alunoId, ficha.disciplinaId);
  const [, correcaoIndividualAtiva] = await Promise.all([
    exigirAcessoOperacional(prisma, actor, contexto, { exigirEscrita: true }),
    exigirEditavelAgora(prisma, ficha, contexto.aplicacao),
  ]);

  if (ficha.status !== 'CONCLUIDA') {
    const [perguntasObrigatorias, respostasExistentes] = await Promise.all([
      prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId, tipoResposta: { not: 'ORIENTACAO' } }, select: { id: true } }),
      prisma.respostaPdi.findMany({ where: { fichaId }, select: { aplicacaoPerguntaId: true } }),
    ]);
    const respondidasIds = new Set(respostasExistentes.map((r) => r.aplicacaoPerguntaId));
    const faltando = perguntasObrigatorias.filter((p) => !respondidasIds.has(p.id)).length;
    if (faltando > 0) {
      throw new ValidationError(`Esta Ficha ainda não pode ser concluída: faltam ${faltando} ${faltando === 1 ? 'pergunta' : 'perguntas'} sem resposta.`);
    }

    await prisma.fichaPdi.update({
      where: { id: fichaId },
      data: { status: 'CONCLUIDA', concluidaEm: new Date(), concluidaPor: String(actor.id), updatedBy: String(actor.id) },
    });
  }

  // Fora do `if` acima de propósito: o caso real de "concluir de novo depois de uma devolução"
  // (seção 29/40 do pedido) é justamente quando a Ficha JÁ estava CONCLUIDA antes de ser
  // devolvida — o bloco de cima é pulado (idempotente), mas a correção em aberto ainda precisa
  // ser resolvida aqui. Nunca mexe em ReaberturaPdi nem na Aplicação, só nesta Ficha.
  if (correcaoIndividualAtiva) {
    await prisma.correcaoFichaPdi.updateMany({
      where: { fichaId, status: 'ABERTA', prazoAte: { gt: new Date() } },
      data: { status: 'RESOLVIDA', concluidaEm: new Date(), concluidaPor: String(actor.id) },
    });
  }

  const atualizada = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fichaId } });
  res.json(await montarRespostaCompleta(atualizada));
});

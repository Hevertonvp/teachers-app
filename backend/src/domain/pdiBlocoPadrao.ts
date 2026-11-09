import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ValidationError } from './errors.js';
import { isAplicacaoEditavelAgora } from './pdiAplicacoes.js';
import { editavelParaProfessor, fichaEditavelAgora } from './pdiFichas.js';

type Cliente = typeof prisma | Prisma.TransactionClient;

export type IdentidadeBloco = { aplicacaoId: number; alunoId: number; turmaId: number; professorId: number };

// Bloco gravado na fotografia da Ficha (turma e professor de quando ela nasceu) — leitura histórica.
export const identidadeDaFotografia = (ficha: { aplicacaoId: number; alunoId: number; turmaId: number; professorResponsavelId: number }): IdentidadeBloco => ({
  aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: ficha.turmaId, professorId: ficha.professorResponsavelId,
});

// Bloco de QUEM responde agora (DEF-14): turma ATUAL do aluno + professor responsável ATUAL
// (ProfessorTurmaDisciplina ativo). Igual à fotografia quando nada mudou; diferente depois de troca
// de turma ou substituição de professor — assim ninguém lê nem grava o bloco de outro professor.
// `null` quando a turma está sem professor responsável nessa disciplina.
export const identidadeBlocoAtual = (
  ficha: { aplicacaoId: number; alunoId: number },
  contexto: { aluno: { turmaId: number }; ptd: { professorId: number } | null },
): IdentidadeBloco | null => (contexto.ptd
  ? { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: contexto.aluno.turmaId, professorId: contexto.ptd.professorId }
  : null);

// Perguntas padrão compartilháveis que esta Ficha (pelo seu aplicacaoModeloId) de fato inclui —
// nunca todas as perguntas padrão da Aplicação: um Modelo criado com carregarPerguntasPadrao=false,
// ou que não incluía aquela pergunta específica, nunca mostra o que não carregou (ver schema.prisma,
// AplicacaoModeloPerguntaPadraoPdi).
export async function perguntasPadraoDaFicha(client: Cliente, aplicacaoModeloId: number) {
  const vinculos = await client.aplicacaoModeloPerguntaPadraoPdi.findMany({
    where: { aplicacaoModeloId },
    include: { aplicacaoPerguntaPadrao: true },
    orderBy: { aplicacaoPerguntaPadrao: { ordem: 'asc' } },
  });
  return vinculos.map((v) => v.aplicacaoPerguntaPadrao);
}

// Resolve o bloco existente ou cria sob demanda — mesmo idioma de obterOuCriarFichaAnual/
// obterOuCriarFichaReal: nunca usa upsert (o branch de update poderia sobrescrever createdBy à
// toa); se outra requisição venceu a corrida (P2002 na unique aplicacaoId+alunoId+turmaId+
// professorId), busca a vencedora fora da transação abortada.
export async function resolverOuCriarBloco(identidade: IdentidadeBloco, actorId: number) {
  const chave = {
    aplicacaoId_alunoId_turmaId_professorId: identidade,
  };
  const existente = await prisma.blocoRespostasPadraoPdi.findUnique({ where: chave });
  if (existente) return existente;

  try {
    // version:0 explícito (nunca o default do schema, 1) — o cliente que nunca viu este bloco
    // sempre lê version:0 (ver montarBlocoParaFicha), então o primeiro PUT precisa encontrar
    // exatamente 0 aqui, senão o optimistic lock rejeitaria o primeiríssimo salvamento como se já
    // houvesse um conflito que nunca existiu.
    return await prisma.blocoRespostasPadraoPdi.create({ data: { ...identidade, version: 0, createdBy: String(actorId) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const vencedor = await prisma.blocoRespostasPadraoPdi.findUnique({ where: chave });
      if (vencedor) return vencedor;
    }
    throw err;
  }
}

export async function existeCorrecaoBlocoAtiva(client: Cliente, blocoId: number): Promise<boolean> {
  const correcao = await client.correcaoBlocoPadraoPdi.findFirst({
    where: { blocoId, status: 'ABERTA', prazoAte: { gt: new Date() } },
    select: { id: true },
  });
  return !!correcao;
}

// Núcleo compartilhado (sem throw) entre a checagem de escrita e a leitura de "editavelAgora" na
// tela — evita buscar escola/reaberturas duas vezes para a mesma pergunta. `blocoId: null` =
// bloco ainda não existe (nenhuma resposta salva em nenhuma disciplina ainda) — nunca há correção
// ativa pra um bloco que não existe.
async function blocoEditavelAgoraSemThrow(
  client: Cliente,
  blocoId: number | null,
  aplicacao: { id: number; dataInicio: Date; dataFim: Date; status: string; escolaId: number },
): Promise<{ editavel: boolean; correcaoAtiva: boolean }> {
  const [escola, reaberturas, correcaoAtiva] = await Promise.all([
    client.escola.findUniqueOrThrow({ where: { id: aplicacao.escolaId } }),
    client.reaberturaPdi.findMany({ where: { aplicacaoId: aplicacao.id }, select: { dataInicio: true, dataFim: true } }),
    blocoId ? existeCorrecaoBlocoAtiva(client, blocoId) : Promise.resolve(false),
  ]);
  const editavel = aplicacao.status === 'ATIVA' && fichaEditavelAgora(
    escola.status === 'ATIVA',
    editavelParaProfessor(isAplicacaoEditavelAgora(aplicacao, reaberturas), correcaoAtiva),
  );
  return { editavel, correcaoAtiva };
}

// Mesma regra de editabilidade de uma Ficha (fichaEditavelAgora/editavelParaProfessor), só que a
// janela de correção individual é a do BLOCO (CorrecaoBlocoPadraoPdi), nunca a de uma Ficha
// específica — devolver a pergunta padrão reabre o bloco inteiro, não uma disciplina só.
export async function exigirBlocoEditavelAgora(
  client: Cliente,
  bloco: { id: number },
  aplicacao: { id: number; dataInicio: Date; dataFim: Date; status: string; escolaId: number },
): Promise<boolean> {
  const { editavel, correcaoAtiva } = await blocoEditavelAgoraSemThrow(client, bloco.id, aplicacao);
  if (!editavel) {
    throw new ValidationError('Este bloco de respostas padrão não está editável no momento (fora da vigência, sem reabertura ativa, ou a Aplicação foi removida).');
  }
  return correcaoAtiva;
}

const formatarPerguntaPadraoSnapshot = (p: {
  id: number; padraoOriginalId: number; secao: string; subsecao: string | null; codigo: string | null;
  texto: string; indicador: string | null; origem: string; tipoResposta: string; opcoes: unknown;
  complementar: unknown; ordem: number;
}) => ({
  id: p.id,
  padraoOriginalId: p.padraoOriginalId,
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

// Suficiente pra montar a seção "Perguntas padrão" dentro de uma Ficha (seção 21 do pedido) —
// nunca materializa o bloco numa leitura pura (GET nunca cria, mesmo padrão de Ficha/FichaAnual):
// se o bloco ainda não existe, perguntas vêm do snapshot (sempre existe se a Aplicação foi criada
// depois desta feature) e respostas/editavelAgora vêm vazios/neutros.
// `opcoes.identidade` (DEF-14): quem está preenchendo agora vê e edita o bloco DELE (turma atual do
// aluno + professor responsável atual), nunca o bloco de outro professor gravado na fotografia da
// Ficha. `null` = não há professor responsável agora: mostra o bloco da fotografia só para leitura.
// Sem `opcoes` (ex.: Correções da Secretaria) continua usando a fotografia — leitura histórica.
export async function montarBlocoParaFicha(ficha: {
  id: number; aplicacaoId: number; aplicacaoModeloId: number; alunoId: number; turmaId: number;
  professorResponsavelId: number; disciplinaId: number;
}, opcoes?: { identidade: IdentidadeBloco | null }) {
  const perguntas = await perguntasPadraoDaFicha(prisma, ficha.aplicacaoModeloId);
  if (perguntas.length === 0) return null; // este Modelo não tem nenhuma pergunta padrão compartilhável

  const somenteLeitura = opcoes !== undefined && opcoes.identidade === null;
  const identidade: IdentidadeBloco = opcoes?.identidade ?? identidadeDaFotografia(ficha);
  const [bloco, aplicacao, outrasFichas] = await Promise.all([
    prisma.blocoRespostasPadraoPdi.findUnique({ where: { aplicacaoId_alunoId_turmaId_professorId: identidade } }),
    prisma.aplicacaoPdi.findUniqueOrThrow({ where: { id: ficha.aplicacaoId } }),
    prisma.fichaPdi.findMany({
      where: { aplicacaoId: ficha.aplicacaoId, alunoId: ficha.alunoId, turmaId: identidade.turmaId, professorResponsavelId: identidade.professorId, disciplinaId: { not: ficha.disciplinaId } },
      select: { id: true, disciplinaId: true, disciplinaNomeSnapshot: true },
    }),
  ]);

  const [respostas, { editavel }] = await Promise.all([
    bloco ? prisma.respostaPadraoPdi.findMany({ where: { blocoId: bloco.id } }) : Promise.resolve([]),
    blocoEditavelAgoraSemThrow(prisma, bloco?.id ?? null, aplicacao),
  ]);

  return {
    blocoId: bloco?.id ?? null,
    version: bloco?.version ?? 0,
    perguntas: perguntas.map(formatarPerguntaPadraoSnapshot),
    respostas: respostas.map((r) => ({ id: r.id, aplicacaoPerguntaPadraoId: r.aplicacaoPerguntaPadraoId, valor: r.valor })),
    editavelAgora: editavel && !somenteLeitura,
    compartilhadoCom: outrasFichas.map((f) => ({ fichaId: f.id, disciplinaId: f.disciplinaId, disciplinaNome: f.disciplinaNomeSnapshot })),
  };
}

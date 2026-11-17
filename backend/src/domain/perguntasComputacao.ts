// Perguntas de Computação do PDI (17/11/2026) — bloco ADICIONAL, separado dos Modelos e das perguntas padrão.
//
// - Cadastradas em Configurações (PerguntaComputacaoPdi). Entram só nas Aplicações criadas DEPOIS: no
//   momento da criação viram linhas congeladas em AplicacaoPerguntaPdi (com `anos`), em cada Modelo da
//   Aplicação. Nada é aplicado a Aplicação/Ficha/resposta que já existia.
// - Cada aluno só vê as do SEU ano: a Ficha congela o ano do Fundamental da turma quando nasce
//   (anoSerieSnapshot). Educação Infantil (sem ano) e Fichas antigas (null) não recebem nenhuma.
// - Perguntas de Modelo têm `anos` vazio e continuam aparecendo sempre, exatamente como antes.
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export const VERSAO_BNCC_COMPUTACAO = 'BNCC-COMPUTACAO-2022';
export const SECAO_COMPUTACAO_PADRAO = 'Computação (BNCC)';
// Depois de todas as perguntas do Modelo (que usam ordens pequenas): o bloco de Computação vem no fim.
export const ORDEM_BASE_COMPUTACAO = 100000;

export const perguntaVisivelNaFicha = (pergunta: { anos: number[] | null }, anoSerie: number | null) =>
  !pergunta.anos || pergunta.anos.length === 0 || (anoSerie !== null && pergunta.anos.includes(anoSerie));

// Ano (1–9) que a Ficha congela ao nascer: só turmas do Fundamental têm ano.
export const anoSerieDaTurma = (turma: { etapa: string; anoSerie: number | null }) =>
  (turma.etapa === 'FUNDAMENTAL' && turma.anoSerie && turma.anoSerie >= 1 && turma.anoSerie <= 9 ? turma.anoSerie : null);

// Perguntas congeladas que ESTA Ficha mostra (Modelo + Computação do ano do aluno), em ordem.
export async function perguntasDaFicha(
  db: Db,
  ficha: { aplicacaoModeloId: number; anoSerieSnapshot: number | null },
  where: Prisma.AplicacaoPerguntaPdiWhereInput = {},
) {
  const todas = await db.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModeloId: ficha.aplicacaoModeloId, ...where }, orderBy: { ordem: 'asc' } });
  return todas.filter((p) => perguntaVisivelNaFicha(p, ficha.anoSerieSnapshot));
}

// Perguntas de Computação ATIVAS hoje, prontas para congelar numa Aplicação nova.
export async function perguntasComputacaoParaSnapshot(db: Db) {
  const ativas = await db.perguntaComputacaoPdi.findMany({ where: { status: 'ATIVA' }, orderBy: { ordem: 'asc' } });
  return ativas.map((p) => ({
    perguntaComputacaoIdOriginal: p.id,
    secao: p.secao,
    subsecao: null,
    codigo: p.codigo,
    texto: p.texto,
    indicador: null,
    origem: 'HABILIDADE' as const,
    tipoResposta: p.tipoResposta,
    opcoes: (p.opcoes ?? []) as Prisma.InputJsonValue,
    complementar: (p.complementar ?? undefined) as Prisma.InputJsonValue | undefined,
    ordem: ORDEM_BASE_COMPUTACAO + p.ordem,
    anos: p.anos,
    observacao: p.observacao,
  }));
}

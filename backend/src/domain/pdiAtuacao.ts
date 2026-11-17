// Formulário PDI de ATUAÇÃO pedagógica (17/11/2026, decisão do usuário) — hoje só o Professor TAE.
//
// - TAE continua atuação (nunca disciplina): a Ficha guarda `atuacaoId` em vez de `disciplinaId`.
// - Conteúdo: só as perguntas de Computação (domain/perguntasComputacao.ts), do ano do aluno; sem
//   Modelo e sem perguntas padrão.
// - Quem responde: o professor com vínculo ATIVO de TAE na turma do aluno (ProfessorTurmaAtuacao). Se a
//   turma tiver mais de um, vale o ligado PRIMEIRO (decisão do usuário) — os outros não recebem a
//   obrigação nem acesso de escrita a ela.
// - 1/3 não muda: nada aqui é lido pelo Formulário 1/3.
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

// Lista fixa (mesmo padrão de ATUACOES_SEM_TURMA em domain/cargos.ts): atuações com formulário PDI próprio.
export const ATUACOES_COM_FORMULARIO_PDI = ['TAE'];
const NOME_EXIBIDO: Record<string, string> = { TAE: 'Professor TAE' };
export const nomeFormularioAtuacao = (nome: string) => NOME_EXIBIDO[nome] ?? nome;

// Disciplinas com formulário PDI SÓ de Computação (17/11/2026, decisão do usuário): mesma regra do TAE (sem Modelo,
// sem perguntas padrão, só as perguntas de Computação do ano do aluno), mas é DISCIPLINA — a Ficha usa disciplinaId
// e o responsável é o professor da disciplina na turma, como em qualquer disciplina.
export const DISCIPLINAS_SO_COMPUTACAO = ['Informática'];
export async function disciplinasSoComputacao(db: Db) {
  return db.disciplina.findMany({ where: { nome: { in: DISCIPLINAS_SO_COMPUTACAO } }, orderBy: { id: 'asc' } });
}

export async function atuacoesComFormularioAtivas(db: Db) {
  return db.atuacaoPedagogica.findMany({ where: { nome: { in: ATUACOES_COM_FORMULARIO_PDI }, status: 'ATIVA' }, orderBy: { id: 'asc' } });
}

// Responsável de cada (turma, atuação com formulário): o vínculo ATIVO mais antigo (primeiro cadastrado).
// Devolve UM vínculo por par — nunca dois responsáveis pelo mesmo aluno.
export async function responsaveisPorAtuacao(db: Db, filtro: { turmaIds?: number[]; escolaIds?: number[]; atuacaoIds?: number[] }) {
  const vinculos = await db.professorTurmaAtuacao.findMany({
    where: {
      status: 'ATIVO',
      atuacao: { nome: { in: ATUACOES_COM_FORMULARIO_PDI } },
      ...(filtro.atuacaoIds ? { atuacaoId: { in: filtro.atuacaoIds } } : {}),
      ...(filtro.turmaIds ? { turmaId: { in: filtro.turmaIds } } : {}),
      turma: { status: 'ATIVA', ...(filtro.escolaIds ? { escolaId: { in: filtro.escolaIds } } : {}) },
    },
    include: { turma: { include: { escola: true } }, professor: true, atuacao: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const primeiro = new Map<string, (typeof vinculos)[number]>();
  for (const v of vinculos) {
    const chave = `${v.turmaId}-${v.atuacaoId}`;
    if (!primeiro.has(chave)) primeiro.set(chave, v);
  }
  return [...primeiro.values()];
}

export async function responsavelDaAtuacao(db: Db, turmaId: number, atuacaoId: number) {
  return (await responsaveisPorAtuacao(db, { turmaIds: [turmaId], atuacaoIds: [atuacaoId] }))[0] ?? null;
}

// Alvo de uma Ficha: disciplina OU atuação (exatamente um).
export type AlvoFicha = { disciplinaId: number | null; atuacaoId: number | null };
export const alvoDaFicha = (f: { disciplinaId: number | null; atuacaoId: number | null }): AlvoFicha => ({ disciplinaId: f.disciplinaId, atuacaoId: f.atuacaoId });
export const filtroDoAlvo = (alvo: AlvoFicha) => (alvo.disciplinaId !== null ? { disciplinaId: alvo.disciplinaId } : { atuacaoId: alvo.atuacaoId! });
// Chave textual estável (para Maps): "d12" ou "a44".
export const chaveDoAlvo = (alvo: AlvoFicha) => (alvo.disciplinaId !== null ? `d${alvo.disciplinaId}` : `a${alvo.atuacaoId}`);

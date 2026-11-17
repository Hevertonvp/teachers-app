import type { PrismaClient } from '@prisma/client';
import { responsaveisPorAtuacao } from '../domain/pdiAtuacao.js';

// Contagem de Fichas PDI esperadas, em preenchimento e concluídas, para VÁRIAS Aplicações de uma vez.
// É a regra de GET /api/pdi-aplicacoes/indicadores (que usa esta função desde 17/11/2026):
//   esperado = pares aluno × disciplina únicos, com ProfessorTurmaDisciplina ATIVO numa disciplina
//   da Aplicação, turma ATIVA da escola e AlunoPdi ATIVO na turma. Ficha nunca criada = não iniciada.
//   concluídas/em andamento só contam se o par também for esperado.
//   17/11/2026: + pares aluno × ATUAÇÃO com formulário próprio (Professor TAE) da Aplicação, quando a turma
//   tem um responsável dessa atuação (vínculo ativo; com mais de um, conta UMA vez — nunca duplica).
// Usada pelo Acompanhamento Escolar, pelos indicadores do PDI e pelo job da "foto". Só leitura; tudo em lote.
//
// LIMITAÇÃO conhecida (é o motivo da foto): o esperado usa os vínculos de HOJE, então para uma
// Aplicação já encerrada o número muda com transferências e trocas de professor.

export type AplicacaoParaContar = { id: number; escolaId: number; disciplinaIds: number[]; atuacaoIds?: number[] };
export type ContagemPorDisciplina = { esperado: number; concluidas: number; emAndamento: number };
export type ContagemAplicacao = {
  esperado: number;
  concluidas: number;
  emAndamento: number;
  porDisciplina: Map<number, ContagemPorDisciplina>;
  porAtuacao: Map<number, ContagemPorDisciplina>;
  // Instantes de conclusão das Fichas concluídas que contam (para a curva de ritmo).
  concluidasEm: Date[];
};

export async function contarFichasPdi(db: PrismaClient, aplicacoes: AplicacaoParaContar[]): Promise<Map<number, ContagemAplicacao>> {
  const resultado = new Map<number, ContagemAplicacao>();
  if (aplicacoes.length === 0) return resultado;
  const escolaIds = [...new Set(aplicacoes.map((a) => a.escolaId))];
  const algumaAtuacao = aplicacoes.some((a) => (a.atuacaoIds ?? []).length > 0);

  const [ptds, taes, fichas] = await Promise.all([
    db.professorTurmaDisciplina.findMany({
      where: { status: 'ATIVO', turma: { escolaId: { in: escolaIds }, status: 'ATIVA' } },
      select: { turmaId: true, disciplinaId: true, turma: { select: { escolaId: true } } },
    }),
    algumaAtuacao ? responsaveisPorAtuacao(db, { escolaIds }) : Promise.resolve([]),
    db.fichaPdi.findMany({
      where: { aplicacaoId: { in: aplicacoes.map((a) => a.id) }, status: { in: ['CONCLUIDA', 'EM_ANDAMENTO'] } },
      select: { aplicacaoId: true, alunoId: true, disciplinaId: true, atuacaoId: true, status: true, concluidaEm: true, updatedAt: true },
    }),
  ]);
  const turmaIds = [...new Set([...ptds.map((p) => p.turmaId), ...taes.map((t) => t.turmaId)])];
  const alunos = turmaIds.length
    ? await db.alunoPdi.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, select: { id: true, turmaId: true } })
    : [];
  const alunosPorTurma = new Map<number, number[]>();
  for (const a of alunos) alunosPorTurma.set(a.turmaId, [...(alunosPorTurma.get(a.turmaId) ?? []), a.id]);

  // Chave: "aluno-disciplina" (como sempre) ou "aluno-a<atuação>".
  const chaveDe = (alunoId: number, disciplinaId: number | null, atuacaoId: number | null) => (disciplinaId !== null ? `${alunoId}-${disciplinaId}` : `${alunoId}-a${atuacaoId}`);
  const fichasPorAplicacao = new Map<number, Map<string, (typeof fichas)[number]>>();
  for (const f of fichas) {
    if (!fichasPorAplicacao.has(f.aplicacaoId)) fichasPorAplicacao.set(f.aplicacaoId, new Map());
    fichasPorAplicacao.get(f.aplicacaoId)!.set(chaveDe(f.alunoId, f.disciplinaId, f.atuacaoId), f);
  }

  for (const aplicacao of aplicacoes) {
    const disciplinas = new Set(aplicacao.disciplinaIds);
    const atuacoes = new Set(aplicacao.atuacaoIds ?? []);
    const candidatos = new Map<string, { disciplinaId: number | null; atuacaoId: number | null }>();
    for (const ptd of ptds) {
      if (ptd.turma.escolaId !== aplicacao.escolaId || !disciplinas.has(ptd.disciplinaId)) continue;
      for (const alunoId of alunosPorTurma.get(ptd.turmaId) ?? []) candidatos.set(chaveDe(alunoId, ptd.disciplinaId, null), { disciplinaId: ptd.disciplinaId, atuacaoId: null });
    }
    for (const tae of taes) {
      if (tae.turma.escolaId !== aplicacao.escolaId || !atuacoes.has(tae.atuacaoId)) continue;
      for (const alunoId of alunosPorTurma.get(tae.turmaId) ?? []) candidatos.set(chaveDe(alunoId, null, tae.atuacaoId), { disciplinaId: null, atuacaoId: tae.atuacaoId });
    }
    const daAplicacao = fichasPorAplicacao.get(aplicacao.id) ?? new Map();
    const contagem: ContagemAplicacao = { esperado: candidatos.size, concluidas: 0, emAndamento: 0, porDisciplina: new Map(), porAtuacao: new Map(), concluidasEm: [] };
    for (const [chave, alvo] of candidatos) {
      const mapa = alvo.disciplinaId !== null ? contagem.porDisciplina : contagem.porAtuacao;
      const id = (alvo.disciplinaId ?? alvo.atuacaoId)!;
      const d = mapa.get(id) ?? { esperado: 0, concluidas: 0, emAndamento: 0 };
      d.esperado += 1;
      const ficha = daAplicacao.get(chave);
      if (ficha?.status === 'CONCLUIDA') {
        contagem.concluidas += 1; d.concluidas += 1;
        contagem.concluidasEm.push(ficha.concluidaEm ?? ficha.updatedAt ?? new Date());
      } else if (ficha?.status === 'EM_ANDAMENTO') {
        contagem.emAndamento += 1; d.emAndamento += 1;
      }
      mapa.set(id, d);
    }
    resultado.set(aplicacao.id, contagem);
  }
  return resultado;
}

import type { PrismaClient } from '@prisma/client';

// Contagem de Fichas PDI esperadas, em preenchimento e concluídas, para VÁRIAS Aplicações de uma vez.
// É a mesma regra de GET /api/pdi-aplicacoes/indicadores (pdiAplicacoes.ts), que continua com a sua
// cópia intocada:
//   esperado = pares aluno × disciplina únicos, com ProfessorTurmaDisciplina ATIVO numa disciplina
//   da Aplicação, turma ATIVA da escola e AlunoPdi ATIVO na turma. Ficha nunca criada = não iniciada.
//   concluídas/em andamento só contam se o par também for esperado.
// Usada pelo Acompanhamento Escolar e pelo job da "foto" do PDI. Só leitura; tudo em lote.
//
// LIMITAÇÃO conhecida (é o motivo da foto): o esperado usa os vínculos de HOJE, então para uma
// Aplicação já encerrada o número muda com transferências e trocas de professor.

export type AplicacaoParaContar = { id: number; escolaId: number; disciplinaIds: number[] };
export type ContagemPorDisciplina = { esperado: number; concluidas: number; emAndamento: number };
export type ContagemAplicacao = {
  esperado: number;
  concluidas: number;
  emAndamento: number;
  porDisciplina: Map<number, ContagemPorDisciplina>;
  // Instantes de conclusão das Fichas concluídas que contam (para a curva de ritmo).
  concluidasEm: Date[];
};

export async function contarFichasPdi(db: PrismaClient, aplicacoes: AplicacaoParaContar[]): Promise<Map<number, ContagemAplicacao>> {
  const resultado = new Map<number, ContagemAplicacao>();
  if (aplicacoes.length === 0) return resultado;
  const escolaIds = [...new Set(aplicacoes.map((a) => a.escolaId))];

  const [ptds, fichas] = await Promise.all([
    db.professorTurmaDisciplina.findMany({
      where: { status: 'ATIVO', turma: { escolaId: { in: escolaIds }, status: 'ATIVA' } },
      select: { turmaId: true, disciplinaId: true, turma: { select: { escolaId: true } } },
    }),
    db.fichaPdi.findMany({
      where: { aplicacaoId: { in: aplicacoes.map((a) => a.id) }, status: { in: ['CONCLUIDA', 'EM_ANDAMENTO'] } },
      select: { aplicacaoId: true, alunoId: true, disciplinaId: true, status: true, concluidaEm: true, updatedAt: true },
    }),
  ]);
  const turmaIds = [...new Set(ptds.map((p) => p.turmaId))];
  const alunos = turmaIds.length
    ? await db.alunoPdi.findMany({ where: { turmaId: { in: turmaIds }, status: 'ATIVO' }, select: { id: true, turmaId: true } })
    : [];
  const alunosPorTurma = new Map<number, number[]>();
  for (const a of alunos) alunosPorTurma.set(a.turmaId, [...(alunosPorTurma.get(a.turmaId) ?? []), a.id]);

  const fichasPorAplicacao = new Map<number, Map<string, (typeof fichas)[number]>>();
  for (const f of fichas) {
    if (!fichasPorAplicacao.has(f.aplicacaoId)) fichasPorAplicacao.set(f.aplicacaoId, new Map());
    fichasPorAplicacao.get(f.aplicacaoId)!.set(`${f.alunoId}-${f.disciplinaId}`, f);
  }

  for (const aplicacao of aplicacoes) {
    const disciplinas = new Set(aplicacao.disciplinaIds);
    const candidatos = new Map<string, number>(); // chave aluno-disciplina -> disciplinaId
    for (const ptd of ptds) {
      if (ptd.turma.escolaId !== aplicacao.escolaId || !disciplinas.has(ptd.disciplinaId)) continue;
      for (const alunoId of alunosPorTurma.get(ptd.turmaId) ?? []) candidatos.set(`${alunoId}-${ptd.disciplinaId}`, ptd.disciplinaId);
    }
    const daAplicacao = fichasPorAplicacao.get(aplicacao.id) ?? new Map();
    const contagem: ContagemAplicacao = { esperado: candidatos.size, concluidas: 0, emAndamento: 0, porDisciplina: new Map(), concluidasEm: [] };
    for (const [chave, disciplinaId] of candidatos) {
      const d = contagem.porDisciplina.get(disciplinaId) ?? { esperado: 0, concluidas: 0, emAndamento: 0 };
      d.esperado += 1;
      const ficha = daAplicacao.get(chave);
      if (ficha?.status === 'CONCLUIDA') {
        contagem.concluidas += 1; d.concluidas += 1;
        contagem.concluidasEm.push(ficha.concluidaEm ?? ficha.updatedAt ?? new Date());
      } else if (ficha?.status === 'EM_ANDAMENTO') {
        contagem.emAndamento += 1; d.emAndamento += 1;
      }
      contagem.porDisciplina.set(disciplinaId, d);
    }
    resultado.set(aplicacao.id, contagem);
  }
  return resultado;
}

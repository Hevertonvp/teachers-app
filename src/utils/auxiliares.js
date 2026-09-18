// Vínculo Auxiliar <-> Aluno (histórico). Regra de domínio: Auxiliar -> Aluno -> Turma ->
// Escola — nunca um vínculo direto Auxiliar->Turma ou Auxiliar->Escola. A turma/escola em que
// um Auxiliar atua é sempre derivada dos alunos que ele acompanha no momento.

// Vínculo ativo (no máximo um por aluno) de um aluno específico.
export const vinculoAtivoDoAluno = (vinculos, alunoId) => vinculos.find(item => item.alunoId === Number(alunoId) && item.status === 'ativo') || null;

// Todo o histórico de um aluno (mais recente primeiro).
export const historicoAuxiliaresDoAluno = (vinculos, alunoId) => vinculos
  .filter(item => item.alunoId === Number(alunoId))
  .sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio));

// Alunos atualmente acompanhados por um Auxiliar (só vínculos ativos) — a escola/turma de cada
// um vem do próprio registro do aluno (pdiAlunos), nunca de um vínculo paralelo.
export const alunosAtivosDoAuxiliar = (vinculos, auxiliarId) => new Set(
  vinculos.filter(item => item.auxiliarId === Number(auxiliarId) && item.status === 'ativo').map(item => item.alunoId),
);

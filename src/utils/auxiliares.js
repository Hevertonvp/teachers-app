// Vínculo Auxiliar <-> TURMA (histórico). Regra de domínio: Auxiliar -> Turma -> Alunos PDI
// daquela turma — nunca um vínculo direto Auxiliar->Aluno. Os alunos acompanhados por um
// Auxiliar são sempre derivados dos alunos PDI das turmas em que ele tem vínculo ativo no
// momento; no máximo um vínculo ativo por turma.

// Vínculo ativo (no máximo um) de uma turma específica.
export const vinculoAtivoDaTurma = (vinculos, turmaId) => vinculos.find(item => item.turmaId === Number(turmaId) && item.status === 'ativo') || null;

// Todo o histórico de vínculos de uma turma (mais recente primeiro).
export const historicoAuxiliaresDaTurma = (vinculos, turmaId) => vinculos
  .filter(item => item.turmaId === Number(turmaId))
  .sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio));

// Alunos PDI atualmente acompanhados por um Auxiliar: todo aluno PDI cuja turma tem vínculo
// ativo com esse Auxiliar agora — nunca um vínculo individual por aluno.
export const alunosDoAuxiliar = (vinculos, auxiliarId, pdiAlunos) => {
  const turmaIds = new Set(vinculos.filter(item => item.auxiliarId === Number(auxiliarId) && item.status === 'ativo').map(item => item.turmaId));
  return pdiAlunos.filter(aluno => turmaIds.has(aluno.turmaId));
};

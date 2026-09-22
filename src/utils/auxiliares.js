// Vínculo Auxiliar <-> TURMA (histórico). Regra de domínio: Auxiliar -> Turma -> Alunos PDI
// daquela turma — nunca um vínculo direto Auxiliar->Aluno. Os alunos acompanhados por um
// Auxiliar são sempre derivados dos alunos PDI das turmas em que ele tem vínculo ativo no
// momento; no máximo um vínculo ativo por turma.

// Vínculo ativo (no máximo um) de uma turma específica. Usado onde só a informação histórica
// importa (ex.: mostrar "Auxiliar responsável" para Professor/Gestor/Secretaria em
// AnamnesePage/PdiAlunoPerfil) — não implica, sozinho, acesso operacional do Auxiliar
// (ver acessoAtivoDaTurma abaixo).
export const vinculoAtivoDaTurma = (vinculos, turmaId) => vinculos.find(item => item.turmaId === Number(turmaId) && item.status === 'ativo') || null;

// Acesso operacional do Auxiliar a uma turma: exige vínculo ATIVO *e* turma ATIVA. Preservar o
// histórico do vínculo (dataInicio/dataFim/status) nunca implica preservar o acesso — turma
// inativada ou vínculo encerrado encerram o acesso imediatamente, mesmo com o registro mantido.
export const acessoAtivoDaTurma = (vinculos, turmas, turmaId) => {
  const vinculo = vinculoAtivoDaTurma(vinculos, turmaId);
  if (!vinculo) return null;
  const turma = turmas.find(item => item.id === Number(turmaId));
  return turma?.status === 'ativa' ? vinculo : null;
};

// Todo o histórico de vínculos de uma turma (mais recente primeiro) — consulta da Secretaria,
// sem nenhuma restrição de status (nem da turma, nem do vínculo).
export const historicoAuxiliaresDaTurma = (vinculos, turmaId) => vinculos
  .filter(item => item.turmaId === Number(turmaId))
  .sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio));

// Alunos PDI atualmente acompanhados por um Auxiliar: aluno PDI cuja turma ATUAL (aluno.turmaId)
// tem vínculo ativo com esse Auxiliar E cuja turma está ativa. Nunca um vínculo individual por
// aluno, e nunca concede acesso via turma inativada (só preserva o registro, não o acesso).
export const alunosDoAuxiliar = (vinculos, auxiliarId, pdiAlunos, turmas) => {
  const turmaIds = new Set(
    vinculos
      .filter(item => item.auxiliarId === Number(auxiliarId) && item.status === 'ativo')
      .map(item => item.turmaId)
      .filter(turmaId => turmas.find(turma => turma.id === turmaId)?.status === 'ativa'),
  );
  return pdiAlunos.filter(aluno => turmaIds.has(aluno.turmaId));
};

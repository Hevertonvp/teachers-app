import { apiFetch } from './api';

// Vínculo real Professor↔Turma↔Disciplina. Usa sempre `disciplinasReais` (DataContext) e as
// turmas reais já migradas — nunca o mock `disciplinas`/`turmaProfessores` (esses continuam só
// pra compatibilidade das telas antigas ainda não migradas, ver DataContext.jsx).
export const listarVinculosProfessorTurmaDisciplina = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value != null)),
  ).toString();
  return apiFetch(`/api/professor-turma-disciplina${query ? `?${query}` : ''}`);
};

export const criarVinculoProfessorTurmaDisciplina = (payload) => apiFetch('/api/professor-turma-disciplina', { method: 'POST', body: payload });

export const encerrarVinculoProfessorTurmaDisciplina = (id) => apiFetch(`/api/professor-turma-disciplina/${id}/encerrar`, { method: 'POST' });

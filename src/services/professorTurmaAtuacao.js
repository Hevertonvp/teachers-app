import { apiFetch } from './api';

// Vínculo Professor ↔ Turma por ATUAÇÃO pedagógica, sem disciplina (16/11/2026): "Regente da 1M1".
// Biblioteca, Professor de Intervenção e Eventual não têm turmas (a API recusa; a atuação vem com temTurmas=false).
export const listarVinculosProfessorTurmaAtuacao = (params = {}) => {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
  return apiFetch(`/api/professor-turma-atuacao${query ? `?${query}` : ''}`);
};
export const criarVinculoProfessorTurmaAtuacao = (payload) => apiFetch('/api/professor-turma-atuacao', { method: 'POST', body: payload });
export const encerrarVinculoProfessorTurmaAtuacao = (id) => apiFetch(`/api/professor-turma-atuacao/${id}/encerrar`, { method: 'POST' });

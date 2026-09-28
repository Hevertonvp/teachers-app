import { apiFetch } from './api';

// Vínculo real Auxiliar↔Turma (nunca Auxiliar↔Aluno — ver AuxiliarTurma no schema do backend).
export const listarAuxiliaresReais = () => apiFetch('/api/pessoas/auxiliares');

export const listarVinculosAuxiliarTurma = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value != null)),
  ).toString();
  return apiFetch(`/api/auxiliar-turma${query ? `?${query}` : ''}`);
};

export const criarVinculoAuxiliarTurma = (payload) => apiFetch('/api/auxiliar-turma', { method: 'POST', body: payload });

export const encerrarVinculoAuxiliarTurma = (id) => apiFetch(`/api/auxiliar-turma/${id}/encerrar`, { method: 'POST' });

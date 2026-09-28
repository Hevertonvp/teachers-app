import { apiFetch } from './api';

// VinculoEscolar real (Professor/Auxiliar) — cria, encerra (com cascata de
// ProfessorTurmaDisciplina/AuxiliarTurma daquela escola, feita no backend) e reativa (sem
// ressuscitar vínculos operacionais antigos).
export const listarVinculosEscolares = (pessoaId) => apiFetch(`/api/vinculos-escolares?pessoaId=${pessoaId}`);

export const criarVinculoEscolarReal = (payload) => apiFetch('/api/vinculos-escolares', { method: 'POST', body: payload });

export const encerrarVinculoEscolarReal = (id) => apiFetch(`/api/vinculos-escolares/${id}/encerrar`, { method: 'POST' });

export const reativarVinculoEscolarReal = (id) => apiFetch(`/api/vinculos-escolares/${id}/reativar`, { method: 'POST' });

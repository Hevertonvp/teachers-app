import { apiFetch } from './api';

// Formulário 1/3 real (backend /api/formulario-um-terco). Datas/horas de abertura, prazo e
// reabertura viajam como "YYYY-MM-DDTHH:mm" no horário de Brasília (o mesmo valor do
// <input type="datetime-local">); o backend devolve instantes ISO. Identidade do preenchimento:
// ciclo + anoSerie + disciplina (o professor é o usuário logado) — nunca escola/turma.
const BASE = '/api/formulario-um-terco';
const caminho = (cicloId, anoSerie, disciplinaId) => `${BASE}/ciclos/${cicloId}/formularios/${anoSerie}/${disciplinaId}`;

// --- Secretaria ---
export const listarCiclosUmTerco = () => apiFetch(`${BASE}/ciclos`);
export const criarCicloUmTerco = (dados) => apiFetch(`${BASE}/ciclos`, { method: 'POST', body: dados });
export const atualizarCicloUmTerco = (id, dados) => apiFetch(`${BASE}/ciclos/${id}`, { method: 'PUT', body: dados });
export const inativarCicloUmTerco = (id) => apiFetch(`${BASE}/ciclos/${id}/inativar`, { method: 'POST' });
export const reativarCicloUmTerco = (id) => apiFetch(`${BASE}/ciclos/${id}/reativar`, { method: 'POST' });
export const criarReaberturaUmTerco = (id, dados) => apiFetch(`${BASE}/ciclos/${id}/reaberturas`, { method: 'POST', body: dados });
export const obterPainelUmTerco = (id, filtros = {}) => {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))).toString();
  return apiFetch(`${BASE}/ciclos/${id}/painel${query ? `?${query}` : ''}`);
};
export const obterEntregaUmTerco = (cicloId, professorId, anoSerie, disciplinaId) => apiFetch(`${BASE}/ciclos/${cicloId}/entregas/${professorId}/${anoSerie}/${disciplinaId}`);

// --- Professor ---
export const listarMeusFormulariosUmTerco = () => apiFetch(`${BASE}/minhas`);
export const obterFormularioUmTerco = (cicloId, anoSerie, disciplinaId) => apiFetch(caminho(cicloId, anoSerie, disciplinaId));
export const caminhoRespostasUmTerco = (cicloId, anoSerie, disciplinaId) => `${caminho(cicloId, anoSerie, disciplinaId)}/respostas`;
export const salvarRespostasUmTerco = (cicloId, anoSerie, disciplinaId, respostas, baseUpdatedAt) => apiFetch(
  caminhoRespostasUmTerco(cicloId, anoSerie, disciplinaId),
  { method: 'PUT', body: { respostas, baseUpdatedAt: baseUpdatedAt ?? null } },
);
export const concluirFormularioUmTerco = (cicloId, anoSerie, disciplinaId, baseUpdatedAt) => apiFetch(
  `${caminho(cicloId, anoSerie, disciplinaId)}/concluir`,
  { method: 'POST', body: { baseUpdatedAt: baseUpdatedAt ?? null } },
);

// Fluxo de correções (10/11/2026): Secretaria devolve uma entrega concluída ao Professor (orientações
// obrigatórias, prazo fixo de 3 dias) e depois aceita a correção recebida.
export const devolverEntregaUmTerco = (entregaId, observacao) => apiFetch(`${BASE}/entregas/${entregaId}/devolver`, { method: 'POST', body: { observacao } });
export const aceitarCorrecaoUmTerco = (entregaId) => apiFetch(`${BASE}/entregas/${entregaId}/aceitar`, { method: 'POST', body: {} });

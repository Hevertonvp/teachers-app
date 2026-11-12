import { apiFetch } from './api';

// Correções → Formulário 1/3 (12/11/2026), só Secretaria. Devolver e "considerar resolvida" usam as rotas
// já existentes do 1/3 (devolverEntregaUmTerco / aceitarCorrecaoUmTerco em formularioUmTerco.js).
const BASE = '/api/correcoes-um-terco';

export const listarCorrecoesUmTerco = (filtros = {}) => {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))).toString();
  return apiFetch(`${BASE}${query ? `?${query}` : ''}`);
};
export const obterCorrecaoUmTerco = (entregaId) => apiFetch(`${BASE}/${entregaId}`);
export const corrigirUmTercoDiretamente = (entregaId, respostas, baseUpdatedAt) => apiFetch(`${BASE}/${entregaId}/respostas`, { method: 'PUT', body: { respostas, baseUpdatedAt } });

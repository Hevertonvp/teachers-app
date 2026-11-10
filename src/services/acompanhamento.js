import { apiFetch } from './api';

// Acompanhamento Escolar (backend /api/acompanhamento): só leitura. Secretaria vê a rede; Diretora,
// só as próprias escolas. Parâmetros: ano, trimestre (PDI), cicloId (1/3), atualizar (ignora o
// cache de 60 s do servidor).
const query = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const obterAcompanhamentoRede = (params = {}) => apiFetch(`/api/acompanhamento/rede${query(params)}`);
export const obterAcompanhamentoEscola = (escolaId, params = {}) => apiFetch(`/api/acompanhamento/escola/${escolaId}${query(params)}`);

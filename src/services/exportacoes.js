import { apiFetch } from './api';

// Dados para as planilhas de exportação (somente leitura). O backend aplica o mesmo escopo de
// acesso das telas; os filtros enviados são os mesmos que o usuário escolheu na tela.
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const obterExportacaoPdi = (filtros = {}) => apiFetch(`/api/pdi-fichas/exportacao${qs(filtros)}`);
export const obterExportacaoUmTerco = (cicloId, filtros = {}) => apiFetch(`/api/formulario-um-terco/ciclos/${cicloId}/exportacao${qs(filtros)}`);

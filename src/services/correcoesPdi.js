import { apiFetch } from './api';

// Correções > PDI real — exclusivo da Secretaria (backend garante, isto é só a camada de
// chamada HTTP). Nunca mexe em ReaberturaPdi/AplicacaoPdi; trabalha sempre sobre a FichaPdi real.
export const listarCorrecoesPdiReais = (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
  });
  const query = params.toString();
  return apiFetch(`/api/correcoes-pdi${query ? `?${query}` : ''}`);
};

export const obterCorrecaoPdiReal = (fichaId) => apiFetch(`/api/correcoes-pdi/${fichaId}`);

export const corrigirDiretamenteReal = (fichaId, respostas, baseUpdatedAt) => apiFetch(`/api/correcoes-pdi/${fichaId}/respostas`, {
  method: 'PUT',
  body: { respostas, baseUpdatedAt },
});

export const devolverFichaPdiReal = (fichaId, observacao) => apiFetch(`/api/correcoes-pdi/${fichaId}/devolver`, {
  method: 'POST',
  body: { observacao },
});

// Bloco comum de perguntas padrão (compartilhado entre as disciplinas do mesmo Professor) — fluxo
// SEPARADO do específico acima (nunca misturar, ver pdiModelos.ts/correcoesPdi.ts no backend).
export const corrigirDiretamentePadraoReal = (fichaId, respostas, version) => apiFetch(`/api/correcoes-pdi/${fichaId}/respostas-padrao`, {
  method: 'PUT',
  body: { respostas, version },
});

export const devolverPadraoReal = (fichaId, observacao) => apiFetch(`/api/correcoes-pdi/${fichaId}/devolver-padrao`, {
  method: 'POST',
  body: { observacao },
});

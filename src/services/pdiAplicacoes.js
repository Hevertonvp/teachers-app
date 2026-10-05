import { apiFetch } from './api';

// Aplicação/Reabertura PDI real — só a área de gestão da Secretaria (aba "Aplicações" de
// FormularioPdiPage.jsx) usa isso. O mock `pdiAplicacoes` (DataContext) continua existindo em
// paralelo: Fichas/Respostas/Meus PDIs/Dashboards ainda dependem dele (próximo bloco).
// Datas @db.Date do Postgres chegam como ISO completo ("2026-09-01T00:00:00.000Z") — o resto do
// app sempre tratou data como string pura 'YYYY-MM-DD' (ver utils/formAvailability.js), então
// normalizamos aqui, na fronteira, cortando a parte de hora.
const soData = (isoDate) => (isoDate ? isoDate.slice(0, 10) : isoDate);

const SOLICITADO_POR_FROM_API = { SECRETARIA: 'secretaria', GESTOR: 'gestor', DIRETORA: 'diretora', PROFESSOR: 'professor', AUXILIAR: 'auxiliar' };
const SOLICITADO_POR_TO_API = Object.fromEntries(Object.entries(SOLICITADO_POR_FROM_API).map(([api, front]) => [front, api]));

const normalizeAplicacao = (aplicacao) => ({
  ...aplicacao,
  dataInicio: soData(aplicacao.dataInicio),
  dataFim: soData(aplicacao.dataFim),
});

const normalizeReabertura = (reabertura) => ({
  ...reabertura,
  dataInicio: soData(reabertura.dataInicio),
  dataFim: soData(reabertura.dataFim),
  solicitadoPorTipo: SOLICITADO_POR_FROM_API[reabertura.solicitadoPorTipo] ?? reabertura.solicitadoPorTipo,
  createdAt: soData(reabertura.createdAt),
});

export const listarPdiAplicacoesReais = async () => (await apiFetch('/api/pdi-aplicacoes')).map(normalizeAplicacao);
// Indicadores REAIS de preenchimento (dashboard) — um item por escola, recalculado ao vivo no
// backend (nunca mock). Sem aplicação ativa no momento, a escola ainda aparece com contagem zero.
export const obterIndicadoresPdiReais = async () => apiFetch('/api/pdi-aplicacoes/indicadores');
export const obterPdiAplicacaoReal = async (id) => normalizeAplicacao(await apiFetch(`/api/pdi-aplicacoes/${id}`));
export const obterSnapshotPdiAplicacaoReal = async (id) => apiFetch(`/api/pdi-aplicacoes/${id}/snapshot`);

export const criarPdiAplicacaoReal = async (payload) => normalizeAplicacao(await apiFetch('/api/pdi-aplicacoes', {
  method: 'POST',
  body: {
    escolaId: Number(payload.escolaId),
    nome: payload.nome || null,
    dataInicio: payload.dataInicio,
    dataFim: payload.dataFim,
    // Omitido = backend usa todos os modelos ativos (compatibilidade); passar [] seria rejeitado
    // lá (precisa de ao menos 1), então só mandamos o campo quando há de fato uma seleção.
    ...(payload.modeloIds ? { modeloIds: payload.modeloIds.map(Number) } : {}),
  },
}));

export const editarPdiAplicacaoReal = async (id, payload) => normalizeAplicacao(await apiFetch(`/api/pdi-aplicacoes/${id}`, {
  method: 'PUT',
  body: { nome: payload.nome || null, dataInicio: payload.dataInicio, dataFim: payload.dataFim },
}));

// Nunca preenchida (zero RespostaPdi): o backend apaga de verdade (modo 'excluida'). Já tinha
// alguma resposta salva: o backend inativa (modo 'inativada') — sai de circulação, mas o histórico
// de Fichas/Respostas continua intacto. Já estava inativa: no-op (modo 'ja_estava_inativa').
export const removerPdiAplicacaoReal = async (id) => apiFetch(`/api/pdi-aplicacoes/${id}`, { method: 'DELETE' });

export const listarReaberturasPdiReais = async (aplicacaoId) => (await apiFetch(`/api/pdi-aplicacoes/${aplicacaoId}/reaberturas`)).map(normalizeReabertura);

export const criarReaberturaPdiReal = async (aplicacaoId, payload) => normalizeReabertura(await apiFetch(`/api/pdi-aplicacoes/${aplicacaoId}/reaberturas`, {
  method: 'POST',
  body: {
    dataInicio: payload.dataInicio,
    dataFim: payload.dataFim,
    solicitadoPorTipo: SOLICITADO_POR_TO_API[payload.solicitadoPorTipo] ?? payload.solicitadoPorTipo,
    motivo: payload.motivo || null,
  },
}));

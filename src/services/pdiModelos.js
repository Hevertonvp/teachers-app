import { apiFetch } from './api';

// Modelo/Pergunta PDI real — só a área de gestão da Secretaria (FormularioPdiPage.jsx) usa isso.
// O mock `pdiModelos` (DataContext) continua existindo em paralelo para telas ainda não migradas
// (Fichas/Respostas/Meus PDIs, próximo bloco). Normalizamos aqui, na fronteira, os enums
// maiúsculos do backend para o mesmo formato minúsculo que o resto do app já usa.
const STATUS_FROM_API = { ATIVA: 'ativa', INATIVA: 'inativa' };
const ORIGEM_FROM_API = { ESTRUTURADA: 'estruturada', HABILIDADE: 'habilidade', ORIENTACAO: 'orientacao', QUALITATIVA: 'qualitativa', PERSONALIZADA: 'personalizada' };
const ORIGEM_TO_API = Object.fromEntries(Object.entries(ORIGEM_FROM_API).map(([api, front]) => [front, api]));
const TIPO_FROM_API = { TEXTO: 'texto', SELECAO: 'selecao', MARCACAO: 'marcacao', NUMERO: 'numero', ORIENTACAO: 'orientacao' };
const TIPO_TO_API = Object.fromEntries(Object.entries(TIPO_FROM_API).map(([api, front]) => [front, api]));

// O resto do app (mock) sempre chamou o texto da pergunta de `pergunta` (nunca `texto`) — ver
// blankPergunta/render em FormularioPdiPage.jsx. Renomeamos aqui pra não precisar tocar em toda
// a UI já existente; o service é o único lugar que sabe que o backend chama isso de `texto`.
const normalizePergunta = ({ texto, ...pergunta }) => ({
  ...pergunta,
  pergunta: texto,
  origem: ORIGEM_FROM_API[pergunta.origem] ?? pergunta.origem,
  tipoResposta: TIPO_FROM_API[pergunta.tipoResposta] ?? pergunta.tipoResposta,
  status: STATUS_FROM_API[pergunta.status] ?? pergunta.status,
});

const normalizeModelo = (modelo) => ({
  ...modelo,
  status: STATUS_FROM_API[modelo.status] ?? modelo.status,
  ...(modelo.perguntas ? { perguntas: modelo.perguntas.map(normalizePergunta) } : {}),
});

const paraPayloadPergunta = (payload) => ({
  secao: payload.secao,
  subsecao: payload.subsecao || null,
  codigo: payload.codigo || null,
  texto: payload.pergunta ?? payload.texto,
  indicador: payload.indicador || null,
  origem: ORIGEM_TO_API[payload.origem] ?? payload.origem,
  tipoResposta: TIPO_TO_API[payload.tipoResposta] ?? payload.tipoResposta,
  opcoes: payload.opcoes || [],
  complementar: payload.complementar || null,
});

export const listarPdiModelosReais = async () => (await apiFetch('/api/pdi-modelos')).map(normalizeModelo);
export const obterPdiModeloReal = async (id) => normalizeModelo(await apiFetch(`/api/pdi-modelos/${id}`));
export const criarPdiModeloReal = async (payload) => normalizeModelo(await apiFetch('/api/pdi-modelos', { method: 'POST', body: payload }));
export const inativarPdiModeloReal = async (id) => normalizeModelo(await apiFetch(`/api/pdi-modelos/${id}/inativar`, { method: 'POST' }));
export const reativarPdiModeloReal = async (id) => normalizeModelo(await apiFetch(`/api/pdi-modelos/${id}/reativar`, { method: 'POST' }));

export const criarPdiModeloPerguntaReal = async (modeloId, payload) => normalizePergunta(await apiFetch(`/api/pdi-modelos/${modeloId}/perguntas`, { method: 'POST', body: paraPayloadPergunta(payload) }));
export const editarPdiModeloPerguntaReal = async (perguntaId, payload) => normalizePergunta(await apiFetch(`/api/pdi-perguntas/${perguntaId}`, { method: 'PUT', body: paraPayloadPergunta(payload) }));
export const inativarPdiPerguntaReal = async (id) => normalizePergunta(await apiFetch(`/api/pdi-perguntas/${id}/inativar`, { method: 'POST' }));
export const reativarPdiPerguntaReal = async (id) => normalizePergunta(await apiFetch(`/api/pdi-perguntas/${id}/reativar`, { method: 'POST' }));
export const reordenarPdiModeloPerguntasReais = async (modeloId, ordens) => (await apiFetch(`/api/pdi-modelos/${modeloId}/perguntas/reordenar`, { method: 'POST', body: { ordens } })).map(normalizePergunta);

import { apiFetch } from './api';

// Template GLOBAL de perguntas padrão (gerenciado em Configurações) — mesma normalização de
// enums maiúsculos->minúsculos já usada em pdiModelos.js, pro resto da UI reaproveitar os mesmos
// componentes de edição de pergunta (FormularioPdiPage.jsx).
const STATUS_FROM_API = { ATIVA: 'ativa', INATIVA: 'inativa' };
const ORIGEM_FROM_API = { ESTRUTURADA: 'estruturada', HABILIDADE: 'habilidade', ORIENTACAO: 'orientacao', QUALITATIVA: 'qualitativa', PERSONALIZADA: 'personalizada' };
const ORIGEM_TO_API = Object.fromEntries(Object.entries(ORIGEM_FROM_API).map(([api, front]) => [front, api]));
const TIPO_FROM_API = { TEXTO: 'texto', SELECAO: 'selecao', MARCACAO: 'marcacao', NUMERO: 'numero', ORIENTACAO: 'orientacao' };
const TIPO_TO_API = Object.fromEntries(Object.entries(TIPO_FROM_API).map(([api, front]) => [front, api]));

const normalizePergunta = ({ texto, ...pergunta }) => ({
  ...pergunta,
  pergunta: texto,
  origem: ORIGEM_FROM_API[pergunta.origem] ?? pergunta.origem,
  tipoResposta: TIPO_FROM_API[pergunta.tipoResposta] ?? pergunta.tipoResposta,
  status: STATUS_FROM_API[pergunta.status] ?? pergunta.status,
});

const paraPayload = (payload) => ({
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

export const listarPdiPerguntasPadraoReais = async () => (await apiFetch('/api/pdi-perguntas-padrao')).map(normalizePergunta);
export const criarPdiPerguntaPadraoReal = async (payload) => normalizePergunta(await apiFetch('/api/pdi-perguntas-padrao', { method: 'POST', body: paraPayload(payload) }));
export const editarPdiPerguntaPadraoReal = async (id, payload) => normalizePergunta(await apiFetch(`/api/pdi-perguntas-padrao/${id}`, { method: 'PUT', body: paraPayload(payload) }));
export const inativarPdiPerguntaPadraoReal = async (id) => normalizePergunta(await apiFetch(`/api/pdi-perguntas-padrao/${id}/inativar`, { method: 'POST' }));
export const reativarPdiPerguntaPadraoReal = async (id) => normalizePergunta(await apiFetch(`/api/pdi-perguntas-padrao/${id}/reativar`, { method: 'POST' }));
export const excluirPdiPerguntaPadraoReal = async (id) => apiFetch(`/api/pdi-perguntas-padrao/${id}`, { method: 'DELETE' });
export const reordenarPdiPerguntasPadraoReais = async (ordens) => (await apiFetch('/api/pdi-perguntas-padrao/reordenar', { method: 'POST', body: { ordens } })).map(normalizePergunta);

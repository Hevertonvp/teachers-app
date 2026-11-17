import { apiFetch } from './api';

// Perguntas de Computação do PDI (17/11/2026, Configurações) — tipos em minúsculas na tela, como o resto do PDI.
const TIPO_FROM_API = { TEXTO: 'texto', SELECAO: 'selecao', MARCACAO: 'marcacao', NUMERO: 'numero', ORIENTACAO: 'orientacao', HABILIDADE_COMPUTACAO: 'habilidade_computacao' };
const TIPO_TO_API = Object.fromEntries(Object.entries(TIPO_FROM_API).map(([api, front]) => [front, api]));
const normalizar = (p) => ({ ...p, tipoResposta: TIPO_FROM_API[p.tipoResposta] ?? p.tipoResposta, status: p.status === 'ATIVA' ? 'ativa' : 'inativa' });
const paraPayload = (v) => ({
  habilidadeId: v.tipoResposta === 'habilidade_computacao' ? null : (v.habilidadeId ? Number(v.habilidadeId) : null),
  anos: v.anos || [],
  secao: v.secao || null,
  texto: v.texto,
  observacao: v.observacao || null,
  tipoResposta: TIPO_TO_API[v.tipoResposta] ?? v.tipoResposta,
  opcoes: v.tipoResposta === 'selecao' ? (v.opcoes || []) : [],
  complementar: v.complementar || null,
});

export const listarPerguntasComputacao = async () => (await apiFetch('/api/pdi-perguntas-computacao')).map(normalizar);
export const criarPerguntaComputacao = async (v) => normalizar(await apiFetch('/api/pdi-perguntas-computacao', { method: 'POST', body: paraPayload(v) }));
export const editarPerguntaComputacao = async (id, v) => normalizar(await apiFetch(`/api/pdi-perguntas-computacao/${id}`, { method: 'PUT', body: paraPayload(v) }));
export const mudarStatusPerguntaComputacao = async (id, ativar) => normalizar(await apiFetch(`/api/pdi-perguntas-computacao/${id}/${ativar ? 'reativar' : 'inativar'}`, { method: 'POST' }));
export const excluirPerguntaComputacao = async (id) => apiFetch(`/api/pdi-perguntas-computacao/${id}`, { method: 'DELETE' });
export const reordenarPerguntasComputacao = async (ordens) => (await apiFetch('/api/pdi-perguntas-computacao/reordenar', { method: 'POST', body: { ordens } })).map(normalizar);

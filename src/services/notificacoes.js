import { apiFetch } from './api';

// Central de Notificações real (Neon) — igual padrão de services/mensagens.js.

export const listarNotificacoesReais = async () => apiFetch('/api/notificacoes');

export const contarNotificacoesNaoLidasReal = async () => apiFetch('/api/notificacoes/nao-lidas');

export const marcarNotificacaoComoLidaReal = async (id) => apiFetch(`/api/notificacoes/${id}/marcar-lida`, { method: 'POST' });

export const marcarTodasNotificacoesComoLidasReal = async () => apiFetch('/api/notificacoes/marcar-todas-lidas', { method: 'POST' });

export const obterChavePublicaPushReal = async () => apiFetch('/api/notificacoes/push/chave-publica');

export const assinarPushReal = async ({ endpoint, keys, userAgent }) => apiFetch('/api/notificacoes/push/assinar', {
  method: 'POST',
  body: { endpoint, keys, userAgent },
});

export const desassinarPushReal = async (endpoint) => apiFetch('/api/notificacoes/push/desassinar', {
  method: 'POST',
  body: { endpoint },
});

import { apiFetch } from './api';

// Mensagens real (Neon) — substitui o mock antigo em DataContext.jsx/utils/mensagens.js. Sem
// normalização de enum porque o backend já devolve os perfis em maiúsculo (PerfilPessoa) e esta
// tela nova trabalha direto com esses valores, sem precisar do formato minúsculo usado pelo
// restante do mock antigo.

export const listarDestinatariosReais = async (escolaId) => apiFetch(`/api/mensagens/destinatarios${escolaId ? `?escolaId=${escolaId}` : ''}`);

export const listarConversasReais = async () => apiFetch('/api/mensagens/conversas');

export const obterConversaReal = async (id) => apiFetch(`/api/mensagens/conversas/${id}`);

export const criarConversaReal = async ({ destinatarios, assunto, conteudo }) => apiFetch('/api/mensagens/conversas', {
  method: 'POST',
  body: { destinatarios, assunto, conteudo },
});

export const responderConversaReal = async (conversaId, conteudo) => apiFetch(`/api/mensagens/conversas/${conversaId}/respostas`, {
  method: 'POST',
  body: { conteudo },
});

export const marcarConversaComoLidaReal = async (conversaId) => apiFetch(`/api/mensagens/conversas/${conversaId}/marcar-lida`, { method: 'POST' });

export const ocultarConversaReal = async (conversaId) => apiFetch(`/api/mensagens/conversas/${conversaId}/ocultar`, { method: 'POST' });

export const contarNaoLidasReal = async () => apiFetch('/api/mensagens/nao-lidas');

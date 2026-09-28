const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'authToken';

let authToken = null;
let onUnauthorized = null;
let onSenhaTemporariaPendente = null;

try {
  authToken = localStorage.getItem(TOKEN_KEY);
} catch {
  authToken = null;
}

export const getAuthToken = () => authToken;

export function setAuthToken(token) {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage indisponível (modo privado etc.): o token vale só até recarregar a página.
  }
}

// Chamado quando o backend rejeita um token que enviamos (expirado/inválido) — o AuthContext
// registra aqui o logout, para o usuário voltar ao login em vez de ficar preso em telas com erro.
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

// Chamado quando o backend recusa uma chamada porque a conta ainda está com senha temporária
// pendente (ver bloquearSenhaTemporariaPendente no backend) — o AuthContext usa isso pra marcar
// o usuário como pendente mesmo que essa informação não estivesse atualizada no estado local
// (ex.: um reset administrativo aconteceu no meio da sessão).
export const setSenhaTemporariaPendenteHandler = (handler) => { onSenhaTemporariaPendente = handler; };

// Cliente HTTP mínimo para o backend real. Lança sempre que a resposta não for OK (nunca engole
// erro em silêncio) — quem chamar decide o que fazer (mostrar mensagem, manter dados antigos, etc.).
export async function apiFetch(path, options = {}) {
  const { body, headers, ...rest } = options;
  const tokenEnviado = authToken;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(tokenEnviado ? { Authorization: `Bearer ${tokenEnviado}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && tokenEnviado && tokenEnviado === authToken) onUnauthorized?.();
    if (response.status === 403 && data?.codigo === 'SENHA_TEMPORARIA_PENDENTE') onSenhaTemporariaPendente?.();
    throw new Error(data?.message || 'Ocorreu um erro inesperado ao comunicar com o servidor.');
  }

  return data;
}

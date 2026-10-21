const API_URL = import.meta.env.VITE_API_URL;
export const API_BASE_URL = API_URL;
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

// Avisado sempre que uma chamada falha por motivo de REDE (nunca por erro de negócio — 4xx/5xx
// com resposta é "online", só sem resposta nenhuma é "offline") ou quando volta a funcionar — a
// infraestrutura offline (src/offline/networkStatus.js) se registra aqui em vez de fazer ping
// próprio: toda chamada real da aplicação já serve como sinal de conectividade, sem polling extra.
let onNetworkFailure = null;
let onNetworkSuccess = null;
export const setNetworkStatusHandlers = (handlers) => {
  onNetworkFailure = handlers?.onFailure ?? null;
  onNetworkSuccess = handlers?.onSuccess ?? null;
};

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
    onNetworkFailure?.();
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.');
  }
  // Teve resposta (mesmo 4xx/5xx) = a rede está de pé, só uma regra de negócio recusou a chamada.
  onNetworkSuccess?.();

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && tokenEnviado && tokenEnviado === authToken) onUnauthorized?.();
    if (response.status === 403 && data?.codigo === 'SENHA_TEMPORARIA_PENDENTE') onSenhaTemporariaPendente?.();
    const erro = new Error(data?.message || 'Ocorreu um erro inesperado ao comunicar com o servidor.');
    // Infra offline (seção "Conflitos"): quem chamou decide o que fazer com o conflito — nunca
    // tratado genericamente aqui, cada tela sabe como preservar o próprio rascunho local.
    if (data?.codigo) erro.codigo = data.codigo;
    if (data?.dadosAtuais !== undefined) erro.dadosAtuais = data.dadosAtuais;
    throw erro;
  }

  return data;
}

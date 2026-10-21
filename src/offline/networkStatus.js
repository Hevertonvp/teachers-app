// Rotina ÚNICA e global de reconexão (seção "Eficiência" do pedido: nunca um timer por
// formulário, nunca polling enquanto online). Só entra em modo de retry depois de uma falha de
// rede REAL reportada por apiFetch (nunca por conta própria) ou do evento nativo `offline` — a
// confirmação de volta é sempre uma chamada real à API (`/health`, já existente, sem consulta ao
// banco), nunca só `navigator.onLine` (ver api.js: setNetworkStatusHandlers).
import { API_BASE_URL, setNetworkStatusHandlers } from '../services/api';

const ESCADA_RETRY_SEGUNDOS = [5, 10, 20, 30, 60]; // depois do último, repete 60s indefinidamente

let online = true;
let retryInSeconds = null;
let timeoutId = null;
let escadaIndex = 0;
let checandoAgora = false;

const listeners = new Set();
const notify = () => listeners.forEach((l) => l(getSnapshot()));

export const getSnapshot = () => ({ online, retryInSeconds });
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function pingHealth() {
  try {
    const resposta = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    return resposta.ok;
  } catch {
    return false;
  }
}

function limparTimer() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
}

function agendarProximaTentativa() {
  limparTimer();
  const segundos = ESCADA_RETRY_SEGUNDOS[Math.min(escadaIndex, ESCADA_RETRY_SEGUNDOS.length - 1)];
  retryInSeconds = segundos;
  notify();
  timeoutId = setTimeout(tentarReconectar, segundos * 1000);
}

async function tentarReconectar() {
  if (online) return; // já reconectou por outro caminho (evento online, chamada real com sucesso)
  checandoAgora = true;
  const ok = await pingHealth();
  checandoAgora = false;
  if (ok) {
    marcarOnline();
    return;
  }
  escadaIndex = Math.min(escadaIndex + 1, ESCADA_RETRY_SEGUNDOS.length - 1);
  agendarProximaTentativa();
}

function marcarOnline() {
  limparTimer();
  escadaIndex = 0;
  retryInSeconds = null;
  const estavaOffline = !online;
  online = true;
  notify();
  if (estavaOffline) listeners.forEach((l) => l(getSnapshot(), { reconectou: true }));
}

function marcarOffline() {
  if (!online) return; // já sabíamos
  online = false;
  escadaIndex = 0;
  notify();
  agendarProximaTentativa();
}

// --- Gatilhos --------------------------------------------------------------------------------
// apiFetch chama isto a cada chamada real da app — é o único "ping" que existe enquanto online,
// nunca um polling extra.
export function reportarFalhaDeRede() { marcarOffline(); }
export function reportarSucessoDeRede() { marcarOnline(); }

// Evento nativo `offline`: entra em modo retry imediatamente, sem esperar a próxima chamada falhar.
window.addEventListener?.('offline', marcarOffline);
// Evento nativo `online`: nunca confiamos só nisso (pode ser falso positivo, ex.: Wi-Fi conectado
// sem internet real) — dispara uma tentativa REAL imediata em vez de assumir reconectado.
window.addEventListener?.('online', () => {
  if (!online && !checandoAgora) tentarReconectar();
});

// Ação manual ("tentar agora") — mesma rotina da escada, só adiantada.
export function tentarAgora() {
  if (!online && !checandoAgora) tentarReconectar();
}

// Registrado aqui (não em api.js) pra api.js nunca precisar importar nada deste módulo —
// quem consome é que se registra, evitando import circular.
setNetworkStatusHandlers({ onFailure: reportarFalhaDeRede, onSuccess: reportarSucessoDeRede });

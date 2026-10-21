// Fila local de escrita pendente — idempotente (cada recurso+operação é UMA linha, salvar de
// novo só atualiza; nunca duplica), só removida após confirmação 2xx real do backend (seção
// "Fila offline" do pedido). Uma única rotina de flush, nunca um timer por formulário.
import { apiFetch } from '../services/api';
import { salvarNaFila, lerDaFila, apagarDaFila, listarFilaDoUsuario } from './db';
import { subscribe as subscribeNetworkStatus, getSnapshot as getNetworkSnapshot } from './networkStatus';

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
export const subscribeFila = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Canal leve nativo do navegador (seção "Múltiplas abas" do pedido) — nunca WebSocket, nunca
// polling: só avisa as outras abas que algo mudou na fila, pra badge/contador ficar correto sem
// cada aba reimplementar sua própria verificação.
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('teachers-app-offline-sync') : null;
canal?.addEventListener('message', () => notify());
const avisarOutrasAbas = () => canal?.postMessage({ tipo: 'mudou' });

export const chaveFila = (userId, resourceType, resourceId, operation) => `${userId}::${resourceType}::${resourceId}::${operation}`;

export async function enfileirar({ userId, resourceType, resourceId, operation, endpoint, method, payload, baseTokenField, baseToken }) {
  const key = chaveFila(userId, resourceType, resourceId, operation);
  await salvarNaFila({
    key, userId, resourceType, resourceId, operation, endpoint, method, payload, baseTokenField, baseToken,
    status: 'pending', savedAt: Date.now(), attempts: 0, lastError: null, dadosAtuais: null,
  });
  notify();
  avisarOutrasAbas();
  if (getNetworkSnapshot().online) flushTudo(userId);
  return key;
}

export const obterItemDaFila = (key) => lerDaFila(key);
export async function removerDaFila(key) {
  await apagarDaFila(key);
  notify();
  avisarOutrasAbas();
}
export const listarPendentes = (userId) => listarFilaDoUsuario(userId);

// O usuário atual é registrado pelo AuthContext (login/logout) — syncQueue nunca importa
// AuthContext diretamente (evita import circular), só guarda o id em memória.
let usuarioAtualId = null;
export function registrarUsuarioAtual(userId) { usuarioAtualId = userId ?? null; }

let flushando = false;

// Uma única rotina global de flush (seção "Eficiência"): nunca duas em paralelo na MESMA aba
// (flag em memória) nem em abas diferentes (Web Locks API — mecanismo nativo leve, seção
// "Múltiplas abas"; se o navegador não suportar, degrada para "sem essa proteção extra", nunca
// quebra). Verifica a versão do recurso antes de cada envio (campo baseTokenField/baseToken) —
// nunca sobrescreve silenciosamente (seção "Conflitos").
export async function flushTudo(userId) {
  if (!userId || flushando) return;
  const executar = async () => {
    flushando = true;
    try {
      const pendentes = await listarFilaDoUsuario(userId);
      for (const item of pendentes.filter((i) => i.status === 'pending' || i.status === 'error')) {
        if (!getNetworkSnapshot().online) break; // caiu de novo no meio da fila — a escada de retry assume
        await enviarUm(item);
      }
    } finally {
      flushando = false;
      notify();
      avisarOutrasAbas();
    }
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request('teachers-app-offline-sync-flush', { ifAvailable: true }, async (lock) => {
      if (!lock) return; // outra aba já está sincronizando agora
      await executar();
    });
  } else {
    await executar();
  }
}

async function enviarUm(item) {
  try {
    await salvarNaFila({ ...item, status: 'syncing' });
    notify();
    const body = { ...item.payload, [item.baseTokenField]: item.baseToken };
    await apiFetch(item.endpoint, { method: item.method, body });
    await apagarDaFila(item.key); // só remove após confirmação 2xx real
  } catch (error) {
    if (error.codigo === 'CONFLITO_VERSAO') {
      // Nunca sobrescreve: marca conflito, preserva o rascunho local, para de tentar essa linha
      // sozinha — quem decide o próximo passo é a tela (ver dadosAtuais).
      await salvarNaFila({ ...item, status: 'conflict', dadosAtuais: error.dadosAtuais, lastError: error.message });
      return;
    }
    if (!error.codigo && /conectar ao servidor/.test(error.message || '')) {
      // Falha de REDE (não de negócio) — a escada de retry do networkStatus já assume a partir
      // daqui; devolve a linha pra "pending" e para de processar o resto da fila agora.
      await salvarNaFila({ ...item, status: 'pending', attempts: (item.attempts || 0) + 1, lastError: error.message });
      throw error;
    }
    // Erro de negócio real (validação etc.) — nunca adianta re-tentar sozinho; fica visível como
    // erro, mas não trava o resto da fila.
    await salvarNaFila({ ...item, status: 'error', attempts: (item.attempts || 0) + 1, lastError: error.message });
  }
}

// Reconectou (qualquer aba) -> tenta sincronizar a fila do usuário atual automaticamente.
subscribeNetworkStatus((_snapshot, meta) => {
  if (meta?.reconectou && usuarioAtualId) flushTudo(usuarioAtualId);
});

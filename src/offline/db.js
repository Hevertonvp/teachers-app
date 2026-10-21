// IndexedDB mínimo, sem biblioteca externa (infraestrutura de resiliência offline). Duas stores:
//   - `drafts`: rascunho local "de leitura" — sobrevive a reload/fechamento, nunca sincroniza por
//     conta própria (quem decide enviar é sempre uma ação explícita da tela, ex.: Mensagens).
//   - `queue`: operações pendentes de ESCRITA real no servidor — cada linha é idempotente por
//     `key` (identidade do recurso+operação; salvar de novo só ATUALIZA a mesma linha, nunca
//     cria uma segunda — ver syncQueue.js). Só é removida após confirmação 2xx real do backend.
// Isolamento por usuário (seção "Logout" do pedido): toda chave inclui o userId; nunca apagamos
// nada no logout, só deixamos de ler/escrever fora do namespace do usuário atual.
const DB_NAME = 'teachers-app-offline';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_QUEUE = 'queue';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        const store = db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
        store.createIndex('byUser', 'userId');
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'key' });
        store.createIndex('byUser', 'userId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// Nunca lança pra fora: IndexedDB indisponível (modo privado restrito, navegador antigo) nunca
// pode quebrar a tela — só degrada pra "sem proteção offline nesta sessão" (apiFetch continua
// funcionando normalmente quando online).
async function withStore(storeName, mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.error(`[offline-db] falha ao acessar ${storeName}`, error);
    return undefined;
  }
}

const requestToPromise = (store, method, ...args) => new Promise((resolve, reject) => {
  const req = store[method](...args);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

// --- drafts (restaurar/ler, nunca sincroniza por conta própria) ------------------------------
export const salvarDraft = (key, value) => withStore(STORE_DRAFTS, 'readwrite', (store) => store.put({ key, ...value }));
export const lerDraft = async (key) => withStore(STORE_DRAFTS, 'readonly', (store) => requestToPromise(store, 'get', key));
export const apagarDraft = (key) => withStore(STORE_DRAFTS, 'readwrite', (store) => store.delete(key));
export const listarDraftsDoUsuario = async (userId) => (await withStore(STORE_DRAFTS, 'readonly', (store) => requestToPromise(store.index('byUser'), 'getAll', userId))) || [];

// --- queue (fila de escrita pendente, idempotente por key) -----------------------------------
export const salvarNaFila = (item) => withStore(STORE_QUEUE, 'readwrite', (store) => store.put(item));
export const lerDaFila = async (key) => withStore(STORE_QUEUE, 'readonly', (store) => requestToPromise(store, 'get', key));
export const apagarDaFila = (key) => withStore(STORE_QUEUE, 'readwrite', (store) => store.delete(key));
export const listarFilaDoUsuario = async (userId) => (await withStore(STORE_QUEUE, 'readonly', (store) => requestToPromise(store.index('byUser'), 'getAll', userId))) || [];

// Limpeza (seção "Limpeza" do pedido): só itens JÁ sincronizados podem ser varridos por idade —
// a fila (`queue`) nunca é tocada aqui, só `drafts` órfãos (ex.: rascunho de uma Ficha que já foi
// sincronizada e confirmada há muito tempo, mantido só como cache de leitura).
export const limparDraftsAntigos = async (userId, maisVelhoQueMs) => {
  const agora = Date.now();
  const drafts = await listarDraftsDoUsuario(userId);
  await Promise.all(
    drafts
      .filter((d) => d.sincronizado && agora - (d.savedAt ?? 0) > maisVelhoQueMs)
      .map((d) => apagarDraft(d.key)),
  );
};

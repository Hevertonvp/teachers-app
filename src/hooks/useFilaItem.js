import { useEffect, useState } from 'react';
import { chaveFila, obterItemDaFila, subscribeFila } from '../offline/syncQueue';

// Observa o estado (na fila local) de UM recurso específico — usado pela tela pra saber se há
// algo pendente/em conflito pra ESTE formulário, sem reimplementar a leitura do IndexedDB.
export function useFilaItem(userId, resourceType, resourceId, operation) {
  const [item, setItem] = useState(null);
  const key = userId && resourceId ? chaveFila(userId, resourceType, resourceId, operation) : null;

  useEffect(() => {
    if (!key) { setItem(null); return undefined; }
    let ativo = true;
    const carregar = () => { obterItemDaFila(key).then((r) => { if (ativo) setItem(r || null); }); };
    carregar();
    const unsubscribe = subscribeFila(carregar);
    return () => { ativo = false; unsubscribe(); };
  }, [key]);

  return item;
}

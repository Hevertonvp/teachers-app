import { useEffect, useState } from 'react';
import { listarPendentes, subscribeFila } from '../offline/syncQueue';

// Resumo da fila do usuário atual (contador global) — usado só pelo SyncStatusBanner.
export function useFilaResumo(userId) {
  const [resumo, setResumo] = useState({ pendentes: 0, sincronizando: 0, conflitos: 0, erros: 0 });

  useEffect(() => {
    if (!userId) { setResumo({ pendentes: 0, sincronizando: 0, conflitos: 0, erros: 0 }); return undefined; }
    let ativo = true;
    const carregar = () => {
      listarPendentes(userId).then((itens) => {
        if (!ativo) return;
        setResumo({
          pendentes: itens.filter((i) => i.status === 'pending').length,
          sincronizando: itens.filter((i) => i.status === 'syncing').length,
          conflitos: itens.filter((i) => i.status === 'conflict').length,
          erros: itens.filter((i) => i.status === 'error').length,
        });
      });
    };
    carregar();
    const unsubscribe = subscribeFila(carregar);
    return () => { ativo = false; unsubscribe(); };
  }, [userId]);

  return resumo;
}

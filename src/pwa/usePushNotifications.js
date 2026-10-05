import { useCallback, useEffect, useState } from 'react';
import { assinarPushReal, desassinarPushReal, obterChavePublicaPushReal } from '../services/notificacoes';

// Estados possíveis (seção 14 do pedido): nao-suportado / bloqueada (navegador negou) /
// disponivel (pode pedir permissão) / ativada (assinatura ativa neste dispositivo).
function urlBase64ParaUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Normalizado = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(base64Normalizado);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

function suportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function usePushNotifications() {
  const [estado, setEstado] = useState('verificando');
  const [erro, setErro] = useState(null);

  const atualizarEstado = useCallback(async () => {
    if (!suportado()) return setEstado('nao-suportado');
    if (Notification.permission === 'denied') return setEstado('bloqueada');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setEstado(subscription ? 'ativada' : 'disponivel');
    } catch {
      setEstado('disponivel');
    }
  }, []);

  useEffect(() => {
    atualizarEstado();
  }, [atualizarEstado]);

  // Só pede a permissão nativa QUANDO o usuário clica em "Ativar notificações" — nunca no
  // carregamento da página (seção 14 do pedido).
  // Devolve true/false (sucesso ou não) pra quem chamou decidir o que fazer na UI — por exemplo,
  // fechar o modal automaticamente só quando a ativação realmente deu certo.
  const ativar = useCallback(async () => {
    setErro(null);
    if (!suportado()) return false;

    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueada' : 'disponivel');
        return false;
      }

      const { chavePublica } = await obterChavePublicaPushReal();
      if (!chavePublica) {
        setErro('Push não está configurado no servidor no momento.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ParaUint8Array(chavePublica),
      });

      const json = subscription.toJSON();
      await assinarPushReal({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
      setEstado('ativada');
      return true;
    } catch (err) {
      console.error('[push] falha ao ativar', err);
      setErro('Não foi possível ativar as notificações neste dispositivo.');
      return false;
    }
  }, []);

  const desativar = useCallback(async () => {
    setErro(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await desassinarPushReal(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEstado('disponivel');
    } catch (err) {
      console.error('[push] falha ao desativar', err);
      setErro('Não foi possível desativar as notificações neste dispositivo.');
    }
  }, []);

  return { estado, erro, ativar, desativar };
}

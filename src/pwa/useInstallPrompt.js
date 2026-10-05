import { useEffect, useState, useCallback } from 'react';

function rodandoStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Captura o beforeinstallprompt (Android/Chrome/Edge) sem disparar automaticamente — só quando
// promptInstall() é chamado a partir de um clique do usuário (seção 5 do pedido). Em navegadores
// sem esse evento (iOS/Safari, principalmente), `podeInstalarComPrompt` fica false e a UI decide
// mostrar instruções manuais em vez do botão nativo (seção 6).
export function useInstallPrompt() {
  const [eventoAdiado, setEventoAdiado] = useState(null);
  const [instalado, setInstalado] = useState(rodandoStandalone());

  useEffect(() => {
    const aoCapturarPrompt = (event) => {
      event.preventDefault();
      setEventoAdiado(event);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setEventoAdiado(null);
    };

    window.addEventListener('beforeinstallprompt', aoCapturarPrompt);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoCapturarPrompt);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!eventoAdiado) return null;
    eventoAdiado.prompt();
    const resultado = await eventoAdiado.userChoice;
    setEventoAdiado(null);
    return resultado.outcome; // 'accepted' | 'dismissed'
  }, [eventoAdiado]);

  return {
    podeInstalarComPrompt: !!eventoAdiado && !instalado,
    instalado,
    ehIOS: ehIOS(),
    promptInstall,
  };
}

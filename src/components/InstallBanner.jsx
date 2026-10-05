import { useState } from 'react';
import { useInstallPrompt } from '../pwa/useInstallPrompt';

const CHAVE_DISPENSA = 'pwa-banner-instalar-dispensado-em';
const DIAS_ATE_REAPARECER = 14;

function foiDispensadoRecentemente() {
  try {
    const salvo = localStorage.getItem(CHAVE_DISPENSA);
    if (!salvo) return false;
    const dias = (Date.now() - Number(salvo)) / (1000 * 60 * 60 * 24);
    return dias < DIAS_ATE_REAPARECER;
  } catch {
    return false;
  }
}

// Banner discreto (seção 4 do pedido): só aparece quando o navegador sinaliza que o app é
// instalável (beforeinstallprompt), nunca insiste — some por DIAS_ATE_REAPARECER dias após
// dispensado, e nunca mais aparece depois de instalado.
export const InstallBanner = () => {
  const { podeInstalarComPrompt, instalado, promptInstall } = useInstallPrompt();
  const [dispensado, setDispensado] = useState(foiDispensadoRecentemente());

  if (!podeInstalarComPrompt || instalado || dispensado) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE_DISPENSA, String(Date.now()));
    } catch {
      // localStorage indisponível (modo privado, etc.) — só não lembra a escolha na próxima vez.
    }
    setDispensado(true);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-900 sm:px-6">
      <p className="min-w-0">Instale o aplicativo para acessar mais rápido e receber notificações neste dispositivo.</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={async () => { await promptInstall(); dispensar(); }}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
        >
          Instalar
        </button>
        <button type="button" onClick={dispensar} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100">
          Agora não
        </button>
      </div>
    </div>
  );
};

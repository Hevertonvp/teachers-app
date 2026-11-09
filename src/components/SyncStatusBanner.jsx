import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useFilaResumo } from '../hooks/useFilaResumo';
import { tentarAgora } from '../offline/networkStatus';

const TOM_CLASSES = {
  offline: 'border-amber-300 bg-amber-50 text-amber-900',
  syncing: 'border-blue-300 bg-blue-50 text-blue-900',
  pending: 'border-slate-300 bg-slate-50 text-slate-700',
  error: 'border-red-300 bg-red-50 text-red-900',
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

// Componente/estado GLOBAL único (seção "Estados visuais" do pedido) — montado uma vez (ver
// Layouts.jsx), nunca uma instância por tela/formulário. Persistente e discreto (nunca um toast
// que empilha); só desaparece quando não há nada a dizer.
export const SyncStatusBanner = () => {
  const { user } = useAuth();
  const { online, retryInSeconds } = useNetworkStatus();
  const { pendentes, sincronizando, conflitos, erros } = useFilaResumo(user?.email?.toLowerCase());
  const [mostrarTudoOk, setMostrarTudoOk] = useState(false);
  const caixaRef = useRef(null);
  const [elevacao, setElevacao] = useState(0);
  const tinhaPendenciaRef = useRef(false);

  const totalPendente = pendentes + sincronizando + conflitos + erros;

  useEffect(() => {
    if (totalPendente > 0) {
      tinhaPendenciaRef.current = true;
    } else if (tinhaPendenciaRef.current && online) {
      tinhaPendenciaRef.current = false;
      setMostrarTudoOk(true);
      const t = setTimeout(() => setMostrarTudoOk(false), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [totalPendente, online]);

  let texto = null;
  let tom = 'pending';
  if (!online) {
    tom = 'offline';
    texto = `Sem conexão com a internet. Suas alterações estão protegidas neste dispositivo.${retryInSeconds ? ` Reconectando em ${retryInSeconds}s...` : ''}`;
  } else if (sincronizando > 0) {
    tom = 'syncing';
    texto = 'Conexão restabelecida — sincronizando...';
  } else if (conflitos > 0 || erros > 0) {
    tom = 'error';
    texto = 'Não foi possível sincronizar algumas alterações.';
  } else if (pendentes > 0) {
    tom = 'pending';
    texto = `${pendentes} ${pendentes === 1 ? 'alteração' : 'alterações'} aguardando sincronização.`;
  } else if (mostrarTudoOk) {
    tom = 'ok';
    texto = 'Tudo sincronizado.';
  }

  // DEF-06/13: o aviso nunca pode cobrir botões. (1) só a caixa recebe cliques (o resto da faixa
  // deixa passar); (2) se a tela tem barra de ações fixa no rodapé ([data-barra-acoes-fixa]), o
  // aviso sobe para cima dela; (3) enquanto visível, a página ganha espaço no fim para o último
  // botão poder rolar para cima do aviso.
  useLayoutEffect(() => {
    if (!texto) return undefined;
    const medir = () => {
      const barra = document.querySelector('[data-barra-acoes-fixa]');
      const alturaBarra = barra ? Math.ceil(barra.getBoundingClientRect().height) : 0;
      setElevacao(alturaBarra);
      const alturaCaixa = caixaRef.current ? caixaRef.current.getBoundingClientRect().height : 0;
      document.body.style.paddingBottom = `${Math.ceil(alturaCaixa + alturaBarra + 24)}px`;
    };
    medir();
    window.addEventListener('resize', medir);
    const observador = new MutationObserver(medir);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', medir);
      observador.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [texto]);

  if (!texto) return null;

  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 ${elevacao ? '' : 'sm:bottom-3'}`} style={elevacao ? { bottom: elevacao + 8 } : undefined}>
      <div ref={caixaRef} className={`pointer-events-auto flex max-w-xl items-center gap-3 rounded-lg border px-4 py-2 text-sm font-semibold shadow-lg ${TOM_CLASSES[tom]}`}>
        <span>{texto}</span>
        {!online && (
          <button type="button" onClick={tentarAgora} className="shrink-0 rounded px-2 py-0.5 text-xs font-bold underline hover:no-underline">
            Tentar agora
          </button>
        )}
      </div>
    </div>
  );
};

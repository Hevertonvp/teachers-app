import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  listarNotificacoesReais,
  marcarNotificacaoComoLidaReal,
  marcarTodasNotificacoesComoLidasReal,
} from '../services/notificacoes';

const TITULOS_TIPO = {
  NOVA_MENSAGEM: '💬',
  PDI_PRAZO_PROFESSOR: '⏰',
  PDI_PRAZO_GESTOR: '⏰',
};

function formatarQuando(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '';
  }
}

// Sino + badge no Header (seção 11 do pedido): não lidas primeiro, depois recentes — mesmo
// padrão de dropdown com fechamento ao clicar fora já usado em ActionMenu/EscolaSelector.
export const NotificacoesBell = () => {
  const { notificacoesNaoLidas, loadNotificacoesNaoLidas } = useData();
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const aoClicarFora = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const abrirPainel = async () => {
    const vaiAbrir = !open;
    setOpen(vaiAbrir);
    if (!vaiAbrir) return;
    setCarregando(true);
    try {
      const lista = await listarNotificacoesReais();
      setNotificacoes(lista);
    } catch {
      setNotificacoes([]);
    } finally {
      setCarregando(false);
    }
  };

  const abrirNotificacao = async (notificacao) => {
    setOpen(false);
    if (!notificacao.lidaEm) {
      try {
        await marcarNotificacaoComoLidaReal(notificacao.id);
        loadNotificacoesNaoLidas();
      } catch {
        // Navegar continua funcionando mesmo se marcar-como-lida falhar.
      }
    }
    if (notificacao.linkContexto) navigate(notificacao.linkContexto);
  };

  const marcarTodasLidas = async () => {
    try {
      await marcarTodasNotificacoesComoLidasReal();
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lidaEm: n.lidaEm ?? new Date().toISOString() })));
      loadNotificacoesNaoLidas();
    } catch {
      // Sem feedback bloqueante — o usuário pode tentar de novo.
    }
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={abrirPainel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notificações"
        title="Notificações"
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM8.5 16a1.5 1.5 0 003 0h-3z" />
        </svg>
        {notificacoesNaoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
            {notificacoesNaoLidas > 9 ? '9+' : notificacoesNaoLidas}
          </span>
        )}
      </button>

      <div
        role="menu"
        className={`absolute right-0 z-50 mt-1 w-80 max-w-[90vw] origin-top-right rounded-xl border border-slate-200 bg-white shadow-lg transition duration-150 ease-out ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-sm font-bold text-slate-900">Notificações</span>
          {notificacoesNaoLidas > 0 && (
            <button type="button" onClick={marcarTodasLidas} className="text-xs font-semibold text-teal-700 hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {carregando ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Carregando…</p>
          ) : notificacoes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma notificação por aqui.</p>
          ) : (
            notificacoes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => abrirNotificacao(n)}
                className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                  !n.lidaEm ? 'bg-teal-50/40' : ''
                }`}
              >
                <span className="mt-0.5 text-base" aria-hidden="true">{TITULOS_TIPO[n.tipo] ?? '🔔'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{n.titulo}</span>
                    {!n.lidaEm && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">{n.corpo}</span>
                  <span className="mt-1 block text-xs text-slate-400">{formatarQuando(n.createdAt)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

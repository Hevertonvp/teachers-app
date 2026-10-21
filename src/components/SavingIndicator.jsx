// Indicador LOCAL (por formulário) de "Salvo"/"Salvando..." — diferente do SyncStatusBanner
// (global, de conectividade/fila). `estado` é 'idle' | 'saving' | 'saved'.
export const SavingIndicator = ({ estado }) => {
  if (estado === 'idle') return null;
  return (
    <span className="text-xs font-semibold text-slate-500">
      {estado === 'saving' ? 'Salvando...' : 'Salvo'}
    </span>
  );
};

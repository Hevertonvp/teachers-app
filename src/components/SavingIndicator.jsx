// Indicador LOCAL (por formulário) do salvamento — diferente do SyncStatusBanner (global, de
// conectividade/fila). `estado`:
//   'idle'   — nada a mostrar;
//   'saving' — enviando;
//   'saved'  — o SERVIDOR confirmou (sincronizado);
//   'queued' — guardado só NESTE APARELHO (fila offline), ainda não chegou ao servidor (DEF-08:
//              nunca mostrar "Salvo" como se estivesse sincronizado quando não está).
export const SavingIndicator = ({ estado }) => {
  if (estado === 'idle') return null;
  if (estado === 'queued') {
    return <span className="text-xs font-semibold text-amber-700">Salvo só neste aparelho — será enviado quando a internet voltar</span>;
  }
  return (
    <span className="text-xs font-semibold text-slate-500">
      {estado === 'saving' ? 'Salvando...' : 'Sincronizado'}
    </span>
  );
};

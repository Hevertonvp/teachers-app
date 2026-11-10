import { useState } from 'react';
import { Button } from './Common';

// Botão "Exportar para Excel" — `gerar` monta os dados (pode buscar na API) e chama exportarExcel.
// Mostra "Gerando..." durante o processo e a mensagem de erro, se houver; nunca exporta duas vezes em paralelo.
export const BotaoExportarExcel = ({ gerar, rotulo = 'Exportar para Excel', size = 'sm', variant = 'outline', disabled = false }) => {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const clicar = async () => {
    if (gerando) return;
    setGerando(true); setErro('');
    try { await gerar(); } catch (e) { setErro(e?.message || 'Não foi possível gerar a planilha.'); } finally { setGerando(false); }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size={size} variant={variant} onClick={clicar} disabled={disabled || gerando}>{gerando ? 'Gerando planilha...' : rotulo}</Button>
      {erro && <span role="alert" className="text-xs font-semibold text-red-700">{erro}</span>}
    </span>
  );
};

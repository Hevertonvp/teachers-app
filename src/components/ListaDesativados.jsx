import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, LoadingBlock } from './Common';
import { formatarDataHora } from '../utils/umTerco';

// Lista de desativados/encerrados de uma área (pedido do usuário, 15/11/2026): sempre tabela (nunca
// cartões), paginada e com os mais recentes primeiro. Duas formas de uso:
//  - `carregar(pagina)` → { itens, total } (paginação no servidor; /api/desativados);
//  - `itens` (lista já carregada pela tela; ordena e pagina aqui).
// Cada item: { id, titulo, detalhe, motivo: 'manual'|'prazo'|'encerrado', data, por }.
// `acoes(item)` devolve os botões da linha (Reativar, Reabrir…). `recarregarChave` força recarregar.

const MOTIVO = {
  manual: { texto: 'Desativado manualmente', variant: 'gray' },
  excluido: { texto: 'Excluído manualmente', variant: 'gray' },
  prazo: { texto: 'Encerrado pelo prazo', variant: 'blue' },
  encerrado: { texto: 'Encerrado', variant: 'yellow' },
};

// Datas só-dia vêm como meia-noite UTC: mostrar o dia escrito, sem converter fuso (senão vira o dia anterior).
const formatarData = (iso) => {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) || /T00:00:00(\.000)?Z$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return formatarDataHora(iso);
};

export const ListaDesativados = ({ carregar, itens, acoes, porPagina = 20, rotuloData = 'Desativado em', vazio = 'Nada desativado por aqui.', recarregarChave = 0 }) => {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const buscar = useCallback(async () => {
    if (!carregar) return;
    setErro('');
    try { setDados(await carregar(pagina, porPagina)); } catch (e) { setErro(e.message); setDados({ itens: [], total: 0 }); }
  }, [carregar, pagina, porPagina]);

  useEffect(() => { setPagina(1); }, [carregar]);
  useEffect(() => { buscar(); }, [buscar, recarregarChave]);

  const local = !carregar;
  const ordenados = local ? [...(itens || [])].sort((a, b) => (b.data ? new Date(b.data).getTime() : 0) - (a.data ? new Date(a.data).getTime() : 0)) : null;
  const total = local ? ordenados.length : dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhas = local ? ordenados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina) : dados?.itens ?? [];

  if (!local && !dados) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">{rotuloData}</th>
              <th className="px-4 py-3">Por</th>
              {acoes && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.length === 0 ? (
              <tr><td colSpan={acoes ? 5 : 4} className="px-4 py-10 text-center text-slate-500">{vazio}</td></tr>
            ) : linhas.map(item => {
              const motivo = MOTIVO[item.motivo] ?? MOTIVO.manual;
              const botoes = acoes?.(item);
              return (
                <tr key={`${item.tipo ?? ''}-${item.id}`} className="hover:bg-slate-50">
                  <td data-label="Nome" className="px-4 py-3 align-top text-slate-700">
                    <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{item.titulo}</p>
                    {item.detalhe && <p className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">{item.detalhe}</p>}
                  </td>
                  <td data-label="Motivo" className="px-4 py-3 align-top"><Badge variant={motivo.variant}>{motivo.texto}</Badge></td>
                  <td data-label={rotuloData} className="whitespace-nowrap px-4 py-3 align-top text-slate-700">{formatarData(item.data)}</td>
                  <td data-label="Por" className="px-4 py-3 align-top text-slate-700">{item.por || '—'}</td>
                  {acoes && <td data-label="Ações" className="px-4 py-3 align-top"><div className="flex flex-wrap gap-2">{botoes}</div></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {total > porPagina && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
            <Button size="sm" variant="outline" disabled={paginaAtual === 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</Button>
            <span className="font-semibold text-slate-600">Página {paginaAtual} de {totalPaginas} · {total} no total</span>
            <Button size="sm" variant="outline" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}>Próxima</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Cabeçalho padrão da tela de desativados de uma área: voltar + título + texto.
export const CabecalhoDesativados = ({ titulo, voltarPara, voltarTexto = '← Voltar', descricao, children }) => (
  <div>
    <Link to={voltarPara} className="text-sm font-semibold text-teal-700 hover:underline">{voltarTexto}</Link>
    <h1 className="mt-3 text-3xl font-bold text-slate-950">{titulo}</h1>
    {descricao && <p className="mt-2 max-w-3xl text-slate-600">{descricao}</p>}
    {children}
  </div>
);

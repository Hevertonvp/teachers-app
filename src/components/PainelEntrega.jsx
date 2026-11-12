import { Link } from 'react-router-dom';
import { Card } from './Common';
import { BarraEmpilhada } from './pdi/Graficos';
import { useVizTema } from './pdi/vizTema';
import { hojeSpServidor } from '../utils/horaServidor';

// Painel de ENTREGA reutilizado pela página do PDI e pelo Dashboard (PDI e Formulário 1/3):
// número principal (percentual concluído), barra parte-do-todo e lista por grupo (escola ou
// disciplina), do menor percentual para o maior — quem precisa de atenção primeiro.
// Cores: rampa ordinal de um só tom (não iniciada -> em andamento -> concluída), sempre com legenda
// numérica ao lado (a cor nunca é a única informação). Ver components/pdi/vizTema.js.

// Dia de hoje em São Paulo pela hora do servidor (não pelo relógio/fuso do aparelho).
const hojeUTC = () => { const [a, m, d] = hojeSpServidor().split('-').map(Number); return Date.UTC(a, m - 1, d); };
const diasAte = (iso) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ano, mes - 1, dia) - hojeUTC()) / 86400000);
};
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const percentual = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

// "encerra em 5 dias (15/12/2026)" — `dataFimIso` é a data (ou o instante já convertido para o dia local).
export const textoPrazo = (dataFimIso) => {
  const dias = diasAte(dataFimIso);
  if (dias < 0) return 'prazo encerrado';
  if (dias === 0) return 'encerra hoje';
  return `encerra em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${dataBr(dataFimIso)})`;
};

const segmentosEntrega = (tema, { concluidas, emAndamento, naoIniciadas }) => [
  { id: 'c', rotulo: 'Concluídas', valor: concluidas, cor: tema.ordinal.forte },
  { id: 'a', rotulo: 'Em preenchimento', valor: emAndamento, cor: tema.ordinal.medio },
  { id: 'n', rotulo: 'Não iniciadas', valor: naoIniciadas, cor: tema.ordinal.fraco },
];

const LegendaEntrega = ({ tema, valores }) => (
  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
    {segmentosEntrega(tema, valores).map(seg => (
      <li key={seg.id} className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: seg.cor }} />
        <span className="font-bold text-slate-950">{seg.valor}</span>
        <span className="text-slate-500">{seg.rotulo}</span>
      </li>
    ))}
  </ul>
);

/**
 * @param unidade   'fichas' | 'entregas' — texto "8 de 30 fichas"
 * @param compacto  versão do Dashboard: número menor, grupos embaixo e só os `maxGrupos` com menor
 *                  percentual (quem precisa de atenção), com link para o painel completo.
 * @param link      { para, texto } — atalho para a tela completa do módulo.
 */
export const PainelEntrega = ({ titulo, descricao, totais, grupos, vazio, rodape, unidade = 'fichas', compacto = false, maxGrupos = 5, link = null }) => {
  const tema = useVizTema();
  const total = totais.concluidas + totais.emAndamento + totais.naoIniciadas;
  const gruposVisiveis = compacto ? grupos.slice(0, maxGrupos) : grupos;
  const ocultos = grupos.length - gruposVisiveis.length;
  const lado = !compacto && grupos.length > 0;
  return (
    <Card className={`overflow-hidden p-0 ${compacto ? 'flex h-full flex-col' : ''}`}>
      <div className={`grid gap-6 p-5 sm:p-6 ${lado ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]' : ''} ${compacto ? 'flex-1' : ''}`}>
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{titulo}</p>
            {link && <Link to={link.para} className="shrink-0 text-sm font-semibold text-teal-700 hover:underline">{link.texto} →</Link>}
          </div>
          {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
          {total === 0 ? (
            <p className="mt-6 text-sm text-slate-500">{vazio}</p>
          ) : (
            <>
              <p className={`flex items-baseline gap-2 ${compacto ? 'mt-4' : 'mt-5'}`}>
                <span className={`${compacto ? 'text-5xl' : 'text-6xl'} font-bold tracking-tight text-slate-950`}>{percentual(totais.concluidas, total)}%</span>
                <span className="text-sm font-semibold text-slate-500">concluído</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{totais.concluidas} de {total} {unidade}</p>
              <div className={compacto ? 'mt-4' : 'mt-5'}><BarraEmpilhada rotulo={titulo} altura={compacto ? 12 : 14} segmentos={segmentosEntrega(tema, totais)} /></div>
              <div className="mt-4"><LegendaEntrega tema={tema} valores={totais} /></div>
            </>
          )}
        </div>
        {gruposVisiveis.length > 0 && (
          <div className={`min-w-0 ${lado ? 'lg:border-l lg:border-slate-200 lg:pl-6' : 'border-t border-slate-200 pt-5'}`}>
            {compacto && <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Menor entrega primeiro</p>}
            <ul className={`space-y-4 ${lado ? 'lg:max-h-[26rem] lg:overflow-y-auto lg:pr-2' : ''}`}>
              {gruposVisiveis.map(grupo => {
                const totalGrupo = grupo.concluidas + grupo.emAndamento + grupo.naoIniciadas;
                return (
                  <li key={grupo.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800" title={grupo.nome}>{grupo.nome}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-slate-950">{percentual(grupo.concluidas, totalGrupo)}%</p>
                    </div>
                    <div className="mt-1.5"><BarraEmpilhada rotulo={grupo.nome} altura={8} segmentos={segmentosEntrega(tema, grupo)} /></div>
                    <p className="mt-1 text-xs text-slate-500">{grupo.concluidas} de {totalGrupo} concluídas{grupo.detalhe ? ` · ${grupo.detalhe}` : ''}</p>
                  </li>
                );
              })}
            </ul>
            {ocultos > 0 && <p className="mt-3 text-xs text-slate-500">+ {ocultos} {ocultos === 1 ? 'outra' : 'outras'} no painel completo.</p>}
          </div>
        )}
      </div>
      {rodape && <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">{rodape}</div>}
    </Card>
  );
};

// Ordena grupos do menor percentual concluído para o maior.
export const ordenarPorEntrega = (grupos) => [...grupos].sort((a, b) =>
  percentual(a.concluidas, a.concluidas + a.emAndamento + a.naoIniciadas) - percentual(b.concluidas, b.concluidas + b.emAndamento + b.naoIniciadas));

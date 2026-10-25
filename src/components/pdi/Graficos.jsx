import { useState } from 'react';
import { formatarNumero, useLargura, useVizTema } from './vizTema';

// Gráficos do PDI em SVG puro (sem biblioteca — o bundle já é grande). Especificação seguida:
// linhas 2px, marcadores r4 com anel de 2px na cor da superfície, colunas <= 24px com topo
// arredondado de 4px e 2px de folga entre vizinhas, grade/eixos em hairline sólida e discreta,
// texto sempre nas cores de texto (nunca na cor da série), legenda sempre que há >= 2 séries,
// tooltip no hover E no foco do teclado, e toda figura tem uma visão em tabela equivalente.

export const Legenda = ({ itens, forma = 'linha' }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-slate-600">
    {itens.map(item => (
      <li key={item.id} className="flex items-center gap-1.5">
        {forma === 'linha'
          ? <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ backgroundColor: item.cor }} />
          : <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.cor }} />}
        {item.nome}
      </li>
    ))}
  </ul>
);

export const AlternarTabela = ({ emTabela, onAlternar }) => (
  <button type="button" onClick={onAlternar} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
    {emTabela ? 'Ver gráfico' : 'Ver tabela'}
  </button>
);

// Tabela equivalente a qualquer gráfico de categorias × séries.
export const TabelaDados = ({ categorias, series, formatarValor = formatarNumero, rotuloCategoria = 'Período' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-4">{rotuloCategoria}</th>
          {series.map(serie => <th key={serie.id} className="py-2 pr-4">{serie.nome}</th>)}
        </tr>
      </thead>
      <tbody>
        {categorias.map((categoria, i) => (
          <tr key={categoria.id} className="border-b border-slate-200 last:border-0">
            <td data-label={rotuloCategoria} className="py-2 pr-4 font-medium text-slate-700">{[categoria.rotulo, categoria.subrotulo].filter(Boolean).join(' ')}</td>
            {series.map(serie => <td key={serie.id} data-label={serie.nome} className="py-2 pr-4 tabular-nums text-slate-700">{serie.texto?.[i] ?? formatarValor(serie.valores[i])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Tooltip = ({ x, largura, titulo, linhas, forma }) => {
  const esquerda = Math.min(Math.max(x - 90, 0), Math.max(0, largura - 180));
  return (
    <div className="pointer-events-none absolute top-0 z-10 w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg" style={{ left: esquerda }}>
      <p className="font-semibold text-slate-500">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {linhas.map(linha => (
          <li key={linha.id} className="flex items-start gap-2">
            {forma === 'barra'
              ? <span aria-hidden className="mt-1 inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: linha.cor }} />
              : <span aria-hidden className="mt-1.5 inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: linha.cor }} />}
            <span>
              <strong className="text-sm text-slate-900">{linha.valor}</strong>
              <span className="ml-1 text-slate-500">{linha.nome}</span>
              {linha.detalhe && <span className="block text-[11px] leading-snug text-slate-500">{linha.detalhe}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Linha (evolução ao longo das Aplicações). `series[].valores` alinhado a `categorias`; null =
// sem dado naquele período (a linha quebra, nunca inventa ponto). `ticks` controla o eixo Y.
export const GraficoLinha = ({ categorias, series, dominio, ticks, formatarValor = formatarNumero, altura = 220, rotulo }) => {
  const tema = useVizTema();
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null);

  const comRotuloFinal = series.length > 1 && series.length <= 4 && largura >= 520;
  const padEsq = 8 + Math.max(...ticks.map(t => String(t.rotulo).length)) * 7;
  const padDir = comRotuloFinal ? 112 : 16;
  const padTopo = 12;
  const padBase = 34;
  const larguraPlot = Math.max(0, largura - padEsq - padDir);
  const alturaPlot = altura - padTopo - padBase;
  const margemX = categorias.length > 1 ? 20 : 0;
  const xDe = (i) => (categorias.length === 1 ? padEsq + larguraPlot / 2 : padEsq + margemX + ((larguraPlot - margemX * 2) * i) / (categorias.length - 1));
  const yDe = (v) => padTopo + alturaPlot - ((v - dominio.min) / (dominio.max - dominio.min)) * alturaPlot;

  const caminho = (valores) => {
    let d = '';
    let aberto = false;
    valores.forEach((v, i) => {
      if (v === null || v === undefined) { aberto = false; return; }
      d += `${aberto ? 'L' : 'M'} ${xDe(i).toFixed(1)} ${yDe(v).toFixed(1)} `;
      aberto = true;
    });
    return d.trim();
  };

  // Rótulos finais só quando não colidem (< 14px entre eles) — senão a legenda e o tooltip bastam.
  const finais = comRotuloFinal ? series.map((serie, s) => {
    const ultimo = serie.valores.map((v, i) => [v, i]).filter(([v]) => v !== null && v !== undefined).pop();
    return ultimo ? { serie, s, y: yDe(ultimo[0]), x: xDe(ultimo[1]), valor: ultimo[0] } : null;
  }).filter(Boolean) : [];
  const ordenados = [...finais].sort((a, b) => a.y - b.y);
  const colidem = ordenados.some((item, i) => i > 0 && item.y - ordenados[i - 1].y < 14);
  const banda = categorias.length > 1 ? (larguraPlot - margemX * 2) / (categorias.length - 1) : larguraPlot;

  return (
    <div ref={ref} className="relative w-full">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={rotulo} className="block overflow-visible">
          {ticks.map(t => (
            <g key={t.valor}>
              <line x1={padEsq} x2={padEsq + larguraPlot} y1={yDe(t.valor)} y2={yDe(t.valor)} stroke={t.valor === dominio.min ? tema.eixo : tema.grade} strokeWidth="1" />
              <text x={padEsq - 8} y={yDe(t.valor) + 4} textAnchor="end" fontSize="11" fill={tema.textoMudo} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.rotulo}</text>
            </g>
          ))}
          {categorias.map((c, i) => (
            <g key={c.id}>
              <text x={xDe(i)} y={altura - 16} textAnchor="middle" fontSize="11" fontWeight="600" fill={tema.textoSecundario}>{c.rotulo}</text>
              {c.subrotulo && <text x={xDe(i)} y={altura - 3} textAnchor="middle" fontSize="10" fill={tema.textoMudo}>{c.subrotulo}</text>}
            </g>
          ))}
          {ativo !== null && <line x1={xDe(ativo)} x2={xDe(ativo)} y1={padTopo} y2={padTopo + alturaPlot} stroke={tema.eixo} strokeWidth="1" />}
          {series.length === 1 && categorias.length > 1 && (() => {
            const pontos = series[0].valores.map((v, i) => [v, i]).filter(([v]) => v !== null && v !== undefined);
            if (pontos.length < 2) return null;
            const area = `${caminho(series[0].valores)} L ${xDe(pontos[pontos.length - 1][1]).toFixed(1)} ${yDe(dominio.min).toFixed(1)} L ${xDe(pontos[0][1]).toFixed(1)} ${yDe(dominio.min).toFixed(1)} Z`;
            return <path d={area} fill={series[0].cor} opacity="0.1" />;
          })()}
          {series.map(serie => <path key={serie.id} d={caminho(serie.valores)} fill="none" stroke={serie.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
          {series.map(serie => serie.valores.map((v, i) => (v === null || v === undefined ? null : (
            <circle key={`${serie.id}-${i}`} cx={xDe(i)} cy={yDe(v)} r={ativo === i ? 5 : 4} fill={serie.cor} stroke={tema.superficie} strokeWidth="2" />
          ))))}
          {!colidem && finais.map(f => (
            <text key={f.serie.id} x={f.x + 10} y={f.y + 4} fontSize="11" fill={tema.textoSecundario}>
              <tspan fontWeight="700" fill={tema.textoPrimario}>{formatarValor(f.valor)}</tspan> {f.serie.nomeCurto || f.serie.nome}
            </text>
          ))}
          {categorias.map((c, i) => (
            <rect
              key={c.id}
              x={xDe(i) - Math.max(banda, 24) / 2}
              y={padTopo}
              width={Math.max(banda, 24)}
              height={alturaPlot}
              fill="transparent"
              tabIndex={0}
              aria-label={`${c.rotulo}: ${series.map(s => `${s.nome} ${formatarValor(s.valores[i])}`).join(', ')}`}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="cursor-crosshair outline-none"
            />
          ))}
        </svg>
      )}
      {ativo !== null && (
        <Tooltip
          x={xDe(ativo)}
          largura={largura}
          titulo={[categorias[ativo].rotulo, categorias[ativo].subrotulo].filter(Boolean).join(' · ')}
          linhas={series.map(serie => ({ id: serie.id, cor: serie.cor, nome: serie.nome, valor: formatarValor(serie.valores[ativo]), detalhe: serie.detalhes?.[ativo] }))}
        />
      )}
    </div>
  );
};

// Colunas agrupadas por período (ex.: habilidades CRMG marcadas). `texto[i]` (ex.: "Todas")
// substitui a coluna quando não há magnitude para desenhar — nunca inventa uma altura.
export const GraficoColunas = ({ categorias, series, formatarValor = formatarNumero, altura = 200, rotulo }) => {
  const tema = useVizTema();
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null); // { c, s }

  const valores = series.flatMap(s => s.valores.filter(v => typeof v === 'number'));
  const maximo = Math.max(1, ...valores);
  const padEsq = 12;
  const padTopo = 22;
  const padBase = 34;
  const larguraPlot = Math.max(0, largura - padEsq * 2);
  const alturaPlot = altura - padTopo - padBase;
  const larguraGrupo = larguraPlot / Math.max(1, categorias.length);
  const larguraBarra = Math.min(24, (larguraGrupo * 0.6 - (series.length - 1) * 2) / series.length);
  const yDe = (v) => padTopo + alturaPlot - (v / maximo) * alturaPlot;
  const xBarra = (c, s) => padEsq + larguraGrupo * c + larguraGrupo / 2 - (series.length * larguraBarra + (series.length - 1) * 2) / 2 + s * (larguraBarra + 2);
  const base = padTopo + alturaPlot;

  const barra = (x, y, w) => {
    const r = Math.min(4, w / 2, base - y);
    if (base - y <= 0) return '';
    return `M ${x} ${base} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${base} Z`;
  };

  return (
    <div ref={ref} className="relative w-full">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={rotulo} className="block overflow-visible">
          <line x1={padEsq} x2={padEsq + larguraPlot} y1={base} y2={base} stroke={tema.eixo} strokeWidth="1" />
          {categorias.map((c, ci) => (
            <g key={c.id}>
              <text x={padEsq + larguraGrupo * ci + larguraGrupo / 2} y={altura - 16} textAnchor="middle" fontSize="11" fontWeight="600" fill={tema.textoSecundario}>{c.rotulo}</text>
              {c.subrotulo && <text x={padEsq + larguraGrupo * ci + larguraGrupo / 2} y={altura - 3} textAnchor="middle" fontSize="10" fill={tema.textoMudo}>{c.subrotulo}</text>}
              {series.map((serie, si) => {
                const v = serie.valores[ci];
                const x = xBarra(ci, si);
                const texto = serie.texto?.[ci];
                const realce = ativo && ativo.c === ci && ativo.s === si;
                return (
                  <g
                    key={serie.id}
                    tabIndex={0}
                    aria-label={`${c.rotulo}, ${serie.nome}: ${texto ?? formatarValor(v)}`}
                    onMouseEnter={() => setAtivo({ c: ci, s: si })}
                    onMouseLeave={() => setAtivo(null)}
                    onFocus={() => setAtivo({ c: ci, s: si })}
                    onBlur={() => setAtivo(null)}
                    className="cursor-pointer outline-none"
                  >
                    <rect x={x - 4} y={padTopo} width={larguraBarra + 8} height={alturaPlot} fill="transparent" />
                    {typeof v === 'number' && v > 0 && <path d={barra(x, yDe(v), larguraBarra)} fill={serie.cor} opacity={realce ? 0.8 : 1} />}
                    <text x={x + larguraBarra / 2} y={(typeof v === 'number' && v > 0 ? yDe(v) : base) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill={tema.textoPrimario}>
                      {texto ?? (typeof v === 'number' ? formatarValor(v) : '—')}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      )}
      {ativo && (
        <Tooltip
          x={xBarra(ativo.c, ativo.s) + larguraBarra / 2}
          largura={largura}
          forma="barra"
          titulo={[categorias[ativo.c].rotulo, categorias[ativo.c].subrotulo].filter(Boolean).join(' · ')}
          linhas={[{ id: series[ativo.s].id, cor: series[ativo.s].cor, nome: series[ativo.s].nome, valor: series[ativo.s].texto?.[ativo.c] ?? formatarValor(series[ativo.s].valores[ativo.c]) }]}
        />
      )}
    </div>
  );
};

// Barra horizontal empilhada (parte do todo) — 2px de folga entre segmentos, pontas arredondadas.
export const BarraEmpilhada = ({ segmentos, altura = 12, rotulo }) => {
  const total = segmentos.reduce((s, seg) => s + seg.valor, 0);
  const tema = useVizTema();
  if (total === 0) return <div className="w-full rounded-full" style={{ height: altura, backgroundColor: tema.trilho }} role="img" aria-label={`${rotulo}: sem fichas`} />;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height: altura }} role="img" aria-label={`${rotulo}: ${segmentos.map(s => `${s.rotulo} ${s.valor}`).join(', ')}`}>
      {segmentos.filter(seg => seg.valor > 0).map(seg => (
        <div key={seg.id} title={`${seg.rotulo}: ${seg.valor}`} className="h-full transition-[width] duration-500" style={{ width: `${(seg.valor / total) * 100}%`, backgroundColor: seg.cor }} />
      ))}
    </div>
  );
};

// Variação vs o período anterior — seta + texto (nunca só cor).
export const Variacao = ({ atual, anterior, formatar = formatarNumero, sufixo = '' }) => {
  const tema = useVizTema();
  if (typeof atual !== 'number' || typeof anterior !== 'number') return null;
  const delta = Math.round((atual - anterior) * 100) / 100;
  if (delta === 0) return <span className="text-xs font-semibold text-slate-500">= igual ao período anterior</span>;
  return (
    <span className="text-xs font-semibold" style={{ color: delta > 0 ? tema.subiu : tema.desceu }}>
      {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : ''}{formatar(delta)}{sufixo} vs período anterior
    </span>
  );
};

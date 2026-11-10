import { useEffect, useRef, useState } from 'react';

// Gráficos do Acompanhamento Escolar — SVG/HTML próprios, sem biblioteca. Cores vêm dos tokens
// CSS de .acp (src/styles/acompanhamento.css), então o modo noturno é automático.

export const fmt = (n) => (n ?? 0).toLocaleString('pt-BR');
export const pct = (parte, total) => (total ? Math.round((parte * 100) / total) : 0);
const fmtDia = (dia) => { const [, m, d] = dia.split('-'); return `${d}/${m}`; };
export const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

// Largura real do contêiner (para o SVG desenhar nítido em qualquer tela).
export function useLargura() {
  const ref = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}

// Barra segmentada: concluída · em andamento · não iniciada (trilho), com 2px entre segmentos.
// O texto equivalente vai no aria-label e na dica; a cor nunca é a única pista.
export const BarraSituacao = ({ concluidas = 0, emAndamento = 0, esperado = 0, fina = false }) => {
  const nao = Math.max(0, esperado - concluidas - emAndamento);
  const total = Math.max(esperado, concluidas + emAndamento);
  const descricao = `${fmt(concluidas)} concluídas, ${fmt(emAndamento)} em andamento, ${fmt(nao)} não iniciadas`;
  if (!total) return <div className="acp-barra" data-fina={fina} role="img" aria-label="Nada esperado"><span className="s-nao" style={{ flex: 1 }} /></div>;
  return (
    <div className="acp-barra" data-fina={fina} role="img" aria-label={descricao} title={descricao}>
      {concluidas > 0 && <span className="s-ok" style={{ flex: concluidas }} />}
      {emAndamento > 0 && <span className="s-and" style={{ flex: emAndamento }} />}
      {nao > 0 && <span className="s-nao" style={{ flex: nao }} />}
    </div>
  );
};

export const LegendaSituacao = () => (
  <div className="acp-legenda" aria-hidden="true">
    <span><i style={{ background: 'var(--acp-ok)' }} />Concluídas</span>
    <span><i style={{ background: 'var(--acp-and)' }} />Em andamento</span>
    <span><i style={{ background: 'var(--acp-trilho)' }} />Não iniciadas</span>
  </div>
);

// Curva acumulada com cruz de leitura. `series`: [{ id, rotulo, cor, pontos: [{dia, valor|null}],
// tracejada?, area? }]. As séries se alinham pelo ÍNDICE (dia relativo do período), o que permite
// sobrepor o ciclo anterior. `maximo` é o topo do eixo (100 em percentual, ou o esperado).
export const GraficoRitmo = ({ series, maximo, sufixo = '', altura = 220, referencia = null }) => {
  const [ref, largura] = useLargura();
  const [foco, setFoco] = useState(null);
  const principal = series[0];
  const n = Math.max(...series.map((s) => s.pontos.length), 2);
  const M = { t: 12, r: 12, b: 26, l: 36 };
  const w = Math.max(largura, 200);
  const W = w - M.l - M.r;
  const H = altura - M.t - M.b;
  const topo = Math.max(maximo || 0, ...series.flatMap((s) => s.pontos.map((p) => p.valor ?? 0)), 1);
  const x = (i) => M.l + (n === 1 ? 0 : (i * W) / (n - 1));
  const y = (v) => M.t + H - (v / topo) * H;
  const caminho = (pontos) => {
    let d = ''; let aberto = false;
    pontos.forEach((p, i) => {
      if (p.valor === null || p.valor === undefined) { aberto = false; return; }
      d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`; aberto = true;
    });
    return d;
  };
  const area = (pontos) => {
    const validos = pontos.map((p, i) => [i, p.valor]).filter(([, v]) => v !== null && v !== undefined);
    if (validos.length < 2) return '';
    return `M${x(validos[0][0])},${y(0)}` + validos.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') + `L${x(validos.at(-1)[0])},${y(0)}Z`;
  };
  const indiceHoje = principal.pontos.findLastIndex((p) => p.valor !== null);
  const aoMover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - M.l) / W) * (n - 1));
    setFoco(Math.min(n - 1, Math.max(0, i)));
  };
  const marcasX = [0, Math.floor((principal.pontos.length - 1) / 2), principal.pontos.length - 1].filter((v, i, a) => a.indexOf(v) === i && principal.pontos[v]);

  return (
    <div className="acp-grafico" ref={ref}>
      {largura > 0 && (
        <svg width={w} height={altura} role="img" aria-label={`Evolução acumulada: ${series.map((s) => `${s.rotulo} ${s.pontos[indiceHoje]?.valor ?? s.pontos.findLast((p) => p.valor !== null)?.valor ?? 0}${sufixo}`).join(', ')}`}
          onPointerMove={aoMover} onPointerLeave={() => setFoco(null)} style={{ touchAction: 'pan-y' }}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={M.l} x2={w - M.r} y1={y(topo * f)} y2={y(topo * f)} stroke="var(--acp-grid)" />
              <text x={M.l - 8} y={y(topo * f) + 4} textAnchor="end">{Math.round(topo * f)}{sufixo}</text>
            </g>
          ))}
          {referencia !== null && <line x1={M.l} x2={w - M.r} y1={y(referencia)} y2={y(referencia)} stroke="var(--acp-muted)" strokeDasharray="2 4" />}
          {marcasX.map((i) => <text key={i} x={x(i)} y={altura - 6} textAnchor={i === 0 ? 'start' : i === principal.pontos.length - 1 ? 'end' : 'middle'}>{fmtDia(principal.pontos[i].dia)}</text>)}
          {series.map((s) => s.area && <path key={`a${s.id}`} d={area(s.pontos)} fill={s.cor} opacity="0.12" />)}
          {series.map((s) => <path key={s.id} d={caminho(s.pontos)} fill="none" stroke={s.cor} strokeWidth="2" strokeDasharray={s.tracejada ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
          {indiceHoje >= 0 && indiceHoje < principal.pontos.length - 1 && <line x1={x(indiceHoje)} x2={x(indiceHoje)} y1={M.t} y2={M.t + H} stroke="var(--acp-atencao)" strokeWidth="1.5" strokeDasharray="3 3" />}
          {foco !== null && (
            <g>
              <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + H} stroke="var(--acp-muted)" strokeWidth="1" />
              {series.map((s) => s.pontos[foco]?.valor != null && <circle key={s.id} cx={x(foco)} cy={y(s.pontos[foco].valor)} r="4.5" fill={s.cor} stroke="var(--acp-surface)" strokeWidth="2" />)}
            </g>
          )}
        </svg>
      )}
      {foco !== null && largura > 0 && (
        <div className="acp-dica-caixa" style={{ left: Math.min(Math.max(x(foco) - 70, 0), w - 160), top: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Dia {foco + 1}{principal.pontos[foco] ? ` · ${fmtDia(principal.pontos[foco].dia)}` : ''}</div>
          {series.map((s) => <div key={s.id}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.cor, marginRight: 6 }} />{s.rotulo}: <b>{s.pontos[foco]?.valor ?? '—'}{s.pontos[foco]?.valor != null ? sufixo : ''}</b></div>)}
        </div>
      )}
    </div>
  );
};

// Linha do tempo de prazos (Gantt simples). Janela fixa em torno de hoje; a reabertura é hachurada.
export const LinhaTempo = ({ itens, de, ate }) => {
  const t0 = de.getTime(); const t1 = ate.getTime();
  const pos = (iso) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - t0) / (t1 - t0)) * 100));
  const hoje = pos(new Date().toISOString());
  return (
    <div className="acp-tempo">
      {itens.map((item) => {
        const a = pos(item.inicio); const b = pos(item.fim);
        return (
          <div key={item.chave} className="acp-tempo-linha">
            <div className="acp-tempo-rotulo">
              <b title={item.titulo}>{item.titulo}</b>
              <span>{item.subtitulo}</span>
            </div>
            <div className="acp-tempo-pista" role="img" aria-label={`${item.titulo}: ${item.subtitulo}`}>
              {b > a && <div className="acp-tempo-barra" data-situacao={item.situacao} style={{ left: `${a}%`, width: `${Math.max(b - a, 1)}%` }} />}
              {item.reaberturas.map((r) => { const ra = pos(r.inicio); const rb = pos(r.fim); return rb > ra ? <div key={r.inicio} className="acp-tempo-reab" style={{ left: `${ra}%`, width: `${Math.max(rb - ra, 1)}%` }} /> : null; })}
              <div className="acp-tempo-hoje" style={{ left: `calc(${hoje}% - 1px)` }} />
            </div>
          </div>
        );
      })}
      <div className="acp-tempo-eixo"><span /><div><span>{fmtData(de.toISOString())}</span><span style={{ color: 'var(--acp-atencao)', fontWeight: 600 }}>hoje</span><span>{fmtData(ate.toISOString())}</span></div></div>
    </div>
  );
};

// Paginação simples (o usuário pediu para não poluir a tela).
export function usePaginas(itens, porPagina) {
  const [pagina, setPagina] = useState(0);
  const total = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(pagina, total - 1);
  return { visiveis: itens.slice(atual * porPagina, (atual + 1) * porPagina), pagina: atual, total, setPagina };
}
export const Paginacao = ({ pagina, total, setPagina, rotulo }) => (total <= 1 ? null : (
  <nav className="acp-paginacao" aria-label={rotulo}>
    <button type="button" onClick={() => setPagina(pagina - 1)} disabled={pagina === 0}>Anterior</button>
    <span>{pagina + 1} de {total}</span>
    <button type="button" onClick={() => setPagina(pagina + 1)} disabled={pagina >= total - 1}>Próxima</button>
  </nav>
));

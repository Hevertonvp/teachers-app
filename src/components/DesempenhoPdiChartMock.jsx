import { useId, useState } from 'react';
import { Badge } from './Common';
import { useTheme } from '../context/ThemeContext';

// Gráfico 100% decorativo (seção pedida pelo usuário: "coloca fictício, dados APENAS DO GRÁFICO
// serão mock"). Nenhum valor aqui vem de FichaPdi/RespostaPdi reais — a análise de desempenho por
// segmento de aprendizagem ainda não existe no backend. Nunca remover o Badge "Dados fictícios"
// nem ligar isto a dados reais sem deixar isso explícito em algum outro lugar da tela.
const PERIODOS = ['1º Bim', '2º Bim', '3º Bim', '4º Bim', '5º Bim', '6º Bim'];

const SEGMENTOS = [
  { id: 'leitura', nome: 'Leitura e Escrita', cor: '#0f766e', valores: [42, 49, 55, 63, 70, 79] },
  { id: 'logico', nome: 'Raciocínio Lógico-Matemático', cor: '#2563eb', valores: [38, 43, 51, 57, 64, 71] },
  { id: 'social', nome: 'Interação Social', cor: '#d97706', valores: [55, 59, 61, 66, 70, 76] },
  { id: 'autonomia', nome: 'Autonomia', cor: '#7c3aed', valores: [31, 38, 46, 53, 61, 68] },
  { id: 'atencao', nome: 'Atenção e Foco', cor: '#db2777', valores: [40, 44, 48, 54, 60, 67] },
];

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const INNER_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

// Curva suave (Catmull-Rom convertida para Bézier cúbica) em vez de linhas retas entre os pontos
// — só estética, não representa nenhum modelo de interpolação real dos dados.
const buildSmoothPath = (pontos) => {
  if (pontos.length < 2) return '';
  let d = `M ${pontos[0].x.toFixed(1)} ${pontos[0].y.toFixed(1)}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] || pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};

export const DesempenhoPdiChartMock = () => {
  const [selecionadoId, setSelecionadoId] = useState(SEGMENTOS[0].id);
  const [hoverIndex, setHoverIndex] = useState(null);
  const gradientId = useId();
  const { isDark } = useTheme();
  const segmento = SEGMENTOS.find(item => item.id === selecionadoId);

  const pontos = segmento.valores.map((valor, index) => ({
    x: PAD_LEFT + (INNER_WIDTH * index) / (segmento.valores.length - 1),
    y: PAD_TOP + INNER_HEIGHT - (INNER_HEIGHT * valor) / 100,
    valor,
  }));
  const linhaPath = buildSmoothPath(pontos);
  const baseY = (PAD_TOP + INNER_HEIGHT).toFixed(1);
  const areaPath = `${linhaPath} L ${pontos[pontos.length - 1].x.toFixed(1)} ${baseY} L ${pontos[0].x.toFixed(1)} ${baseY} Z`;
  const variacao = segmento.valores[segmento.valores.length - 1] - segmento.valores[0];

  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Desempenho por segmento de aprendizagem</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">Evolução ao longo do ano</h3>
        </div>
        <Badge variant="yellow">Dados fictícios — análise ainda não implementada</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SEGMENTOS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelecionadoId(item.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${item.id === selecionadoId ? 'border-transparent text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            style={item.id === selecionadoId ? { backgroundColor: item.cor } : undefined}
          >
            {item.nome}
          </button>
        ))}
      </div>

      <div key={selecionadoId} className="pdi-chart-fade mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">{segmento.nome}</p>
          <p className="text-sm font-semibold text-emerald-600">↑ +{variacao} pontos desde o 1º bimestre</p>
        </div>

        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mt-2 w-full" role="img" aria-label={`Gráfico fictício de evolução em ${segmento.nome}`}>
          <defs>
            <linearGradient id={`pdi-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={segmento.cor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={segmento.cor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map(marca => {
            const y = PAD_TOP + INNER_HEIGHT - (INNER_HEIGHT * marca) / 100;
            return (
              <g key={marca}>
                <line x1={PAD_LEFT} y1={y} x2={CHART_WIDTH - PAD_RIGHT} y2={y} stroke={gridColor} strokeWidth="1" />
                <text x={PAD_LEFT - 6} y={y + 3} textAnchor="end" fontSize="9" fill={axisColor}>{marca}</text>
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#pdi-grad-${gradientId})`} />
          <path d={linhaPath} fill="none" stroke={segmento.cor} strokeWidth="2.5" strokeLinecap="round" />

          {pontos.map((ponto, index) => (
            <g key={index} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)} className="cursor-pointer">
              <circle cx={ponto.x} cy={ponto.y} r={hoverIndex === index ? 14 : 10} fill="transparent" />
              <circle cx={ponto.x} cy={ponto.y} r={hoverIndex === index ? 6 : 4} fill="white" stroke={segmento.cor} strokeWidth="2.5" />
              {hoverIndex === index && (
                <g>
                  <rect x={ponto.x - 18} y={ponto.y - 28} width="36" height="18" rx="4" fill={segmento.cor} />
                  <text x={ponto.x} y={ponto.y - 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{ponto.valor}%</text>
                </g>
              )}
              <text x={ponto.x} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="9" fill={axisColor}>{PERIODOS[index]}</text>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-2 text-xs text-slate-500">Clique em um segmento acima para ver sua evolução ao longo do ano. Valores meramente ilustrativos.</p>
    </div>
  );
};

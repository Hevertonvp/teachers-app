import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

// Tokens dos gráficos do PDI — paleta validada (scripts do skill de dataviz) contra as superfícies
// reais dos cartões: branco no claro, #0f172a no escuro. Séries categóricas em ordem FIXA (nunca
// ciclada); a cor segue a entidade, nunca a posição. A rampa ordinal (azul, claro -> escuro) é só
// para estados ordenados (não iniciada -> em andamento -> concluída).
const CLARO = {
  superficie: '#ffffff',
  textoPrimario: '#0f172a',
  textoSecundario: '#475569',
  textoMudo: '#64748b',
  grade: '#e2e8f0',
  eixo: '#cbd5e1',
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  ordinal: { forte: '#1c5cab', medio: '#3987e5', fraco: '#86b6ef' },
  trilho: '#e8f0fb',
  subiu: '#047857',
  desceu: '#b91c1c',
};

const ESCURO = {
  superficie: '#0f172a',
  textoPrimario: '#f1f5f9',
  textoSecundario: '#cbd5e1',
  textoMudo: '#94a3b8',
  grade: '#1e293b',
  eixo: '#334155',
  series: ['#3987e5', '#d95926', '#199e70'],
  ordinal: { forte: '#6da7ec', medio: '#2a78d6', fraco: '#184f95' },
  trilho: '#14233f',
  subiu: '#34d399',
  desceu: '#f87171',
};

export const useVizTema = () => {
  const { isDark } = useTheme();
  return isDark ? ESCURO : CLARO;
};

// Largura real do contêiner (ResizeObserver) — os gráficos desenham em pixels de verdade, então o
// texto não encolhe no celular como aconteceria com um viewBox fixo esticado.
export const useLargura = () => {
  const ref = useRef(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.floor(entrada.contentRect.width)));
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, []);
  return [ref, largura];
};

// Teto "redondo" para eixo numérico (1, 2, 5 × 10^n).
export const tetoRedondo = (valor) => {
  if (!valor || valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const fracao = valor / potencia;
  const passo = fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10;
  return passo * potencia;
};

export const formatarNumero = (valor, casas = 1) => (valor === null || valor === undefined ? '—' : Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: casas }));

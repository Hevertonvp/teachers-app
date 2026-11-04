// Formatação do Formulário 1/3: instantes sempre no horário de Brasília (America/Sao_Paulo).
const FUSO = 'America/Sao_Paulo';
const OFFSET_SP_MS = -3 * 60 * 60 * 1000;

export const formatarDataHora = (isoInstante) => {
  if (!isoInstante) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(isoInstante));
};

// "2026-10-19" -> "19/10"
export const formatarDiaMes = (dataIso) => (dataIso ? `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}` : '');
export const formatarPeriodo = (inicio, fim) => `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;

// Instante ISO -> valor de <input type="datetime-local"> no horário de Brasília.
export const paraInputDataHora = (isoInstante) => (isoInstante ? new Date(new Date(isoInstante).getTime() + OFFSET_SP_MS).toISOString().slice(0, 16) : '');

export const STATUS_ENTREGA = {
  nao_iniciado: { label: 'Não iniciado', variant: 'gray' },
  em_andamento: { label: 'Em andamento', variant: 'blue' },
  concluida: { label: 'Concluído', variant: 'green' },
};

export const STATUS_PRAZO = {
  agendado: { label: 'Agendado', variant: 'blue' },
  aberto: { label: 'Aberto', variant: 'green' },
  encerrado: { label: 'Encerrado', variant: 'gray' },
};

// Agrupa "Válido para" por escola: [{ escolaNome, turmas: ['6M1','6M2'] }]
export const agruparPorEscola = (turmas = []) => {
  const mapa = new Map();
  turmas.forEach(t => {
    const grupo = mapa.get(t.escolaId) ?? { escolaId: t.escolaId, escolaNome: t.escolaNome, turmas: [] };
    grupo.turmas.push(t.turmaNome);
    mapa.set(t.escolaId, grupo);
  });
  return [...mapa.values()].sort((a, b) => a.escolaNome.localeCompare(b.escolaNome));
};

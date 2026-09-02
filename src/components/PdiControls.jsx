import { Badge } from './Common';
import { pdiNivelOptions } from '../utils/pdi';

export const TrendBadge = ({ trend }) => {
  const colors = {
    evolucao: 'bg-emerald-50 text-emerald-700',
    estavel: 'bg-slate-100 text-slate-700',
    atencao: 'bg-red-50 text-red-700',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${colors[trend.key]}`}>{trend.label}</span>;
};

export const PdiLevelSelector = ({ value, onChange }) => (
  <div className="grid gap-2 sm:grid-cols-5">
    {pdiNivelOptions.map(option => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`rounded-xl border p-3 text-left transition ${Number(value) === option.value ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200'}`}
      >
        <span className="block text-lg font-bold">{option.value}</span>
        <span className="mt-1 block text-xs leading-snug">{option.label}</span>
      </button>
    ))}
  </div>
);

export const MetaStatusBadge = ({ status }) => {
  const labels = {
    nao_iniciada: 'Não iniciada',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    revisar: 'Revisar',
  };
  const variants = {
    nao_iniciada: 'gray',
    em_andamento: 'yellow',
    concluida: 'green',
    revisar: 'red',
  };

  return <Badge variant={variants[status] || 'gray'}>{labels[status] || status}</Badge>;
};
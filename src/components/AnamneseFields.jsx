import { useState } from 'react';
import { Card } from './Common';
import { inputClass } from '../utils/display';

// Botões segmentados (2 ou 5 opções) — substitui <select> para respostas de escolha única.
// `flex-wrap` garante que no mobile as opções quebrem linha em vez de gerar scroll horizontal.
export const SegmentedToggle = ({ value, onChange, options, disabled }) => (
  <div className="flex flex-wrap gap-2" role="radiogroup">
    {options.map(option => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          value === option.value ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-300'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// Checkbox múltiplo (mais de uma resposta pode ser verdadeira ao mesmo tempo).
export const CheckboxGroup = ({ value, onChange, options, disabled }) => {
  const toggle = (key) => onChange(value.includes(key) ? value.filter(item => item !== key) : [...value, key]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(option => (
        <label key={option.key} className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={value.includes(option.key)} onChange={() => toggle(option.key)} disabled={disabled} />
          {option.label}
        </label>
      ))}
    </div>
  );
};

// "ⓘ Ver explicação" — só aparece quando existe texto. Funciona por clique (toque no mobile)
// e por hover no desktop.
export const InfoTooltip = ({ text }) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="relative ml-1.5 inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="Ver explicação"
        className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-300"
      >
        i
      </button>
      {open && (
        <span className="absolute left-0 top-6 z-20 w-60 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-normal leading-snug text-slate-600 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
};

// "+ Adicionar observação" — o textarea só existe depois de um clique, para não poluir a tela
// com dezenas de campos abertos. Se já houver texto salvo, abre exibindo o conteúdo.
export const ObservacaoField = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(!!value);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-teal-700 hover:underline">
        + Adicionar observação
      </button>
    );
  }
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">Observação</label>
      <textarea className={inputClass} rows="2" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} placeholder="Opcional" />
    </div>
  );
};

// Um aspecto estruturado (comportamental, psicomotor ou cognitivo): rótulo + explicação opcional
// + escolha de resposta + observação opcional.
export const AspectoItem = ({ item, opcoes, value, onChangeResposta, onChangeObservacao, disabled }) => (
  <div className="border-b border-slate-100 py-3 last:border-0">
    <p className="text-sm font-semibold text-slate-800">
      {item.label}
      <InfoTooltip text={item.explicacao} />
    </p>
    <div className="mt-2"><SegmentedToggle value={value.resposta} onChange={onChangeResposta} options={opcoes} disabled={disabled} /></div>
    <div className="mt-2"><ObservacaoField value={value.observacao} onChange={onChangeObservacao} disabled={disabled} /></div>
  </div>
);

// Seção em acordeão (não é wizard: todas as seções ficam acessíveis livremente, sem obrigar
// avançar/voltar). Mostra um selo de progresso no cabeçalho para indicar o que já foi
// respondido sem precisar abrir a seção.
export const AccordionSection = ({ title, subtitle, badge, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card className="p-0">
      <button type="button" onClick={() => setOpen(prev => !prev)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-950">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {badge}
          <span className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>
      {open && <div className="space-y-4 border-t border-slate-200 p-5">{children}</div>}
    </Card>
  );
};

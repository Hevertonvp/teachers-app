import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfessorName } from './ProfessorName';

// Botão "voltar" padrão de qualquer página interna (telas de detalhe/criação, não as que já têm
// entrada direta no menu lateral). Usa o histórico do navegador (`navigate(-1)`) em vez de uma
// rota fixa, porque a mesma tela pode ser aberta a partir de mais de um lugar.
export const BackButton = ({ label = '← Voltar', className = '' }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)} className={`text-sm font-semibold text-teal-700 hover:underline ${className}`}>
      {label}
    </button>
  );
};

// Nome + cargo abaixo, em fonte pequena — mesmo padrão visual de ProfessorName,
// mas genérico (recebe nome/cargo prontos, sem lookup por id) para supervisor/diretor.
export const PersonName = ({ nome, cargo, className = '', nameClassName = 'font-semibold text-slate-900', roleClassName = 'text-[10px] font-medium uppercase tracking-wide text-slate-400' }) => (
  <span className={`inline-flex flex-col leading-tight ${className}`}>
    <span className={nameClassName}>{nome}</span>
    {cargo && <span className={roleClassName}>{cargo}</span>}
  </span>
);

export const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-slate-800 text-white hover:bg-slate-950',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'text-slate-700 hover:bg-slate-100',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };

  return <button className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

export const StatusBadge = ({ status }) => {
  const labels = {
    concluido: 'Concluído',
    'concluído': 'Concluído',
    em_andamento: 'Em andamento',
    pendente: 'Pendente',
    em_atraso: 'Em atraso',
  };
  const colors = {
    concluido: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'concluído': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    em_andamento: 'bg-amber-50 text-amber-700 ring-amber-200',
    pendente: 'bg-slate-100 text-slate-700 ring-slate-200',
    em_atraso: 'bg-red-50 text-red-700 ring-red-200',
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${colors[status] || colors.pendente}`}>{labels[status] || status}</span>;
};

export const Badge = ({ children, variant = 'gray', className = '' }) => {
  const variants = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  };

  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${variants[variant]} ${className}`}>{children}</span>;
};

export const StatCard = ({ label, value, description, children }) => (
  <Card>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <div className="mt-2 flex items-end justify-between gap-4">
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {children}
    </div>
    {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
  </Card>
);

export const ProgressRing = ({ value, label }) => {
  const degree = Math.round((value / 100) * 360);
  return (
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 place-items-center rounded-full" style={{ background: `conic-gradient(#0f766e ${degree}deg, #e2e8f0 ${degree}deg)` }}>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-bold text-slate-900">{value}%</div>
      </div>
      <div>
        <p className="font-semibold text-slate-800">{label}</p>
        <p className="text-sm text-slate-500">preenchimento</p>
      </div>
    </div>
  );
};

export const DataTable = ({ columns, rows, emptyMessage = 'Nenhum registro encontrado', onRowClick }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>{columns.map(column => <th key={column.key} className="px-4 py-3">{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">{emptyMessage}</td></tr>
          ) : rows.map(row => (
            <tr key={row.id} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50'}>
              {columns.map(column => <td key={column.key} data-label={column.header} className="px-4 py-3 align-top text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">×</button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

export const FormField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

export const EmptyState = ({ title, description, children }) => (
  <Card className="py-12 text-center">
    <p className="font-semibold text-slate-800">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{description}</p>
    {children && <div className="mt-4 flex justify-center">{children}</div>}
  </Card>
);

// Menu "..." de ações secundárias (editar/excluir/etc.) — mesmo padrão de dropdown já usado no
// EscolaSelector (fecha ao clicar fora). Usado para tirar ações pouco frequentes da competição
// visual direta com a ação principal de cada tela/cartão.
export const ActionMenu = ({ items, label = 'Mais ações' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      <div
        role="menu"
        className={`absolute right-0 z-40 mt-1 w-52 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg transition duration-150 ease-out ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { setOpen(false); item.onClick(); }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              item.variant === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Botões pequenos e discretos de "mover" (reordenar), sem peso visual de ação primária.
export const OrderButtons = ({ onUp, onDown, upDisabled, downDisabled }) => (
  <div className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200">
    <button type="button" onClick={onUp} disabled={upDisabled} aria-label="Mover para cima" className="grid h-6 w-8 place-items-center text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path fillRule="evenodd" d="M10 6.5a.75.75 0 01.53.22l4.25 4.25a.75.75 0 11-1.06 1.06L10 8.31l-3.72 3.72a.75.75 0 11-1.06-1.06l4.25-4.25A.75.75 0 0110 6.5z" clipRule="evenodd" /></svg>
    </button>
    <button type="button" onClick={onDown} disabled={downDisabled} aria-label="Mover para baixo" className="grid h-6 w-8 place-items-center border-t border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path fillRule="evenodd" d="M10 13.5a.75.75 0 01-.53-.22l-4.25-4.25a.75.75 0 111.06-1.06L10 11.69l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-.53.22z" clipRule="evenodd" /></svg>
    </button>
  </div>
);

export const ConfirmDialog = ({ title, message, onCancel, onConfirm, confirmLabel = 'Excluir' }) => (
  <Modal title={title} onClose={onCancel}>
    <p className="text-slate-600">{message}</p>
    <div className="mt-6 flex justify-end gap-3">
      <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  </Modal>
);

export const NotificationCard = ({ professor, pendencia }) => (
  <Card className="border-red-200 bg-red-50/70">
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-sm font-bold text-red-700">{professor?.avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ProfessorName professor={professor} />
          <StatusBadge status="em_atraso" />
        </div>
        <p className="mt-1 text-sm text-slate-600">{pendencia.atividade}</p>
        <p className="mt-1 text-xs font-semibold text-red-700">{pendencia.diasAtraso} dias em atraso</p>
      </div>
    </div>
  </Card>
);
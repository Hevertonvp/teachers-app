import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEscola } from '../context/EscolaContext';
import { isProfessor, isSecretaria } from '../utils/roles';

export const EscolaSelector = () => {
  const { user } = useAuth();
  const { userEscolas, activeEscolaId, setActiveEscolaId, setExplicitBatchSelection } = useEscola();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Professor nunca vê o seletor — sempre enxerga tudo o que é seu em todas as suas escolas
  // juntas (ver feedback salvo em memória), então escolher uma escola não faria sentido.
  // Gestor/Diretora: 1 escola -> sem seletor (auto-selecionada). Secretaria sempre vê o seletor
  // (tem a opção agregada "Todas as escolas" além de cada escola individual).
  if (isProfessor(user)) return null;
  if (!isSecretaria(user) && userEscolas.length <= 1) return null;

  const options = isSecretaria(user) ? [{ id: null, nome: 'Todas as escolas' }, ...userEscolas] : userEscolas;
  const selected = options.find(option => option.id === activeEscolaId) ?? options[0];

  const select = (id) => {
    setActiveEscolaId(id);
    setExplicitBatchSelection(id === null);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[6.5rem] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:max-w-[14rem] sm:text-sm"
      >
        <span className="truncate">{selected?.nome}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      <div
        role="listbox"
        className={`absolute right-0 z-50 mt-2 max-h-[70vh] w-64 origin-top-right overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg transition duration-150 ease-out ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {options.map(option => (
          <button
            key={option.id ?? 'todas'}
            type="button"
            role="option"
            aria-selected={option.id === activeEscolaId}
            onClick={() => select(option.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              option.id === activeEscolaId ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="truncate">{option.nome}</span>
            {option.status && option.status !== 'ativa' && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inativa</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

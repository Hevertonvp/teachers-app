import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isProfessor } from '../utils/roles';
import { EscolaSelector } from './EscolaSelector';
import { ProfessorName } from './ProfessorName';
import { useNavigate } from 'react-router-dom';

export const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur ${isDark ? 'border-slate-800 bg-slate-950/95' : 'border-slate-200 bg-white/95'}`}
      style={isDark ? { backgroundColor: 'rgba(15, 23, 42, 0.96)', borderColor: '#1e293b' } : undefined}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-xl font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 md:hidden"
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white sm:grid">GP</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900 md:text-xl">Gestão Pedagógica</h1>
            <p className="truncate text-xs text-slate-500">Rede Municipal de Ensino</p>
          </div>
        </div>
        
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <EscolaSelector />
          <button
            type="button"
            onClick={toggleTheme}
            className={`group relative h-7 w-12 shrink-0 rounded-full border p-1 shadow-sm transition sm:h-9 sm:w-16 ${isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'}`}
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
            title={isDark ? 'Modo claro' : 'Modo noturno'}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full text-sm shadow transition-transform duration-500 sm:h-7 sm:w-7 ${isDark ? 'translate-x-5 bg-cyan-200 text-slate-950 sm:translate-x-7' : 'translate-x-0 bg-white text-slate-800'}`}>
              {isDark ? '☾' : '☼'}
            </span>
          </button>
          <div className="hidden text-right sm:block">
            {isProfessor(user) ? (
              <ProfessorName professor={user} nameClassName="text-sm font-semibold text-slate-800" disciplineClassName="text-[10px] font-medium uppercase tracking-wide text-slate-400" />
            ) : (
              <p className="text-sm font-semibold text-slate-800">{user?.nome}</p>
            )}
            <p className="text-xs text-slate-500 capitalize">{user?.tipo}</p>
          </div>
          <div className="hidden h-10 w-10 place-items-center rounded-full bg-teal-100 font-semibold text-teal-800 sm:grid">
            {(user?.avatar || user?.initials)}
          </div>
          <button
            onClick={handleLogout}
            aria-label="Sair"
            title="Sair"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200 sm:h-auto sm:w-auto sm:px-4 sm:py-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5 sm:hidden">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" />
            </svg>
            <span className="hidden text-sm font-semibold sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
};

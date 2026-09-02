import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-xl font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 md:hidden"
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">GP</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 md:text-xl">Gestão Pedagógica</h1>
            <p className="text-xs text-slate-500">Rede Municipal de Ensino</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            className={`group relative h-9 w-16 rounded-full border p-1 shadow-sm transition ${isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'}`}
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
            title={isDark ? 'Modo claro' : 'Modo noturno'}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-full text-sm shadow transition-transform duration-500 ${isDark ? 'translate-x-7 bg-cyan-200 text-slate-950' : 'translate-x-0 bg-white text-slate-800'}`}>
              {isDark ? '☾' : '☼'}
            </span>
          </button>
          <div className="hidden text-right sm:block">
            {user?.tipo === 'professor' ? (
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
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

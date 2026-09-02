import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const { user } = useAuth();
  const location = useLocation();

  const menuProfessor = [
    { name: 'Dashboard', path: '/dashboard', icon: 'D' },
    { name: 'Formulário 1/3', path: '/formulario-um-terco', icon: 'F' },
    { name: 'PDI', path: '/pdi', icon: 'P' },
    { name: 'Correções', path: '/correcoes-simulados', icon: 'C' },
    { name: 'Eventos', path: '/eventos', icon: 'E' },
  ];

  const menuGestor = [
    { name: 'Dashboard', path: '/dashboard', icon: 'D' },
    { name: 'Formulário 1/3', path: '/formulario-um-terco', icon: 'F' },
    { name: 'PDI', path: '/pdi', icon: 'P' },
    { name: 'Correções', path: '/correcoes-simulados', icon: 'C' },
    { name: 'Gestão de Professores', path: '/gestao-professores', icon: 'G' },
    { name: 'Eventos', path: '/eventos', icon: 'E' },
  ];

  const menu = user?.tipo === 'professor' ? menuProfessor : menuGestor;
  const bottomMenu = [{ name: 'Perfil', path: '/perfil', icon: 'U' }, { name: 'Configurações', path: '/configuracoes', icon: 'S' }];

  const renderLink = (item) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        location.pathname === item.path
          ? 'bg-white text-slate-950'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-md bg-white/10 text-xs">{item.icon}</span>
      <span>{item.name}</span>
    </Link>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside className={`fixed bottom-0 left-0 top-0 z-50 w-72 max-w-[85vw] border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-out md:top-16.25 md:z-30 md:w-64 md:translate-x-0 md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="flex h-full flex-col p-4">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <div>
              <p className="text-sm font-bold text-white">Gestão Pedagógica</p>
              <p className="text-xs text-slate-400">Menu principal</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg text-white transition hover:bg-white/15"
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>

          <div className="space-y-1">
            {menu.map(renderLink)}
          </div>
          <div className="mt-auto space-y-1 border-t border-slate-800 pt-4">
            {bottomMenu.map(renderLink)}
          </div>
        </nav>
      </aside>
    </>
  );
};

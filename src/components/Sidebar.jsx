import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { isAuxiliar, isDiretora, isProfessor, isSecretaria } from '../utils/roles';
import { identityKey } from '../utils/mensagens';

// Ícones de linha simples (sem biblioteca externa) para o menu lateral — mesmo padrão de svg
// inline já usado em EscolaSelector/Header (viewBox 24, stroke currentColor). Um id por item de
// menu, independente da sigla usada antes (que servia só de rótulo textual do ícone).
const ICON_PATHS = {
  dashboard: <>
    <rect x="4" y="4" width="7" height="7" rx="1.4" />
    <rect x="13" y="4" width="7" height="7" rx="1.4" />
    <rect x="4" y="13" width="7" height="7" rx="1.4" />
    <rect x="13" y="13" width="7" height="7" rx="1.4" />
  </>,
  formulario: <>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <line x1="7.5" y1="9" x2="16.5" y2="9" />
    <line x1="7.5" y1="13" x2="16.5" y2="13" />
    <line x1="7.5" y1="17" x2="13" y2="17" />
  </>,
  pdi: <>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <rect x="9" y="2.4" width="6" height="3" rx="1" />
    <path d="M9 13l2 2 4-4" />
  </>,
  correcoes: <>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M8.4 12.4l2.4 2.4 4.8-4.8" />
  </>,
  pessoas: <>
    <circle cx="9" cy="8" r="3.1" />
    <path d="M3.5 19.3c0-3.1 2.5-5.4 5.5-5.4s5.5 2.3 5.5 5.4" />
    <circle cx="17.3" cy="9.3" r="2.2" />
    <path d="M14.9 14.6c2.5.4 4.2 2.3 4.5 4.7" />
  </>,
  escolas: <>
    <rect x="5" y="3" width="14" height="18" rx="1.4" />
    <rect x="8" y="6.5" width="2" height="2" />
    <rect x="14" y="6.5" width="2" height="2" />
    <rect x="8" y="11" width="2" height="2" />
    <rect x="14" y="11" width="2" height="2" />
    <rect x="10" y="16" width="4" height="5" />
  </>,
  turmas: <>
    <rect x="3.5" y="6" width="4" height="4" rx="1" />
    <rect x="10" y="6" width="4" height="4" rx="1" />
    <rect x="16.5" y="6" width="4" height="4" rx="1" />
    <rect x="3.5" y="14" width="4" height="4" rx="1" />
    <rect x="10" y="14" width="4" height="4" rx="1" />
    <rect x="16.5" y="14" width="4" height="4" rx="1" />
  </>,
  acompanhamento: <>
    <line x1="4.5" y1="20" x2="19.5" y2="20" />
    <rect x="6" y="12" width="3" height="8" rx="0.8" />
    <rect x="10.8" y="8" width="3" height="12" rx="0.8" />
    <rect x="15.6" y="4" width="3" height="16" rx="0.8" />
  </>,
  eventos: <>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <line x1="4" y1="9.5" x2="20" y2="9.5" />
    <line x1="8" y1="3" x2="8" y2="6.5" />
    <line x1="16" y1="3" x2="16" y2="6.5" />
  </>,
  noticias: <>
    <rect x="3.5" y="5" width="13" height="14" rx="1.4" />
    <line x1="6.5" y1="9" x2="13.5" y2="9" />
    <line x1="6.5" y1="12" x2="13.5" y2="12" />
    <line x1="6.5" y1="15" x2="11" y2="15" />
    <path d="M16.5 8h2A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-2" />
  </>,
  mensagens: <path d="M4 5.8A2.3 2.3 0 0 1 6.3 3.5h11.4A2.3 2.3 0 0 1 20 5.8v7.4a2.3 2.3 0 0 1-2.3 2.3H9.2l-4.3 3.7-.9-.9V5.8Z" />,
  perfil: <>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="9.9" r="2.7" />
    <path d="M6.6 18.1c.9-2.5 2.9-3.8 5.4-3.8s4.5 1.3 5.4 3.8" />
  </>,
  configuracoes: <>
    <line x1="5" y1="6.5" x2="19" y2="6.5" />
    <circle cx="9.5" cy="6.5" r="1.7" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <circle cx="15" cy="12" r="1.7" />
    <line x1="5" y1="17.5" x2="19" y2="17.5" />
    <circle cx="11" cy="17.5" r="1.7" />
  </>,
};

const NavIcon = ({ id, className = 'h-4.5 w-4.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {ICON_PATHS[id] || ICON_PATHS.dashboard}
  </svg>
);

export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const { user } = useAuth();
  const { mensagens } = useData();
  const location = useLocation();
  const unreadCount = mensagens.filter(message => identityKey(message.destinatarioTipo, message.destinatarioId) === identityKey(user?.tipo, user?.id) && !message.lidaEm).length;

  const menuProfessor = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { name: 'Formulário 1/3', path: '/formulario-um-terco', icon: 'formulario' },
    { name: 'PDI', path: '/pdi', icon: 'pdi' },
    { name: 'Correções', path: '/correcoes-simulados', icon: 'correcoes' },
    { name: 'Eventos', path: '/eventos', icon: 'eventos' },
    { name: 'Notícias', path: '/noticias', icon: 'noticias' },
    { name: 'Mensagens', path: '/mensagens', icon: 'mensagens' },
  ];

  const menuGestor = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { name: 'Formulário 1/3', path: '/formulario-um-terco', icon: 'formulario' },
    { name: 'PDI', path: '/pdi', icon: 'pdi' },
    { name: 'Correções', path: '/correcoes-simulados', icon: 'correcoes' },
    { name: 'Gestão de Professores(as)', path: '/gestao-professores', icon: 'pessoas' },
    { name: 'Eventos', path: '/eventos', icon: 'eventos' },
    { name: 'Notícias', path: '/noticias', icon: 'noticias' },
    { name: 'Mensagens', path: '/mensagens', icon: 'mensagens' },
  ];

  const menuSecretaria = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { name: 'Gestão de Pessoas', path: '/pessoas', icon: 'pessoas' },
    { name: 'Escolas', path: '/escolas', icon: 'escolas' },
    { name: 'Turmas', path: '/turmas', icon: 'turmas' },
    { name: 'Acompanhamento Escolar', path: '/acompanhamento-escolar', icon: 'acompanhamento' },
    { name: 'Formulário 1/3', path: '/formulario-um-terco', icon: 'formulario' },
    { name: 'PDI', path: '/pdi', icon: 'pdi' },
    { name: 'Correções', path: '/correcoes-simulados', icon: 'correcoes' },
    { name: 'Eventos', path: '/eventos', icon: 'eventos' },
    { name: 'Notícias', path: '/noticias', icon: 'noticias' },
    { name: 'Mensagens', path: '/mensagens', icon: 'mensagens' },
  ];

  const menuDiretora = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { name: 'Notícias', path: '/noticias', icon: 'noticias' },
    { name: 'Mensagens', path: '/mensagens', icon: 'mensagens' },
  ];

  // Etapa inicial do perfil Auxiliar: só a lista dos alunos que acompanha — sem módulos
  // administrativos de outros perfis.
  const menuAuxiliar = [
    { name: 'Meus alunos', path: '/meus-alunos', icon: 'pessoas' },
  ];

  const menu = isProfessor(user) ? menuProfessor
    : isSecretaria(user) ? menuSecretaria
    : isDiretora(user) ? menuDiretora
    : isAuxiliar(user) ? menuAuxiliar
    : menuGestor;
  const menuWithUnread = menu.map(item => item.path === '/mensagens' ? { ...item, badge: unreadCount } : item);
  const bottomMenu = [{ name: 'Perfil', path: '/perfil', icon: 'perfil' }, { name: 'Configurações', path: '/configuracoes', icon: 'configuracoes' }];

  const renderLink = (item) => {
    const active = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClose}
        className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
          active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${
          active ? 'bg-teal-50 text-teal-700' : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white'
        }`}>
          <NavIcon id={item.icon} />
        </span>
        <span>{item.name}</span>
        {item.badge > 0 && <span className="ml-auto shrink-0 rounded-full bg-teal-400 px-2 py-0.5 text-xs font-bold text-slate-950">{item.badge}</span>}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside className={`fixed bottom-0 left-0 top-0 z-50 w-72 max-w-[85vw] border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-transform duration-[900ms] ease-out md:top-16.25 md:z-30 md:w-64 md:translate-x-0 md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="flex h-full flex-col p-4 md:pt-6">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <div>
              <p className="text-sm font-bold text-white">Gestão Pedagógica</p>
              <p className="text-xs text-slate-400">Menu principal</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-lg text-white transition hover:bg-white/15"
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {menuWithUnread.map(renderLink)}
          </div>
          <div className="shrink-0 space-y-1 border-t border-slate-800 pt-4">
            {bottomMenu.map(renderLink)}
          </div>
        </nav>
      </aside>
    </>
  );
};

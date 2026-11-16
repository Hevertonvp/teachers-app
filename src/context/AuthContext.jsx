import { createContext, useEffect, useState, useContext } from 'react';
import { apiFetch, getAuthToken, setAuthToken, setSenhaTemporariaPendenteHandler, setUnauthorizedHandler } from '../services/api';
import { registrarUsuarioAtual, sincronizarAoEntrar } from '../offline/syncQueue';
import { useData } from './DataContext';

const AuthContext = createContext();

const getStoredUser = () => {
  const storedUser = localStorage.getItem('user');
  // Sessão salva sem token (anterior à autenticação real) não vale mais: exige novo login.
  if (!storedUser || !getAuthToken()) return null;

  try {
    return JSON.parse(storedUser);
  } catch (e) {
    console.error('Erro ao carregar usuário do localStorage:', e);
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);
  const { loadEscolas, loadTurmas, loadDisciplinasReais, loadPdiAlunosReais, loadTrimestres } = useData();

  // Carga inicial de dados reais depois que a sessão está liberada. Com senha temporária pendente o
  // backend recusa TODAS estas chamadas (403), então só roda no login normal e, no primeiro acesso,
  // logo depois de a senha ser trocada (ver trocarSenha) — senão o painel abriria sem escolas,
  // turmas, disciplinas e trimestres até alguém recarregar a página.
  const carregarDadosIniciais = (perfil) => {
    loadEscolas();
    loadTurmas();
    loadDisciplinasReais();
    loadTrimestres();
    // GET /api/pdi-alunos é exclusivo de Secretaria/Gestor/Diretora (ver exigirLeitura em
    // pdiAlunos.ts) — Professor e Auxiliar sempre recebiam 403 aqui à toa.
    if (['SECRETARIA', 'GESTOR', 'DIRETORA'].includes(perfil)) loadPdiAlunosReais();
  };

  // Login REAL: quem valida e-mail/senha é o backend (bcrypt + JWT); o usuário é o que ele devolve.
  const login = async (email, senha) => {
    let resposta;
    try {
      resposta = await apiFetch('/api/auth/login', { method: 'POST', body: { email, senha } });
    } catch (error) {
      return { ok: false, error: error.message };
    }

    const { token, pessoa } = resposta;
    // 16/11/2026: dados de demonstração (mockData) removidos — o usuário vem só do backend. Iniciais do nome para o
    // círculo do cabeçalho (antes vinham do mock só para as contas de demonstração; professores ficavam sem).
    const palavras = (pessoa.nome || pessoa.email || '').trim().split(/\s+/).filter(Boolean);
    const iniciais = palavras.length > 1 ? `${palavras[0][0]}${palavras[palavras.length - 1][0]}` : (palavras[0] ?? '').slice(0, 2);
    const userData = {
      id: pessoa.id,
      email: pessoa.email,
      nome: pessoa.nome,
      cargo: pessoa.cargo,
      tipo: pessoa.perfil.toLowerCase(),
      avatar: iniciais.toUpperCase(),
    };

    userData.senhaTemporaria = pessoa.senhaTemporaria;

    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    if (!pessoa.senhaTemporaria) carregarDadosIniciais(pessoa.perfil);
    return { ok: true };
  };

  // Chamado após "Criar minha senha" (primeiro acesso) ou sempre que o backend recusar uma
  // chamada por senha temporária pendente (ex.: reset administrativo no meio da sessão) — marca
  // o usuário como pendente/concluído sem precisar de um novo login.
  const marcarSenhaTemporaria = (pendente) => {
    setUser(prev => {
      if (!prev) return prev;
      // Sem mudança real, devolve o MESMO objeto: um objeto novo a cada 403 refazia os efeitos que
      // dependem de `user` (ex.: EscolaContext), que pediam de novo, recebiam 403 de novo... em laço.
      if (!!prev.senhaTemporaria === pendente) return prev;
      const atualizado = { ...prev, senhaTemporaria: pendente };
      localStorage.setItem('user', JSON.stringify(atualizado));
      return atualizado;
    });
  };

  const trocarSenha = async (novaSenha, confirmarNovaSenha) => {
    try {
      const { token } = await apiFetch('/api/auth/trocar-senha', { method: 'POST', body: { novaSenha, confirmarNovaSenha } });
      setAuthToken(token);
      marcarSenhaTemporaria(false);
      carregarDadosIniciais(user?.tipo?.toUpperCase());
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const clearSession = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
  };

  const logout = clearSession;

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    setSenhaTemporariaPendenteHandler(() => marcarSenhaTemporaria(true));
    return () => {
      setUnauthorizedHandler(null);
      setSenhaTemporariaPendenteHandler(null);
    };
  }, []);

  // Isolamento da infra offline por usuário (nunca por "id", que é sobrescrito pelo id do perfil
  // rico do mock — ver login() acima; email é sempre único e sempre presente). Cobre login,
  // logout e o reload inicial (usuário já vinha de localStorage) num só lugar. Logout NUNCA
  // apaga rascunho não sincronizado (decisão confirmada) — só para de ler/escrever o namespace
  // daquele usuário; o dado fica inerte no IndexedDB até ele logar de novo no mesmo navegador.
  useEffect(() => {
    const userId = user?.email?.toLowerCase() ?? null;
    registrarUsuarioAtual(userId);
    // DEF-07: ao abrir o app/logar, envia a fila pendente DESTE usuário — só com sessão válida
    // (token presente e sem senha temporária pendente, que o backend recusaria). Se o token
    // estiver expirado, o 401 devolve a linha a 'pending' e ela segue guardada até o próximo login.
    if (userId && !user.senhaTemporaria && getAuthToken()) sincronizarAoEntrar(userId);
  }, [user]);

  const isAuthenticated = () => user !== null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, trocarSenha }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

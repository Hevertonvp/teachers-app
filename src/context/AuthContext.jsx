import { createContext, useEffect, useState, useContext } from 'react';
import { usuarios as usuariosIniciais } from '../data/mockData';
import { apiFetch, getAuthToken, setAuthToken, setUnauthorizedHandler } from '../services/api';
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
  const [usuarios, setUsuarios] = useState(usuariosIniciais);
  // Lê os perfis sempre atualizados do DataContext (não mais uma cópia estática do mockData) —
  // assim, uma pessoa cadastrada ou editada em Gestão de Pessoas já entra corretamente aqui,
  // sem depender de recarregar a página. Por isso o AuthProvider precisa estar DENTRO do
  // DataProvider (ver App.jsx).
  const { professores, gestores, diretores, secretarias, auxiliares, loadEscolas } = useData();

  // Login REAL: quem valida e-mail/senha é o backend (bcrypt + JWT). O array `usuarios` do mock
  // continua servindo só para ligar a conta ao perfil detalhado (turmas, disciplinas, avatar...)
  // que ainda vive no DataContext mockado — a autenticação em si não depende mais dele.
  const login = async (email, senha) => {
    let resposta;
    try {
      resposta = await apiFetch('/api/auth/login', { method: 'POST', body: { email, senha } });
    } catch (error) {
      return { ok: false, error: error.message };
    }

    const { token, pessoa } = resposta;
    const usuario = usuarios.find(u => u.email.toLowerCase() === pessoa.email.toLowerCase());
    if (!usuario) {
      return { ok: false, error: 'Esta conta ainda não tem perfil configurado neste aplicativo.' };
    }

    // O backend devolve o perfil em maiúsculas (PROFESSOR, GESTOR...); o frontend usa minúsculas.
    let userData = {
      id: usuario.id,
      email: usuario.email,
      tipo: pessoa.perfil.toLowerCase(),
    };

    if (usuario.tipo === 'professor') {
      const professor = professores.find(p => p.id === usuario.professorId);
      userData = { ...userData, ...professor };
    } else if (usuario.tipo === 'gestor') {
      const gestor = gestores.find(g => g.id === usuario.gestorId);
      userData = { ...userData, ...gestor };
    } else if (usuario.tipo === 'diretora') {
      const diretora = diretores.find(d => d.id === usuario.diretoraId);
      userData = { ...userData, ...diretora };
    } else if (usuario.tipo === 'secretaria') {
      const secretaria = secretarias.find(s => s.id === usuario.secretariaId);
      userData = { ...userData, ...secretaria };
    } else if (usuario.tipo === 'auxiliar') {
      const auxiliar = auxiliares.find(a => a.id === usuario.auxiliarId);
      userData = { ...userData, ...auxiliar };
    }

    // `id` acima é sobrescrito pelo id do perfil (professorId/gestorId/...) nos spreads
    // acima — é o que o resto do app usa como "user.id" hoje. `usuarioId` preserva à parte
    // o id da credencial de login (usuarios.id), que não deve ser perdido nessa fusão.
    userData.usuarioId = usuario.id;

    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    loadEscolas();
    return { ok: true };
  };

  const clearSession = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
  };

  const logout = clearSession;

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, []);

  const isAuthenticated = () => user !== null;

  // Cria a credencial de login de uma pessoa recém-cadastrada (professor/gestor/diretora) —
  // sem isso, cadastrar em Gestão de Pessoas criava o perfil mas nunca uma conta pra entrar
  // (ver GestaoPessoas.jsx). `tipo` é sempre 'professor' | 'gestor' | 'diretora', e a chave do
  // perfil na credencial segue o mesmo padrão já usado no mock (`${tipo}Id`).
  const registrarUsuario = ({ email, senha = '123456', tipo, perfilId }) => {
    setUsuarios(prev => [...prev, {
      id: Math.max(0, ...prev.map(item => item.id)) + 1,
      email,
      senha,
      tipo,
      [`${tipo}Id`]: perfilId,
    }]);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, registrarUsuario }}>
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

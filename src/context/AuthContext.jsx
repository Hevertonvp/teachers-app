import { createContext, useState, useContext } from 'react';
import { usuarios, professores, gestores } from '../data/mockData';

const AuthContext = createContext();

const getStoredUser = () => {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) return null;

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

  const login = (email, senha) => {
    const usuario = usuarios.find(u => u.email === email && u.senha === senha);
    
    if (usuario) {
      let userData = {
        id: usuario.id,
        email: usuario.email,
        tipo: usuario.tipo,
      };

      if (usuario.tipo === 'professor') {
        const professor = professores.find(p => p.id === usuario.professorId);
        userData = { ...userData, ...professor };
      } else if (usuario.tipo === 'gestor') {
        const gestor = gestores.find(g => g.id === usuario.gestorId);
        userData = { ...userData, ...gestor };
      }

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const isAuthenticated = () => user !== null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
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

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Enquanto a senha for temporária, nenhuma rota normal é acessível — mesmo por URL direta
  // (o backend também bloqueia isso; este redirect é só pra não mostrar uma tela quebrada).
  if (user?.senhaTemporaria) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  return children;
};

// Guarda da própria tela de "criar minha senha": só acessível durante o estado pendente.
export const PrimeiroAcessoRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.senhaTemporaria) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

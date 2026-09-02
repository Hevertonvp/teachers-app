import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../layouts/Layouts';
import { Button } from '../components/Common';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    // Simular delay de requisição
    await new Promise(resolve => setTimeout(resolve, 500));

    if (login(email, senha)) {
      navigate('/dashboard');
    } else {
      setErro('Email ou senha incorretos');
    }
    setCarregando(false);
  };

  const preencherDados = (tipo) => {
    if (tipo === 'professor') {
      setEmail('professor@escola.gov.br');
      setSenha('123456');
    } else if (tipo === 'gestor') {
      setEmail('gestor@escola.gov.br');
      setSenha('123456');
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 font-bold text-primary-600">GP</div>
          <h1 className="text-2xl font-bold text-slate-700">Gestão Pedagógica</h1>
          <p className="text-gray-600 text-sm mt-1">Rede Municipal de Ensino</p>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="seu.email@escola.gov.br"
              disabled={carregando}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="••••••"
              disabled={carregando}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={carregando}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-3">Contas de Demonstração</p>
          <div className="space-y-2">
            <button
              onClick={() => preencherDados('professor')}
              className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
            >
              Professor
            </button>
            <button
              onClick={() => preencherDados('gestor')}
              className="w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium"
            >
              Gestor/Supervisor
            </button>
          </div>
        </div>
      </div>

      <p className="text-white text-center text-xs mt-8">
        Protótipo de demonstração - Dados fictícios
      </p>
    </AuthLayout>
  );
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../layouts/Layouts';
import { Button } from '../components/Common';

export const PrimeiroAcessoPage = () => {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { trocarSenha } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');

    if (novaSenha !== confirmarNovaSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setSalvando(true);
    const resultado = await trocarSenha(novaSenha, confirmarNovaSenha);
    setSalvando(false);

    if (resultado.ok) {
      navigate('/dashboard');
    } else {
      setErro(resultado.error);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 font-bold text-primary-600">GP</div>
          <h1 className="text-2xl font-bold text-slate-700">Crie sua senha</h1>
          <p className="text-gray-600 text-sm mt-2">
            Você está acessando o sistema pela primeira vez (ou sua senha foi redefinida). Para continuar, defina uma senha pessoal.
          </p>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              disabled={salvando}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmarNovaSenha}
              onChange={(e) => setConfirmarNovaSenha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              minLength={8}
              disabled={salvando}
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

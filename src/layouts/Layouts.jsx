import { useState } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { InstallBanner } from '../components/InstallBanner';
import { useAuth } from '../context/AuthContext';
import { useEscola } from '../context/EscolaContext';
import { isSecretaria } from '../utils/roles';

// Enquanto os vínculos escolares reais (VinculoEscolar) ainda não chegaram da API, `userEscolas`
// fica temporariamente vazio — sem este gate, as várias telas que fazem
// `if (userEscolas.length === 0) return <EmptyState .../>` mostrariam essa mensagem errada por um
// instante a cada carregamento (ver EscolaContext.jsx). Secretaria nunca depende disso (usa
// `escolas` direto), por isso fica de fora do gate.
export const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { vinculosLoading, vinculosError, reloadVinculos } = useEscola();
  const aguardandoVinculos = !isSecretaria(user) && vinculosLoading;
  const mostrarErroVinculos = !isSecretaria(user) && !vinculosLoading && vinculosError;

  return (
    <div className="min-h-screen bg-slate-100">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <InstallBanner />
      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="min-w-0 flex-1 p-4 pt-6 md:ml-64 md:p-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
            {mostrarErroVinculos && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                <span>Não foi possível carregar suas escolas vinculadas: {vinculosError}</span>
                <button type="button" onClick={reloadVinculos} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100">Tentar novamente</button>
              </div>
            )}
            {aguardandoVinculos ? <p className="text-center text-slate-500">Carregando...</p> : children}
          </div>
        </main>
      </div>
    </div>
  );
};

export const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
};

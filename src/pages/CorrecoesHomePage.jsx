import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../components/Common';
import { PdiDesenvolvimentoPage, SeloDesenvolvimento } from '../components/PdiDesenvolvimento';
import { useAuth } from '../context/AuthContext';
import { PDI_ATIVO, PDI_EM_DESENVOLVIMENTO } from '../config/modulos';
import { canViewCorrecoesPdi, isSecretaria } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Hub de Correções. Desde 12/11/2026 tem o Formulário 1/3 (só Secretaria) além do PDI. A entrada não depende
// mais do PDI: com o PDI "em desenvolvimento", a Secretaria vê o 1/3 normalmente e o PDI com o selo; os
// demais perfis (que não têm subárea de correções) continuam vendo o mesmo aviso de antes.
export const CorrecoesHomePage = () => {
  const { user } = useAuth();
  const umTerco = isSecretaria(user);
  const pdi = canViewCorrecoesPdi(user);

  if (!umTerco) {
    if (!PDI_ATIVO && PDI_EM_DESENVOLVIMENTO) return <PdiDesenvolvimentoPage />;
    if (!pdi) return <MainLayout><div className="space-y-6"><h1 className="text-3xl font-bold text-slate-950">Correções</h1><EmptyState title="Em construção" /></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Correções</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {umTerco && (
            <Link to="/correcoes/um-terco">
              <Card className="h-full transition hover:border-teal-300 hover:shadow-md">
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Formulário 1/3</p>
                <p className="mt-1 text-lg font-bold text-slate-950">Correção das folhas do 1/3</p>
                <p className="mt-1 text-sm text-slate-600">Corrigir diretamente ou enviar para correção do professor.</p>
              </Card>
            </Link>
          )}
          {pdi && (
            <Link to="/correcoes/pdi">
              <Card className={`h-full transition hover:border-teal-300 hover:shadow-md ${PDI_ATIVO ? '' : 'opacity-75'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
                  {!PDI_ATIVO && <SeloDesenvolvimento />}
                </div>
                <p className="mt-1 text-lg font-bold text-slate-950">Correção de Fichas PDI</p>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

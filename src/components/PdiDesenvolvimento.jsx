import { Link } from 'react-router-dom';
import { Button, Card } from './Common';
import { MainLayout } from '../layouts/Layouts';
import { useAuth } from '../context/AuthContext';
import { isProfessor, isSecretaria } from '../utils/roles';
import { AVISO_PDI_DESENVOLVIMENTO } from '../config/modulos';

// Selo "Em desenvolvimento" (PDI em MODO_PDI = 'desenvolvimento', ver config/modulos.js).
export const SeloDesenvolvimento = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ${className}`}>
    <span aria-hidden="true">🚧</span> Em desenvolvimento
  </span>
);

// Cartão desabilitado que ocupa o lugar de um cartão do PDI (Dashboards).
export const CartaoPdiDesenvolvimento = ({ titulo = 'PDI', className = '' }) => (
  <Card className={`bg-slate-50 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-bold text-slate-500">{titulo}</h2>
      <SeloDesenvolvimento />
    </div>
    <p className="mt-3 text-sm text-slate-600">{AVISO_PDI_DESENVOLVIMENTO}</p>
  </Card>
);

// Página mostrada em qualquer rota do PDI (ou das Correções do PDI) enquanto está em desenvolvimento.
export const PdiDesenvolvimentoPage = () => {
  const { user } = useAuth();
  const temUmTerco = isProfessor(user) || isSecretaria(user);
  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl">
        <Card className="py-10 text-center">
          <div className="text-4xl" aria-hidden="true">🚧</div>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">PDI em desenvolvimento</h1>
          <p className="mx-auto mt-2 max-w-md text-slate-600">{AVISO_PDI_DESENVOLVIMENTO}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {temUmTerco && <Link to="/formulario-um-terco"><Button className="w-full sm:w-auto">Ir para o Formulário 1/3</Button></Link>}
            <Link to="/dashboard"><Button variant="outline" className="w-full sm:w-auto">Voltar ao Dashboard</Button></Link>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

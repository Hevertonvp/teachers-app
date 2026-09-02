import { MainLayout } from '../layouts/Layouts';
import { Card, StatusBadge } from '../components/Common';

export const ConfiguracoesPage = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Configurações</h1>
          <p className="mt-2 text-slate-600">Tela visual para demonstração. Nenhuma integração externa foi implementada.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <h2 className="font-bold text-slate-950">Ano letivo</h2>
            <p className="mt-2 text-sm text-slate-600">2026</p>
            <div className="mt-4"><StatusBadge status="em_andamento" /></div>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Instrumentos ativos</h2>
            <p className="mt-2 text-sm text-slate-600">Formulário 1/3, PDI e Correções dos simulados.</p>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Persistência</h2>
            <p className="mt-2 text-sm text-slate-600">Dados mantidos apenas em estado React durante a sessão.</p>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};
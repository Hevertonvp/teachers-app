import { Link } from 'react-router-dom';
import { Button, Card, EmptyState } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';

export const DashboardGestor = () => {
  const { user } = useAuth();
  const { userEscolas } = useEscola();

  if (userEscolas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a Secretaria de Educação." />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Visão geral da escola</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Bem-vinda(o), {user?.nome}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Esta primeira entrega disponibiliza só o módulo PDI — os demais indicadores administrativos serão liberados nas próximas etapas.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <h2 className="text-xl font-bold text-slate-950">PDI</h2>
            <p className="mt-2 text-sm text-slate-600">Alunos, fichas e aplicações do PDI por disciplina das suas escolas.</p>
            <div className="mt-4 grid gap-3">
              <Link to="/pdi"><Button className="w-full" variant="primary">Acessar PDI</Button></Link>
              <Link to="/pdi/alunos"><Button className="w-full" variant="outline">Ver Alunos PDI</Button></Link>
            </div>
          </Card>

          <Card className="lg:col-span-2 border-dashed bg-slate-50 text-center">
            <p className="font-semibold text-slate-800">Em construção</p>
            <p className="mt-1 text-sm text-slate-500">Formulário 1/3, Correções de simulados, pendências, eventos, notícias e a Análise de Desenvolvimento (versão anterior do PDI) serão liberados nas próximas entregas.</p>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

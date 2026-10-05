import { Badge, Button, Card, StatCard } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { canViewIndicadoresDiretora } from '../utils/roles';

export const DashboardDiretora = () => {
  const { user } = useAuth();
  const { escolas, turmas, escolasLoading, escolasError, turmasLoading, loadEscolas } = useData();
  const { userEscolas, activeEscolaId } = useEscola();

  if (!canViewIndicadoresDiretora(user)) return null;

  // Mesmo cuidado do dashboard da Secretaria: sem isso, a tela mostra "0 escolas" por um instante
  // a cada carregamento (bem mais que um instante num cold start do backend em produção).
  if (escolasLoading || turmasLoading) {
    return (
      <MainLayout>
        <p className="text-center text-slate-500">Carregando indicadores...</p>
      </MainLayout>
    );
  }

  if (escolasError) {
    return (
      <MainLayout>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar as escolas: {escolasError}</span>
          <Button size="sm" variant="outline" onClick={loadEscolas}>Tentar novamente</Button>
        </div>
      </MainLayout>
    );
  }

  const escolasVinculadas = escolas.filter(escola => userEscolas.some(item => item.id === escola.id));
  const escolasVisualizadas = activeEscolaId === null ? escolasVinculadas : escolasVinculadas.filter(escola => escola.id === activeEscolaId);
  const escolasAtivas = escolasVisualizadas.filter(escola => escola.status === 'ativa').length;
  const escolasInativas = escolasVisualizadas.length - escolasAtivas;
  const totalTurmas = turmas.filter(turma => escolasVisualizadas.some(escola => escola.id === turma.escolaId)).length;

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Visão das escolas vinculadas</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Dashboard do(a) Diretor(a)</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Esta primeira entrega disponibiliza só o módulo PDI — os demais indicadores serão liberados nas próximas etapas.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Escolas" value={escolasVinculadas.length} description="vinculadas" />
              <StatCard label="Ativas" value={escolasAtivas} description="escolas" />
              <StatCard label="Inativas" value={escolasInativas} description="escolas" />
              <StatCard label="Turmas" value={totalTurmas} description="nas escolas" />
            </div>
          </div>
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">Escolas vinculadas</h2>
              <p className="mt-1 text-sm text-slate-600">Consulte o PDI dos alunos dessas escolas pelo menu PDI.</p>
            </div>
            <div className="space-y-3">
              {escolasVisualizadas.map(escola => (
                <div key={escola.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{escola.nome}</h3>
                      <p className="mt-1 text-sm text-slate-500">{turmas.filter(turma => turma.escolaId === escola.id).length} turmas</p>
                    </div>
                    <Badge variant={escola.status === 'ativa' ? 'green' : 'gray'}>{escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <Card className="border-dashed bg-slate-50 text-center">
            <p className="font-semibold text-slate-800">Em construção</p>
            <p className="mt-1 text-sm text-slate-500">Indicadores de Formulário 1/3, Correções de simulados e supervisores serão liberados nas próximas entregas.</p>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

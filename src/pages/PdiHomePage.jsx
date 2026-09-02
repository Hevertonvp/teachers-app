import { Link } from 'react-router-dom';
import { Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { formatFullDate, formDefinitions, formStatusClasses, formStatusLabel, getFormStatus } from '../utils/formAvailability';

export const PdiHomePage = () => {
  const { user } = useAuth();
  const { formPeriods } = useData();
  const isGestor = user?.tipo === 'gestor';
  const pdiForm = formPeriods.find(period => period.id === 'pdi');
  const pdiStatus = pdiForm ? getFormStatus(pdiForm.startDate, pdiForm.endDate) : null;
  const pdiVigente = pdiForm && pdiStatus === 'active';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Módulo PDI</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Plano de Desenvolvimento Individual</h1>
          <p className="mt-2 max-w-3xl text-slate-600">O módulo separa a gestão das perguntas do formulário e o acompanhamento individual dos alunos.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">{isGestor ? 'Gestão de indicadores' : 'Avaliação trimestral'}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Formulário PDI</h2>
                <p className="mt-2 text-sm text-slate-600">{isGestor ? 'Crie, edite, ordene e ative/desative as perguntas que definem os dados de desenvolvimento coletados nos acompanhamentos.' : 'Acesse seus alunos PDI para preencher ou consultar a avaliação trimestral dentro da vigência definida pela gestão.'}</p>
              </div>
              {isGestor ? <Link to="/pdi/formulario"><Button>Gerenciar formulário</Button></Link> : <Link to="/pdi/alunos"><Button>Preencher avaliações</Button></Link>}
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">Acompanhamento pedagógico</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Alunos PDI</h2>
                <p className="mt-2 text-sm text-slate-600">{isGestor ? 'Consulte alunos, histórico de respostas, gráfico de desenvolvimento e tendência de evolução ao longo do tempo.' : 'Consulte os alunos PDI das turmas em que você leciona e acesse a avaliação trimestral.'}</p>
              </div>
              <Link to="/pdi/alunos"><Button variant="outline">Ver alunos</Button></Link>
            </div>
          </Card>
        </div>

        {isGestor && pdiVigente && <Card>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-xl font-bold text-slate-950">Formulários PDI vigentes</h2><p className="mt-1 text-sm text-slate-600">Períodos de preenchimento definidos pela gestão.</p></div>
            <Link to="/pdi/formulario"><Button size="sm" variant="outline">Gerenciar formulário</Button></Link>
          </div>
          {pdiForm && <Link to="/pdi/formulario" className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-slate-900">{formDefinitions.pdi.title}</p><p className="mt-1 text-sm text-slate-600">{formDefinitions.pdi.subtitle}</p></div>
              <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(pdiStatus)}`}>{formStatusLabel(pdiStatus)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Início: {formatFullDate(pdiForm.startDate)}</span><span>Encerramento: {formatFullDate(pdiForm.endDate)}</span></div>
          </Link>}
        </Card>}
      </div>
    </MainLayout>
  );
};
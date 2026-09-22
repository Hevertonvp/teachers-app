import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { escolaName } from '../utils/display';
import { formatFullDate, formStatusClasses, formStatusLabel, getFormStatus } from '../utils/formAvailability';
import { canManagePedagogico, isProfessor as isProfessorRole } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';

export const PdiHomePage = () => {
  const { user } = useAuth();
  const { pdiAplicacoes, disciplinas, escolas } = useData();
  const { activeEscolaId } = useEscola();
  const isGestor = canManagePedagogico(user);
  const isProfessorUser = isProfessorRole(user);
  const pdiAplicavel = activeEscolaId !== null && isEscolaAplicavel(RECURSOS.PDI, activeEscolaId);
  // Vigência do PDI agora é por APLICAÇÃO (ver src/data/... / DataContext.jsx `pdiAplicacoes`),
  // não mais um único período em formPeriods — pode haver várias aplicações para a mesma
  // escola. Aqui mostramos todas as aplicações da escola selecionada pelo Gestor.
  const aplicacoesDaEscola = pdiAplicavel ? pdiAplicacoes.filter(aplicacao => aplicacao.escolaId === activeEscolaId) : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Módulo PDI</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Plano de Desenvolvimento Individual</h1>
          <p className="mt-2 max-w-3xl text-slate-600">O módulo separa a gestão das perguntas do formulário e o acompanhamento individual dos alunos.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">{isGestor ? 'Gestão de modelos e aplicações' : 'PDI por disciplina'}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Formulário PDI</h2>
                <p className="mt-2 text-sm text-slate-600">{isGestor ? 'Crie modelos por disciplina, gerencie suas perguntas e abra aplicações PDI para cada escola.' : 'Acesse "Meus PDIs" para preencher ou consultar as fichas das disciplinas que você leciona, sem precisar escolher uma escola antes.'}</p>
              </div>
              {isGestor ? <Link to="/pdi/formulario"><Button>Gerenciar formulário</Button></Link> : <Link to="/pdi/meus-pdis"><Button>Meus PDIs</Button></Link>}
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">Acompanhamento pedagógico</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Alunos PDI</h2>
                <p className="mt-2 text-sm text-slate-600">{isGestor ? 'Consulte alunos, histórico de respostas, gráfico de desenvolvimento e tendência de evolução ao longo do tempo.' : 'Consulte os alunos PDI das turmas em que você leciona.'}</p>
              </div>
              <Link to={isProfessorUser ? '/pdi/meus-pdis' : '/pdi/alunos'}><Button variant="outline">Ver alunos</Button></Link>
            </div>
          </Card>

          {isGestor && <Card>
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-700">Evolução do aluno</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Acompanhamento do PDI</h2>
                <p className="mt-2 text-sm text-slate-600">Selecione uma escola e um aluno para consultar o histórico de desenvolvimento, gráficos de evolução e tendência ao longo dos trimestres.</p>
              </div>
              <Link to="/pdi/acompanhamento"><Button variant="outline">Ver acompanhamento</Button></Link>
            </div>
          </Card>}
        </div>

        {isGestor && aplicacoesDaEscola.length > 0 && <Card>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-xl font-bold text-slate-950">Aplicações PDI desta escola</h2><p className="mt-1 text-sm text-slate-600">Pode haver mais de uma aplicação ao mesmo tempo, inclusive com vigências sobrepostas.</p></div>
            <Link to="/pdi/formulario"><Button size="sm" variant="outline">Gerenciar formulário</Button></Link>
          </div>
          <div className="space-y-3">
            {aplicacoesDaEscola.map(aplicacao => {
              const status = getFormStatus(aplicacao.dataInicio, aplicacao.dataFim);
              return (
                <Link key={aplicacao.id} to="/pdi/formulario" className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{escolaName(escolas, aplicacao.escolaId)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {aplicacao.modelos.map(modelo => <Badge key={modelo.modeloId} variant="blue">{disciplinas.find(item => item.id === modelo.disciplinaId)?.nome || modelo.nome}</Badge>)}
                      </div>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(status)}`}>{formStatusLabel(status)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Início: {formatFullDate(aplicacao.dataInicio)}</span><span>Encerramento: {formatFullDate(aplicacao.dataFim)}</span></div>
                </Link>
              );
            })}
          </div>
        </Card>}
      </div>
    </MainLayout>
  );
};
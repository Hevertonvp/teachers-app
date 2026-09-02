import { Link } from 'react-router-dom';
import { Badge, Button, Card, ProgressRing, StatCard, StatusBadge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { disciplinaName, turmaName } from '../utils/display';
import { pdiSummary } from '../utils/pdi';
import { deadlineText, formDefinitions, formStatusLabel, isFormAvailableForTeacher, teacherFillingStatus } from '../utils/formAvailability';
import { MainLayout } from '../layouts/Layouts';

const today = new Date('2026-08-31T12:00:00');

const daysUntil = (date) => Math.ceil((new Date(`${date}T12:00:00`) - today) / (1000 * 60 * 60 * 24));

const percentageComplete = (items) => {
  if (!items.length) return 0;
  return Math.round((items.filter(item => item.status === 'concluido' || item.status === 'concluído').length / items.length) * 100);
};

const notificationMeta = (item) => {
  const days = daysUntil(item.prazo);
  if (item.status === 'em_atraso' || days < 0) {
    return { label: `${Math.abs(days)} dias em atraso`, tone: 'red', status: 'em_atraso' };
  }
  return { label: `vence em ${days} dias`, tone: 'amber', status: item.status };
};

const noticiasProfessor = [
  {
    id: 1,
    titulo: 'Rede inicia ciclo de acompanhamento pedagógico individual',
    resumo: 'Gestores e professores terão novos indicadores para acompanhar avanços dos estudantes ao longo do ano letivo.',
    rota: '/pdi',
    editoria: 'PDI',
  },
  {
    id: 2,
    titulo: 'Formulário 1/3 entra em período de preenchimento',
    resumo: 'O registro de conteúdos já está disponível para professores com prazo definido pela gestão pedagógica.',
    rota: '/formulario-um-terco',
    editoria: 'Planejamento',
  },
];

export const DashboardProfessor = () => {
  const { user } = useAuth();
  const { formularios, pdis, correcoes, turmas, disciplinas, proximosEventos, pdiAlunos, pdiMetas, pdiAcompanhamentos, pdiRespostas, formPeriods } = useData();

  const meusFormularios = formularios.filter(item => item.professorId === user?.id);
  const meusPdis = pdis.filter(item => item.professorId === user?.id);
  const minhasCorrecoes = correcoes.filter(item => item.professorId === user?.id);
  const minhasTurmas = turmas.filter(turma => turma.professores.includes(user?.id));
  const meusAlunosPdi = pdiAlunos.filter(aluno => aluno.professorId === user?.id);
  const resumoPdiProfessor = pdiSummary(meusAlunosPdi, pdiMetas, pdiRespostas.filter(resposta => Number.isFinite(Number(resposta.resposta))));
  const recordsByForm = {
    formulario_um_terco: meusFormularios,
    pdi: meusPdis,
    correcoes_simulados: minhasCorrecoes,
  };
  const activeFormIds = new Set(formPeriods.filter(period => isFormAvailableForTeacher(period)).map(period => period.id));

  const notificacoes = [
    ...(activeFormIds.has('formulario_um_terco') ? meusFormularios.map(item => ({ ...item, tipo: 'Formulário 1/3', titulo: item.conteudo, prazo: item.prazo, rota: '/formulario-um-terco' })) : []),
    ...(activeFormIds.has('pdi') ? meusPdis.map(item => ({ ...item, tipo: 'PDI', titulo: `${item.aluno} - ${item.indicador}`, prazo: item.prazo, rota: '/pdi/alunos' })) : []),
    ...(activeFormIds.has('correcoes_simulados') ? minhasCorrecoes.map(item => ({ ...item, tipo: 'Correção de simulado', titulo: item.simulado, prazo: item.prazoCorrecao, rota: '/correcoes-simulados' })) : []),
  ]
    .filter(item => item.status === 'em_atraso' || (item.status !== 'concluido' && daysUntil(item.prazo) <= 7))
    .sort((a, b) => daysUntil(a.prazo) - daysUntil(b.prazo));

  const eventosDashboard = proximosEventos.slice(0, 3);
  const formulariosVigentes = formPeriods
    .filter(period => isFormAvailableForTeacher(period))
    .map(period => ({
      ...period,
      form: formDefinitions[period.id],
      fillingStatus: teacherFillingStatus(recordsByForm[period.id] || [], user?.id),
      progress: percentageComplete(recordsByForm[period.id] || []),
    }));
  const prazoMaisProximo = [...formulariosVigentes].sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Minha rotina pedagógica</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Bem-vindo, {user?.nome}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Acompanhe suas entregas, pendências, turmas e próximos eventos da rede.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Minhas turmas" value={minhasTurmas.length} description="turmas vinculadas" />
              <StatCard label="Pendências" value={notificacoes.length} description="atenção necessária" />
              <StatCard label="Registros" value={meusFormularios.length + meusPdis.length + minhasCorrecoes.length} description="instrumentos ativos" />
            </div>
          </div>
        </section>

        <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-2">
          <Link to="/eventos" className="relative block border-b border-slate-200 bg-stone-800 p-3 text-white transition hover:bg-slate-900 lg:border-b-0 lg:border-r lg:border-slate-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.22),transparent_38%)]" />
            <div className="relative flex min-h-24 flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-serif text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200">Próximos eventos</p>
                <span className="rounded-full bg-teal-300 px-2.5 py-0.5 text-[11px] font-bold text-slate-950">{eventosDashboard[0]?.data}</span>
              </div>
              <div>
                <h2 className="font-serif text-base font-bold leading-tight">{eventosDashboard[0]?.titulo}</h2>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-300">{eventosDashboard[0]?.descricao}</p>
              </div>
            </div>
          </Link>

          <Link to={noticiasProfessor[0].rota} className="block bg-cyan-50 p-3 text-slate-950 transition hover:bg-cyan-100/70">
            <div className="flex min-h-24 flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-serif text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800">Notícias</p>
                <span className="text-[11px] font-bold uppercase tracking-wide text-cyan-800">{noticiasProfessor[0].editoria}</span>
              </div>
              <div>
                <h2 className="font-serif text-base font-bold leading-tight">{noticiasProfessor[0].titulo}</h2>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-700">{noticiasProfessor[0].resumo}</p>
              </div>
            </div>
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card><ProgressRing value={percentageComplete(meusFormularios)} label="Formulário 1/3" /></Card>
          <Card><ProgressRing value={percentageComplete(meusPdis)} label="PDI" /></Card>
          <Card><ProgressRing value={percentageComplete(minhasCorrecoes)} label="Correções" /></Card>
        </section>

        <section>
          <Card>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Meus formulários</h2>
                <p className="mt-1 text-sm text-slate-600">Mostrando somente formulários atualmente vigentes para preenchimento.</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                {formulariosVigentes.length} {formulariosVigentes.length === 1 ? 'formulário vigente' : 'formulários vigentes'}
              </div>
            </div>

            {prazoMaisProximo && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <strong>Prazo mais próximo:</strong> {prazoMaisProximo.form.title} · {deadlineText(prazoMaisProximo.endDate)}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {formulariosVigentes.map(item => (
                <Card key={item.id} className="border-emerald-200 bg-emerald-50/60">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{item.form.title}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{item.form.subtitle}</h3>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{formStatusLabel('active')}</span>
                    <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700">{item.fillingStatus}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">{deadlineText(item.endDate)}</p>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600"><span>Preenchimento</span><span>{item.progress}%</span></div>
                    <div className="h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-teal-700" style={{ width: `${item.progress}%` }} /></div>
                  </div>
                  <Link to={item.form.route}><Button className="mt-4 w-full" variant="primary">{item.fillingStatus === 'Não iniciado' ? 'Preencher' : 'Continuar preenchimento'}</Button></Link>
                </Card>
              ))}
            </div>
            {formulariosVigentes.length === 0 && (
              <Card className="border-dashed bg-slate-50 text-center">
                <p className="font-semibold text-slate-800">Nenhum formulário disponível no momento</p>
                <p className="mt-1 text-sm text-slate-500">Os formulários aparecerão aqui quando estiverem dentro do período de preenchimento definido pela gestão.</p>
              </Card>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Atividades pendentes</h2>
                  <p className="mt-1 text-sm text-slate-600">Notificações de atividades em atraso ou vencendo nos próximos dias.</p>
                </div>
                <Link to="/pendencias"><Button variant="outline">Ver pendências</Button></Link>
              </div>

              <div className="space-y-3">
                {notificacoes.slice(0, 5).map(item => {
                  const meta = notificationMeta(item);
                  return (
                    <Link key={`${item.tipo}-${item.id}`} to={item.rota} className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">{item.titulo}</h3>
                            <StatusBadge status={meta.status} />
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.tipo} • {turmaName(turmas, item.turmaId)}</p>
                          {item.disciplinaId && <p className="mt-1 text-xs text-slate-500">{disciplinaName(disciplinas, item.disciplinaId)}</p>}
                        </div>
                        <div className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${meta.tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{meta.label}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Próximos eventos</h2>
                  <p className="mt-1 text-sm text-slate-600">Agenda pedagógica compartilhada pela gestão.</p>
                </div>
                <Link to="/eventos"><Button variant="outline">Ver agenda</Button></Link>
              </div>
              <div className="space-y-3">
                {eventosDashboard.map(evento => (
                  <div key={evento.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">{evento.titulo}</h3>
                          <Badge variant="blue">{evento.tipo}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>
                      </div>
                      <p className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{evento.data}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-slate-950">Atalhos</h2>
              <div className="mt-4 grid gap-3">
                <Link to="/formulario-um-terco"><Button className="w-full" variant="primary">Acessar Formulário 1/3</Button></Link>
                <Link to="/pdi"><Button className="w-full" variant="outline">Acessar PDI</Button></Link>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-950">Acompanhamento PDI</h2>
                <Link to="/pdi/alunos"><Button size="sm" variant="outline">Ver alunos</Button></Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Alunos</p><p className="text-2xl font-bold text-slate-900">{resumoPdiProfessor.totalAlunos}</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">Evolução</p><p className="text-2xl font-bold text-emerald-800">{resumoPdiProfessor.alunosEvolucao}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Estáveis</p><p className="text-2xl font-bold text-slate-900">{resumoPdiProfessor.alunosEstaveis}</p></div>
                <div className="rounded-lg bg-red-50 p-3"><p className="text-red-700">Atenção</p><p className="text-2xl font-bold text-red-800">{resumoPdiProfessor.alunosAtencao}</p></div>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-slate-950">Minhas turmas</h2>
              <div className="mt-4 space-y-3">
                {minhasTurmas.map(turma => (
                  <div key={turma.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{turma.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">{turma.ciclo}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{turma.quantidadeAlunos} alunos</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};
import { Badge, Card, ProgressRing, StatCard } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { gestoresDaEscola, resumoEscola } from '../utils/escolas';
import { canViewIndicadoresDiretora } from '../utils/roles';

export const DashboardDiretora = () => {
  const { user } = useAuth();
  const { escolas, gestores, turmas, formularios, pdis, correcoes, vinculosEscolares } = useData();
  const { userEscolas, activeEscolaId } = useEscola();

  if (!canViewIndicadoresDiretora(user)) return null;

  const contexto = { turmas, formularios, pdis, correcoes, vinculosEscolares };
  const escolasVinculadas = escolas.filter(escola => userEscolas.some(item => item.id === escola.id));
  const escolasVisualizadas = activeEscolaId === null ? escolasVinculadas : escolasVinculadas.filter(escola => escola.id === activeEscolaId);
  const resumos = escolasVisualizadas.map(escola => resumoEscola(escola, contexto));
  const supervisoresMap = new Map();
  escolasVisualizadas.forEach(escola => gestoresDaEscola(gestores, vinculosEscolares, escola.id, user).forEach(supervisor => {
    const current = supervisoresMap.get(supervisor.id) || { ...supervisor, escolas: [] };
    current.escolas.push(escola.nome);
    supervisoresMap.set(supervisor.id, current);
  }));
  const supervisores = [...supervisoresMap.values()];
  const vinculosDasEscolas = vinculosEscolares.filter(vinculo => escolasVisualizadas.some(escola => escola.id === vinculo.escolaId) && vinculo.status === 'ativo');
  const totalProfissionais = new Set(vinculosDasEscolas.map(vinculo => `${vinculo.usuarioTipo}:${vinculo.usuarioId}`)).size;
  const escolasAtivas = escolasVisualizadas.filter(escola => escola.status === 'ativa').length;
  const escolasInativas = escolasVisualizadas.length - escolasAtivas;
  const totalAlunos = resumos.reduce((total, item) => total + item.totalAlunos, 0);
  const totalTurmas = resumos.reduce((total, item) => total + item.totalTurmas, 0);
  const indicadores = [
    { label: 'Formulário 1/3', value: resumos.length ? Math.round(resumos.reduce((total, item) => total + item.formulario, 0) / resumos.length) : 0 },
    { label: 'PDI', value: resumos.length ? Math.round(resumos.reduce((total, item) => total + item.pdi, 0) / resumos.length) : 0 },
    { label: 'Correções', value: resumos.length ? Math.round(resumos.reduce((total, item) => total + item.correcoes, 0) / resumos.length) : 0 },
  ];

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Visão das escolas vinculadas</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Dashboard da Diretora</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{activeEscolaId === null ? 'Indicadores agregados das escolas sob sua responsabilidade.' : 'Indicadores agregados da escola selecionada.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Escolas" value={escolasVinculadas.length} description="vinculadas" />
              <StatCard label="Ativas" value={escolasAtivas} description="escolas" />
              <StatCard label="Inativas" value={escolasInativas} description="escolas" />
              <StatCard label="Profissionais" value={totalProfissionais} description="nas escolas" />
              <StatCard label="Turmas" value={totalTurmas} description="nas escolas" />
              <StatCard label="Alunos" value={totalAlunos} description="matriculados" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {indicadores.map(indicador => <Card key={indicador.label}><ProgressRing value={indicador.value} label={indicador.label} /></Card>)}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">Escolas vinculadas</h2>
              <p className="mt-1 text-sm text-slate-600">Acompanhamento agregado dos instrumentos pedagógicos.</p>
            </div>
            <div className="space-y-3">
              {resumos.map(resumo => (
                <div key={resumo.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{resumo.escola.nome}</h3>
                      <p className="mt-1 text-sm text-slate-500">{resumo.totalTurmas} turmas · {resumo.totalAlunos} alunos</p>
                    </div>
                    <Badge variant={resumo.escola.status === 'ativa' ? 'green' : 'gray'}>{resumo.escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Formulário</p><p className="font-bold text-slate-900">{resumo.formulario}%</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">PDI</p><p className="font-bold text-slate-900">{resumo.pdi}%</p></div>
                    <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Correções</p><p className="font-bold text-slate-900">{resumo.correcoes}%</p></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-slate-950">Supervisoras</h2>
            <p className="mt-1 text-sm text-slate-600">Profissionais responsáveis pelas escolas vinculadas.</p>
            <div className="mt-5 space-y-3">
              {supervisores.length ? supervisores.map(supervisor => (
                <div key={supervisor.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{supervisor.nome}</p>
                  <p className="mt-1 text-sm text-slate-500">{supervisor.cargo} · {supervisor.escolas.length} escola(s)</p>
                  <p className="mt-1 text-xs text-slate-400">{supervisor.escolas.join(' · ')}</p>
                </div>
              )) : <p className="text-sm text-slate-500">Nenhuma supervisora vinculada.</p>}
            </div>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

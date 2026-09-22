import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Card, Modal, PersonName, StatCard } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { diretoresDaEscola, gestoresDaEscola, professoresDaEscola, professoresPorPreenchimento, resumoEscola } from '../utils/escolas';
import { formatFullDate, formCompletionStats, formDefinitions, getFormStatus } from '../utils/formAvailability';
import { canAcompanharProfessores, isDiretora, isGestor, isSecretaria } from '../utils/roles';

const InfoCard = ({ label, description, children }) => (
  <Card>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <div className="mt-2 space-y-1.5">{children}</div>
    {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
  </Card>
);

export const AcompanhamentoEscolar = () => {
  const { user } = useAuth();
  const { escolas, professores, gestores, diretores, turmas, formularios, pdis, correcoes, formPeriods, vinculosEscolares } = useData();
  const { activeEscolaId } = useEscola();
  const [selectedAtividade, setSelectedAtividade] = useState(null);
  const canViewAggregate = isSecretaria(user) || isDiretora(user) || isGestor(user);
  const canViewIndividual = canAcompanharProfessores(user);

  if (!canViewAggregate) return <Navigate to="/dashboard" replace />;

  if (activeEscolaId === null) {
    return (
      <MainLayout>
        <Card className="border-dashed bg-slate-50 text-center">
          <p className="font-semibold text-slate-800">Selecione uma escola</p>
          <p className="mt-1 text-sm text-slate-500">Escolha uma escola específica no seletor do topo da página para ver o acompanhamento dela.</p>
        </Card>
      </MainLayout>
    );
  }

  const escola = escolas.find(item => item.id === activeEscolaId);
  const resumo = resumoEscola(escola, { turmas, formularios, pdis, correcoes, vinculosEscolares });

  const professoresEscola = canViewIndividual ? professoresDaEscola(professores, vinculosEscolares, escola.id, user) : [];
  const totalProfessoresEscola = canViewIndividual
    ? professoresEscola.length
    : vinculosEscolares.filter(vinculo => vinculo.usuarioTipo === 'professor' && vinculo.escolaId === escola.id && vinculo.status === 'ativo').length;
  const diretoresEscola = diretoresDaEscola(diretores, vinculosEscolares, escola.id, user);
  const supervisoresEscola = gestoresDaEscola(gestores, vinculosEscolares, escola.id, user);

  const recordsByForm = {
    formulario_um_terco: formularios.filter(item => item.escolaId === escola.id),
    pdi: pdis.filter(item => item.escolaId === escola.id),
    correcoes_simulados: correcoes.filter(item => item.escolaId === escola.id),
  };

  const atividadesVigentes = formPeriods
    .filter(period => period.escolaId === escola.id && getFormStatus(period.startDate, period.endDate) === 'active')
    .map(period => ({
      ...period,
      form: formDefinitions[period.id],
      stats: formCompletionStats(recordsByForm[period.id] || [], totalProfessoresEscola),
    }));

  const graficos = [
    { label: 'Formulário 1/3', value: resumo.formulario },
    { label: 'PDI', value: resumo.pdi },
    { label: 'Correções', value: resumo.correcoes },
  ];

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Acompanhamento Escolar</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-950">{escola.nome}</h1>
            <Badge variant={escola.status === 'ativa' ? 'green' : 'gray'}>{escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Alunos" value={resumo.totalAlunos} description="matriculados" />
            <StatCard label="Professores(as)" value={totalProfessoresEscola} description="vinculados" />
            <InfoCard label="Diretor(a)" description="responsável pela escola">
              {diretoresEscola.length
                ? diretoresEscola.map(diretor => <PersonName key={diretor.id} nome={diretor.nome} cargo={diretor.cargo} />)
                : <p className="text-base font-bold text-slate-900">—</p>}
            </InfoCard>
            <InfoCard label="Supervisor(a)" description="responsável pela escola">
              {supervisoresEscola.length
                ? supervisoresEscola.map(gestor => <PersonName key={gestor.id} nome={gestor.nome} cargo={gestor.cargo} />)
                : <p className="text-base font-bold text-slate-900">—</p>}
            </InfoCard>
          </div>
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">Entrega de atividades por instrumento</h2>
              <p className="mt-1 text-sm text-slate-600">Percentual de conclusão de cada instrumento pedagógico nesta escola.</p>
            </div>
            <div className="mx-auto max-w-md overflow-hidden">
              <svg viewBox="0 0 300 100" className="block h-auto w-full" role="img" aria-label="Gráfico de entrega de atividades por instrumento">
                {graficos.map((item, index) => {
                  const y = 14 + index * 30;
                  const barWidth = (item.value / 100) * 210;
                  return (
                    <g key={item.label}>
                      <text x="0" y={y - 3} fill="#334155" fontSize="8" fontWeight="700">{item.label}</text>
                      <rect x="0" y={y} width="210" height="10" rx="5" fill="#e2e8f0" />
                      <rect x="0" y={y} width={barWidth} height="10" rx="5" fill="#0f766e" />
                      <text x="216" y={y + 8.5} fill="#0f172a" fontSize="8.5" fontWeight="800">{item.value}%</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">Atividades vigentes</h2>
              <p className="mt-1 text-sm text-slate-600">Instrumentos pedagógicos dentro do período de preenchimento nesta escola.</p>
            </div>
            {atividadesVigentes.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {atividadesVigentes.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={canViewIndividual ? () => setSelectedAtividade(item) : undefined}
                    disabled={!canViewIndividual}
                    className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/30"
                  >
                    <p className="font-semibold text-slate-900">{item.form.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.form.subtitle}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-500">{formatFullDate(item.startDate)} a {formatFullDate(item.endDate)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Preencheram</p><p className="font-bold text-slate-900">{item.stats.filled}</p></div>
                      <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Pendentes</p><p className="font-bold text-slate-900">{item.stats.pending}</p></div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma atividade vigente no momento para esta escola.</p>
            )}
          </Card>
        </section>
      </div>

      {selectedAtividade && canViewIndividual && (() => {
        const { preencheram, pendentes } = professoresPorPreenchimento(professoresEscola, recordsByForm[selectedAtividade.id] || []);
        return (
          <Modal title={selectedAtividade.form.title} onClose={() => setSelectedAtividade(null)}>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-emerald-700">Preencheram ({preencheram.length})</p>
                <div className="space-y-2">
                  {preencheram.length ? preencheram.map(professor => (
                    <div key={professor.id} className="rounded-lg bg-emerald-50 p-2.5"><ProfessorName professor={professor} /></div>
                  )) : <p className="text-sm text-slate-500">Ninguém preencheu ainda.</p>}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold text-red-700">Pendentes ({pendentes.length})</p>
                <div className="space-y-2">
                  {pendentes.length ? pendentes.map(professor => (
                    <div key={professor.id} className="rounded-lg bg-red-50 p-2.5"><ProfessorName professor={professor} /></div>
                  )) : <p className="text-sm text-slate-500">Todos preencheram.</p>}
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </MainLayout>
  );
};

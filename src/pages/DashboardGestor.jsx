import { Link } from 'react-router-dom';
import { useState } from 'react';
import { MainLayout } from '../layouts/Layouts';
import { Badge, Button, Card, FormField, Modal, NotificationCard, ProgressRing, StatCard, StatusBadge } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useData } from '../context/DataContext';
import { inputClass, professorName } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { deadlineText, formCompletionStats, formDefinitions, formStatusClasses, formStatusLabel, formatShortDate, getFormStatus } from '../utils/formAvailability';

const pdiDevelopmentSeries = [58, 66, 74, 81];

export const DashboardGestor = () => {
  const { professores, formularios, pdis, correcoes, pendencias, indicadores, atividadesRecentes, proximosEventos, pdiAlunos, resumoPdi, formPeriods, updateFormPeriod } = useData();
  const [editingPeriod, setEditingPeriod] = useState(null);
  const pendenciasImportantes = pendencias.slice(0, 3);
  const eventosDashboard = proximosEventos.slice(0, 4);
  const formRecords = {
    formulario_um_terco: formularios,
    pdi: pdis,
    correcoes_simulados: correcoes,
  };
  const formPeriodCards = formPeriods.map(period => {
    const form = formDefinitions[period.id];
    const status = getFormStatus(period.startDate, period.endDate);
    const stats = formCompletionStats(formRecords[period.id] || [], professores.length);
    return { ...period, form, status, stats };
  });

  const savePeriod = (event) => {
    event.preventDefault();
    updateFormPeriod(editingPeriod.id, {
      startDate: editingPeriod.startDate,
      endDate: editingPeriod.endDate,
    });
    setEditingPeriod(null);
  };

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Visão geral da escola</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Dashboard Administrativo</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Acompanhamento dos instrumentos pedagógicos prioritários, pendências e movimentações recentes da rede.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Professores" value={indicadores.totalProfessores} description="corpo docente ativo" />
              <StatCard label="Com pendências" value={indicadores.professoresComPendencias} description="professores em atraso" />
              <StatCard label="Registros" value={formularios.length + pdis.length + correcoes.length} description="instrumentos monitorados" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card><ProgressRing value={indicadores.formulario} label="Formulário 1/3" /></Card>
          <Card><ProgressRing value={indicadores.pdi} label="PDI" /></Card>
          <Card><ProgressRing value={indicadores.correcoes} label="Correções" /></Card>
        </section>

        <section>
          <Card>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Formulários e Prazos</h2>
                <p className="mt-1 text-sm text-slate-600">Visão administrativa dos períodos de preenchimento e situação atual dos três instrumentos.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {formPeriodCards.map(card => (
                <div key={card.id} className={`rounded-xl border p-4 ${formStatusClasses(card.status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide opacity-80">{card.form.title}</p>
                      <h3 className="mt-1 text-lg font-bold">{card.form.subtitle}</h3>
                    </div>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{formStatusLabel(card.status)}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold">{formatShortDate(card.startDate)} → {formatShortDate(card.endDate)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white/65 p-3"><p className="opacity-70">Preencheram</p><p className="text-xl font-bold">{card.stats.filled}</p></div>
                    <div className="rounded-lg bg-white/65 p-3"><p className="opacity-70">Pendentes</p><p className="text-xl font-bold">{card.stats.pending}</p></div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs font-semibold"><span>{card.stats.percent}% preenchido</span><span>{deadlineText(card.endDate)}</span></div>
                    <div className="h-2 rounded-full bg-white/60"><div className="h-2 rounded-full bg-current" style={{ width: `${card.stats.percent}%` }} /></div>
                  </div>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => setEditingPeriod(card)}>Gerenciar prazo</Button>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-red-200">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Pendências importantes</h2>
                  <p className="mt-1 text-sm text-slate-600">{indicadores.professoresComPendencias} professores possuem atividades em atraso.</p>
                </div>
                <Link to="/pendencias"><Button variant="danger">Ver todas as pendências</Button></Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {pendenciasImportantes.map(pendencia => (
                  <NotificationCard key={pendencia.id} pendencia={pendencia} professor={professores.find(professor => professor.id === pendencia.professorId)} />
                ))}
              </div>
            </Card>

            <Card className="mt-6">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Próximos eventos</h2>
                  <p className="mt-1 text-sm text-slate-600">Agenda pedagógica da rede para os próximos dias.</p>
                </div>
                <Link to="/eventos"><Button variant="outline">Gerenciar eventos</Button></Link>
              </div>

              <div className="space-y-3">
                {eventosDashboard.map(evento => (
                  <div key={evento.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">{evento.titulo}</h3>
                          <Badge variant="blue">{evento.tipo}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>
                      </div>
                      <div className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{evento.data}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-xl font-bold text-slate-950">Atividades recentes</h2>
            <div className="mt-4 space-y-4">
              {atividadesRecentes.map(atividade => (
                <div key={atividade.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" />
                  <div>
                    <p className="text-sm text-slate-700"><ProfessorName professorId={atividade.professorId} /> <span>{atividade.texto}</span></p>
                    <p className="mt-1 text-xs text-slate-500">{atividade.tempo}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950">Resumo operacional</h2>
              <Link to="/correcoes-simulados"><Button variant="outline" size="sm">Acompanhar correções</Button></Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[{ label: 'Formulário 1/3', items: formularios }, { label: 'PDI', items: pdis }, { label: 'Correções', items: correcoes }].map(group => (
                <div key={group.label} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-800">{group.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['concluido', 'em_andamento', 'pendente', 'em_atraso'].map(status => (
                      <div key={status} className="flex items-center gap-2 text-sm text-slate-600">
                        <StatusBadge status={status} />
                        <span>{group.items.filter(item => item.status === status || (status === 'concluido' && item.status === 'concluído')).length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <Card>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Acompanhamento PDI</h2>
                <p className="mt-1 text-sm text-slate-600">Síntese calculada a partir dos alunos, metas e acompanhamentos do módulo PDI.</p>
              </div>
              <Link to="/pdi/alunos"><Button variant="outline">Ver alunos</Button></Link>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <StatCard label="Alunos" value={resumoPdi.totalAlunos} description="em acompanhamento" />
              <StatCard label="Em evolução" value={resumoPdi.alunosEvolucao} description="tendência positiva" />
              <StatCard label="Estáveis" value={resumoPdi.alunosEstaveis} description="sem variação recente" />
              <StatCard label="Atenção" value={resumoPdi.alunosAtencao} description="queda recente" />
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4"><p className="font-semibold text-slate-900">Desenvolvimento geral dos alunos</p><p className="mt-1 text-sm text-slate-600">Evolução média simulada para acompanhamento visual ao longo dos trimestres.</p></div>
              <div className="overflow-hidden"><svg viewBox="0 0 800 260" className="block h-auto w-full" role="img" aria-label="Gráfico geral de desenvolvimento dos alunos por trimestre"><defs><linearGradient id="pdi-general-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity="0.2" /><stop offset="100%" stopColor="#0f766e" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3, 4].map(index => { const y = 40 + index * 40; return <line key={y} x1="70" x2="750" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />; })}<path d="M 90 176 L 300 144 L 510 112 L 720 84 L 720 216 L 90 216 Z" fill="url(#pdi-general-area)" /><path d="M 90 176 L 300 144 L 510 112 L 720 84" fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{pdiDevelopmentSeries.map((value, index) => { const x = 90 + index * 210; const y = 216 - ((value - 40) / 50) * 160; return <g key={value}><circle cx={x} cy={y} r="7" fill="#0f766e" stroke="#ffffff" strokeWidth="3" /><text x={x} y={y - 14} textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="800">{value}%</text><text x={x} y="244" textAnchor="middle" fill="#64748b" fontSize="13" fontWeight="700">{index + 1}º tri.</text></g>; })}</svg></div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {resumoPdi.acompanhamentosRecentes.map(acompanhamento => {
                const aluno = pdiAlunos.find(item => item.id === acompanhamento.alunoId);
                return (
                  <Link key={acompanhamento.id} to={`/pdi/alunos/${acompanhamento.alunoId}`} className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
                    <p className="font-semibold text-slate-900">{aluno?.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">{acompanhamento.area} · {acompanhamento.indicador} · Nível {acompanhamento.nivelObservado}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(acompanhamento.data)}</p>
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
      </div>

      {editingPeriod && (
        <Modal title={`Gerenciar prazo - ${editingPeriod.form.title}`} onClose={() => setEditingPeriod(null)}>
          <form onSubmit={savePeriod} className="space-y-4">
            <p className="text-sm text-slate-600">Configure o período em que o formulário ficará disponível para preenchimento dos professores.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Data de início"><input className={inputClass} type="date" value={editingPeriod.startDate} onChange={event => setEditingPeriod(prev => ({ ...prev, startDate: event.target.value }))} required /></FormField>
              <FormField label="Data de encerramento"><input className={inputClass} type="date" value={editingPeriod.endDate} onChange={event => setEditingPeriod(prev => ({ ...prev, endDate: event.target.value }))} required /></FormField>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              Situação atual: <strong>{formStatusLabel(getFormStatus(editingPeriod.startDate, editingPeriod.endDate))}</strong>
            </div>
            <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditingPeriod(null)}>Cancelar</Button><Button type="submit">Salvar prazo</Button></div>
          </form>
        </Modal>
      )}
    </MainLayout>
  );
};
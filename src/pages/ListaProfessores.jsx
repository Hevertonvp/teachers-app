import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, DataTable, FormField, Modal, NotificationCard, ProgressRing, StatCard, StatusBadge } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { MainLayout } from '../layouts/Layouts';

export const ListaProfessores = () => {
  const { user } = useAuth();
  const { professores, formularios, pdis, correcoes, pendencias, atividadesRecentes } = useData();
  const [professorId, setProfessorId] = useState('todos');
  const [activityType, setActivityType] = useState('todos');
  const [period, setPeriod] = useState('todos');
  const [selected, setSelected] = useState(null);

  if (user?.tipo !== 'gestor') return <Navigate to="/dashboard" replace />;

  const tasks = useMemo(() => [
    ...formularios.map(item => ({ ...item, type: 'Formulário 1/3', title: item.conteudo || 'Formulário 1/3', dueDate: item.prazo })),
    ...pdis.map(item => ({ ...item, type: 'PDI', title: `${item.aluno} - ${item.indicador}`, dueDate: item.prazo })),
    ...correcoes.map(item => ({ ...item, type: 'Correções dos simulados', title: item.simulado, dueDate: item.prazoCorrecao })),
  ], [formularios, pdis, correcoes]);
  const isDelivered = (task) => ['concluido', 'concluído', 'enviado'].includes(task.status);
  const filteredTasks = tasks.filter(task => (professorId === 'todos' || String(task.professorId) === professorId) && (activityType === 'todos' || task.type === activityType) && (period === 'todos' || (period === 'atrasadas' ? task.status === 'em_atraso' : task.status === period)));
  const rows = professores.map(professor => {
    const ownTasks = filteredTasks.filter(task => task.professorId === professor.id);
    const delivered = ownTasks.filter(isDelivered).length;
    const late = ownTasks.filter(task => task.status === 'em_atraso').length;
    const pending = ownTasks.length - delivered - late;
    const completion = ownTasks.length ? Math.round((delivered / ownTasks.length) * 100) : 0;
    const latest = [...ownTasks].sort((left, right) => String(right.atualizadoEm || '').localeCompare(String(left.atualizadoEm || '')))[0];
    return { ...professor, delivered, pending, late, completion, latest: latest?.title || 'Sem atividades' };
  }).filter(row => professorId === 'todos' || String(row.id) === professorId);
  const totals = rows.reduce((total, row) => ({ delivered: total.delivered + row.delivered, pending: total.pending + row.pending, late: total.late + row.late }), { delivered: 0, pending: 0, late: 0 });
  const totalTasks = totals.delivered + totals.pending + totals.late;
  const completion = totalTasks ? Math.round((totals.delivered / totalTasks) * 100) : 0;
  const lateTeachers = pendencias.filter(item => professorId === 'todos' || String(item.professorId) === professorId);
  const columns = [
    { key: 'professor', header: 'Professor', render: row => <ProfessorName professor={row} /> },
    { key: 'delivered', header: 'Entregues' },
    { key: 'pending', header: 'Pendentes' },
    { key: 'late', header: 'Em atraso', render: row => <span className={row.late ? 'font-bold text-red-700' : ''}>{row.late}</span> },
    { key: 'completion', header: 'Cumprimento', render: row => `${row.completion}%` },
    { key: 'latest', header: 'Última atividade' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Gestão de Professores</h1>
          <p className="mt-2 text-slate-600">Acompanhe entregas, pendências e atrasos das atividades pedagógicas.</p>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Tarefas entregues" value={totals.delivered} description="registros concluídos" /><StatCard label="Tarefas pendentes" value={totals.pending} description="aguardando entrega" /><StatCard label="Tarefas em atraso" value={totals.late} description="requerem atenção" /><Card><ProgressRing value={completion} label="Cumprimento geral" /></Card></section>
        <Card><div className="grid gap-3 md:grid-cols-3"><FormField label="Professor"><select className={inputClass} value={professorId} onChange={event => setProfessorId(event.target.value)}><option value="todos">Todos os professores</option>{professores.map(professor => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}</select></FormField><FormField label="Tipo de atividade"><select className={inputClass} value={activityType} onChange={event => setActivityType(event.target.value)}><option value="todos">Todas as atividades</option><option value="Formulário 1/3">Formulário 1/3</option><option value="PDI">PDI</option><option value="Correções dos simulados">Correções dos simulados</option></select></FormField><FormField label="Período / situação"><select className={inputClass} value={period} onChange={event => setPeriod(event.target.value)}><option value="todos">Todos os períodos</option><option value="em_andamento">Em andamento</option><option value="pendente">Pendentes</option><option value="atrasadas">Em atraso</option></select></FormField></div></Card>
        <Card><div className="mb-4"><h2 className="text-xl font-bold text-slate-950">Professores com atraso</h2><p className="mt-1 text-sm text-slate-600">Atividades que ultrapassaram o prazo definido.</p></div><div className="grid gap-3 md:grid-cols-3">{lateTeachers.length ? lateTeachers.map(item => <NotificationCard key={item.id} pendencia={item} professor={professores.find(professor => professor.id === item.professorId)} />) : <p className="text-sm text-slate-500">Não há atrasos para os filtros selecionados.</p>}</div></Card>
        <DataTable columns={columns} rows={rows} onRowClick={setSelected} emptyMessage="Nenhum professor encontrado" />
        <Card><h2 className="text-xl font-bold text-slate-950">Atividades recentes</h2><div className="mt-4 space-y-3">{atividadesRecentes.map(activity => <div key={activity.id} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" /><div><p className="text-sm text-slate-700"><ProfessorName professorId={activity.professorId} /> {activity.texto}</p><p className="mt-1 text-xs text-slate-500">{activity.tempo}</p></div></div>)}</div></Card>
        {selected && <Modal title={`Tarefas de ${selected.nome}`} onClose={() => setSelected(null)}><div className="space-y-3">{tasks.filter(task => task.professorId === selected.id).map(task => <div key={`${task.type}-${task.id}`} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{task.title}</p><p className="mt-1 text-sm text-slate-600">{task.type} · Prazo: {task.dueDate}</p></div><StatusBadge status={task.status} /></div></div>)}<div className="flex justify-end"><Button onClick={() => setSelected(null)}>Fechar</Button></div></div></Modal>}
      </div>
    </MainLayout>
  );
};

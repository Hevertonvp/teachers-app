import { useMemo, useState } from 'react';
import { MainLayout } from '../layouts/Layouts';
import { Button, Card, DataTable, Modal, StatusBadge } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useData } from '../context/DataContext';
import { disciplinaName, filterByText, inputClass, professorName, turmaName } from '../utils/display';

export const Pendencias = () => {
  const { pendencias, professores, turmas, disciplinas } = useData();
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [turma, setTurma] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let result = filterByText(pendencias, search, [row => professorName(professores, row.professorId), row => row.atividade, row => row.descricao, row => disciplinaName(disciplinas, row.disciplinaId)]);
    if (tipo !== 'todos') result = result.filter(row => row.atividade === tipo);
    if (turma !== 'todos') result = result.filter(row => String(row.turmaId) === turma);
    if (periodo === 'ate3') result = result.filter(row => row.diasAtraso <= 3);
    if (periodo === 'mais3') result = result.filter(row => row.diasAtraso > 3);
    return result;
  }, [pendencias, professores, disciplinas, search, tipo, turma, periodo]);

  const columns = [
    { key: 'professor', header: 'Professor', render: row => <ProfessorName professorId={row.professorId} /> },
    { key: 'atividade', header: 'Atividade' },
    { key: 'disciplina', header: 'Matéria', render: row => disciplinaName(disciplinas, row.disciplinaId) },
    { key: 'turma', header: 'Turma', render: row => turmaName(turmas, row.turmaId) },
    { key: 'prazo', header: 'Prazo' },
    { key: 'diasAtraso', header: 'Dias em atraso', render: row => `${row.diasAtraso} dias` },
    { key: 'status', header: 'Status', render: row => <StatusBadge status={row.status} /> },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Pendências</h1>
            <p className="mt-2 text-slate-600">Professores com atividades atrasadas nos instrumentos pedagógicos do MVP.</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{filtered.length} registros em atraso</div>
        </div>

        <Card>
          <div className="grid gap-3 md:grid-cols-4">
            <input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por professor ou atividade" />
            <select className={inputClass} value={tipo} onChange={event => setTipo(event.target.value)}>
              <option value="todos">Todas as atividades</option>
              <option value="Formulário 1/3">Formulário 1/3</option>
              <option value="PDI">PDI</option>
              <option value="Correções dos simulados">Correções dos simulados</option>
            </select>
            <select className={inputClass} value={turma} onChange={event => setTurma(event.target.value)}>
              <option value="todos">Todas as turmas</option>
              {turmas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            <select className={inputClass} value={periodo} onChange={event => setPeriodo(event.target.value)}>
              <option value="todos">Todos os períodos</option>
              <option value="ate3">Até 3 dias</option>
              <option value="mais3">Mais de 3 dias</option>
            </select>
          </div>
        </Card>

        <DataTable columns={columns} rows={filtered} onRowClick={setSelected} emptyMessage="Nenhuma pendência encontrada" />

        {selected && (
          <Modal title="Detalhes da pendência" onClose={() => setSelected(null)}>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card><p className="text-sm text-slate-500">Professor</p><ProfessorName professorId={selected.professorId} /></Card>
                <Card><p className="text-sm text-slate-500">Turma</p><p className="font-semibold text-slate-900">{turmaName(turmas, selected.turmaId)}</p></Card>
                <Card><p className="text-sm text-slate-500">Matéria</p><p className="font-semibold text-slate-900">{disciplinaName(disciplinas, selected.disciplinaId)}</p></Card>
                <Card><p className="text-sm text-slate-500">Atividade</p><p className="font-semibold text-slate-900">{selected.atividade}</p></Card>
                <Card><p className="text-sm text-slate-500">Prazo</p><p className="font-semibold text-slate-900">{selected.prazo}</p></Card>
              </div>
              <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{selected.descricao} Esta pendência está há {selected.diasAtraso} dias em atraso.</p>
              <div className="flex justify-end"><Button onClick={() => setSelected(null)}>Fechar</Button></div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};
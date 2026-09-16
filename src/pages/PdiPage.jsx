import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal } from '../components/Common';
import { TrendBadge } from '../components/PdiControls';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { inputClass, professorName, turmaName } from '../utils/display';
import { filterByEscola, professoresDaEscola, turmasDoProfessor } from '../utils/escolas';
import { alunoStatusOptions, formatDate, latestAcompanhamento, pdiTrend } from '../utils/pdi';
import { isDiretora, isProfessor as isProfessorRole, isSecretaria, canManagePedagogico } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';
import { MainLayout } from '../layouts/Layouts';

const blankAluno = (professorId, turmaId, escolaId) => ({
  nome: '',
  dataNascimento: '',
  escolaId,
  turmaId,
  professorId,
  dataEntradaRede: '',
  dataInicio: '',
  condicaoInformada: '',
  cid: '',
  status: 'ativo',
});

export const PdiPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    pdiAlunos,
    pdiAcompanhamentos,
    professores,
    turmas,
    turmaProfessores,
    escolas,
    vinculosEscolares,
    createPdiAluno,
    updatePdiAluno,
    archivePdiAluno,
  } = useData();
  const { activeEscolaId, userEscolas, isExplicitBatchSelection } = useEscola();

  const isProfessor = isProfessorRole(user);
  const canManage = canManagePedagogico(user);
  const turmasDaEscola = filterByEscola(turmas, activeEscolaId, user);
  const availableTurmas = isProfessor ? turmasDoProfessor(turmasDaEscola, turmaProfessores, user.id) : turmasDaEscola;
  const professoresOptions = professoresDaEscola(professores, vinculosEscolares, activeEscolaId, user);
  const [search, setSearch] = useState('');
  const [turma, setTurma] = useState('todos');
  const [status, setStatus] = useState('ativo');
  const [tendencia, setTendencia] = useState('todos');
  const [form, setForm] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [message, setMessage] = useState('');

  const alunosDaEscola = filterByEscola(pdiAlunos, activeEscolaId, user);
  const scopedAlunos = isProfessor ? alunosDaEscola.filter(aluno => availableTurmas.some(turma => turma.id === aluno.turmaId)) : alunosDaEscola;

  const alunos = useMemo(() => scopedAlunos.filter(aluno => {
    const alunoTrend = pdiTrend(pdiAcompanhamentos.filter(item => item.alunoId === aluno.id)).key;
    const matchesSearch = aluno.nome.toLowerCase().includes(search.toLowerCase());
    const matchesTurma = turma === 'todos' || String(aluno.turmaId) === turma;
    const matchesStatus = status === 'todos' || aluno.status === status;
    const matchesTrend = isProfessor || tendencia === 'todos' || alunoTrend === tendencia;
    return matchesSearch && matchesTurma && matchesStatus && matchesTrend;
  }), [scopedAlunos, pdiAcompanhamentos, search, turma, status, tendencia]);

  if (!isSecretaria(user) && userEscolas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a Secretaria de Educação." />
      </MainLayout>
    );
  }

  if (activeEscolaId !== null && !isEscolaAplicavel(RECURSOS.PDI, activeEscolaId)) {
    return <MainLayout><EmptyState title="PDI não aplicável" description="Esta escola não utiliza o módulo PDI." /></MainLayout>;
  }

  const openCreate = () => {
    if (!canManage) return;
    if (activeEscolaId === null && !isExplicitBatchSelection) {
      setMessage('Selecione uma escola específica antes de criar um aluno PDI.');
      return;
    }
    setEditing(null);
    setForm(blankAluno(professoresOptions[0]?.id, availableTurmas[0]?.id, activeEscolaId));
  };

  const openEdit = (aluno) => {
    if (!canManage) return;
    setEditing(aluno);
    setForm({ ...aluno });
  };

  const saveAluno = (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (activeEscolaId === null && !isExplicitBatchSelection) {
      setMessage('Selecione uma escola específica antes de salvar o aluno PDI.');
      return;
    }
    const payload = { ...form, escolaId: activeEscolaId ?? form.escolaId };
    if (editing) {
      updatePdiAluno(editing.id, payload);
      setMessage('Aluno atualizado com sucesso.');
    } else {
      createPdiAluno(payload);
      setMessage('Aluno criado com sucesso.');
    }
    setForm(null);
    setEditing(null);
  };

  const paginatedAlunos = alunos.slice((page - 1) * 10, page * 10);
  const totalPages = Math.max(1, Math.ceil(alunos.length / 10));

  if (isSecretaria(user) || isDiretora(user)) return <Navigate to="/dashboard" replace />;

  const columns = [
    { key: 'nome', header: 'Aluno', render: row => <button className="font-semibold text-teal-700 hover:underline" onClick={event => { event.stopPropagation(); navigate(`/pdi/alunos/${row.id}`); }}>{row.nome}</button> },
    { key: 'turma', header: 'Turma', render: row => turmaName(turmas, row.turmaId) },
    { key: 'status', header: 'Status', render: row => row.status === 'arquivado' ? 'Arquivado' : 'Ativo' },
    ...(!isProfessor ? [
      { key: 'ultimo', header: 'Último acompanhamento', render: row => formatDate(latestAcompanhamento(pdiAcompanhamentos.filter(item => item.alunoId === row.id))?.data) },
      { key: 'tendencia', header: 'Evolução', render: row => <TrendBadge trend={pdiTrend(pdiAcompanhamentos.filter(item => item.alunoId === row.id))} /> },
    ] : []),
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => navigate(`/pdi/alunos/${row.id}`)}>Ver</Button>
        {canManage && <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Editar</Button>}
        {canManage && row.status !== 'arquivado' && <Button size="sm" variant="danger" onClick={() => setArchiving(row)}>Arquivar</Button>}
      </div>
    ) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Alunos PDI</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Alunos em acompanhamento</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{isProfessor ? 'Consulte os alunos PDI das turmas em que você leciona.' : 'Acompanhe a jornada PDI por aluno: avaliação inicial, metas, acompanhamentos e evolução.'}</p>
          </div>
          {canManage && <Button onClick={openCreate}>Novo aluno PDI</Button>}
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <Card>
          <div className="grid gap-3 md:grid-cols-4">
            <FormField label="Busca por nome"><input className={inputClass} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar aluno" /></FormField>
            <FormField label="Turma"><select className={inputClass} value={turma} onChange={event => { setTurma(event.target.value); setPage(1); }}><option value="todos">Todas</option>{availableTurmas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
            <FormField label="Ativos e arquivados"><select className={inputClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ativo">Ativos</option><option value="arquivado">Arquivados</option><option value="todos">Todos</option></select></FormField>
            {!isProfessor && <FormField label="Tendência"><select className={inputClass} value={tendencia} onChange={event => { setTendencia(event.target.value); setPage(1); }}><option value="todos">Todas</option><option value="evolucao">Evolução</option><option value="estavel">Estável</option><option value="atencao">Atenção</option></select></FormField>}
          </div>
        </Card>

        <DataTable columns={columns} rows={paginatedAlunos} onRowClick={row => navigate(`/pdi/alunos/${row.id}`)} emptyMessage="Nenhum aluno encontrado" />

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:flex-row sm:items-center">
          <span>Exibindo {paginatedAlunos.length} de {alunos.length} alunos</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>Anterior</Button>
            <span className="font-semibold text-slate-800">Página {page} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>Próxima</Button>
          </div>
        </div>

        {form && (
          <Modal title={editing ? 'Editar aluno' : 'Novo aluno'} onClose={() => setForm(null)}>
            <form onSubmit={saveAluno} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nome completo"><input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} required /></FormField>
                <FormField label="Data de nascimento"><input className={inputClass} type="date" value={form.dataNascimento} onChange={event => setForm(prev => ({ ...prev, dataNascimento: event.target.value }))} required /></FormField>
                <FormField label="Escola"><select className={inputClass} value={form.escolaId} onChange={event => setForm(prev => ({ ...prev, escolaId: Number(event.target.value) }))} required disabled={activeEscolaId !== null}>{(activeEscolaId !== null ? escolas.filter(item => item.id === activeEscolaId) : escolas).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={form.turmaId} onChange={event => setForm(prev => ({ ...prev, turmaId: Number(event.target.value) }))} required>{availableTurmas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                {!isProfessor && <FormField label="Professor responsável"><select className={inputClass} value={form.professorId} onChange={event => setForm(prev => ({ ...prev, professorId: Number(event.target.value) }))} required>{professoresOptions.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>}
                <FormField label="Data de entrada na rede"><input className={inputClass} type="date" value={form.dataEntradaRede} onChange={event => setForm(prev => ({ ...prev, dataEntradaRede: event.target.value }))} required /></FormField>
                <FormField label="Data de início do acompanhamento"><input className={inputClass} type="date" value={form.dataInicio} onChange={event => setForm(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
                <FormField label="Transtorno/condição informada"><input className={inputClass} value={form.condicaoInformada} onChange={event => setForm(prev => ({ ...prev, condicaoInformada: event.target.value }))} placeholder="Informação fictícia do cadastro" /></FormField>
                <FormField label="CID, quando houver"><input className={inputClass} value={form.cid} onChange={event => setForm(prev => ({ ...prev, cid: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Status"><select className={inputClass} value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}>{alunoStatusOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
              </div>
              <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {archiving && <ConfirmDialog title="Arquivar aluno" message={`Arquivar ${archiving.nome}? O histórico continuará disponível no filtro Arquivados.`} confirmLabel="Arquivar" onCancel={() => setArchiving(null)} onConfirm={() => { archivePdiAluno(archiving.id); setArchiving(null); setMessage('Aluno arquivado com sucesso.'); }} />}
      </div>
    </MainLayout>
  );
};
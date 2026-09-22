import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BackButton, Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal } from '../components/Common';
import { TrendBadge } from '../components/PdiControls';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { inputClass, professorName, turmaName } from '../utils/display';
import { filterByEscola, professoresDaEscola, professoresDaTurma, turmasDoProfessor } from '../utils/escolas';
import { alunoStatusOptions, formatDate, latestAcompanhamento, parentescoOptions, pdiTrend } from '../utils/pdi';
import { isAuxiliar, isDiretora, isGestor, isProfessor as isProfessorRole, isSecretaria, canManagePedagogico } from '../utils/roles';
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
  responsavelNome: '',
  responsavelParentesco: '',
  responsavelTelefone1: '',
  responsavelTelefone2: '',
});

// Bloco somente leitura "Professores da turma": derivado direto de turmaProfessores, sem
// cadastro manual — reaproveitado nos modais de criação e edição de aluno.
const ProfessoresDaTurmaPreview = ({ turmaProfessores, professores, disciplinas, turmaId }) => {
  const vinculos = turmaId ? professoresDaTurma(turmaProfessores, professores, disciplinas, Number(turmaId)) : [];
  return (
    <div className="md:col-span-2">
      <p className="mb-1.5 text-sm font-semibold text-slate-700">Professores da turma</p>
      {vinculos.length === 0
        ? <p className="text-sm text-slate-500">Selecione uma turma para ver os professores vinculados.</p>
        : (
          <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {vinculos.map(vinculo => (
              <li key={`${vinculo.professorId}-${vinculo.disciplinaId}`}>{vinculo.professor?.nome || 'Professor não encontrado'} — {vinculo.disciplina?.nome || 'Disciplina não encontrada'}</li>
            ))}
          </ul>
        )}
    </div>
  );
};

export const PdiPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    pdiAlunos,
    pdiAcompanhamentos,
    professores,
    turmas,
    turmaProfessores,
    disciplinas,
    escolas,
    vinculosEscolares,
    createPdiAluno,
    updatePdiAluno,
    archivePdiAluno,
  } = useData();
  const { activeEscolaId, userEscolas, isExplicitBatchSelection } = useEscola();

  const isProfessor = isProfessorRole(user);
  const canManage = canManagePedagogico(user);
  // Escola inativa vinculada à Supervisora: consulta sempre permitida, edição nunca.
  // Secretaria não é afetada (o escopo desta regra é "Gestor/Supervisora").
  const escolaAtivaSelecionada = activeEscolaId ? escolas.find(item => item.id === activeEscolaId)?.status === 'ativa' : true;
  const canEditPdi = canManage && (!isGestor(user) || escolaAtivaSelecionada);
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

  // Esta lista agora é exclusiva de Secretaria/Gestor — Professor é redirecionado para "Meus
  // PDIs" antes de chegar aqui (ver guard mais abaixo), então não há mais escopo por
  // aluno.professorId nesta tela.
  const alunosDaEscola = filterByEscola(pdiAlunos, activeEscolaId, user);
  const scopedAlunos = alunosDaEscola;

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
    if (!canEditPdi) return;
    if (activeEscolaId === null && !isExplicitBatchSelection) {
      setMessage('Selecione uma escola específica antes de criar um aluno PDI.');
      return;
    }
    setEditing(null);
    setForm(blankAluno(professoresOptions[0]?.id, activeEscolaId === null ? '' : availableTurmas[0]?.id, activeEscolaId));
  };

  const openEdit = (aluno) => {
    if (!canEditPdi) return;
    setEditing(aluno);
    setForm({ ...aluno });
  };

  const saveAluno = (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (activeEscolaId === null && !isExplicitBatchSelection) {
      setMessage('Selecione uma escola específica antes de salvar o aluno PDI.');
      return;
    }
    const payload = { ...form, escolaId: activeEscolaId ?? form.escolaId };
    if (!payload.nome?.trim() || !payload.escolaId || !payload.turmaId) {
      setMessage('Preencha nome, escola e turma antes de salvar.');
      return;
    }
    if (!payload.responsavelNome?.trim() || !payload.responsavelParentesco || !payload.responsavelTelefone1?.trim()) {
      setMessage('Informe nome, parentesco e telefone principal do responsável legal.');
      return;
    }
    const turmaSelecionada = turmas.find(item => item.id === Number(payload.turmaId));
    if (!turmaSelecionada || turmaSelecionada.escolaId !== Number(payload.escolaId)) {
      setMessage('A turma selecionada não pertence à escola selecionada.');
      return;
    }
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

  // A Secretaria administra o PDI (perguntas, escolas e vigência) e por isso também precisa
  // consultar a lista de alunos — Diretora e Auxiliar ficam de fora deste módulo (Auxiliar tem
  // sua própria tela em /meus-alunos).
  if (isDiretora(user) || isAuxiliar(user)) return <Navigate to="/dashboard" replace />;
  // Professor não usa mais esta lista para o PDI por disciplina — o acesso não é mais baseado
  // em aluno.professorId, e sim em turmaProfessores (ver src/utils/pdiFichas.js). A visão do
  // professor passa a ser "Meus PDIs", que já mostra aluno/escola/turma/disciplina juntos.
  if (isProfessor) return <Navigate to="/pdi/meus-pdis" replace />;

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
        {canEditPdi && <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Editar</Button>}
        {canEditPdi && row.status !== 'arquivado' && <Button size="sm" variant="danger" onClick={() => setArchiving(row)}>Arquivar</Button>}
      </div>
    ) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <BackButton />
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Alunos PDI</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Alunos em acompanhamento</h1>
            <p className="mt-2 max-w-3xl text-slate-600">{isProfessor ? 'Consulte os alunos PDI das turmas em que você leciona.' : 'Acompanhe a jornada PDI por aluno: avaliação inicial, metas, acompanhamentos e evolução.'}</p>
          </div>
          {canEditPdi && <Button onClick={openCreate}>Novo aluno PDI</Button>}
        </div>

        {isGestor(user) && activeEscolaId !== null && !escolaAtivaSelecionada && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Escola inativa — consulta histórica. Os registros estão disponíveis apenas para consulta; preenchimento, edição e correção estão desabilitados.
          </div>
        )}

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
                <FormField label="Data de nascimento"><input className={inputClass} type="date" value={form.dataNascimento} onChange={event => setForm(prev => ({ ...prev, dataNascimento: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Escola"><select className={inputClass} value={form.escolaId ?? ''} onChange={event => { const escolaId = Number(event.target.value); setForm(prev => ({ ...prev, escolaId, turmaId: turmas.some(item => item.id === prev.turmaId && item.escolaId === escolaId) ? prev.turmaId : '' })); }} required disabled={activeEscolaId !== null}>{(activeEscolaId !== null ? escolas.filter(item => item.id === activeEscolaId) : escolas).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={form.turmaId} onChange={event => setForm(prev => ({ ...prev, turmaId: Number(event.target.value) }))} required>
                  <option value="" disabled>{form.escolaId ? 'Selecione a turma' : 'Selecione a escola primeiro'}</option>
                  {turmas.filter(item => item.escolaId === Number(form.escolaId)).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select></FormField>
                {!isProfessor && <FormField label="Professor responsável"><select className={inputClass} value={form.professorId} onChange={event => setForm(prev => ({ ...prev, professorId: Number(event.target.value) }))} required>{professoresOptions.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>}
                <ProfessoresDaTurmaPreview turmaProfessores={turmaProfessores} professores={professores} disciplinas={disciplinas} turmaId={form.turmaId} />
                <div className="md:col-span-2 grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                  <p className="text-sm font-semibold text-slate-700 md:col-span-2">Responsável legal</p>
                  <FormField label="Nome do responsável"><input className={inputClass} value={form.responsavelNome} onChange={event => setForm(prev => ({ ...prev, responsavelNome: event.target.value }))} required /></FormField>
                  <FormField label="Parentesco"><select className={inputClass} value={form.responsavelParentesco} onChange={event => setForm(prev => ({ ...prev, responsavelParentesco: event.target.value }))} required><option value="" disabled>Selecione</option>{parentescoOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
                  <FormField label="Telefone principal"><input className={inputClass} value={form.responsavelTelefone1} onChange={event => setForm(prev => ({ ...prev, responsavelTelefone1: event.target.value }))} required /></FormField>
                  <FormField label="Telefone secundário"><input className={inputClass} value={form.responsavelTelefone2} onChange={event => setForm(prev => ({ ...prev, responsavelTelefone2: event.target.value }))} placeholder="Opcional" /></FormField>
                </div>
                <FormField label="Data de entrada na rede"><input className={inputClass} type="date" value={form.dataEntradaRede} onChange={event => setForm(prev => ({ ...prev, dataEntradaRede: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Data de início do acompanhamento"><input className={inputClass} type="date" value={form.dataInicio} onChange={event => setForm(prev => ({ ...prev, dataInicio: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Transtorno/condição informada"><input className={inputClass} value={form.condicaoInformada} onChange={event => setForm(prev => ({ ...prev, condicaoInformada: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="CID, quando houver"><input className={inputClass} value={form.cid} onChange={event => setForm(prev => ({ ...prev, cid: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Status"><select className={inputClass} value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}>{alunoStatusOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
              </div>
              <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {archiving && <ConfirmDialog title="Arquivar aluno" message={`Arquivar ${archiving.nome}? O histórico continuará disponível no filtro Arquivados.`} confirmLabel="Arquivar" onCancel={() => setArchiving(null)} onConfirm={() => { if (!canEditPdi) return; archivePdiAluno(archiving.id); setArchiving(null); setMessage('Aluno arquivado com sucesso.'); }} />}
      </div>
    </MainLayout>
  );
};
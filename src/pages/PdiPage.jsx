import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal } from '../components/Common';
import { ProfessoresDaTurmaPreview } from '../components/ProfessoresDaTurmaPreview';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { inputClass, turmaName } from '../utils/display';
import { filterByEscola } from '../utils/escolas';
import { parentescoOptions } from '../utils/pdi';
import { isAuxiliar, isDiretora, isGestor, isProfessor as isProfessorRole, isSecretaria, canManagePedagogico, canViewPdiAlunos } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';
import { MainLayout } from '../layouts/Layouts';

const blankAluno = (turmaId, escolaId) => ({
  nome: '',
  escolaId,
  turmaId,
  responsavelNome: '',
  responsavelParentesco: '',
  responsavelTelefone: '',
});

export const PdiPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    pdiAlunosReais, pdiAlunosReaisLoading, pdiAlunosReaisError, loadPdiAlunosReais,
    createPdiAlunoReal, updatePdiAlunoReal, arquivarPdiAluno, reativarPdiAluno,
    turmas, escolas,
  } = useData();
  const { activeEscolaId, userEscolas, isExplicitBatchSelection } = useEscola();

  const isProfessor = isProfessorRole(user);
  const canManage = canManagePedagogico(user); // Secretaria + Gestor: cria/edita/arquiva/reativa
  const canView = canViewPdiAlunos(user); // + Diretora: só consulta
  // Escola inativa vinculada à Supervisora: consulta sempre permitida, edição nunca.
  const escolaAtivaSelecionada = activeEscolaId ? escolas.find(item => item.id === activeEscolaId)?.status === 'ativa' : true;
  const canEditPdi = canManage && (!isGestor(user) || escolaAtivaSelecionada);
  const turmasDaEscola = filterByEscola(turmas.filter(t => t.status === 'ativa'), activeEscolaId, user);
  const [search, setSearch] = useState('');
  const [turma, setTurma] = useState('todos');
  const [status, setStatus] = useState('ativo');
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [reactivating, setReactivating] = useState(null);
  const [message, setMessage] = useState('');

  const scopedAlunos = filterByEscola(pdiAlunosReais, activeEscolaId, user);

  const alunos = useMemo(() => scopedAlunos.filter(aluno => {
    const matchesSearch = aluno.nome.toLowerCase().includes(search.toLowerCase());
    const matchesTurma = turma === 'todos' || String(aluno.turmaId) === turma;
    const matchesStatus = status === 'todos' || aluno.status === status;
    return matchesSearch && matchesTurma && matchesStatus;
  }), [scopedAlunos, search, turma, status]);

  if (isAuxiliar(user)) return <Navigate to="/dashboard" replace />;
  // Professor não usa mais esta lista — vai direto para "Meus PDIs" (turmaProfessores, não
  // aluno.professorId, que nem existe mais no backend real — ver src/utils/pdiFichas.js).
  if (isProfessor) return <Navigate to="/pdi/meus-pdis" replace />;
  if (!canView) return <Navigate to="/dashboard" replace />;

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
    setForm(blankAluno(activeEscolaId === null ? '' : turmasDaEscola[0]?.id, activeEscolaId));
  };

  const openEdit = (aluno) => {
    if (!canEditPdi) return;
    setEditing(aluno);
    setForm({ ...aluno });
  };

  const saveAluno = async (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (activeEscolaId === null && !isExplicitBatchSelection) {
      setMessage('Selecione uma escola específica antes de salvar o aluno PDI.');
      return;
    }
    if (!form.nome?.trim() || !form.turmaId) {
      setMessage('Preencha nome e turma antes de salvar.');
      return;
    }
    if (!form.responsavelNome?.trim() || !form.responsavelParentesco || !form.responsavelTelefone?.trim()) {
      setMessage('Informe nome, parentesco e telefone do responsável legal.');
      return;
    }
    setSalvando(true);
    const resultado = editing ? await updatePdiAlunoReal(editing.id, form) : await createPdiAlunoReal(form);
    setSalvando(false);
    if (!resultado.ok) {
      setMessage(resultado.error);
      return;
    }
    setMessage(editing ? 'Aluno atualizado com sucesso.' : 'Aluno criado com sucesso.');
    setForm(null);
    setEditing(null);
  };

  const confirmarArquivar = async () => {
    const alvo = archiving;
    setArchiving(null);
    const resultado = await arquivarPdiAluno(alvo.id);
    setMessage(resultado.ok ? 'Aluno arquivado com sucesso.' : resultado.error);
  };

  const confirmarReativar = async () => {
    const alvo = reactivating;
    setReactivating(null);
    const resultado = await reativarPdiAluno(alvo.id);
    setMessage(resultado.ok ? 'Aluno reativado com sucesso.' : resultado.error);
  };

  const paginatedAlunos = alunos.slice((page - 1) * 10, page * 10);
  const totalPages = Math.max(1, Math.ceil(alunos.length / 10));

  const columns = [
    { key: 'nome', header: 'Aluno', render: row => <button className="font-semibold text-teal-700 hover:underline" onClick={event => { event.stopPropagation(); navigate(`/pdi/alunos/${row.id}`); }}>{row.nome}</button> },
    { key: 'turma', header: 'Turma', render: row => turmaName(turmas, row.turmaId) },
    { key: 'status', header: 'Status', render: row => row.status === 'arquivado' ? 'Arquivado' : 'Ativo' },
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => navigate(`/pdi/alunos/${row.id}`)}>Ver</Button>
        {canEditPdi && <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Editar</Button>}
        {canEditPdi && (row.status !== 'arquivado'
          ? <Button size="sm" variant="danger" onClick={() => setArchiving(row)}>Arquivar</Button>
          : <Button size="sm" variant="outline" onClick={() => setReactivating(row)}>Reativar</Button>)}
      </div>
    ) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            {/* Link explícito pra /pdi, nunca navigate(-1): a pilha de histórico do navegador aqui
                alterna com o perfil do aluno (PdiAlunoPerfil.jsx usa <Link to="/pdi/alunos">, que
                empilha uma entrada nova em vez de "voltar") — navigate(-1) ficava preso num loop
                entre esta lista e o último aluno aberto em vez de voltar pra tela principal do PDI. */}
            <Link to="/pdi" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar</Link>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Alunos PDI</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Alunos em acompanhamento</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Cadastro dos alunos acompanhados pelo PDI: turma, escola e responsável legal.</p>
          </div>
          {canEditPdi && <Button onClick={openCreate} disabled={pdiAlunosReaisLoading}>Novo aluno PDI</Button>}
        </div>

        {isGestor(user) && activeEscolaId !== null && !escolaAtivaSelecionada && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Escola inativa — consulta histórica. Edição, arquivamento e reativação estão desabilitados.
          </div>
        )}

        {isDiretora(user) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Você tem acesso de consulta aos Alunos PDI das suas escolas. Cadastro, edição e arquivamento são feitos pela Secretaria ou pela Supervisão.
          </div>
        )}

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {pdiAlunosReaisError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar os alunos: {pdiAlunosReaisError}</span>
            <Button size="sm" variant="outline" onClick={loadPdiAlunosReais}>Tentar novamente</Button>
          </div>
        )}

        <Card>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Busca por nome"><input className={inputClass} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar aluno" /></FormField>
            <FormField label="Turma"><select className={inputClass} value={turma} onChange={event => { setTurma(event.target.value); setPage(1); }}><option value="todos">Todas</option>{turmasDaEscola.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
            <FormField label="Ativos e arquivados"><select className={inputClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ativo">Ativos</option><option value="arquivado">Arquivados</option><option value="todos">Todos</option></select></FormField>
          </div>
        </Card>

        {pdiAlunosReaisLoading ? (
          <Card><p className="text-center text-slate-500">Carregando alunos...</p></Card>
        ) : (
          <>
            <DataTable columns={columns} rows={paginatedAlunos} onRowClick={row => navigate(`/pdi/alunos/${row.id}`)} emptyMessage="Nenhum aluno encontrado" />

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:flex-row sm:items-center">
              <span>Exibindo {paginatedAlunos.length} de {alunos.length} alunos</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>Anterior</Button>
                <span className="font-semibold text-slate-800">Página {page} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>Próxima</Button>
              </div>
            </div>
          </>
        )}

        {form && (
          <Modal title={editing ? 'Editar aluno' : 'Novo aluno'} onClose={() => setForm(null)}>
            <form onSubmit={saveAluno} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nome completo"><input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} required /></FormField>
                <FormField label="Escola (filtro)"><select className={inputClass} value={form.escolaId ?? ''} onChange={event => { const escolaId = Number(event.target.value); setForm(prev => ({ ...prev, escolaId, turmaId: turmas.some(item => item.id === prev.turmaId && item.escolaId === escolaId) ? prev.turmaId : '' })); }} disabled={activeEscolaId !== null}>{(activeEscolaId !== null ? escolas.filter(item => item.id === activeEscolaId) : escolas).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={form.turmaId} onChange={event => setForm(prev => ({ ...prev, turmaId: Number(event.target.value) }))} required>
                  <option value="" disabled>{form.escolaId ? 'Selecione a turma' : 'Selecione a escola primeiro'}</option>
                  {turmas.filter(item => item.status === 'ativa' && item.escolaId === Number(form.escolaId)).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select></FormField>
                <ProfessoresDaTurmaPreview turmaId={form.turmaId} />
                <div className="md:col-span-2 grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                  <p className="text-sm font-semibold text-slate-700 md:col-span-2">Responsável legal</p>
                  <FormField label="Nome do responsável"><input className={inputClass} value={form.responsavelNome} onChange={event => setForm(prev => ({ ...prev, responsavelNome: event.target.value }))} required /></FormField>
                  <FormField label="Parentesco"><select className={inputClass} value={form.responsavelParentesco} onChange={event => setForm(prev => ({ ...prev, responsavelParentesco: event.target.value }))} required><option value="" disabled>Selecione</option>{parentescoOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
                  <FormField label="Telefone principal"><input className={inputClass} value={form.responsavelTelefone} onChange={event => setForm(prev => ({ ...prev, responsavelTelefone: event.target.value }))} required /></FormField>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={salvando}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button></div>
            </form>
          </Modal>
        )}

        {archiving && <ConfirmDialog title="Arquivar aluno" message={`Arquivar ${archiving.nome}? O histórico continuará disponível no filtro Arquivados.`} confirmLabel="Arquivar" onCancel={() => setArchiving(null)} onConfirm={confirmarArquivar} />}
        {reactivating && <ConfirmDialog title="Reativar aluno" message={`Reativar ${reactivating.nome}? Ele volta a aparecer como ativo nas listas operacionais.`} confirmLabel="Reativar" onCancel={() => setReactivating(null)} onConfirm={confirmarReativar} />}
      </div>
    </MainLayout>
  );
};

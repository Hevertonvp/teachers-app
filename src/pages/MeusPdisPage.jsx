import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BackButton, Badge, Button, Card, DataTable, EmptyState, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { formatFullDate, formStatusClasses, formStatusLabel } from '../utils/formAvailability';
import { isProfessor } from '../utils/roles';

const STATUS_VISUAL_LABEL = { nao_iniciado: 'Não iniciado', agendado: 'Agendado', em_andamento: 'Em preenchimento', concluido: 'Concluído', prazo_encerrado: 'Prazo encerrado' };
const STATUS_VISUAL_VARIANT = { nao_iniciado: 'gray', agendado: 'yellow', em_andamento: 'blue', concluido: 'green', prazo_encerrado: 'gray' };

// Visão única do professor para o PDI por disciplina: tudo que pertence a ele, em qualquer
// escola/turma/disciplina em que lecione, sem exigir seleção prévia de escola — cada linha já vem
// pronta do backend (GET /api/pdi-fichas/meus-pdis), com ou sem Ficha ainda criada (seção 3 do
// pedido: PDI sem Ficha aparece como "Não iniciado", a Ficha só nasce quando o professor abre).
export const MeusPdisPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { meusPdisReais, meusPdisReaisLoading, meusPdisReaisError, loadMeusPdisReais } = useData();

  const [filtroEscola, setFiltroEscola] = useState('todas');
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');
  const [filtroTurma, setFiltroTurma] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  useEffect(() => { if (isProfessor(user)) loadMeusPdisReais(); }, [user, loadMeusPdisReais]);

  if (!isProfessor(user)) return <Navigate to="/pdi" replace />;

  const escolasDisponiveis = [...new Map(meusPdisReais.map(item => [item.escolaId, item.escolaNome])).entries()];
  const disciplinasDisponiveis = [...new Map(meusPdisReais.map(item => [item.disciplinaId, item.disciplinaNome])).entries()];
  const turmasDisponiveis = [...new Map(meusPdisReais.map(item => [item.turmaId, item.turmaNome])).entries()];

  const itensFiltrados = meusPdisReais.filter(item => (
    (filtroEscola === 'todas' || String(item.escolaId) === filtroEscola)
    && (filtroDisciplina === 'todas' || String(item.disciplinaId) === filtroDisciplina)
    && (filtroTurma === 'todas' || String(item.turmaId) === filtroTurma)
    && (filtroStatus === 'todos' || item.statusVisual === filtroStatus)
  ));

  const columns = [
    { key: 'aluno', header: 'Aluno', render: row => row.alunoNome },
    { key: 'escola', header: 'Escola', render: row => row.escolaNome },
    { key: 'turma', header: 'Turma', render: row => row.turmaNome },
    { key: 'disciplina', header: 'Disciplina', render: row => row.disciplinaNome },
    { key: 'vigencia', header: 'Vigência', render: row => (
      <div className="flex flex-col gap-1">
        <span>{formatFullDate(row.dataInicio)} a {formatFullDate(row.dataFim)}</span>
        <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${formStatusClasses(row.statusVigencia)}`}>{formStatusLabel(row.statusVigencia)}</span>
      </div>
    ) },
    { key: 'status', header: 'Status', render: row => <Badge variant={STATUS_VISUAL_VARIANT[row.statusVisual]}>{STATUS_VISUAL_LABEL[row.statusVisual]}</Badge> },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <BackButton />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">PDI por disciplina</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Meus PDIs</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Todas as fichas PDI das disciplinas que você leciona, em qualquer escola ou turma — sem precisar selecionar uma escola primeiro.</p>
        </div>

        {meusPdisReaisError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar seus PDIs: {meusPdisReaisError}</span>
            <Button size="sm" variant="outline" onClick={loadMeusPdisReais}>Tentar novamente</Button>
          </div>
        )}

        {meusPdisReaisLoading ? (
          <Card className="py-12 text-center"><p className="text-slate-500">Carregando...</p></Card>
        ) : (
          <>
            <Card>
              <div className="grid gap-3 md:grid-cols-4">
                <FormField label="Escola"><select className={inputClass} value={filtroEscola} onChange={event => setFiltroEscola(event.target.value)}><option value="todas">Todas</option>{escolasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
                <FormField label="Disciplina"><select className={inputClass} value={filtroDisciplina} onChange={event => setFiltroDisciplina(event.target.value)}><option value="todas">Todas</option>{disciplinasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={filtroTurma} onChange={event => setFiltroTurma(event.target.value)}><option value="todas">Todas</option>{turmasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
                <FormField label="Status"><select className={inputClass} value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)}><option value="todos">Todos</option><option value="nao_iniciado">Não iniciado</option><option value="agendado">Agendado</option><option value="em_andamento">Em preenchimento</option><option value="concluido">Concluído</option><option value="prazo_encerrado">Prazo encerrado</option></select></FormField>
              </div>
            </Card>

            {location.state?.pdiMensagemSucesso && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{location.state.pdiMensagemSucesso}</div>
            )}

            {meusPdisReais.length === 0 ? (
              <EmptyState title="Nenhum PDI disponível" description="Não há, no momento, nenhuma aplicação PDI aberta para as disciplinas e turmas em que você leciona." />
            ) : (
              <DataTable
                columns={columns}
                rows={itensFiltrados}
                onRowClick={row => navigate(`/pdi/fichas/${row.aplicacaoId}/${row.disciplinaId}/${row.alunoId}`)}
                emptyMessage="Nenhum PDI encontrado com os filtros selecionados"
              />
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BackButton, Badge, Card, DataTable, EmptyState, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass, escolaName } from '../utils/display';
import { CURRENT_DATE, formatFullDate, formStatusClasses, formStatusLabel, getFormStatus } from '../utils/formAvailability';
import { fichasDoProfessor, statusFicha, STATUS_FICHA_LABEL } from '../utils/pdiFichas';
import { isProfessor } from '../utils/roles';

const STATUS_BADGE_VARIANT = { concluido: 'green', em_andamento: 'blue', pendente: 'yellow', nao_preenchido: 'gray' };

// Visão única do professor para o PDI por disciplina: tudo que pertence a ele, em qualquer
// escola/turma/disciplina em que lecione, sem exigir seleção prévia de escola (ver seção 14/24
// do pedido) — a escola de cada item já aparece explícita na própria linha.
export const MeusPdisPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { turmaProfessores, pdiAlunos, pdiAplicacoes, pdiFichaHistorico, pdiFichaRespostas, disciplinas, turmas, escolas } = useData();

  const [filtroEscola, setFiltroEscola] = useState('todas');
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');
  const [filtroTurma, setFiltroTurma] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // useMemo precisa ser chamado sempre, antes de qualquer "return" condicional (regras de
  // hooks) — o guard de acesso (só Professor usa esta página) vem depois.
  const fichas = useMemo(
    () => (isProfessor(user)
      ? fichasDoProfessor(user.id, { turmaProfessores, pdiAlunos, pdiAplicacoes, disciplinas, turmas }).map(ficha => ({
        ...ficha,
        vigenciaStatus: getFormStatus(ficha.dataInicio, ficha.dataFim),
        fichaStatus: statusFicha({ aplicacao: ficha, historico: pdiFichaHistorico, respostas: pdiFichaRespostas, currentDate: CURRENT_DATE }),
      }))
      : []),
    [user, turmaProfessores, pdiAlunos, pdiAplicacoes, disciplinas, turmas, pdiFichaHistorico, pdiFichaRespostas]
  );

  if (!isProfessor(user)) return <Navigate to="/pdi" replace />;

  const escolasDisponiveis = [...new Map(fichas.map(item => [item.escolaId, escolaName(escolas, item.escolaId)])).entries()];
  const disciplinasDisponiveis = [...new Map(fichas.map(item => [item.disciplinaId, item.disciplinaNome])).entries()];
  const turmasDisponiveis = [...new Map(fichas.map(item => [item.turmaId, item.turmaNome])).entries()];

  const fichasFiltradas = fichas.filter(item => (
    (filtroEscola === 'todas' || String(item.escolaId) === filtroEscola)
    && (filtroDisciplina === 'todas' || String(item.disciplinaId) === filtroDisciplina)
    && (filtroTurma === 'todas' || String(item.turmaId) === filtroTurma)
    && (filtroStatus === 'todos' || item.fichaStatus === filtroStatus)
  ));

  const columns = [
    { key: 'aluno', header: 'Aluno', render: row => row.alunoNome },
    { key: 'escola', header: 'Escola', render: row => escolaName(escolas, row.escolaId) },
    { key: 'turma', header: 'Turma', render: row => row.turmaNome },
    { key: 'disciplina', header: 'Disciplina', render: row => row.disciplinaNome },
    { key: 'vigencia', header: 'Vigência', render: row => (
      <div className="flex flex-col gap-1">
        <span>{formatFullDate(row.dataInicio)} a {formatFullDate(row.dataFim)}</span>
        <span className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${formStatusClasses(row.vigenciaStatus)}`}>{formStatusLabel(row.vigenciaStatus)}</span>
      </div>
    ) },
    { key: 'status', header: 'Status', render: row => <Badge variant={STATUS_BADGE_VARIANT[row.fichaStatus]}>{STATUS_FICHA_LABEL[row.fichaStatus]}</Badge> },
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

        <Card>
          <div className="grid gap-3 md:grid-cols-4">
            <FormField label="Escola"><select className={inputClass} value={filtroEscola} onChange={event => setFiltroEscola(event.target.value)}><option value="todas">Todas</option>{escolasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
            <FormField label="Disciplina"><select className={inputClass} value={filtroDisciplina} onChange={event => setFiltroDisciplina(event.target.value)}><option value="todas">Todas</option>{disciplinasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
            <FormField label="Turma"><select className={inputClass} value={filtroTurma} onChange={event => setFiltroTurma(event.target.value)}><option value="todas">Todas</option>{turmasDisponiveis.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></FormField>
            <FormField label="Status"><select className={inputClass} value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)}><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="em_andamento">Em preenchimento</option><option value="concluido">Concluído</option><option value="nao_preenchido">Não preenchido</option></select></FormField>
          </div>
        </Card>

        {location.state?.pdiMensagemSucesso && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{location.state.pdiMensagemSucesso}</div>
        )}

        {fichas.length === 0 ? (
          <EmptyState title="Nenhuma ficha PDI disponível" description="Não há, no momento, nenhuma aplicação PDI aberta para as disciplinas e turmas em que você leciona." />
        ) : (
          <DataTable
            columns={columns}
            rows={fichasFiltradas}
            onRowClick={row => navigate(`/pdi/fichas/${row.aplicacaoId}/${row.disciplinaId}/${row.alunoId}`)}
            emptyMessage="Nenhuma ficha encontrada com os filtros selecionados"
          />
        )}
      </div>
    </MainLayout>
  );
};

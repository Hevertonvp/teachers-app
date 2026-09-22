import { MainLayout } from '../layouts/Layouts';
import { Navigate } from 'react-router-dom';
import { InstrumentManager, statusField } from '../components/InstrumentManager';
import { ProfessorName } from '../components/ProfessorName';
import { EmptyState, StatusBadge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { disciplinaName, escolaName, professorName, turmaName } from '../utils/display';
import { filterByEscola, professoresDaEscola, turmasDoProfessor } from '../utils/escolas';
import { canManagePedagogico, isGestor, isProfessor as isProfessorRole, isSecretaria } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';

export const CorrecoesSimulados = () => {
  const { user } = useAuth();
  const { correcoes, professores, turmas, turmaProfessores, disciplinas, escolas, vinculosEscolares, createCorrecao, updateCorrecao, deleteCorrecao } = useData();
  const { activeEscolaId, userEscolas } = useEscola();
  const isProfessor = isProfessorRole(user);
  // Professor vê tudo que é seu em qualquer escola em que leciona, unificado — não fica preso à
  // escola selecionada no seletor do topo (que nem existe mais para este perfil). Gestor/
  // Secretaria continuam escopados pela escola selecionada, como antes.
  const scopedCorrecoes = isProfessor ? correcoes.filter(item => item.professorId === user.id) : filterByEscola(correcoes, activeEscolaId, user);
  const availableTurmas = isProfessor ? turmasDoProfessor(turmas, turmaProfessores, user.id) : filterByEscola(turmas, activeEscolaId, user);
  const availableProfessores = professoresDaEscola(professores, vinculosEscolares, activeEscolaId, user);

  if (!isProfessor && !isGestor(user)) return <Navigate to="/dashboard" replace />;

  if (!isProfessor && activeEscolaId !== null && !isEscolaAplicavel(RECURSOS.CORRECOES_SIMULADOS, activeEscolaId)) {
    return <MainLayout><EmptyState title="Correções não aplicáveis" description="Esta escola não utiliza o módulo de correções de simulados." /></MainLayout>;
  }

  if (!isSecretaria(user) && userEscolas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a Secretaria de Educação." />
      </MainLayout>
    );
  }

  const professorOptions = availableProfessores.map(professor => ({ value: professor.id, label: professor.nome }));
  const turmaOptions = availableTurmas.map(turma => ({ value: turma.id, label: turma.nome }));
  const disciplinaOptions = disciplinas.map(disciplina => ({ value: disciplina.id, label: disciplina.nome }));

  const fields = [
    { name: 'professorId', label: 'Professor', required: true, kind: 'select-number', options: professorOptions, defaultValue: isProfessor ? user.id : availableProfessores[0]?.id, hidden: isProfessor },
    { name: 'turmaId', label: 'Turma', required: true, kind: 'select-number', options: turmaOptions, defaultValue: availableTurmas[0]?.id },
    { name: 'disciplinaId', label: 'Disciplina', required: true, kind: 'select-number', options: disciplinaOptions, defaultValue: disciplinas[0]?.id },
    { name: 'simulado', label: 'Simulado', required: true, defaultValue: '1º Simulado Municipal' },
    { name: 'dataAplicacao', label: 'Data de aplicação', type: 'date', required: true },
    { name: 'prazoCorrecao', label: 'Prazo para correção', type: 'date', required: true },
    { name: 'dataCorrecao', label: 'Data da correção', type: 'date' },
    { name: 'quantidadeAlunos', label: 'Quantidade de alunos', type: 'number', required: true, defaultValue: 25 },
    { name: 'quantidadeCorrigida', label: 'Quantidade corrigida', type: 'number', required: true, defaultValue: 0 },
    statusField,
  ];

  const columns = [
    { key: 'professor', header: 'Professor', render: row => <ProfessorName professorId={row.professorId} /> },
    // Escola só aparece para o Professor — ele vê registros de todas as escolas juntos, então
    // precisa ficar explícito de qual escola é cada um (Gestor já filtra por escola no topo).
    ...(isProfessor ? [{ key: 'escola', header: 'Escola', render: row => escolaName(escolas, row.escolaId) }] : []),
    { key: 'turma', header: 'Turma', render: row => turmaName(turmas, row.turmaId) },
    { key: 'simulado', header: 'Simulado' },
    { key: 'disciplina', header: 'Disciplina', render: row => disciplinaName(disciplinas, row.disciplinaId) },
    { key: 'progresso', header: 'Corrigidos', render: row => `${row.quantidadeCorrigida}/${row.quantidadeAlunos}` },
    { key: 'prazoCorrecao', header: 'Prazo' },
    { key: 'status', header: 'Status', render: row => <StatusBadge status={row.status} /> },
  ];

  return (
    <MainLayout>
      <InstrumentManager
        title="Correções dos simulados"
        description="Acompanhe entregas de correção por professor, turma, simulado e disciplina, com destaque para registros em atraso."
        records={scopedCorrecoes}
        fields={fields}
        columns={columns}
        onCreate={payload => createCorrecao({ ...(isProfessor ? { ...payload, professorId: user.id } : payload), escolaId: turmas.find(item => item.id === Number(payload.turmaId))?.escolaId })}
        onUpdate={(id, payload) => updateCorrecao(id, { ...(isProfessor ? { ...payload, professorId: user.id } : payload), escolaId: turmas.find(item => item.id === Number(payload.turmaId))?.escolaId })}
        onDelete={deleteCorrecao}
        canCreate={canManagePedagogico(user)}
        canDelete={canManagePedagogico(user)}
        editLabel={isProfessor ? 'Preencher' : 'Editar'}
        submitLabel={isProfessor ? 'Enviar formulário' : 'Salvar'}
        emptyDescription={isProfessor ? 'Nenhuma correção foi disponibilizada pela gestão para seu perfil neste período vigente.' : 'Ajuste os filtros ou crie um novo registro para continuar.'}
        detailTitle="Detalhes da correção"
        searchFields={[
          row => professorName(professores, row.professorId),
          row => turmaName(turmas, row.turmaId),
          row => disciplinaName(disciplinas, row.disciplinaId),
          row => row.simulado,
        ]}
        filters={[
          ...(!isProfessor ? [{ name: 'professor', label: 'Professor', options: professorOptions, getValue: row => row.professorId }] : []),
          { name: 'turma', label: 'Turma', options: turmaOptions, getValue: row => row.turmaId },
          { name: 'status', label: 'Status', options: statusField.options, getValue: row => row.status },
        ]}
      />
    </MainLayout>
  );
};
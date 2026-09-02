import { MainLayout } from '../layouts/Layouts';
import { InstrumentManager, statusField } from '../components/InstrumentManager';
import { ProfessorName } from '../components/ProfessorName';
import { StatusBadge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { disciplinaName, professorName, turmaName } from '../utils/display';

export const CorrecoesSimulados = () => {
  const { user } = useAuth();
  const { correcoes, professores, turmas, disciplinas, createCorrecao, updateCorrecao, deleteCorrecao } = useData();
  const isProfessor = user?.tipo === 'professor';
  const scopedCorrecoes = isProfessor ? correcoes.filter(item => item.professorId === user.id) : correcoes;
  const availableTurmas = isProfessor ? turmas.filter(turma => turma.professores.includes(user.id)) : turmas;

  const professorOptions = professores.map(professor => ({ value: professor.id, label: professor.nome }));
  const turmaOptions = availableTurmas.map(turma => ({ value: turma.id, label: turma.nome }));
  const disciplinaOptions = disciplinas.map(disciplina => ({ value: disciplina.id, label: disciplina.nome }));

  const fields = [
    { name: 'professorId', label: 'Professor', required: true, kind: 'select-number', options: professorOptions, defaultValue: isProfessor ? user.id : professores[0]?.id, hidden: isProfessor },
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
        onCreate={payload => createCorrecao(isProfessor ? { ...payload, professorId: user.id } : payload)}
        onUpdate={(id, payload) => updateCorrecao(id, isProfessor ? { ...payload, professorId: user.id } : payload)}
        onDelete={deleteCorrecao}
        canCreate={!isProfessor}
        canDelete={!isProfessor}
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
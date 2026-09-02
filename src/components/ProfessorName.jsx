import { useData } from '../context/DataContext';
import { disciplinaName, findById } from '../utils/display';

export const ProfessorName = ({ professor, professorId, className = '', nameClassName = 'font-semibold text-slate-900', disciplineClassName = 'text-[10px] font-medium uppercase tracking-wide text-slate-400' }) => {
  const { professores, disciplinas } = useData();
  const resolvedProfessor = professor || findById(professores, professorId);

  if (!resolvedProfessor) {
    return (
      <span className={className}>
        <span className={nameClassName}>Não informado</span>
      </span>
    );
  }

  const professorDisciplinas = resolvedProfessor.disciplinas?.length
    ? resolvedProfessor.disciplinas.map(id => disciplinaName(disciplinas, id)).join(' · ')
    : 'Disciplina não informada';

  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className={nameClassName}>{resolvedProfessor.nome}</span>
      <span className={disciplineClassName}>{professorDisciplinas}</span>
    </span>
  );
};
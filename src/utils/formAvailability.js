export const CURRENT_DATE = '2026-09-02';

export const formDefinitions = {
  formulario_um_terco: {
    id: 'formulario_um_terco',
    title: 'Formulário 1/3',
    subtitle: 'Conteúdos',
    route: '/formulario-um-terco',
  },
  pdi: {
    id: 'pdi',
    title: 'PDI',
    subtitle: 'Acompanhamento pedagógico',
    route: '/pdi/alunos',
  },
  correcoes_simulados: {
    id: 'correcoes_simulados',
    title: 'Correções dos simulados',
    subtitle: 'Correção e devolutiva',
    route: '/correcoes-simulados',
  },
};

const asDate = (date) => new Date(`${date}T12:00:00`);

export const formatShortDate = (date) => {
  const [year, month, day] = date.split('-');
  return `${day}/${month}`;
};

export const formatFullDate = (date) => {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

export const getFormStatus = (startDate, endDate, currentDate = CURRENT_DATE) => {
  const current = asDate(currentDate);
  const start = asDate(startDate);
  const end = asDate(endDate);

  if (current < start) return 'scheduled';
  if (current > end) return 'expired';
  return 'active';
};

export const formStatusLabel = (status) => ({
  scheduled: 'Agendado',
  active: 'Vigente',
  expired: 'Encerrado',
}[status]);

export const formStatusClasses = (status) => ({
  scheduled: 'border-blue-200 bg-blue-50 text-blue-800',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  expired: 'border-slate-200 bg-slate-100 text-slate-700',
}[status]);

export const isFormAvailableForTeacher = (period, currentDate = CURRENT_DATE) => (
  getFormStatus(period.startDate, period.endDate, currentDate) === 'active'
);

export const daysUntilEnd = (endDate, currentDate = CURRENT_DATE) => {
  const diff = asDate(endDate) - asDate(currentDate);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const deadlineText = (endDate, currentDate = CURRENT_DATE) => {
  const days = daysUntilEnd(endDate, currentDate);
  if (days === 0) return 'Termina hoje';
  if (days === 1) return 'Encerra amanhã';
  if (days > 1) return `${days} dias restantes`;
  return `Encerrado há ${Math.abs(days)} dias`;
};

export const teacherFillingStatus = (records, professorId) => {
  const ownRecords = records.filter(record => record.professorId === professorId);
  if (!ownRecords.length) return 'Não iniciado';
  if (ownRecords.some(record => record.status === 'concluido' || record.status === 'concluído')) return 'Concluído';
  if (ownRecords.some(record => record.status === 'em_andamento')) return 'Em andamento';
  return 'Não iniciado';
};

export const formCompletionStats = (records, totalProfessores) => {
  const completedProfessors = new Set(records
    .filter(record => record.status === 'concluido' || record.status === 'concluído')
    .map(record => record.professorId));
  const filled = completedProfessors.size;
  const pending = Math.max(0, totalProfessores - filled);
  const percent = totalProfessores ? Math.round((filled / totalProfessores) * 100) : 0;
  return { filled, pending, percent };
};
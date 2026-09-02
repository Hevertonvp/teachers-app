export const findById = (items, id) => items.find(item => item.id === Number(id));

export const professorName = (professores, id) => findById(professores, id)?.nome || 'Não informado';

export const turmaName = (turmas, id) => findById(turmas, id)?.nome || 'Não informada';

export const disciplinaName = (disciplinas, id) => findById(disciplinas, id)?.nome || 'Não informada';

export const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'em_atraso', label: 'Em atraso' },
];

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100';

export const filterByText = (items, query, fields) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter(item => fields.some(field => String(field(item)).toLowerCase().includes(normalizedQuery)));
};
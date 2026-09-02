export const pdiAreas = [
  {
    area: 'Aprendizagem',
    indicadores: ['Leitura', 'Escrita', 'Compreensão', 'Resolução de problemas'],
  },
  {
    area: 'Comunicação',
    indicadores: ['Compreensão de instruções', 'Comunicação oral'],
  },
  {
    area: 'Autonomia',
    indicadores: ['Organização', 'Realização de atividades', 'Cumprimento de rotinas'],
  },
  {
    area: 'Participação e socialização',
    indicadores: ['Participação nas atividades', 'Interação com colegas', 'Interação com professores'],
  },
  {
    area: 'Desenvolvimento motor',
    indicadores: ['Coordenação motora'],
  },
];

export const pdiNivelOptions = [
  { value: 1, label: 'Necessita de apoio intenso' },
  { value: 2, label: 'Necessita de apoio frequente' },
  { value: 3, label: 'Realiza com apoio' },
  { value: 4, label: 'Realiza com pouca ajuda' },
  { value: 5, label: 'Realiza de forma autônoma' },
];

export const metaStatusOptions = [
  { value: 'nao_iniciada', label: 'Não iniciada' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'revisar', label: 'Revisar' },
];

export const alunoStatusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'arquivado', label: 'Arquivado' },
];

export const perguntaTipoOptions = [
  { value: 'escala', label: 'Escala' },
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'texto', label: 'Texto' },
];

export const perguntaStatusOptions = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
];

export const formatDate = (date) => {
  if (!date) return 'Sem registro';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

export const pdiTrend = (acompanhamentos) => {
  const sorted = [...acompanhamentos].sort((a, b) => new Date(a.data) - new Date(b.data));
  if (sorted.length < 2) return { key: 'estavel', label: '→ Estável', shortLabel: '→', tone: 'slate' };

  const recent = sorted.slice(-3);
  const first = Number(recent[0].nivelObservado ?? recent[0].resposta);
  const last = Number(recent[recent.length - 1].nivelObservado ?? recent[recent.length - 1].resposta);

  if (last > first) return { key: 'evolucao', label: '↑ Evolução', shortLabel: '↑', tone: 'emerald' };
  if (last < first) return { key: 'atencao', label: '↓ Atenção', shortLabel: '↓', tone: 'red' };
  return { key: 'estavel', label: '→ Estável', shortLabel: '→', tone: 'slate' };
};

export const latestAcompanhamento = (acompanhamentos) => {
  if (!acompanhamentos.length) return null;
  return [...acompanhamentos].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
};

export const pdiSummary = (alunos, metas, acompanhamentos) => {
  const activeStudents = alunos.filter(aluno => aluno.status !== 'arquivado');
  const trends = activeStudents.map(aluno => pdiTrend(acompanhamentos.filter(item => item.alunoId === aluno.id)).key);

  return {
    totalAlunos: activeStudents.length,
    alunosEvolucao: trends.filter(item => item === 'evolucao').length,
    alunosEstaveis: trends.filter(item => item === 'estavel').length,
    alunosAtencao: trends.filter(item => item === 'atencao').length,
    totalMetas: metas.filter(meta => activeStudents.some(aluno => aluno.id === meta.alunoId)).length,
    acompanhamentosRecentes: [...acompanhamentos]
      .filter(item => activeStudents.some(aluno => aluno.id === item.alunoId))
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 5),
  };
};
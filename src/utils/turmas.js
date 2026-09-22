// Estrutura e regras de Turmas (Educação Infantil + Ensino Fundamental, período regular).
// Integral fica de fora do escopo — não faz parte do módulo PDI nesta etapa (ver GestaoTurmas.jsx).
export const ETAPAS = [
  { value: 'fundamental', label: 'Ensino Fundamental' },
  { value: 'educacao_infantil', label: 'Educação Infantil' },
];

export const TURNOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
];

export const ANOS_FUNDAMENTAL = Array.from({ length: 9 }, (_, index) => ({ value: index + 1, label: `${index + 1}º ano` }));

export const SEGMENTOS_INFANTIL = [
  {
    value: 'creche',
    label: 'Creche',
    niveis: [
      { value: 'bercario_1', label: 'Berçário I' },
      { value: 'bercario_2', label: 'Berçário II' },
      { value: 'maternal_1', label: 'Maternal I' },
      { value: 'maternal_2', label: 'Maternal II' },
    ],
  },
  {
    value: 'pre_escola',
    label: 'Pré-escola',
    niveis: [
      { value: 'pre_1', label: 'Pré I' },
      { value: 'pre_2', label: 'Pré II' },
    ],
  },
];

export const etapaLabel = (etapa) => ETAPAS.find(item => item.value === etapa)?.label || 'Não informado';
export const turnoLabel = (turno) => TURNOS.find(item => item.value === turno)?.label || 'Turno não informado';
export const segmentoLabel = (segmento) => SEGMENTOS_INFANTIL.find(item => item.value === segmento)?.label || 'Não informado';
export const nivelLabel = (segmento, nivel) => SEGMENTOS_INFANTIL.find(item => item.value === segmento)?.niveis.find(item => item.value === nivel)?.label || 'Não informado';
export const niveisDoSegmento = (segmento) => SEGMENTOS_INFANTIL.find(item => item.value === segmento)?.niveis || [];

// Nome de exibição gerado automaticamente — a Secretaria nunca digita "6T5" à mão.
// Fundamental: <anoSerie><M|T><identificador>, ex.: 6 + tarde + 5 -> "6T5".
// Educação Infantil: "<nível> [identificador, se > 1] — <turno>", ex.: "Maternal II — Manhã".
export const nomeTurma = (payload) => {
  if (payload.etapa === 'fundamental') {
    const turnoLetra = payload.turno === 'manha' ? 'M' : 'T';
    return `${payload.anoSerie}${turnoLetra}${payload.identificador}`;
  }
  if (payload.etapa === 'educacao_infantil') {
    const nivel = nivelLabel(payload.segmento, payload.nivel);
    const sufixo = Number(payload.identificador) > 1 ? ` ${payload.identificador}` : '';
    return `${nivel}${sufixo} — ${turnoLabel(payload.turno)}`;
  }
  return '';
};

// Descrição curta para listagem — nunca lota o card com campos técnicos. Turmas legadas sem
// turno definido (ver migração em mockData.js) mostram "Turno não informado" em vez de quebrar.
export const descricaoTurma = (turma) => {
  if (turma.etapa === 'educacao_infantil') {
    return `Educação Infantil • ${segmentoLabel(turma.segmento)}`;
  }
  const partes = ['Ensino Fundamental'];
  if (turma.anoSerie) partes.push(`${turma.anoSerie}º ano`);
  partes.push(turma.turno ? turnoLabel(turma.turno) : 'Turno não informado');
  return partes.join(' • ');
};

// Duas turmas são a mesma "vaga histórica" quando coincidem escola + ano letivo + identidade
// pedagógica (série ou segmento/nível) + turno + identificador — INDEPENDENTE do status. Uma
// turma inativada continua sendo o registro histórico daquela identidade: ela NÃO libera a
// combinação para um novo cadastro (ver seção 1/2 do pedido de correção). Quem já usa aquela
// identidade e está inativo deve ser reativado, nunca duplicado.
export const turmaConflitante = (turmasExistentes, payload, ignorarId = null) => {
  const candidatas = turmasExistentes.filter(turma => turma.id !== ignorarId);
  if (payload.etapa === 'fundamental') {
    return candidatas.find(turma => (
      turma.etapa === 'fundamental'
      && Number(turma.escolaId) === Number(payload.escolaId)
      && Number(turma.anoLetivo) === Number(payload.anoLetivo)
      && Number(turma.anoSerie) === Number(payload.anoSerie)
      && turma.turno === payload.turno
      && Number(turma.identificador) === Number(payload.identificador)
    )) || null;
  }
  if (payload.etapa === 'educacao_infantil') {
    return candidatas.find(turma => (
      turma.etapa === 'educacao_infantil'
      && Number(turma.escolaId) === Number(payload.escolaId)
      && Number(turma.anoLetivo) === Number(payload.anoLetivo)
      && turma.segmento === payload.segmento
      && turma.nivel === payload.nivel
      && turma.turno === payload.turno
      && Number(turma.identificador) === Number(payload.identificador)
    )) || null;
  }
  return null;
};

export const turmaDuplicada = (turmasExistentes, payload, ignorarId = null) => !!turmaConflitante(turmasExistentes, payload, ignorarId);

// Vínculos ativos de uma turma nos três pontos do sistema que hoje dependem de `turmaId`
// (ver CLAUDE.md / pedido de Gestão de Turmas). Usado só para avisar a Secretaria — nunca para
// bloquear ou cascatear exclusão (inativar turma nunca apaga nada disso).
export const vinculosDaTurma = (turmaId, { turmaProfessores, pdiAlunos, pdiAuxiliaresVinculos }) => {
  const id = Number(turmaId);
  const professores = turmaProfessores.filter(vinculo => vinculo.turmaId === id && vinculo.status === 'ativo').length;
  const alunos = pdiAlunos.filter(aluno => aluno.turmaId === id && aluno.status === 'ativo').length;
  const auxiliar = pdiAuxiliaresVinculos.filter(vinculo => vinculo.turmaId === id && vinculo.status === 'ativo').length;
  return { professores, alunos, auxiliar, total: professores + alunos + auxiliar };
};

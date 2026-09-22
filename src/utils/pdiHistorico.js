// Autoria/histórico de preenchimento do Formulário PDI trimestral. Granularidade: um evento
// por ENVIO do formulário (não por pergunta) — quem preencheu, quando, e se foi o primeiro
// preenchimento ou uma edição. Professor e Supervisora que editam o mesmo aluno/período
// compartilham este histórico (nunca um registro paralelo por perfil).
export const ACOES_PDI = {
  PREENCHIMENTO_INICIAL: 'preenchimento_inicial',
  EDICAO: 'edicao',
};

export const ACAO_PDI_LABEL = {
  [ACOES_PDI.PREENCHIMENTO_INICIAL]: 'Preenchimento inicial',
  [ACOES_PDI.EDICAO]: 'Edição',
};

// Todos os eventos de um aluno/professor/trimestre específico, do mais antigo para o mais
// recente (professorId aqui é sempre o "professor responsável" do aluno — ver aluno.professorId
// — mesmo quando quem preencheu foi a Supervisora, para nunca criar um histórico paralelo).
export const eventosPreenchimentoPdi = (historico, alunoId, professorId, trimestre) => historico
  .filter(item => item.alunoId === Number(alunoId) && item.professorId === Number(professorId) && item.trimestre === trimestre)
  .sort((left, right) => new Date(left.dataHora) - new Date(right.dataHora));

// { inicial, ultima } — null quando ainda não há nenhum preenchimento para esse período.
export const autoriaPdi = (historico, alunoId, professorId, trimestre) => {
  const eventos = eventosPreenchimentoPdi(historico, alunoId, professorId, trimestre);
  if (!eventos.length) return null;
  return { inicial: eventos[0], ultima: eventos[eventos.length - 1], eventos };
};

// Nome + rótulo de perfil de quem executou um evento (usuarioTipo é sempre 'professor' ou
// 'gestor' — os únicos perfis autorizados a preencher/editar PDI).
export const autorLabel = (evento, { professores, gestores }) => {
  if (evento.usuarioTipo === 'professor') {
    return { nome: professores.find(item => item.id === evento.usuarioId)?.nome || 'Professor não encontrado', perfil: 'Professor' };
  }
  const gestor = gestores.find(item => item.id === evento.usuarioId);
  return { nome: gestor?.nome || 'Gestor não encontrado', perfil: gestor?.cargo || 'Gestor' };
};

// Autoria/histórico da FICHA (aplicação + disciplina + aluno) do PDI por disciplina — mesmo
// princípio de eventosPreenchimentoPdi/autoriaPdi acima, só que a identidade agora é a ficha
// (nunca mais aluno+professor+trimestre, que não distingue aplicações diferentes nem
// disciplinas diferentes do mesmo aluno). Ver src/utils/pdiFichas.js e FormularioPdiProfessor.jsx.
export const eventosPreenchimentoFicha = (historico, aplicacaoId, disciplinaId, alunoId) => historico
  .filter(item => item.aplicacaoId === Number(aplicacaoId) && item.disciplinaId === Number(disciplinaId) && item.alunoId === Number(alunoId))
  .sort((left, right) => new Date(left.dataHora) - new Date(right.dataHora));

export const autoriaFicha = (historico, aplicacaoId, disciplinaId, alunoId) => {
  const eventos = eventosPreenchimentoFicha(historico, aplicacaoId, disciplinaId, alunoId);
  if (!eventos.length) return null;
  return { inicial: eventos[0], ultima: eventos[eventos.length - 1], eventos };
};

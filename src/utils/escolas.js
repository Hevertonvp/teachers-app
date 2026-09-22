import { isDiretora, isGestor, isProfessor, isSecretaria } from './roles';

// Escolas que o usuário pode acessar. Secretaria retorna null (sentinela = todas as escolas,
// inclusive inativas, para consulta histórica). Professor/Supervisor: só vínculos com status 'ativo'.
export const getUserEscolaIds = (user, vinculosEscolares) => {
  if (isSecretaria(user)) return null;

  const usuarioTipo = isProfessor(user) ? 'professor' : isDiretora(user) ? 'diretora' : 'gestor';
  return vinculosEscolares
    .filter(vinculo => vinculo.usuarioTipo === usuarioTipo && vinculo.usuarioId === user?.id && vinculo.status === 'ativo')
    .map(vinculo => vinculo.escolaId);
};

// Secretaria sempre acessa (inclusive escolas inativas, para histórico).
// Professor/Supervisor só acessam escolas ativas às quais estão vinculados no momento.
// Desvincular ou desativar a escola bloqueia o acesso daqui para frente, sem apagar dados.
export const canAccessEscola = (user, escolaId, { escolas, vinculosEscolares }) => {
  if (isSecretaria(user)) return true;

  const escola = escolas.find(item => item.id === Number(escolaId));
  if (!escola || escola.status !== 'ativa') return false;

  const userEscolaIds = getUserEscolaIds(user, vinculosEscolares);
  return userEscolaIds.includes(Number(escolaId));
};

// Vínculo do Gestor/Supervisor(a) com a escola, SEM considerar o status da escola — diferente
// de canAccessEscola, que bloqueia integralmente escolas inativas. Usado no módulo PDI para
// permitir consulta histórica de escolas inativas vinculadas (a edição continua sendo
// bloqueada separadamente, checando `escola.status === 'ativa'` onde a ação é executada).
export const gestorVinculadoEscola = (user, escolaId, { vinculosEscolares }) => {
  if (!isGestor(user)) return false;
  return vinculosEscolares.some(vinculo => (
    vinculo.usuarioTipo === 'gestor' && vinculo.usuarioId === user.id && vinculo.escolaId === Number(escolaId) && vinculo.status === 'ativo'
  ));
};

// Filtra uma lista de registros com `escolaId` pela escola ativa.
// escolaId === null só significa "não filtrar" para a Secretaria (modo agregado "Todas as
// escolas"). Para Professor/Supervisor, null significa "nenhuma escola disponível" — e não
// deve nunca "vazar" os dados de todas as escolas, então retorna lista vazia.
export const filterByEscola = (items, escolaId, user) => {
  if (escolaId === null) return isSecretaria(user) ? items : [];
  return items.filter(item => item.escolaId === escolaId);
};

export const professoresDaEscola = (professores, vinculosEscolares, escolaId, user) => {
  if (escolaId === null) return isSecretaria(user) ? professores : [];
  const ids = vinculosEscolares.filter(v => v.usuarioTipo === 'professor' && v.escolaId === escolaId && v.status === 'ativo').map(v => v.usuarioId);
  return professores.filter(professor => ids.includes(professor.id));
};

export const gestoresDaEscola = (gestores, vinculosEscolares, escolaId, user) => {
  if (escolaId === null) return isSecretaria(user) ? gestores : [];
  const ids = vinculosEscolares.filter(v => v.usuarioTipo === 'gestor' && v.escolaId === escolaId && v.status === 'ativo').map(v => v.usuarioId);
  return gestores.filter(gestor => ids.includes(gestor.id));
};

// Turmas em que um professor leciona, a partir da relação normalizada `turmaProfessores`
// (fonte única do vínculo turma<->professor, ver mockData.js). Só vínculos ATIVOS contam — um
// vínculo encerrado (professor que saiu da turma) não deve mais aparecer aqui.
export const turmasDoProfessor = (turmas, turmaProfessores, professorId) => {
  const turmaIds = new Set(turmaProfessores.filter(vinculo => vinculo.professorId === professorId && vinculo.status === 'ativo').map(vinculo => vinculo.turmaId));
  return turmas.filter(turma => turmaIds.has(turma.id));
};

// Professores (+ disciplina) vinculados ATIVAMENTE a uma turma, direto de `turmaProfessores` —
// mesma fonte única usada por `turmasDoProfessor`, sem cadastro manual paralelo. Usado para
// derivar automaticamente "professores do aluno" a partir da turma (cadastro de aluno e Anamnese).
export const professoresDaTurma = (turmaProfessores, professores, disciplinas, turmaId) => turmaProfessores
  .filter(vinculo => vinculo.turmaId === turmaId && vinculo.status === 'ativo')
  .map(vinculo => ({
    professorId: vinculo.professorId,
    professor: professores.find(item => item.id === vinculo.professorId),
    disciplinaId: vinculo.disciplinaId,
    disciplina: disciplinas.find(item => item.id === vinculo.disciplinaId),
  }));

export const diretoresDaEscola = (diretores, vinculosEscolares, escolaId, user) => {
  if (escolaId === null) return isSecretaria(user) ? diretores : [];
  const ids = vinculosEscolares.filter(v => v.usuarioTipo === 'diretora' && v.escolaId === escolaId && v.status === 'ativo').map(v => v.usuarioId);
  return diretores.filter(diretor => ids.includes(diretor.id));
};

export const countProfissionaisDaEscola = (vinculosEscolares, escolaId) => new Set(
  vinculosEscolares
    .filter(vinculo => vinculo.escolaId === escolaId && vinculo.status === 'ativo')
    .map(vinculo => `${vinculo.usuarioTipo}:${vinculo.usuarioId}`),
).size;

// Mesmo critério de "concluído" usado por formCompletionStats (utils/formAvailability.js),
// para os números do card e as listas deste modal nunca divergirem.
const DELIVERED_STATUSES = ['concluido', 'concluído'];

// Divide os professores de uma escola entre quem já preencheu um instrumento e quem não
// preencheu, a partir dos registros (já filtrados por escola) daquele instrumento.
export const professoresPorPreenchimento = (professoresDaEscola, records) => {
  const idsQuePreencheram = new Set(records.filter(record => DELIVERED_STATUSES.includes(record.status)).map(record => record.professorId));
  return {
    preencheram: professoresDaEscola.filter(professor => idsQuePreencheram.has(professor.id)),
    pendentes: professoresDaEscola.filter(professor => !idsQuePreencheram.has(professor.id)),
  };
};

const COMPLETED_STATUSES = ['concluido', 'concluído'];
const percentageComplete = (items) => {
  if (!items.length) return 0;
  return Math.round((items.filter(item => COMPLETED_STATUSES.includes(item.status)).length / items.length) * 100);
};

// Resumo agregado de UMA escola (nunca de uma pessoa) — base do painel "Escolas da Rede"
// da Secretaria. Reaproveita os mesmos dados/campos já usados nos outros dashboards,
// só muda o eixo de agrupamento de professorId para escolaId.
export const resumoEscola = (escola, { turmas, formularios, pdis, correcoes, vinculosEscolares }) => {
  const turmasDaEscola = turmas.filter(turma => turma.escolaId === escola.id);
  const totalAlunos = turmasDaEscola.reduce((total, turma) => total + (turma.quantidadeAlunos || 0), 0);
  const totalProfissionais = countProfissionaisDaEscola(vinculosEscolares, escola.id);

  return {
    id: escola.id,
    escola,
    totalTurmas: turmasDaEscola.length,
    totalAlunos,
    totalProfissionais,
    formulario: percentageComplete(formularios.filter(item => item.escolaId === escola.id)),
    pdi: percentageComplete(pdis.filter(item => item.escolaId === escola.id)),
    correcoes: percentageComplete(correcoes.filter(item => item.escolaId === escola.id)),
  };
};

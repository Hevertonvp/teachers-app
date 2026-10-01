// Papéis de usuário e capacidades centralizadas.
// 'supervisor' ainda não existe como tipo de usuário próprio: reservado para expansão futura
// (hoje 'gestor' representa esse papel).
export const ROLES = {
  PROFESSOR: 'professor',
  GESTOR: 'gestor',
  DIRETORA: 'diretora',
  SECRETARIA: 'secretaria',
  AUXILIAR: 'auxiliar',
};

export const isProfessor = (user) => user?.tipo === ROLES.PROFESSOR;
export const isGestor = (user) => user?.tipo === ROLES.GESTOR;
export const isDiretora = (user) => user?.tipo === ROLES.DIRETORA;
export const isSecretaria = (user) => user?.tipo === ROLES.SECRETARIA;
// Auxiliar de Aprendizagem: perfil próprio, sem as capacidades de professor/gestor/diretora/
// secretaria abaixo — acompanha alunos específicos (ver utils/auxiliares.js), sem gerenciar
// nada. Não herda nenhuma das capacidades listadas a seguir.
export const isAuxiliar = (user) => user?.tipo === ROLES.AUXILIAR;

// --- Capacidades específicas ---
// Cada capacidade lista explicitamente quem a possui. Nenhuma é herdada por pertencer
// a um grupo genérico de "gestão" — Secretaria e Supervisor têm permissões distintas,
// ainda que, hoje, coincidam em algumas capacidades.

// Gerenciar PDI, Formulário 1/3 e Correções (criar, editar, excluir).
// O escopo (em quais escolas isso vale) é resolvido à parte, fora deste módulo.
const PEDAGOGICO_MANAGE_ROLES = [ROLES.GESTOR, ROLES.SECRETARIA];
export const canManagePedagogico = (user) => PEDAGOGICO_MANAGE_ROLES.includes(user?.tipo);

// Consultar (nunca criar/editar/arquivar) a listagem real de Alunos PDI — Diretora ganhou este
// acesso de leitura, escopado às próprias escolas, quando Aluno PDI virou real (backend já
// aplica a mesma restrição; aqui é só o gate de UI). Deliberadamente mais estreita que
// canManagePedagogico, que continua sendo só Gestor/Secretaria.
export const canViewPdiAlunos = (user) => canManagePedagogico(user) || isDiretora(user);

// Consultar (nunca criar/editar/reabrir) a área real de Aplicações PDI — Gestor perde a gestão
// que tinha sobre Aplicações mock (correção explícita pedida na migração de Aplicações/
// Reaberturas PDI para o backend: só a Secretaria administra) e Diretora ganha acesso de
// leitura, escopado às próprias escolas (backend aplica a mesma restrição; aqui é só o gate de
// UI). Modelo PDI continua exclusivo da Secretaria — ver isSecretaria direto em FormularioPdiPage.
export const canViewAplicacoesPdi = (user) => isSecretaria(user) || isGestor(user) || isDiretora(user);

// Preencher (não gerenciar) os instrumentos pedagógicos — papel do Professor.
export const canFillPedagogico = (user) => isProfessor(user);

// Acompanhar professores (entregas e pendências).
const ACOMPANHAR_PROFESSORES_ROLES = [ROLES.GESTOR];
export const canAcompanharProfessores = (user) => ACOMPANHAR_PROFESSORES_ROLES.includes(user?.tipo);

// Exclusivas da Secretaria.
export const canManageEscolas = (user) => isSecretaria(user);
export const canManageVinculos = (user) => isSecretaria(user);
export const canViewIndicadoresRede = (user) => isSecretaria(user);
export const canViewIndicadoresDiretora = (user) => isDiretora(user);
export const canViewSupervisoras = (user) => isDiretora(user);

// Administração cadastral de pessoas (professores, supervisores, diretores): criar, editar,
// ativar/inativar. Distinta de canAcompanharProfessores (que é acompanhamento/monitoramento,
// compartilhado com Supervisor) — Secretaria não vira "supervisor com mais permissão".
// Continua exclusiva da Secretaria: é quem controla as abas Supervisores(as)/Diretores(as) em
// Gestão de Pessoas. A Diretora NUNCA cria/edita Supervisor ou Diretora, só Professor — ver
// canManageProfessores abaixo, que é mais estreita.
export const canManagePessoas = (user) => isSecretaria(user);

// Cadastro real de Professor (conta autenticável, backend) — Secretaria em qualquer escola da
// rede; Diretora só nas escolas onde tem vínculo ativo (checado de verdade no backend, nunca só
// aqui). Deliberadamente mais estreita que canManagePessoas: não dá acesso a Supervisores/
// Diretores.
export const canManageProfessores = (user) => isSecretaria(user) || isDiretora(user);

// Gestão de Turmas (criar/editar/inativar) — exclusiva da Secretaria, não herdada por
// canManagePedagogico (Gestor não cria/edita turma, só usa as que a Secretaria cadastrou).
export const canManageTurmas = (user) => isSecretaria(user);

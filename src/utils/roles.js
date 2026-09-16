// Papéis de usuário e capacidades centralizadas.
// 'supervisor' ainda não existe como tipo de usuário próprio: reservado para expansão futura
// (hoje 'gestor' representa esse papel).
export const ROLES = {
  PROFESSOR: 'professor',
  GESTOR: 'gestor',
  DIRETORA: 'diretora',
  SECRETARIA: 'secretaria',
};

export const isProfessor = (user) => user?.tipo === ROLES.PROFESSOR;
export const isGestor = (user) => user?.tipo === ROLES.GESTOR;
export const isDiretora = (user) => user?.tipo === ROLES.DIRETORA;
export const isSecretaria = (user) => user?.tipo === ROLES.SECRETARIA;

// --- Capacidades específicas ---
// Cada capacidade lista explicitamente quem a possui. Nenhuma é herdada por pertencer
// a um grupo genérico de "gestão" — Secretaria e Supervisor têm permissões distintas,
// ainda que, hoje, coincidam em algumas capacidades.

// Gerenciar PDI, Formulário 1/3 e Correções (criar, editar, excluir).
// O escopo (em quais escolas isso vale) é resolvido à parte, fora deste módulo.
const PEDAGOGICO_MANAGE_ROLES = [ROLES.GESTOR, ROLES.SECRETARIA];
export const canManagePedagogico = (user) => PEDAGOGICO_MANAGE_ROLES.includes(user?.tipo);

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
export const canManagePessoas = (user) => isSecretaria(user);

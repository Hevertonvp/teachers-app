/** Erros de domínio mapeados para status HTTP no middleware de erro (ver api/app.ts). */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Autenticado, mas sem permissão para a ação (perfil errado, fora do escopo de escola). Distinto
// de UnauthorizedError (401, sessão inválida/ausente) — este é sempre 403.
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// 403 com um código de máquina — o frontend usa `codigo` pra redirecionar direto pra "criar
// senha", em vez de só mostrar um erro genérico (ver services/api.js).
export class SenhaTemporariaPendenteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SenhaTemporariaPendenteError';
  }
}

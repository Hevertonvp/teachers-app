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

// 400 com código de máquina: a criação de uma Aplicação PDI esbarrou no calendário de trimestres
// (incompleto, inválido ou data fora de todo trimestre) — o frontend usa `codigo` pra oferecer o
// atalho direto pra Configurações > Trimestres (ver domain/trimestres.ts).
export class CalendarioTrimestresError extends Error {
  codigo: 'CALENDARIO_TRIMESTRES_INCOMPLETO' | 'CALENDARIO_TRIMESTRES_INVALIDO' | 'DATA_FORA_DO_CALENDARIO';
  constructor(message: string, codigo: CalendarioTrimestresError['codigo']) {
    super(message);
    this.name = 'CalendarioTrimestresError';
    this.codigo = codigo;
  }
}

// 409 com código de máquina (infraestrutura offline/conflito — ver api/app.ts): o cliente enviou
// `baseUpdatedAt`/`baseVersion` desatualizado — alguém (ou outra aba/dispositivo do mesmo usuário)
// já salvou uma versão mais nova deste recurso enquanto este estava offline/editando. NUNCA
// sobrescreve — o frontend usa `dadosAtuais` para mostrar o conflito e preservar o rascunho local,
// nunca um segundo round-trip só para buscar o estado atual.
export class ConflitoVersaoError extends Error {
  dadosAtuais: unknown;
  constructor(message: string, dadosAtuais: unknown) {
    super(message);
    this.name = 'ConflitoVersaoError';
    this.dadosAtuais = dadosAtuais;
  }
}

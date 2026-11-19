import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../domain/errors.js';
import { pdiSoSecretaria } from '../../config/modulos.js';

// Montado nas rotas do PDI (19/11/2026). Ver config/modulos.ts. GET passa sempre (só leitura).
export function bloquearPdiEmDesenvolvimento(req: Request, res: Response, next: NextFunction) {
  if (!pdiSoSecretaria() || req.method === 'GET') return next();
  const perfil = (res.locals.pessoa as { perfil?: string } | undefined)?.perfil;
  if (perfil !== 'SECRETARIA') return next(new ForbiddenError('O PDI está em desenvolvimento.'));
  // Devolver ao Professor: ele ainda não tem acesso ao PDI. A correção direta continua.
  if (req.baseUrl === '/api/correcoes-pdi' && /\/devolver(-padrao)?\/?$/.test(req.path)) {
    return next(new ForbiddenError('O PDI está em desenvolvimento: use a correção direta.'));
  }
  return next();
}

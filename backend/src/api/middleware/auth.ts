import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../domain/errors.js';

export interface TokenPayload {
  sub: string; // id da Pessoa
  perfil: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  }
  return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Autenticação necessária. Faça login para continuar.');
  }

  try {
    const payload = jwt.verify(header.slice(7), getJwtSecret()) as TokenPayload;
    res.locals.pessoa = { id: Number(payload.sub), perfil: payload.perfil };
  } catch {
    throw new UnauthorizedError('Sessão inválida ou expirada. Faça login novamente.');
  }
  next();
}

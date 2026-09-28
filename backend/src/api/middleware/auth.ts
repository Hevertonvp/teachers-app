import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { SenhaTemporariaPendenteError, UnauthorizedError } from '../../domain/errors.js';

export interface TokenPayload {
  sub: string; // id da Pessoa
  perfil: string;
  authVersion: number;
}

export interface PessoaAutenticada {
  id: number;
  perfil: string;
  senhaTemporaria: boolean;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).');
  }
  return secret;
}

export function assinarToken(pessoa: { id: number; perfil: string; authVersion: number }): string {
  return jwt.sign({ perfil: pessoa.perfil, authVersion: pessoa.authVersion }, getJwtSecret(), {
    subject: String(pessoa.id),
    expiresIn: '12h',
  });
}

// Verifica o JWT E reconfere no banco a cada requisição (pessoa existe, está ATIVO, e a versão
// de autenticação do token ainda bate com a atual) — sem isso, trocar/resetar senha ou inativar
// uma conta não invalidaria sessões já abertas até o token expirar sozinho (12h). Aceito consultar
// o banco a cada request dado o volume de usuários deste sistema (ver decisão de autenticação).
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Autenticação necessária. Faça login para continuar.');
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), getJwtSecret()) as TokenPayload;
  } catch {
    throw new UnauthorizedError('Sessão inválida ou expirada. Faça login novamente.');
  }

  const pessoa = await prisma.pessoa.findUnique({ where: { id: Number(payload.sub) } });
  if (!pessoa || pessoa.status !== 'ATIVO' || pessoa.authVersion !== payload.authVersion) {
    throw new UnauthorizedError('Sessão inválida ou expirada. Faça login novamente.');
  }

  res.locals.pessoa = { id: pessoa.id, perfil: pessoa.perfil, senhaTemporaria: pessoa.senhaTemporaria } satisfies PessoaAutenticada;
  next();
}

// Bloqueia qualquer rota normal enquanto a pessoa ainda não trocou a senha temporária — inclusive
// por chamada direta à API, não só navegação (ver POST /api/auth/trocar-senha, a única rota
// autenticada que fica de fora deste bloqueio).
export function bloquearSenhaTemporariaPendente(req: Request, res: Response, next: NextFunction) {
  const pessoa = res.locals.pessoa as PessoaAutenticada;
  if (pessoa.senhaTemporaria) {
    throw new SenhaTemporariaPendenteError('Você precisa definir uma nova senha antes de continuar.');
  }
  next();
}

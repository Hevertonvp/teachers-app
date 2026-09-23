import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { UnauthorizedError } from '../../domain/errors.js';
import { getJwtSecret } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().min(1, 'E-mail é obrigatório.'),
  senha: z.string().min(1, 'Senha é obrigatória.'),
});

// Hash válido de uma senha qualquer, usado só para gastar o mesmo tempo de bcrypt quando o e-mail
// não existe — evita distinguir "e-mail inexistente" de "senha errada" pelo tempo de resposta.
const HASH_FALSO = bcrypt.hashSync('senha-inexistente', 10);

authRouter.post('/login', async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);

  const pessoa = await prisma.pessoa.findUnique({ where: { email: email.toLowerCase() } });
  const senhaConfere = await bcrypt.compare(senha, pessoa?.senhaHash ?? HASH_FALSO);

  if (!pessoa || !pessoa.senhaHash || !senhaConfere || pessoa.status !== 'ATIVO') {
    throw new UnauthorizedError('E-mail ou senha incorretos.');
  }

  const token = jwt.sign({ perfil: pessoa.perfil }, getJwtSecret(), {
    subject: String(pessoa.id),
    expiresIn: '12h',
  });

  res.json({
    token,
    pessoa: { id: pessoa.id, nome: pessoa.nome, email: pessoa.email, cargo: pessoa.cargo, perfil: pessoa.perfil },
  });
});

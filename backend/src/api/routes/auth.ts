import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { UnauthorizedError, ValidationError } from '../../domain/errors.js';
import { assinarToken } from '../middleware/auth.js';

// /login é pública. /trocar-senha exige autenticação, mas fica de fora do bloqueio de "senha
// temporária pendente" — é exatamente a rota que resolve esse estado (ver api/app.ts pra ordem
// de montagem dos dois routers).
export const authRouter = Router();
export const authProtectedRouter = Router();

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

  if (pessoa.senhaTemporaria && pessoa.senhaTemporariaExpiraEm && pessoa.senhaTemporariaExpiraEm < new Date()) {
    throw new UnauthorizedError('Sua senha temporária expirou. Solicite uma nova senha à Secretaria ou à Diretora da sua escola.');
  }

  const token = assinarToken(pessoa);

  res.json({
    token,
    pessoa: {
      id: pessoa.id,
      nome: pessoa.nome,
      email: pessoa.email,
      cargo: pessoa.cargo,
      perfil: pessoa.perfil,
      senhaTemporaria: pessoa.senhaTemporaria,
    },
  });
});

const trocarSenhaSchema = z.object({
  novaSenha: z.string().min(8, 'A nova senha precisa ter pelo menos 8 caracteres.'),
  confirmarNovaSenha: z.string().min(8, 'Confirme a nova senha.'),
});

// Só funciona enquanto a conta está com senha temporária pendente (fluxo de primeiro acesso) —
// não é (ainda) uma troca de senha voluntária de conta já normalizada.
authProtectedRouter.post('/trocar-senha', async (req, res) => {
  const { novaSenha, confirmarNovaSenha } = trocarSenhaSchema.parse(req.body);
  if (novaSenha !== confirmarNovaSenha) throw new ValidationError('As senhas não coincidem.');

  const pessoaId = res.locals.pessoa.id;
  const pessoa = await prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaId } });
  if (!pessoa.senhaTemporaria) throw new ValidationError('Esta conta não está com senha temporária pendente.');

  const senhaHash = await bcrypt.hash(novaSenha, 10);

  const atualizado = await prisma.$transaction(async (tx) => {
    const pessoaAtualizada = await tx.pessoa.update({
      where: { id: pessoaId },
      data: { senhaHash, senhaTemporaria: false, senhaTemporariaExpiraEm: null, authVersion: { increment: 1 } },
    });
    await tx.pessoaEvento.create({
      data: { pessoaId, tipo: 'PRIMEIRO_ACESSO_CONCLUIDO', autorId: pessoaId },
    });
    return pessoaAtualizada;
  });

  // O token antigo (usado nesta própria requisição) acabou de virar inválido, porque authVersion
  // mudou — por isso devolvemos um novo, já refletindo a versão atual.
  res.json({ token: assinarToken(atualizado) });
});

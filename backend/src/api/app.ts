import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError, SenhaTemporariaPendenteError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { bloquearSenhaTemporariaPendente, requireAuth } from './middleware/auth.js';
import { authProtectedRouter, authRouter } from './routes/auth.js';
import { escolasRouter } from './routes/escolas.js';
import { escolaModulosRouter } from './routes/escolaModulos.js';
import { disciplinasRouter } from './routes/disciplinas.js';
import { turmasRouter } from './routes/turmas.js';
import { pessoasRouter } from './routes/pessoas.js';
import { professorTurmaDisciplinaRouter } from './routes/professorTurmaDisciplina.js';
import { auxiliarTurmaRouter } from './routes/auxiliarTurma.js';

export function createApp() {
  const app = express();

  // CORS só para desenvolvimento local do frontend Vite — em produção, trocar por uma política
  // com a origem real (domínio do Vercel), nunca aberto irrestrito.
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);

  // Tudo abaixo exige JWT válido. /health e /api/auth/login são as únicas rotas públicas.
  app.use('/api', requireAuth);

  // /api/auth/trocar-senha precisa de autenticação, mas é a própria rota que resolve o estado de
  // "senha temporária pendente" — por isso fica montada antes do bloqueio abaixo, não depois.
  app.use('/api/auth', authProtectedRouter);

  // Enquanto a pessoa não trocar a senha temporária, nenhuma rota normal responde — nem por
  // chamada direta à API (ver seção 9 do pedido de autenticação).
  app.use('/api', bloquearSenhaTemporariaPendente);

  app.use('/api/escolas', escolasRouter);
  app.use('/api/escolas', escolaModulosRouter); // /api/escolas/:escolaId/modulos/...
  app.use('/api/disciplinas', disciplinasRouter);
  app.use('/api/turmas', turmasRouter);
  app.use('/api/pessoas', pessoasRouter);
  app.use('/api/professor-turma-disciplina', professorTurmaDisciplinaRouter);
  app.use('/api/auxiliar-turma', auxiliarTurmaRouter);

  app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));

  // Middleware de erro centralizado — mapeia os erros de domínio para status HTTP consistentes
  // em todos os endpoints, em vez de cada rota tratar isso individualmente.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Dados inválidos.', detalhes: err.issues });
    }
    if (err instanceof UnauthorizedError) return res.status(401).json({ message: err.message });
    if (err instanceof SenhaTemporariaPendenteError) return res.status(403).json({ message: err.message, codigo: 'SENHA_TEMPORARIA_PENDENTE' });
    if (err instanceof ForbiddenError) return res.status(403).json({ message: err.message });
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ message: err.message });

    console.error(err);
    return res.status(500).json({ message: 'Erro interno inesperado.' });
  });

  return app;
}

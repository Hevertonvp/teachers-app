import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../domain/errors.js';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { escolasRouter } from './routes/escolas.js';
import { escolaModulosRouter } from './routes/escolaModulos.js';
import { disciplinasRouter } from './routes/disciplinas.js';
import { turmasRouter } from './routes/turmas.js';

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
  app.use('/api/escolas', escolasRouter);
  app.use('/api/escolas', escolaModulosRouter); // /api/escolas/:escolaId/modulos/...
  app.use('/api/disciplinas', disciplinasRouter);
  app.use('/api/turmas', turmasRouter);

  app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));

  // Middleware de erro centralizado — mapeia os erros de domínio para status HTTP consistentes
  // em todos os endpoints, em vez de cada rota tratar isso individualmente.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Dados inválidos.', detalhes: err.issues });
    }
    if (err instanceof UnauthorizedError) return res.status(401).json({ message: err.message });
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ message: err.message });

    console.error(err);
    return res.status(500).json({ message: 'Erro interno inesperado.' });
  });

  return app;
}

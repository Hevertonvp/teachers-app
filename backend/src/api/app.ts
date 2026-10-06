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
import { vinculosEscolaresRouter } from './routes/vinculosEscolares.js';
import { pdiAlunosRouter } from './routes/pdiAlunos.js';
import { pdiModelosRouter, pdiPerguntasRouter } from './routes/pdiModelos.js';
import { pdiPerguntasPadraoRouter } from './routes/pdiPerguntasPadrao.js';
import { pdiAplicacoesRouter } from './routes/pdiAplicacoes.js';
import { pdiFichasRouter } from './routes/pdiFichas.js';
import { pdiFichaAnualRouter } from './routes/pdiFichaAnual.js';
import { correcoesPdiRouter } from './routes/correcoesPdi.js';
import { anamneseModelosRouter, anamnesePerguntasRouter } from './routes/anamneseModelos.js';
import { anamnesesRouter } from './routes/anamneses.js';
import { mensagensRouter } from './routes/mensagens.js';
import { notificacoesRouter } from './routes/notificacoes.js';

export function createApp() {
  const app = express();

  // CORS só para desenvolvimento local do frontend Vite — em produção, trocar por uma política
  // com a origem real (domínio do Vercel), nunca aberto irrestrito.
  //
  // FRONTEND_ORIGIN aceita uma lista separada por vírgula (ex.: "https://localhost:5173,
  // https://192.168.0.10:5173") — necessário desde que o dev server passou a servir HTTPS
  // (vite.config.js/@vitejs/plugin-basic-ssl: testar PWA/Push num celular exige contexto seguro,
  // e só https conta, mesmo acessando pelo IP da rede local). Fora de produção, também aceitamos
  // por padrão qualquer origem https(s) na faixa de IP privada na porta do Vite, pra não precisar
  // redescobrir e configurar o IP da máquina a cada vez que ele mudar (troca de rede, DHCP, etc.).
  const origensConfiguradas = (process.env.FRONTEND_ORIGIN ?? 'https://localhost:5173,http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origemLanDev = /^https?:\/\/(localhost|127\.0\.0\.1|(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+)(:\d+)?$/;
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true); // requisições sem Origin (ex.: curl, apps nativos)
        if (origensConfiguradas.includes(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== 'production' && origemLanDev.test(origin)) return callback(null, true);
        callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
      },
    }),
  );
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
  app.use('/api/vinculos-escolares', vinculosEscolaresRouter);
  // O pedido sugeria /api/pdi/alunos; adaptado ao padrão flat já usado pelo resto da API
  // (professor-turma-disciplina, auxiliar-turma, vinculos-escolares — nunca rotas aninhadas).
  app.use('/api/pdi-alunos', pdiAlunosRouter);
  app.use('/api/pdi-modelos', pdiModelosRouter);
  app.use('/api/pdi-perguntas', pdiPerguntasRouter);
  app.use('/api/pdi-perguntas-padrao', pdiPerguntasPadraoRouter);
  app.use('/api/pdi-aplicacoes', pdiAplicacoesRouter);
  app.use('/api/pdi-fichas', pdiFichasRouter);
  app.use('/api/pdi-ficha-anual', pdiFichaAnualRouter);
  app.use('/api/correcoes-pdi', correcoesPdiRouter);
  app.use('/api/anamnese-modelos', anamneseModelosRouter);
  app.use('/api/anamnese-perguntas', anamnesePerguntasRouter);
  app.use('/api/anamneses', anamnesesRouter);
  app.use('/api/mensagens', mensagensRouter);
  app.use('/api/notificacoes', notificacoesRouter);

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

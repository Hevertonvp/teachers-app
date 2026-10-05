import cron from 'node-cron';
import { prisma } from './lib/prisma.js';
import { executarVerificacaoPrazosPdi } from './jobs/pdiPrazoJob.js';
import { TIMEZONE_OPERACIONAL } from './domain/notificacoes.js';

// Scheduler in-process: roda dentro do mesmo processo Express (sem serviço externo), por isso
// depende do processo ficar sempre no ar — exatamente o modelo de deploy já documentado no
// README (Render/Fly.io, instância fixa, não serverless). Chamado só por server.ts, nunca por
// app.ts, para não disparar cron ao importar createApp() em teste/script.
export function iniciarScheduler(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      executarVerificacaoPrazosPdi(prisma).catch((err) => {
        console.error('[scheduler] falha ao executar verificação de prazos de PDI', err);
      });
    },
    { timezone: TIMEZONE_OPERACIONAL },
  );
  console.log(`[scheduler] job de prazos de PDI agendado para 08:00 (${TIMEZONE_OPERACIONAL})`);
}

import cron from 'node-cron';
import { prisma } from './lib/prisma.js';
import { executarVerificacaoPrazosPdi } from './jobs/pdiPrazoJob.js';
import { executarFechamentoAutomaticoFichaAnual } from './jobs/fichaAnualFechamentoJob.js';
import { executarFotografiaPdi } from './jobs/fotografiaPdiJob.js';
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

  // Job independente do de prazos — só fecha Fichas Anuais cujo ciclo tem dataEncerramento
  // configurada e já vencida (seção 16 do pedido de Ficha Anual/Correções).
  cron.schedule(
    '15 8 * * *',
    () => {
      executarFechamentoAutomaticoFichaAnual(prisma).catch((err) => {
        console.error('[scheduler] falha ao executar fechamento automático de Ficha Anual PDI', err);
      });
    },
    { timezone: TIMEZONE_OPERACIONAL },
  );
  console.log(`[scheduler] job de fechamento automático de Ficha Anual PDI agendado para 08:15 (${TIMEZONE_OPERACIONAL})`);

  // "Foto" do PDI no prazo (Acompanhamento Escolar). Roda também uma vez na subida: o servidor
  // pode ter dormido às 08:30, e o job só fotografa até 3 dias depois do fim (idempotente).
  const fotografar = () => {
    executarFotografiaPdi(prisma).catch((err) => {
      console.error('[scheduler] falha ao tirar a foto do PDI no prazo', err);
    });
  };
  cron.schedule('30 8 * * *', fotografar, { timezone: TIMEZONE_OPERACIONAL });
  fotografar();
  console.log(`[scheduler] foto do PDI no prazo agendada para 08:30 (${TIMEZONE_OPERACIONAL}) e executada na subida`);
}

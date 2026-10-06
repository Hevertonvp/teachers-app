import type { PrismaClient } from '@prisma/client';
import { hojeComoData } from '../domain/pdiAplicacoes.js';

// Fechamento automático da Ficha Anual PDI (seção 16 do pedido de Ficha Anual/Correções) — pura
// segurança, só fecha anos com `CicloAnualPdi.dataEncerramento` explicitamente configurada pela
// Secretaria e já vencida; anos sem configuração nunca fecham sozinhos. Job independente do de
// prazos de PDI (pdiPrazoJob.ts) — nunca toca nele, nunca toca ReaberturaPdi/AplicacaoPdi.
export async function executarFechamentoAutomaticoFichaAnual(prisma: PrismaClient, agora: Date = new Date()): Promise<void> {
  const hoje = hojeComoData(agora);

  const ciclosVencidos = await prisma.cicloAnualPdi.findMany({
    where: { dataEncerramento: { lte: hoje } },
    select: { ano: true },
  });
  if (ciclosVencidos.length === 0) return;

  await prisma.fichaAnualPdi.updateMany({
    where: { ano: { in: ciclosVencidos.map((c) => c.ano) }, status: 'EM_ANDAMENTO' },
    data: { status: 'FECHADA', fechadaEm: agora, fechadaPor: 'sistema' },
  });
}

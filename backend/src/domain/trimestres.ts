// Calendário de trimestres (PeriodoTrimestre, editado em Configurações > Trimestres).
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

// Trimestre cujo período contém a data (comparação só de data, sem hora). null quando nenhum
// período configurado a contém.
export async function trimestreDaData(db: Db, data: Date): Promise<number | null> {
  const dia = data.toISOString().slice(0, 10);
  const periodos = await db.periodoTrimestre.findMany({ orderBy: { trimestre: 'asc' } });
  const periodo = periodos.find((p) => p.dataInicio.toISOString().slice(0, 10) <= dia && dia <= p.dataFim.toISOString().slice(0, 10));
  return periodo?.trimestre ?? null;
}

// Pergunta com trimestre null vale para qualquer Aplicação (comportamento de sempre). Pergunta de
// um trimestre específico só entra na Aplicação daquele trimestre; se a Aplicação não cair em
// nenhum período configurado, entram todas (nada some sem a Secretaria perceber — ela edita depois).
export function perguntaValeParaTrimestre(perguntaTrimestre: number | null, aplicacaoTrimestre: number | null): boolean {
  return perguntaTrimestre === null || aplicacaoTrimestre === null || perguntaTrimestre === aplicacaoTrimestre;
}

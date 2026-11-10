// Acompanhamento Escolar: regras puras (sem I/O). Decisões do usuário em 10/11/2026; ver
// PROPOSTA_ACOMPANHAMENTO_ESCOLAR.md (§6) e CLAUDE_CONTEXT.md.
//
// Linguagem: nada aqui é "atraso". Depois do prazo o professor não consegue preencher sem
// reabertura, então o que sobra é "não concluído no prazo".
import { dataLocalSp } from './umTerco.js';

export const LIMITES = {
  diasPrazoProximo: 7, // "prazo se aproximando"
  percentualPoucoAndamento: 50, // abaixo disso, com prazo próximo, merece acompanhamento
  minimoParaPercentual: 5, // abaixo disso a tela mostra só "x de y", sem percentual
  diasSemMovimento: 7, // período aberto há mais que isso sem nenhum início
  diasEncerradoRecente: 30, // encerrado com pendências só aparece por este tempo
  diasParaFotografia: 3, // a foto do PDI só é tirada até 3 dias depois do prazo
} as const;

export type SituacaoPeriodo = 'agendado' | 'aberto' | 'reabertura' | 'encerrado';
export type Contagem = { esperado: number | null; concluidas: number; emAndamento: number };
export type MotivoAcompanhamento = 'prazo_proximo' | 'sem_movimento' | 'encerrado_com_pendencias';

const DIA_MS = 86400000;
// Fuso operacional: São Paulo, UTC-3 fixo (mesmo de domain/umTerco.ts).
const OFFSET_SP_MS = 3 * 60 * 60 * 1000;

// Data (coluna @db.Date, meia-noite UTC) -> instante de início/fim do dia em São Paulo.
export const inicioDoDiaSp = (data: Date) => new Date(data.getTime() + OFFSET_SP_MS);
export const fimDoDiaSp = (data: Date) => new Date(data.getTime() + OFFSET_SP_MS + DIA_MS - 1000);

export function situacaoPeriodo(
  periodo: { inicio: Date; fim: Date },
  reaberturas: { inicio: Date; fim: Date }[],
  agora: Date = new Date(),
): SituacaoPeriodo {
  const t = agora.getTime();
  if (t < periodo.inicio.getTime()) return 'agendado';
  if (t <= periodo.fim.getTime()) return 'aberto';
  if (reaberturas.some((r) => t >= r.inicio.getTime() && t <= r.fim.getTime())) return 'reabertura';
  return 'encerrado';
}

// Critérios de "Entregas que merecem acompanhamento" (§6.2 da proposta, aprovados pelo usuário).
// Esperado nulo ou zero nunca gera item: escola sem professor/aluno vinculado não é pendência.
export function motivoAcompanhamento(
  periodo: { situacao: SituacaoPeriodo; inicio: Date; fim: Date; contagem: Contagem },
  agora: Date = new Date(),
): MotivoAcompanhamento | null {
  const { esperado, concluidas, emAndamento } = periodo.contagem;
  if (!esperado) return null;
  const t = agora.getTime();
  if (periodo.situacao === 'aberto') {
    const diasAtePrazo = (periodo.fim.getTime() - t) / DIA_MS;
    if (diasAtePrazo <= LIMITES.diasPrazoProximo && esperado >= LIMITES.minimoParaPercentual
      && (concluidas * 100) / esperado < LIMITES.percentualPoucoAndamento) return 'prazo_proximo';
    const diasAberto = (t - periodo.inicio.getTime()) / DIA_MS;
    if (diasAberto > LIMITES.diasSemMovimento && concluidas + emAndamento === 0) return 'sem_movimento';
    return null;
  }
  if (periodo.situacao === 'encerrado') {
    const diasDesdePrazo = (t - periodo.fim.getTime()) / DIA_MS;
    if (diasDesdePrazo <= LIMITES.diasEncerradoRecente && concluidas < esperado) return 'encerrado_com_pendencias';
  }
  return null;
}

// Curva acumulada por dia (data local de São Paulo) entre `de` e `ate`, contando cada instante no
// dia em que aconteceu. Dias depois de `limite` (normalmente hoje) ficam sem valor (null), para o
// gráfico não desenhar o futuro.
export function curvaAcumulada(instantes: Date[], de: Date, ate: Date, limite: Date = new Date()): { dia: string; valor: number | null }[] {
  const porDia = new Map<string, number>();
  for (const i of instantes) {
    const dia = dataLocalSp(i);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const primeiro = dataLocalSp(de);
  const ultimo = dataLocalSp(ate);
  const hoje = dataLocalSp(limite);
  // Tudo que aconteceu antes do primeiro dia (ex.: concluído "antes" por relógio) entra no início.
  let acumulado = [...porDia.entries()].filter(([d]) => d < primeiro).reduce((s, [, n]) => s + n, 0);
  const pontos: { dia: string; valor: number | null }[] = [];
  for (let d = new Date(`${primeiro}T00:00:00Z`); d.toISOString().slice(0, 10) <= ultimo; d = new Date(d.getTime() + DIA_MS)) {
    const dia = d.toISOString().slice(0, 10);
    acumulado += porDia.get(dia) ?? 0;
    pontos.push({ dia, valor: dia <= hoje ? acumulado : null });
    if (pontos.length > 400) break; // proteção contra período absurdo
  }
  return pontos;
}

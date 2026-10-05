// Regras puras de Notificações — sem Express, sem Prisma (mesmo princípio de domain/pdiFichas.ts
// e domain/mensagens.ts: testável sem subir servidor nem banco).

// Timezone operacional fixo do sistema. Não há TZ definida no ambiente hoje (backend roda sem
// configuração de timezone própria) — como o sistema é claramente de uma rede municipal
// brasileira, fixamos America/Sao_Paulo explicitamente aqui em vez de depender do timezone do
// SO do servidor (que em produção pode estar em UTC). Ver README/relatório para o raciocínio.
export const TIMEZONE_OPERACIONAL = 'America/Sao_Paulo';

// Data civil (YYYY-MM-DD) de um instante REAL ("agora"), no timezone operacional — é o único caso
// em que o timezone importa de verdade (saber que dia é "hoje" em São Paulo agora mesmo).
export function dataCivilSP(instante: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_OPERACIONAL });
  return formatter.format(instante); // en-CA formata como YYYY-MM-DD
}

// Data civil (YYYY-MM-DD) de uma coluna @db.Date vinda do Postgres via Prisma. Diferente de um
// instante real, uma coluna @db.Date não tem timezone — o Prisma só a representa como meia-noite
// UTC daquele dia (mesma observação já feita em domain/pdiAplicacoes.ts/hojeComoData). Rodar isso
// pelo timezone de São Paulo (UTC-3) SUBTRAIRIA um dia por engano — por isso aqui extraímos o
// Y-M-D em UTC diretamente, nunca via Intl/timeZone.
export function dataCivilDeColunaDate(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// Diferença em dias de calendário entre duas datas civis (YYYY-MM-DD), b - a.
export function diasEntreDatasCivis(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO}T00:00:00Z`);
  const ate = new Date(`${ateISO}T00:00:00Z`);
  const umDiaEmMs = 24 * 60 * 60 * 1000;
  return Math.round((ate.getTime() - de.getTime()) / umDiaEmMs);
}

export type MarcoPrazoPdi = '3_dias' | '1_dia';

// Único ponto de decisão de "é hoje que avisamos?" — exatamente 3 ou exatamente 1 dia antes do
// fim (seção 22 do pedido: nunca depois do vencimento, nunca outros intervalos).
export function marcoPrazoPdi(hojeISO: string, dataFimISO: string): MarcoPrazoPdi | null {
  const dias = diasEntreDatasCivis(hojeISO, dataFimISO);
  if (dias === 3) return '3_dias';
  if (dias === 1) return '1_dia';
  return null;
}

// Textos literais das seções 23/25/26 do pedido. Nunca usar "fora do prazo" antes do vencimento
// (seção 27) — "amanhã" no marco de 1 dia, "em 3 dias" no marco de 3 dias.
function textoPrazo(marco: MarcoPrazoPdi): string {
  return marco === '3_dias' ? 'O prazo termina em 3 dias.' : 'O prazo termina amanhã.';
}

export function textoPrazoProfessor(pendentes: number, marco: MarcoPrazoPdi): string {
  const plural = pendentes === 1 ? 'PDI pendente' : 'PDIs pendentes';
  return `Você possui ${pendentes} ${plural}. ${textoPrazo(marco)}`;
}

export function textoPrazoGestor(professoresComPendencia: number, escolaNome: string, marco: MarcoPrazoPdi): string {
  const plural = professoresComPendencia === 1 ? 'professor' : 'professores';
  return `${escolaNome}: há ${professoresComPendencia} ${plural} com PDI pendente. ${textoPrazo(marco)}`;
}

export function chaveIdempotenciaPrazoProfessor(marco: MarcoPrazoPdi, professorId: number, aplicacaoId: number): string {
  return `pdi-prazo-professor:${marco}:${professorId}:${aplicacaoId}`;
}

export function chaveIdempotenciaPrazoGestor(marco: MarcoPrazoPdi, gestorId: number, aplicacaoId: number): string {
  return `pdi-prazo-gestor:${marco}:${gestorId}:${aplicacaoId}`;
}

export function textoNovaMensagem(remetenteNome: string): { titulo: string; corpo: string } {
  return { titulo: 'Nova mensagem', corpo: `Você recebeu uma nova mensagem de ${remetenteNome}.` };
}

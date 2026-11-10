// Fluxo de correções (PDI e Formulário 1/3), regras puras. Decisões do usuário em 10/11/2026:
// Secretaria escreve "o que precisa ser corrigido" -> prazo FIXO de 3 dias corridos a partir da
// confirmação -> mensagem na caixa do Professor -> Professor corrige e usa "Enviar correção" ->
// Secretaria aceita ou devolve de novo (devoluções ilimitadas; cada uma é uma linha nova).
//
// Status gravado: ABERTA (aguardando o Professor) ou RESOLVIDA (Professor enviou), mais a
// conferência da Secretaria (ACEITA/DEVOLVIDA). "Prazo de correção encerrado" é CALCULADO.
// Depois do prazo o Professor NÃO é bloqueado: a correção continua aberta até ele enviar.

export const PRAZO_CORRECAO_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias corridos, sem configuração
export const OBSERVACAO_MAX = 2000;

export type SituacaoCorrecao = 'solicitada' | 'prazo_encerrado' | 'recebida' | 'aceita' | 'devolvida';

type CorrecaoGravada = {
  id: number; observacao: string; status: string; criadaPor: string; criadaEm: Date; prazoAte: Date;
  concluidaEm: Date | null; concluidaPor: string | null;
  conferidaEm: Date | null; conferidaPor: string | null; conferencia: string | null;
};

export function situacaoCorrecao(c: { status: string; prazoAte: Date; conferencia: string | null }, agora: Date = new Date()): SituacaoCorrecao {
  if (c.status === 'ABERTA') return agora.getTime() > c.prazoAte.getTime() ? 'prazo_encerrado' : 'solicitada';
  if (c.conferencia === 'ACEITA') return 'aceita';
  if (c.conferencia === 'DEVOLVIDA') return 'devolvida';
  return 'recebida';
}

// `nomes`: id (string, como gravado em criadaPor/concluidaPor/conferidaPor) -> nome da pessoa.
export function formatarCorrecao(c: CorrecaoGravada, nomes: Map<string, string> = new Map(), agora: Date = new Date()) {
  return {
    id: c.id,
    observacao: c.observacao,
    // Compatibilidade com as telas antigas: EXPIRADA continua aparecendo como antes.
    status: c.status === 'ABERTA' && c.prazoAte <= agora ? 'EXPIRADA' : c.status,
    situacao: situacaoCorrecao(c, agora),
    criadaPor: c.criadaPor,
    criadaPorNome: nomes.get(c.criadaPor) ?? null,
    criadaEm: c.criadaEm,
    prazoAte: c.prazoAte,
    concluidaEm: c.concluidaEm,
    concluidaPor: c.concluidaPor,
    concluidaPorNome: c.concluidaPor ? nomes.get(c.concluidaPor) ?? null : null,
    enviadaForaDoPrazo: !!c.concluidaEm && c.concluidaEm.getTime() > c.prazoAte.getTime(),
    conferidaEm: c.conferidaEm,
    conferidaPor: c.conferidaPor,
    conferidaPorNome: c.conferidaPor ? nomes.get(c.conferidaPor) ?? null : null,
    conferencia: c.conferencia,
  };
}

// Ids de pessoa que aparecem numa lista de correções (para buscar os nomes de uma vez).
export const idsDePessoasDasCorrecoes = (lista: CorrecaoGravada[]) => [...new Set(lista.flatMap((c) => [c.criadaPor, c.concluidaPor, c.conferidaPor]).filter((x): x is string => !!x && /^\d+$/.test(x)).map(Number))];

// "13/11/2026, às 14h30" no horário oficial da aplicação (São Paulo).
export function formatarPrazo(d: Date): string {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month}/${partes.year}, às ${partes.hour}h${partes.minute}`;
}

// Texto da mensagem automática que vai para a caixa de mensagens do Professor.
export function textoMensagemCorrecao(dados: { formulario: string; identificacao: string[]; observacao: string; prazoAte: Date }): string {
  return [
    `Você possui uma correção pendente no ${dados.formulario}.`,
    '',
    ...dados.identificacao,
    '',
    'Orientações para correção:',
    dados.observacao,
    '',
    `Prazo: ${formatarPrazo(dados.prazoAte)}.`,
    '',
    'Acesse o formulário para realizar os ajustes solicitados.',
  ].join('\n');
}

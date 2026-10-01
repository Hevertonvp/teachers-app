// Regras de vigência/sobreposição/editabilidade de Aplicação PDI — puras, sem I/O, reutilizáveis
// pelas rotas e (no próximo bloco) por Fichas PDI (ver seção 26 do pedido: a regra de
// editabilidade já fica pronta aqui, mesmo sem nenhuma rota usando isso ainda).

interface Periodo {
  dataInicio: Date;
  dataFim: Date;
}

// Datas @db.Date do Postgres chegam como meia-noite UTC do dia — truncamos "agora" da mesma
// forma antes de comparar, senão uma aplicação com dataFim = hoje apareceria "encerrada" a
// qualquer hora depois da meia-noite (ver ressalva no relatório final: o mock usava uma data
// simulada fixa sem hora, então nunca teve esse problema; o backend real usa `new Date()` de
// verdade e precisa desse cuidado).
export function hojeComoData(agora: Date = new Date()): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

// Duas vigências se sobrepõem quando uma começa antes da outra terminar E termina depois da
// outra começar — datas iguais nas pontas CONTAM como sobreposição (ver seção 12 do pedido).
export function vigenciasSobrepoem(a: Periodo, b: Periodo): boolean {
  return a.dataInicio <= b.dataFim && a.dataFim >= b.dataInicio;
}

export type StatusVigencia = 'scheduled' | 'active' | 'expired';

// Mesmos 3 estados que o mock já usa (getFormStatus/formStatusLabel no frontend) — devolvidos
// com esses nomes de propósito, para o frontend reaproveitar a UI de badge que já existe, sem
// reimplementar nada.
export function statusVigencia(periodo: Periodo, agora: Date = hojeComoData()): StatusVigencia {
  const hoje = hojeComoData(agora);
  if (hoje < periodo.dataInicio) return 'scheduled';
  if (hoje > periodo.dataFim) return 'expired';
  return 'active';
}

// Editável agora = dentro da vigência original OU dentro de alguma reabertura (seção 26). Ainda
// não usado por nenhuma rota nesta etapa — só a regra pronta pro bloco de Fichas.
export function isAplicacaoEditavelAgora(aplicacao: Periodo, reaberturas: Periodo[], agora: Date = hojeComoData()): boolean {
  const hoje = hojeComoData(agora);
  const dentroDaVigenciaOriginal = hoje >= aplicacao.dataInicio && hoje <= aplicacao.dataFim;
  const dentroDeAlgumaReabertura = reaberturas.some((reabertura) => hoje >= reabertura.dataInicio && hoje <= reabertura.dataFim);
  return dentroDaVigenciaOriginal || dentroDeAlgumaReabertura;
}

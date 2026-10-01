// Regras puras da Anamnese — sem I/O, reutilizáveis pelas rotas.

export type StatusAnamnese = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

// Status só avança por fato observável (ter alguma resposta salva) ou ação explícita de concluir
// — nunca volta sozinho. Mesma regra de FichaPdi (ver domain/pdiFichas.ts).
export function statusAposSalvarResposta(atual: StatusAnamnese, existeAlgumaResposta: boolean): StatusAnamnese {
  if (atual === 'PENDENTE' && existeAlgumaResposta) return 'EM_ANDAMENTO';
  return atual;
}

// Gatilho especial usado no `complementar` das perguntas migradas dos grupos de aspecto
// (comportamentais/psicomotores/cognitivos): a observação do formulário original é SEMPRE
// disponível, não condicional a uma resposta específica como no `complementar` do PDI. Perguntas
// configuráveis novas continuam podendo usar um gatilho normal (valor de opção específico).
export const GATILHO_COMPLEMENTAR_SEMPRE = 'sempre';

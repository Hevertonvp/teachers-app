// Regras puras de status/editabilidade de Ficha PDI — sem I/O, reutilizáveis pelas rotas.

export type StatusFichaPdi = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA';

// Status só avança por fato observável (ter alguma resposta salva) ou ação explícita de concluir
// (ver concluirFicha na rota) — nunca volta sozinho. Editar respostas de uma ficha já CONCLUIDA
// não a faz regredir para EM_ANDAMENTO (seção 19/21 do pedido de Fichas PDI).
export function statusAposSalvarResposta(atual: StatusFichaPdi, existeAlgumaResposta: boolean): StatusFichaPdi {
  if (atual === 'PENDENTE' && existeAlgumaResposta) return 'EM_ANDAMENTO';
  return atual;
}

// Editável agora = escola ATIVA + dentro da vigência original da Aplicação OU de alguma
// Reabertura — sempre calculado com o estado REAL atual da Aplicação/Reaberturas, nunca com o
// snapshot congelado da própria Ficha (que é só histórico, ver seção 9 do pedido).
export function fichaEditavelAgora(
  escolaAtiva: boolean,
  aplicacaoEditavelAgora: boolean,
): boolean {
  return escolaAtiva && aplicacaoEditavelAgora;
}

export type StatusVisualPdi = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'prazo_encerrado';

// Status visual único para listagens (Meus PDIs, perfil do aluno) — deriva de status da Ficha
// (quando existe) + editabilidade atual, para o frontend nunca precisar recalcular a regra.
// Combinação PENDENTE-ou-sem-Ficha com janela fechada vira "prazo_encerrado" (nunca apareceu
// preenchida e não há mais como preencher); com janela aberta é "nao_iniciado".
export function statusVisualItem(statusFicha: StatusFichaPdi | null, editavelAgora: boolean): StatusVisualPdi {
  if (statusFicha === 'CONCLUIDA') return 'concluido';
  if (statusFicha === 'EM_ANDAMENTO') return 'em_andamento';
  return editavelAgora ? 'nao_iniciado' : 'prazo_encerrado';
}

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

// Correção individual (CorrecaoFichaPdi) abre uma segunda porta de edição pro Professor, paralela
// à vigência normal da Aplicação — nunca a substitui, só OR com ela (seção 38/41 do pedido de
// Ficha Anual/Correções). Função separada de `fichaEditavelAgora` de propósito: quando não existe
// nenhuma CorrecaoFichaPdi ativa para a Ficha, `correcaoIndividualAtiva` é sempre false e o
// resultado fica idêntico ao comportamento de antes desta função existir.
export function editavelParaProfessor(aplicacaoEditavelAgora: boolean, correcaoIndividualAtiva: boolean): boolean {
  return aplicacaoEditavelAgora || correcaoIndividualAtiva;
}

export type StatusVisualPdi = 'nao_iniciado' | 'agendado' | 'em_andamento' | 'concluido' | 'prazo_encerrado';

// Status visual único para listagens (Meus PDIs, perfil do aluno) — deriva de status da Ficha
// (quando existe) + editabilidade atual + vigência da Aplicação, para o frontend nunca precisar
// recalcular a regra. PENDENTE-ou-sem-Ficha com janela fechada: se a Aplicação ainda nem começou
// (vigência "scheduled"), é "agendado" — nunca "prazo_encerrado", que é só pra quando a janela JÁ
// passou (vigência "expired") e não há reabertura ativa. Com janela aberta é "nao_iniciado". Bug
// corrigido: antes não recebia a vigência e um formulário agendado pra começar no futuro aparecia
// como "prazo encerrado" — mesmo rótulo de quando o prazo já tinha passado, o que é o oposto do
// que aconteceu.
export function statusVisualItem(
  statusFicha: StatusFichaPdi | null,
  editavelAgora: boolean,
  statusVigenciaAplicacao: 'scheduled' | 'active' | 'expired',
): StatusVisualPdi {
  if (statusFicha === 'CONCLUIDA') return 'concluido';
  if (statusFicha === 'EM_ANDAMENTO') return 'em_andamento';
  if (editavelAgora) return 'nao_iniciado';
  return statusVigenciaAplicacao === 'scheduled' ? 'agendado' : 'prazo_encerrado';
}

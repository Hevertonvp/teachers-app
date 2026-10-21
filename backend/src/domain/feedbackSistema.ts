// Regras puras do Feedback do Sistema — sem I/O, reutilizáveis pela rota.

export type StatusFeedbackSistema = 'NOVO' | 'EM_ANALISE' | 'RESOLVIDO' | 'NAO_E_PROBLEMA_DO_SISTEMA';

// Decisão do usuário (sem padrão equivalente já existente no sistema — Mensagens não tem status/
// reabertura, ReaberturaPdi/CorrecaoFichaPdi são sempre iniciadas pela Secretaria, nunca pela
// resposta da outra parte): quando o PRÓPRIO autor responde um chamado já RESOLVIDO, ele volta
// para EM_ANALISE (não NOVO) — reconhece que já houve contato do suporte sobre o assunto.
export function statusAposRespostaDoAutor(statusAtual: StatusFeedbackSistema): StatusFeedbackSistema {
  return statusAtual === 'RESOLVIDO' ? 'EM_ANALISE' : statusAtual;
}

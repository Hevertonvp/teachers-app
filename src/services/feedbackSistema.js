import { apiFetch } from './api';

// Feedback do Sistema — canal técnico GLOBAL (qualquer perfil -> SUPORTE_SISTEMA), entidade
// própria, deliberadamente separada de Mensagens (ver backend/src/domain/feedbackSistema.ts).

export const CATEGORIA_OPTIONS = [
  { value: 'ERRO_BUG', label: 'Erro / bug' },
  { value: 'SUGESTAO_MELHORIA', label: 'Sugestão de melhoria' },
  { value: 'DIFICULDADE_USO', label: 'Dificuldade para usar o sistema' },
  { value: 'LENTIDAO_TECNICO', label: 'Lentidão / problema técnico' },
  { value: 'OUTRO_PROBLEMA', label: 'Outro problema do sistema' },
];
export const categoriaLabel = (value) => CATEGORIA_OPTIONS.find((o) => o.value === value)?.label || value;

export const STATUS_LABEL = {
  NOVO: 'Novo',
  EM_ANALISE: 'Em análise',
  RESOLVIDO: 'Resolvido',
  NAO_E_PROBLEMA_DO_SISTEMA: 'Não é problema do sistema',
};
export const STATUS_VARIANT = {
  NOVO: 'blue',
  EM_ANALISE: 'yellow',
  RESOLVIDO: 'green',
  NAO_E_PROBLEMA_DO_SISTEMA: 'gray',
};
export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

// Respostas prontas (seção 12 do pedido) — só texto estático de UI, o Suporte pode editar antes
// de enviar; nunca persistidas/versionadas no backend, não há necessidade.
export const RESPOSTAS_PRONTAS = [
  { titulo: 'Recebido', texto: 'Obrigado pela mensagem. Seu relato foi recebido e será analisado.' },
  { titulo: 'Sugestão em análise', texto: 'Obrigado pela sugestão. Ela foi registrada e está sendo analisada para possíveis melhorias no sistema.' },
  { titulo: 'Problema em análise', texto: 'Obrigado pelo relato. Estamos analisando o problema informado.' },
  { titulo: 'Resolvido', texto: 'O problema informado foi analisado e considerado resolvido. Se ele voltar a acontecer, envie um novo feedback com os detalhes.' },
  { titulo: 'Não é problema do sistema', texto: 'Este canal é destinado exclusivamente a questões técnicas e sugestões sobre o sistema. Para assuntos relacionados a regras do PDI, prazos, decisões pedagógicas ou organização escolar, procure a gestão responsável.' },
];

// Dados técnicos capturados automaticamente (seção 20 do pedido) — nunca conteúdo de formulário/
// senha/token, só contexto leve. `tipoDispositivo` por heurística simples de largura de tela.
export const capturarContextoTecnico = () => ({
  rotaOrigem: typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') || window.location.pathname : null,
  userAgentResumo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  tipoDispositivo: typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop') : null,
});

export const criarFeedbackSistemaReal = (payload) => apiFetch('/api/feedback-sistema', {
  method: 'POST',
  body: { ...payload, ...capturarContextoTecnico() },
});

export const listarMeusFeedbacksReais = () => apiFetch('/api/feedback-sistema/meus');
export const obterMeuFeedbackReal = (id) => apiFetch(`/api/feedback-sistema/meus/${id}`);
export const responderMeuFeedbackReal = (id, conteudo) => apiFetch(`/api/feedback-sistema/meus/${id}/responder`, { method: 'POST', body: { conteudo } });

export const listarFeedbacksSistemaReais = (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
  });
  const query = params.toString();
  return apiFetch(`/api/feedback-sistema${query ? `?${query}` : ''}`);
};
export const obterFeedbackSistemaReal = (id) => apiFetch(`/api/feedback-sistema/${id}`);
export const responderFeedbackSistemaReal = (id, conteudo) => apiFetch(`/api/feedback-sistema/${id}/responder`, { method: 'POST', body: { conteudo } });
export const mudarStatusFeedbackSistemaReal = (id, status) => apiFetch(`/api/feedback-sistema/${id}/status`, { method: 'POST', body: { status } });

import { apiFetch } from './api';

// Anamnese real — entidades próprias, nunca misturadas com ModeloPdi/PerguntaPdi/FichaPdi/
// RespostaPdi (ciclos de vida diferentes: Anamnese é do aluno inteiro, versionada, sem vigência/
// Aplicação/Reabertura). O mock antigo (`pdiAnamneses` em DataContext) nunca teve dado real —
// começava vazio — então não há fallback a preservar aqui.
const TIPO_FROM_API = { TEXTO: 'texto', SELECAO: 'selecao', MARCACAO: 'marcacao', NUMERO: 'numero', ORIENTACAO: 'orientacao', SELECAO_MULTIPLA: 'selecao_multipla' };
const TIPO_TO_API = Object.fromEntries(Object.entries(TIPO_FROM_API).map(([api, front]) => [front, api]));
const STATUS_ANAMNESE_FROM_API = { PENDENTE: 'pendente', EM_ANDAMENTO: 'em_andamento', CONCLUIDA: 'concluida' };
const POSSUI_LAUDO_FROM_API = { SIM: 'sim', NAO: 'nao', EM_INVESTIGACAO: 'em_investigacao' };
const POSSUI_LAUDO_TO_API = Object.fromEntries(Object.entries(POSSUI_LAUDO_FROM_API).map(([api, front]) => [front, api]));

const normalizePergunta = ({ texto, ...pergunta }) => ({
  ...pergunta,
  pergunta: texto,
  tipoResposta: TIPO_FROM_API[pergunta.tipoResposta] ?? pergunta.tipoResposta,
  status: pergunta.status === 'ATIVA' ? 'ativa' : pergunta.status === 'INATIVA' ? 'inativa' : pergunta.status,
});

const normalizeModelo = (modelo) => ({
  ...modelo,
  status: modelo.status === 'ATIVA' ? 'ativa' : 'inativa',
  ...(modelo.perguntas ? { perguntas: modelo.perguntas.map(normalizePergunta) } : {}),
});

const paraPayloadPergunta = (payload) => ({
  secao: payload.secao,
  subsecao: payload.subsecao || null,
  texto: payload.pergunta ?? payload.texto,
  explicacao: payload.explicacao || null,
  tipoResposta: TIPO_TO_API[payload.tipoResposta] ?? payload.tipoResposta,
  opcoes: payload.opcoes || [],
  complementar: payload.complementar || null,
});

export const listarAnamneseModelosReais = async () => (await apiFetch('/api/anamnese-modelos')).map(normalizeModelo);
export const obterAnamneseModeloReal = async (id) => normalizeModelo(await apiFetch(`/api/anamnese-modelos/${id}`));
export const criarAnamnesePerguntaReal = async (payload) => normalizePergunta(await apiFetch('/api/anamnese-modelos/perguntas', { method: 'POST', body: paraPayloadPergunta(payload) }));
export const editarAnamnesePerguntaReal = async (perguntaId, payload) => normalizePergunta(await apiFetch(`/api/anamnese-perguntas/${perguntaId}`, { method: 'PUT', body: paraPayloadPergunta(payload) }));
export const inativarAnamnesePerguntaReal = async (id) => normalizePergunta(await apiFetch(`/api/anamnese-perguntas/${id}/inativar`, { method: 'POST' }));
export const reativarAnamnesePerguntaReal = async (id) => normalizePergunta(await apiFetch(`/api/anamnese-perguntas/${id}/reativar`, { method: 'POST' }));
export const reordenarAnamnesePerguntasReais = async (ordens) => (await apiFetch('/api/anamnese-modelos/perguntas/reordenar', { method: 'POST', body: { ordens } })).map(normalizePergunta);

const normalizeAnamnese = (a) => ({
  ...a,
  status: STATUS_ANAMNESE_FROM_API[a.status] ?? a.status,
  possuiLaudo: a.possuiLaudo ? (POSSUI_LAUDO_FROM_API[a.possuiLaudo] ?? a.possuiLaudo) : null,
});

const normalizeDetalhe = (payload) => ({
  anamnese: normalizeAnamnese(payload.anamnese),
  perguntas: payload.perguntas.map(normalizePergunta),
  respostas: payload.respostas,
  versaoAtual: payload.versaoAtual,
  editavel: payload.editavel,
});

export const obterHistoricoAnamneseReal = async (alunoId) => {
  const payload = await apiFetch(`/api/anamneses/aluno/${alunoId}`);
  return {
    atual: payload.atual ? normalizeDetalhe(payload.atual) : null,
    historico: payload.historico.map(normalizeAnamnese),
  };
};

export const obterAnamneseReal = async (id) => normalizeDetalhe(await apiFetch(`/api/anamneses/${id}`));

export const listarAnamnesesPendentesReal = async (escolaId) => (await apiFetch(`/api/anamneses/pendentes?escolaId=${escolaId}`)).map((aluno) => ({
  ...aluno,
  statusAnamnese: aluno.statusAnamnese ? (STATUS_ANAMNESE_FROM_API[aluno.statusAnamnese] ?? aluno.statusAnamnese) : null,
}));

export const iniciarAnamneseReal = async (alunoId) => normalizeDetalhe(await apiFetch('/api/anamneses', {
  method: 'POST',
  body: { alunoId: Number(alunoId) },
}));

const paraPayloadEstrutural = (estrutural) => ({
  ...estrutural,
  possuiLaudo: estrutural.possuiLaudo ? (POSSUI_LAUDO_TO_API[estrutural.possuiLaudo] ?? estrutural.possuiLaudo) : null,
});

export const salvarAnamneseReal = async (id, { estrutural, respostas }) => normalizeDetalhe(await apiFetch(`/api/anamneses/${id}/respostas`, {
  method: 'PUT',
  body: {
    ...(estrutural ? { estrutural: paraPayloadEstrutural(estrutural) } : {}),
    ...(respostas ? { respostas: respostas.map((item) => ({ perguntaAnamneseId: item.perguntaAnamneseId, valor: item.valor })) } : {}),
  },
}));

export const concluirAnamneseReal = async (id) => normalizeDetalhe(await apiFetch(`/api/anamneses/${id}/concluir`, { method: 'POST' }));

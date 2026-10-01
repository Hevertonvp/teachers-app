import { apiFetch } from './api';

// Ficha/Resposta PDI real — usado só pelo formulário real de preenchimento (FormularioPdiProfessor.jsx)
// e pela abertura a partir do perfil do aluno (PdiAlunoPerfil.jsx). O mock antigo (pdiFichaRespostas/
// pdiFichaHistorico em DataContext) continua existindo em paralelo para os consumidores ainda não
// migrados (MeusPdisPage, DashboardProfessor — ver seção 35/37 do pedido).
const STATUS_FICHA_FROM_API = { PENDENTE: 'pendente', EM_ANDAMENTO: 'em_andamento', CONCLUIDA: 'concluida' };
const ORIGEM_FROM_API = { ESTRUTURADA: 'estruturada', HABILIDADE: 'habilidade', ORIENTACAO: 'orientacao', QUALITATIVA: 'qualitativa', PERSONALIZADA: 'personalizada' };
const TIPO_FROM_API = { TEXTO: 'texto', SELECAO: 'selecao', MARCACAO: 'marcacao', NUMERO: 'numero', ORIENTACAO: 'orientacao' };

// Datas @db.Date chegam como ISO completo — o resto do app trata como 'YYYY-MM-DD' (ver
// utils/formAvailability.js).
const soData = (isoDate) => (isoDate ? isoDate.slice(0, 10) : isoDate);

const normalizeFicha = (ficha) => ({
  ...ficha,
  status: STATUS_FICHA_FROM_API[ficha.status] ?? ficha.status,
  aplicacaoDataInicio: soData(ficha.aplicacaoDataInicio),
  aplicacaoDataFim: soData(ficha.aplicacaoDataFim),
});

const normalizePerguntaSnapshot = ({ texto, ...pergunta }) => ({
  ...pergunta,
  pergunta: texto,
  origem: ORIGEM_FROM_API[pergunta.origem] ?? pergunta.origem,
  tipoResposta: TIPO_FROM_API[pergunta.tipoResposta] ?? pergunta.tipoResposta,
});

const normalizeRespostaCompleta = (payload) => ({
  ficha: normalizeFicha(payload.ficha),
  perguntas: payload.perguntas.map(normalizePerguntaSnapshot),
  respostas: payload.respostas,
  editavelAgora: payload.editavelAgora,
});

// Item de listagem (Meus PDIs / consulta por aluno) — mais leve que a Ficha completa: não tem
// perguntas/respostas, só o suficiente pra montar uma linha de tabela/card (seção 4 do pedido de
// Meus PDIs). `statusVigencia` já vem no mesmo vocabulário de formStatusLabel/formStatusClasses.
const normalizeItemListagem = (item) => ({
  ...item,
  dataInicio: soData(item.dataInicio),
  dataFim: soData(item.dataFim),
  statusFicha: item.statusFicha ? (STATUS_FICHA_FROM_API[item.statusFicha] ?? item.statusFicha) : null,
});

export const listarMeusPdisReais = async () => (await apiFetch('/api/pdi-fichas/meus-pdis')).map(normalizeItemListagem);

// Consulta de Fichas já existentes (nunca cria) — usada pelo perfil do aluno para Diretora/
// Auxiliar/Secretaria montarem o resumo de PDI por disciplina sem materializar nada.
export const listarFichasPdiReais = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.alunoId) params.set('alunoId', filtros.alunoId);
  if (filtros.aplicacaoId) params.set('aplicacaoId', filtros.aplicacaoId);
  if (filtros.status) params.set('status', filtros.status);
  const query = params.toString();
  return (await apiFetch(`/api/pdi-fichas${query ? `?${query}` : ''}`)).map(normalizeFicha);
};

export const obterOuCriarFichaReal = async (payload) => normalizeRespostaCompleta(await apiFetch('/api/pdi-fichas/obter-ou-criar', {
  method: 'POST',
  body: { aplicacaoId: Number(payload.aplicacaoId), alunoId: Number(payload.alunoId), disciplinaId: Number(payload.disciplinaId) },
}));

export const obterFichaReal = async (aplicacaoId, alunoId, disciplinaId) => normalizeRespostaCompleta(
  await apiFetch(`/api/pdi-fichas/${aplicacaoId}/${alunoId}/${disciplinaId}`),
);

export const salvarRespostasFichaReal = async (fichaId, respostas) => normalizeRespostaCompleta(await apiFetch(`/api/pdi-fichas/${fichaId}/respostas`, {
  method: 'PUT',
  body: { respostas: respostas.map((item) => ({ aplicacaoPerguntaId: item.aplicacaoPerguntaId, valor: item.valor })) },
}));

export const concluirFichaReal = async (fichaId) => normalizeRespostaCompleta(await apiFetch(`/api/pdi-fichas/${fichaId}/concluir`, { method: 'POST' }));

export const paraPayloadValor = (tipoResposta, current) => ({
  resposta: tipoResposta === 'numero' ? (current.valor === '' ? null : Number(current.valor))
    : tipoResposta === 'selecao' ? current.opcao
    : tipoResposta === 'marcacao' ? current.marcado
    : current.texto,
  complementarTexto: current.complementar || '',
});

import { apiFetch } from './api';

// O backend guarda etapa/turno/segmento/nível/status em enums MAIÚSCULOS (Postgres); o resto do
// frontend (filtros, utils/turmas.js, GestaoTurmas.jsx) já compara com os valores minúsculos que
// sempre existiram no mock. Normalizamos aqui, na fronteira, para não precisar mudar nada fora
// deste serviço (mesmo padrão já usado em services/api.js + DataContext para Escolas).
const ETAPA_FROM_API = { FUNDAMENTAL: 'fundamental', EDUCACAO_INFANTIL: 'educacao_infantil' };
const ETAPA_TO_API = { fundamental: 'FUNDAMENTAL', educacao_infantil: 'EDUCACAO_INFANTIL' };
const TURNO_FROM_API = { MANHA: 'manha', TARDE: 'tarde' };
const TURNO_TO_API = { manha: 'MANHA', tarde: 'TARDE' };
const SEGMENTO_FROM_API = { CRECHE: 'creche', PRE_ESCOLA: 'pre_escola' };
const SEGMENTO_TO_API = { creche: 'CRECHE', pre_escola: 'PRE_ESCOLA' };
const NIVEL_FROM_API = {
  BERCARIO_I: 'bercario_1', BERCARIO_II: 'bercario_2',
  MATERNAL_I: 'maternal_1', MATERNAL_II: 'maternal_2',
  PRE_I: 'pre_1', PRE_II: 'pre_2',
};
const NIVEL_TO_API = Object.fromEntries(Object.entries(NIVEL_FROM_API).map(([api, front]) => [front, api]));
const STATUS_FROM_API = { ATIVA: 'ativa', INATIVA: 'inativa' };

// `ciclo` é só um rótulo de exibição — derivado 1:1 de `etapa`, sem nenhuma informação nova (o
// mock tinha esse campo solto; o backend não precisa guardar algo que já é dedutível da etapa).
export const normalizeTurma = (turma) => ({
  ...turma,
  etapa: ETAPA_FROM_API[turma.etapa],
  turno: TURNO_FROM_API[turma.turno],
  segmento: turma.segmento ? SEGMENTO_FROM_API[turma.segmento] : null,
  nivel: turma.nivel ? NIVEL_FROM_API[turma.nivel] : null,
  status: STATUS_FROM_API[turma.status],
  ciclo: turma.etapa === 'FUNDAMENTAL' ? 'Ensino Fundamental' : 'Educação Infantil',
});

const paraPayloadApi = (payload) => ({
  escolaId: Number(payload.escolaId),
  anoLetivo: Number(payload.anoLetivo),
  etapa: ETAPA_TO_API[payload.etapa],
  turno: TURNO_TO_API[payload.turno],
  identificador: Number(payload.identificador),
  anoSerie: payload.etapa === 'fundamental' ? Number(payload.anoSerie) : null,
  segmento: payload.etapa === 'educacao_infantil' ? SEGMENTO_TO_API[payload.segmento] : null,
  nivel: payload.etapa === 'educacao_infantil' ? NIVEL_TO_API[payload.nivel] : null,
});

export const listarTurmas = async () => (await apiFetch('/api/turmas')).map(normalizeTurma);
export const criarTurma = async (payload) => normalizeTurma(await apiFetch('/api/turmas', { method: 'POST', body: paraPayloadApi(payload) }));
export const editarTurma = async (id, payload) => normalizeTurma(await apiFetch(`/api/turmas/${id}`, { method: 'PUT', body: paraPayloadApi(payload) }));
export const inativarTurmaApi = async (id) => normalizeTurma(await apiFetch(`/api/turmas/${id}/inativar`, { method: 'POST' }));
export const reativarTurmaApi = async (id) => normalizeTurma(await apiFetch(`/api/turmas/${id}/reativar`, { method: 'POST' }));

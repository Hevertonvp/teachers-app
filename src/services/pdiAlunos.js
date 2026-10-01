import { apiFetch } from './api';

// Aluno PDI real — fonte nova e paralela ao mock `pdiAlunos` (DataContext), usada só pelas duas
// telas já migradas (PdiPage.jsx, PdiAlunoPerfil.jsx). O mock continua intocado: várias outras
// telas (Anamnese, Meus Alunos do Auxiliar, Fichas/Respostas, Meus PDIs, Dashboards) ainda
// dependem dele, inclusive de campos que o backend real nunca terá (professorId, escolaId solto,
// dataNascimento, condicaoInformada, cid) — ver DataContext.jsx.
const STATUS_FROM_API = { ATIVO: 'ativo', ARQUIVADO: 'arquivado' };
const STATUS_TO_API = { ativo: 'ATIVO', arquivado: 'ARQUIVADO' };

export const normalizeAluno = (aluno) => ({ ...aluno, status: STATUS_FROM_API[aluno.status] ?? aluno.status });

const paraPayloadApi = (payload) => ({
  nome: payload.nome,
  turmaId: Number(payload.turmaId),
  responsavelNome: payload.responsavelNome,
  responsavelParentesco: payload.responsavelParentesco,
  responsavelTelefone: payload.responsavelTelefone,
});

export const listarPdiAlunos = async () => (await apiFetch('/api/pdi-alunos')).map(normalizeAluno);
export const listarMeusAlunosAuxiliarReais = async () => (await apiFetch('/api/pdi-alunos/meus-alunos')).map(normalizeAluno);
export const obterPdiAluno = async (id) => normalizeAluno(await apiFetch(`/api/pdi-alunos/${id}`));
export const criarPdiAlunoReal = async (payload) => normalizeAluno(await apiFetch('/api/pdi-alunos', { method: 'POST', body: paraPayloadApi(payload) }));
export const editarPdiAlunoReal = async (id, payload) => normalizeAluno(await apiFetch(`/api/pdi-alunos/${id}`, { method: 'PUT', body: paraPayloadApi(payload) }));
export const arquivarPdiAlunoReal = async (id) => normalizeAluno(await apiFetch(`/api/pdi-alunos/${id}/arquivar`, { method: 'POST' }));
export const reativarPdiAlunoReal = async (id) => normalizeAluno(await apiFetch(`/api/pdi-alunos/${id}/reativar`, { method: 'POST' }));

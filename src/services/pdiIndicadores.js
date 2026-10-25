import { apiFetch } from './api';

// Indicadores de desenvolvimento de UM aluno (perfil do aluno) — ver backend routes/pdiIndicadores.ts.
export const obterIndicadoresAluno = async (alunoId) => apiFetch(`/api/pdi-indicadores/alunos/${alunoId}`);

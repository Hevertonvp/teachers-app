import { apiFetch } from './api';

// Desativados e encerrados por área (15/11/2026), só Secretaria. Paginado no servidor, mais recentes primeiro.
// tipo: escolas | turmas | pessoas | cargos | vinculos-escolares | turmas-professor | turmas-auxiliar |
//       atuacoes | perguntas-padrao | alunos-pdi | modelos-pdi
export const listarDesativados = (tipo, { pagina = 1, porPagina = 20, ...extra } = {}) => {
  const q = new URLSearchParams({ tipo, pagina: String(pagina), porPagina: String(porPagina) });
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return apiFetch(`/api/desativados?${q.toString()}`);
};

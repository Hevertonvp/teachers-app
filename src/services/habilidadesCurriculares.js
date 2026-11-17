import { apiFetch } from './api';

// Busca no catálogo CRMG (só o construtor de Modelos PDI usa). O backend resolve
// disciplina -> componente curricular e devolve no máximo 20 sugestões — o catálogo nunca vem
// inteiro para o frontend.
export const buscarHabilidadesCurriculares = async (disciplinaId, q, { signal } = {}) => {
  const params = new URLSearchParams({ disciplinaId: String(disciplinaId), q });
  return apiFetch(`/api/habilidades-curriculares?${params.toString()}`, { signal });
};

// Catálogo da BNCC Computação (17/11/2026). Com `ano`: as habilidades daquele ano (Ficha). Sem: todas (Configurações).
export const listarHabilidadesComputacao = async (ano, { signal } = {}) =>
  apiFetch(`/api/habilidades-curriculares/computacao${ano ? `?ano=${ano}` : ''}`, { signal });

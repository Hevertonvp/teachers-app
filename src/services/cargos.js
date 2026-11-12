import { apiFetch } from './api';

// Cargos do Professor (decisão do usuário, 12/11/2026): Professor → Cargo(s) → Escola(s) → Disciplina(s).
// Só a Secretaria cadastra, altera e encerra. Composição enviada: [{ escolaId, disciplinaIds: [] }].
const base = (professorId) => `/api/pessoas/professores/${professorId}/cargos`;

export const listarCargos = (professorId, { incluirEncerrados = false } = {}) => apiFetch(`${base(professorId)}${incluirEncerrados ? '?incluirEncerrados=1' : ''}`);
export const criarCargo = (professorId, dados) => apiFetch(base(professorId), { method: 'POST', body: dados });
export const alterarCargo = (professorId, cargoId, dados) => apiFetch(`${base(professorId)}/${cargoId}`, { method: 'PUT', body: dados });
export const encerrarCargo = (professorId, cargoId, dataFim) => apiFetch(`${base(professorId)}/${cargoId}/encerrar`, { method: 'POST', body: { dataFim } });

// "Prudenciana — Inglês, Geografia"; escola sem disciplina: só o nome da escola.
export const descreverParteCargo = (parte) => (parte.disciplinas?.length ? `${parte.escolaNome} — ${parte.disciplinas.map(d => d.nome).join(', ')}` : parte.escolaNome);

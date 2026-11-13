import { apiFetch } from './api';

// Cargos do Professor (decisão do usuário, 12/11/2026): Professor → Cargo(s) → Escola(s) → Disciplina(s).
// Só a Secretaria cadastra, altera e encerra. Composição enviada: [{ escolaId, disciplinaIds: [] }].
const base = (professorId) => `/api/pessoas/professores/${professorId}/cargos`;

export const listarCargos = (professorId, { incluirEncerrados = false } = {}) => apiFetch(`${base(professorId)}${incluirEncerrados ? '?incluirEncerrados=1' : ''}`);
export const criarCargo = (professorId, dados) => apiFetch(base(professorId), { method: 'POST', body: dados });
export const alterarCargo = (professorId, cargoId, dados) => apiFetch(`${base(professorId)}/${cargoId}`, { method: 'PUT', body: dados });
export const encerrarCargo = (professorId, cargoId, dataFim, confirmarSaida = false) => apiFetch(`${base(professorId)}/${cargoId}/encerrar`, { method: 'POST', body: { dataFim, confirmarSaida } });
// Prévia (só leitura, 13/11/2026): escolas e turmas de onde o professor SAI se o cargo ficar com `composicao`
// ou for encerrado (`{ encerrar: true }`). Lista vazia = ninguém sai de nada.
export const previaSaidasCargo = (professorId, cargoId, dados) => apiFetch(`${base(professorId)}/${cargoId}/saidas`, { method: 'POST', body: dados });

// "Prudenciana — Inglês, Geografia", "CMEI — Professor Regente", "Escola X — Inglês; Professor de Intervenção".
export const descreverParteCargo = (parte) => {
  const itens = [(parte.disciplinas ?? []).map(d => d.nome).join(', '), (parte.atuacoes ?? []).map(a => a.nome).join(', ')].filter(Boolean);
  return itens.length ? `${parte.escolaNome} — ${itens.join('; ')}` : parte.escolaNome;
};

// Atuações pedagógicas (12/11/2026): catálogo da Secretaria (Configurações). Professor Regente, Oficina do
// Brincar, Professor de Intervenção… Não são disciplinas.
export const listarAtuacoes = () => apiFetch('/api/atuacoes-pedagogicas');
export const criarAtuacao = (nome) => apiFetch('/api/atuacoes-pedagogicas', { method: 'POST', body: { nome } });
export const alterarAtuacao = (id, dados) => apiFetch(`/api/atuacoes-pedagogicas/${id}`, { method: 'PUT', body: dados });

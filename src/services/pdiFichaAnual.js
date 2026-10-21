import { apiFetch } from './api';

// Ficha Anual PDI real — consolidado leve (nunca respostas completas), consumido por
// FichaAnualPdiPage.jsx. Abrir um período/disciplina continua indo pra rota já existente de
// Ficha PDI (services/pdiFichas.js), sem duplicar nada aqui.
export const obterFichaAnualReal = (alunoId, ano) => apiFetch(`/api/pdi-ficha-anual/${alunoId}/${ano}`);

// Anos com algum dado pra este aluno (mais recente primeiro) — usado pro seletor de anos, pra
// nunca deixar a pessoa navegando às cegas "anterior/próximo" sem saber onde tem conteúdo.
export const listarAnosFichaAnualReal = (alunoId) => apiFetch(`/api/pdi-ficha-anual/${alunoId}/anos`);

export const fecharFichaAnualReal = (alunoId, ano) => apiFetch(`/api/pdi-ficha-anual/${alunoId}/${ano}/fechar`, { method: 'POST' });

export const obterCicloAnualReal = (ano) => apiFetch(`/api/pdi-ficha-anual/ciclo/${ano}`);

export const salvarCicloAnualReal = (ano, dataEncerramento) => apiFetch(`/api/pdi-ficha-anual/ciclo/${ano}`, {
  method: 'PUT',
  body: { dataEncerramento },
});

import { apiFetch } from './api';

// Ficha Anual PDI real — consolidado leve (nunca respostas completas), consumido por
// FichaAnualPdiPage.jsx. Abrir um período/disciplina continua indo pra rota já existente de
// Ficha PDI (services/pdiFichas.js), sem duplicar nada aqui.
export const obterFichaAnualReal = (alunoId, ano) => apiFetch(`/api/pdi-ficha-anual/${alunoId}/${ano}`);

export const fecharFichaAnualReal = (alunoId, ano) => apiFetch(`/api/pdi-ficha-anual/${alunoId}/${ano}/fechar`, { method: 'POST' });

export const obterCicloAnualReal = (ano) => apiFetch(`/api/pdi-ficha-anual/ciclo/${ano}`);

export const salvarCicloAnualReal = (ano, dataEncerramento) => apiFetch(`/api/pdi-ficha-anual/ciclo/${ano}`, {
  method: 'PUT',
  body: { dataEncerramento },
});

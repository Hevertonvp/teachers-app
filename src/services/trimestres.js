import { apiFetch } from './api';
import { trimestres } from '../utils/trimestres';

// Calendário de trimestres por ano letivo (Configurações > Trimestres), persistido no backend.
// Converte para o mesmo formato que a tela sempre usou: { ano, trimestre: '1º trimestre', startDate, endDate }.
const daApi = (p) => ({ ano: p.ano, trimestre: trimestres[p.trimestre - 1], startDate: p.dataInicio, endDate: p.dataFim });
const numeroDo = (rotulo) => trimestres.indexOf(rotulo) + 1;

export const listarTrimestres = async () => (await apiFetch('/api/trimestres')).map(daApi);

// Salva um ou mais trimestres de UM ano de uma vez — devolve o calendário completo daquele ano.
// Data vazia vai como null de propósito: o backend recusa com mensagem dizendo qual trimestre
// ficou sem qual data.
export const salvarCalendarioTrimestres = async (ano, periodos) => (await apiFetch(`/api/trimestres/${ano}`, {
  method: 'PUT',
  body: {
    periodos: periodos.map(p => ({ trimestre: numeroDo(p.trimestre), dataInicio: p.startDate || null, dataFim: p.endDate || null })),
  },
})).map(daApi);

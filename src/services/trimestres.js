import { apiFetch } from './api';
import { trimestres } from '../utils/trimestres';

// Calendário de trimestres (Configurações > Trimestres), persistido no backend. Converte para o
// mesmo formato que a tela sempre usou: { trimestre: '1º trimestre', startDate, endDate }.
const daApi = (p) => ({ trimestre: trimestres[p.trimestre - 1], startDate: p.dataInicio, endDate: p.dataFim });
const numeroDo = (rotulo) => trimestres.indexOf(rotulo) + 1;

export const listarTrimestres = async () => (await apiFetch('/api/trimestres')).map(daApi);

export const atualizarTrimestre = async (rotulo, payload) => daApi(await apiFetch(`/api/trimestres/${numeroDo(rotulo)}`, {
  method: 'PUT',
  body: {
    ...(payload.startDate ? { dataInicio: payload.startDate } : {}),
    ...(payload.endDate ? { dataFim: payload.endDate } : {}),
  },
}));

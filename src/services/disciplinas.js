import { apiFetch } from './api';

// Disciplinas reais (10 registros já existentes no Neon) — fonte nova e reutilizável para os
// próximos blocos (Professor↔Turma↔Disciplina, Modelos PDI, fichas). Nenhum módulo consome esta
// lista ainda: por enquanto ela só fica disponível via DataContext (`disciplinasReais`), lado a
// lado com o mock `disciplinas` que continua alimentando o PDI por disciplina sem alteração.
export const listarDisciplinas = () => apiFetch('/api/disciplinas');

import { apiFetch } from './api';

// Catálogo de níveis da Educação Infantil (16/11/2026): [{ id, nome, faixa: 'CRECHE'|'PRE_ESCOLA', ordem, status }].
export const listarNiveisInfantil = () => apiFetch('/api/niveis-infantil');

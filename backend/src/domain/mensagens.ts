// Regras puras de quem pode conversar com quem — sem I/O, testável isoladamente. A autorização de
// verdade (vínculo atual + mesma escola) mora nas rotas (mensagens.ts), que são as únicas com
// acesso ao banco; aqui só a matriz da hierarquia em si.

export type PerfilMensagem = 'SECRETARIA' | 'DIRETORA' | 'GESTOR' | 'PROFESSOR' | 'AUXILIAR';

// Pares não-ordenados permitidos (seção 3 do pedido de Mensagens). SECRETARIA só fala com
// DIRETORA; DIRETORA fala com todo mundo (pra cima e pra baixo); GESTOR fala com DIRETORA/
// PROFESSOR/AUXILIAR da própria escola, nunca outro GESTOR; PROFESSOR/AUXILIAR só falam pra cima
// (DIRETORA/GESTOR), nunca entre si nem com SECRETARIA.
const PARES_PERMITIDOS: [PerfilMensagem, PerfilMensagem][] = [
  ['SECRETARIA', 'DIRETORA'],
  ['DIRETORA', 'GESTOR'],
  ['DIRETORA', 'PROFESSOR'],
  ['DIRETORA', 'AUXILIAR'],
  ['GESTOR', 'PROFESSOR'],
  ['GESTOR', 'AUXILIAR'],
];

export function podeConversar(a: PerfilMensagem, b: PerfilMensagem): boolean {
  return PARES_PERMITIDOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Só estes perfis podem originar um envio em massa (vários destinatários numa única ação) —
// Professor/Auxiliar enviam sempre individual (seção 4 do pedido).
export function podeEnviarEmMassa(perfil: PerfilMensagem): boolean {
  return perfil === 'SECRETARIA' || perfil === 'DIRETORA' || perfil === 'GESTOR';
}

// Secretaria é autoridade de rede (sem VinculoEscolar próprio, mesma filosofia de
// escolasPermitidas em pessoas.ts) — os demais perfis precisam de VinculoEscolar ATIVO na escola
// da conversa pra manter acesso.
export function exigeVinculoEscolarProprio(perfil: PerfilMensagem): boolean {
  return perfil !== 'SECRETARIA';
}

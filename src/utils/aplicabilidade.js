export const RECURSOS = {
  MENSAGENS: 'mensagens',
  PDI: 'pdi',
  FORMULARIO_UM_TERCO: 'formulario_um_terco',
  CORRECOES_SIMULADOS: 'correcoes_simulados',
};

// Escolas compatíveis com cada recurso no mock atual.
export const ESCOLAS_COMPATIVEIS = {
  [RECURSOS.MENSAGENS]: Array.from({ length: 34 }, (_, index) => index + 1),
  [RECURSOS.PDI]: Array.from({ length: 20 }, (_, index) => index + 1),
  [RECURSOS.FORMULARIO_UM_TERCO]: Array.from({ length: 24 }, (_, index) => index + 1),
  [RECURSOS.CORRECOES_SIMULADOS]: Array.from({ length: 24 }, (_, index) => index + 1),
};

export const getEscolaIdsAplicaveis = (recurso) => ESCOLAS_COMPATIVEIS[recurso] || [];

export const getEscolasAplicaveis = (recurso, escolas) => {
  const ids = new Set(getEscolaIdsAplicaveis(recurso));
  return escolas.filter(escola => ids.has(escola.id));
};

export const isEscolaAplicavel = (recurso, escolaId) => getEscolaIdsAplicaveis(recurso).includes(Number(escolaId));

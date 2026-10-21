export const RECURSOS = {
  MENSAGENS: 'mensagens',
  PDI: 'pdi',
  FORMULARIO_UM_TERCO: 'formulario_um_terco',
  CORRECOES_SIMULADOS: 'correcoes_simulados',
};

// Escolas compatíveis com cada recurso ainda mock (Formulário 1/3 e Correções-simulados — telas
// "Em construção", fora do escopo real desta entrega). PDI é real/em produção e NUNCA deve ser
// restrito por uma lista de ids: travar por id causava um bug de verdade — uma escola real criada
// depois, com id maior que o range mock, ficava invisível pro PDI sem nenhum motivo de negócio.
export const ESCOLAS_COMPATIVEIS = {
  [RECURSOS.MENSAGENS]: Array.from({ length: 34 }, (_, index) => index + 1),
  [RECURSOS.FORMULARIO_UM_TERCO]: Array.from({ length: 24 }, (_, index) => index + 1),
  [RECURSOS.CORRECOES_SIMULADOS]: Array.from({ length: 24 }, (_, index) => index + 1),
};

export const getEscolaIdsAplicaveis = (recurso) => ESCOLAS_COMPATIVEIS[recurso] || [];

export const getEscolasAplicaveis = (recurso, escolas) => (
  recurso === RECURSOS.PDI ? escolas : escolas.filter(escola => getEscolaIdsAplicaveis(recurso).includes(escola.id))
);

export const isEscolaAplicavel = (recurso, escolaId) => (
  recurso === RECURSOS.PDI ? true : getEscolaIdsAplicaveis(recurso).includes(Number(escolaId))
);

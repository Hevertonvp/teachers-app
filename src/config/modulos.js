// Módulos ligados/desligados na interface (lançamento "Educa São João").
//
// MODO_PDI:
//   'ativo'      → PDI funciona normalmente.
//   'desenvolvimento' → tudo do PDI aparece (menu, cartões, telas), mas desabilitado com o aviso
//                  "Em desenvolvimento" (decisão do usuário, 11/11/2026: esconder assustaria as escolas; "manutenção" soava mal).
//   'oculto'     → PDI some da interface (menu, cartões) e as rotas voltam ao Dashboard.
// Só muda o frontend; a API e os dados do PDI continuam intactos.
export const MODO_PDI = 'desenvolvimento';

export const PDI_ATIVO = MODO_PDI === 'ativo';
export const PDI_EM_DESENVOLVIMENTO = MODO_PDI === 'desenvolvimento';
export const PDI_VISIVEL = MODO_PDI !== 'oculto';

export const AVISO_PDI_DESENVOLVIMENTO = 'O PDI está em desenvolvimento e estará disponível em breve. O Formulário 1/3 funciona normalmente.';

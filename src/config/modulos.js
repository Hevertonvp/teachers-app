// Módulos ligados/desligados na interface (lançamento "Educa São João").
//
// Modos do PDI:
//   'ativo'      → PDI funciona normalmente.
//   'desenvolvimento' → tudo do PDI aparece (menu, cartões, telas), mas desabilitado com o aviso
//                  "Em desenvolvimento" (decisão do usuário, 11/11/2026: esconder assustaria as escolas; "manutenção" soava mal).
//   'oculto'     → PDI some da interface (menu, cartões) e as rotas voltam ao Dashboard.
// 12/11/2026: PDI liberado por inteiro até segunda ordem (pedido do usuário).
// 19/11/2026 (decisão do usuário): o modo passou a depender do perfil — a Secretaria usa MODO_PDI (ativo, para
// montar Modelos/Aplicações); TODOS os demais perfis usam MODO_PDI_DEMAIS ("em desenvolvimento", sem mexer).
// O servidor faz o mesmo bloqueio (backend/src/config/modulos.ts, chave PDI_LIBERADO). Para lançar o PDI para
// todos: trocar MODO_PDI_DEMAIS para 'ativo' aqui E PDI_LIBERADO=true no Render.
import { useAuth } from '../context/AuthContext';
import { isSecretaria } from '../utils/roles';

export const MODO_PDI = 'ativo';
export const MODO_PDI_DEMAIS = 'desenvolvimento';

// Valores fixos da Secretaria (mantidos para quem não depende do usuário logado).
export const PDI_ATIVO = MODO_PDI === 'ativo';
export const PDI_EM_DESENVOLVIMENTO = MODO_PDI === 'desenvolvimento';
export const PDI_VISIVEL = MODO_PDI !== 'oculto';

export const modoPdiDe = (user) => (isSecretaria(user) ? MODO_PDI : MODO_PDI_DEMAIS);

// Modo do PDI para o usuário logado — usar em todo lugar que decide o que mostrar do PDI.
export function useModoPdi() {
  const { user } = useAuth();
  const modo = modoPdiDe(user);
  return { PDI_ATIVO: modo === 'ativo', PDI_EM_DESENVOLVIMENTO: modo === 'desenvolvimento', PDI_VISIVEL: modo !== 'oculto' };
}

export const AVISO_PDI_DESENVOLVIMENTO = 'O PDI está em desenvolvimento e estará disponível em breve. O Formulário 1/3 funciona normalmente.';

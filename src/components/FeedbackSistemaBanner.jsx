import { Link } from 'react-router-dom';

// Chamada visível na tela principal (seção 3/22 do pedido de Feedback do Sistema) — para TODOS
// os perfis autenticados, exceto SUPORTE_SISTEMA (cuja própria tela inicial já É a caixa de
// feedbacks). Leva direto para o formulário de criação.
export const FeedbackSistemaBanner = () => (
  <Link
    to="/feedback-sistema/novo"
    className="block rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 transition hover:bg-teal-100 sm:px-5 sm:py-4"
  >
    Encontrou um problema ou tem uma sugestão para melhorar o sistema?{' '}
    <span className="underline">Avise o desenvolvedor aqui.</span>
  </Link>
);

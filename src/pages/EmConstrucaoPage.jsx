import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';

// Placeholder genérico para toda funcionalidade fora do escopo desta primeira entrega (só o PDI
// por disciplina e o que ele depende — Escolas/Turmas/Pessoas — está liberado). O link continua
// visível no menu para todos os perfis; ao entrar, mostra só este aviso, sem nenhum dado mock.
export const EmConstrucaoPage = () => (
  <MainLayout>
    <EmptyState title="Em construção">
      <VoltarButton />
    </EmptyState>
  </MainLayout>
);

const VoltarButton = () => {
  const navigate = useNavigate();
  return <Button variant="outline" onClick={() => navigate('/dashboard')}>Voltar ao início</Button>;
};

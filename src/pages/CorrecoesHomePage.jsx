import { Link } from 'react-router-dom';
import { Card, EmptyState } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { canViewCorrecoesPdi } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Hub de Correções (seção 12/22 do pedido de Ficha Anual/Correções): preparado para, no futuro,
// ter mais de uma subárea (PDI, 1/3, outros) — hoje só PDI existe de verdade. Quem não tem acesso
// a nenhuma subárea continua vendo exatamente "Em construção", igual via /correcoes-simulados.
export const CorrecoesHomePage = () => {
  const { user } = useAuth();
  const temAlgumaSubarea = canViewCorrecoesPdi(user);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Correções</h1>
          <p className="mt-2 text-slate-600">Revisão e correção dos instrumentos já concluídos.</p>
        </div>

        {temAlgumaSubarea ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {canViewCorrecoesPdi(user) && (
              <Link to="/correcoes/pdi">
                <Card className="h-full transition hover:border-teal-300 hover:shadow-md">
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">Correção de Fichas PDI</p>
                  <p className="mt-2 text-sm text-slate-600">Localizar, corrigir diretamente ou devolver Fichas PDI já concluídas.</p>
                </Card>
              </Link>
            )}
          </div>
        ) : (
          <EmptyState title="Em construção" />
        )}
      </div>
    </MainLayout>
  );
};

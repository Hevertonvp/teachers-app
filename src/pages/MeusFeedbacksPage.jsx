import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, DataTable, EmptyState } from '../components/Common';
import { STATUS_LABEL, STATUS_VARIANT, categoriaLabel, listarMeusFeedbacksReais } from '../services/feedbackSistema';
import { MainLayout } from '../layouts/Layouts';

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

// Meus feedbacks (seção 8 do pedido) — só os próprios, nunca os de outra pessoa.
export const MeusFeedbacksPage = () => {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarMeusFeedbacksReais()
      .then(setItens)
      .catch((error) => setErro(error.message))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="text-3xl font-bold text-slate-950">Meus feedbacks</h1>
          <Link to="/feedback-sistema/novo"><Button>+ Novo feedback</Button></Link>
        </div>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        {carregando ? (
          <p className="text-center text-slate-500">Carregando...</p>
        ) : itens.length === 0 ? (
          <EmptyState title="Nenhum feedback enviado ainda" description="Encontrou um problema ou tem uma sugestão? Clique em “Novo feedback”.">
            <Link to="/feedback-sistema/novo"><Button>+ Novo feedback</Button></Link>
          </EmptyState>
        ) : (
          <DataTable
            columns={[
              { key: 'assunto', header: 'Assunto' },
              { key: 'categoria', header: 'Categoria', render: (item) => categoriaLabel(item.categoria) },
              { key: 'status', header: 'Status', render: (item) => <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge> },
              { key: 'updatedAt', header: 'Última atualização', render: (item) => formatarDataHora(item.updatedAt ?? item.createdAt) },
            ]}
            rows={itens}
            onRowClick={(item) => navigate(`/feedback-sistema/meus/${item.id}`)}
          />
        )}
      </div>
    </MainLayout>
  );
};

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Badge, Card, DataTable, EmptyState } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { isSecretaria } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue' };

export const AnamnesesPendentesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listarAnamnesesPendentes } = useData();
  const { activeEscolaId, userEscolas } = useEscola();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [alunos, setAlunos] = useState([]);

  const escolaAtiva = userEscolas.find(escola => escola.id === activeEscolaId);

  useEffect(() => {
    if (activeEscolaId === null) { setCarregando(false); return; }
    setCarregando(true);
    setErro('');
    listarAnamnesesPendentes(activeEscolaId).then(resultado => {
      setCarregando(false);
      if (!resultado.ok) { setErro(resultado.error); return; }
      setAlunos(resultado.alunos);
    });
  }, [activeEscolaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSecretaria(user)) return <Navigate to="/dashboard" replace />;

  const columns = [
    { key: 'nome', header: 'Aluno', render: row => <span className="font-semibold text-slate-900">{row.nome}</span> },
    { key: 'turma', header: 'Turma', render: row => row.turmaNome },
    { key: 'status', header: 'Anamnese', render: row => (
      row.statusAnamnese ? <Badge variant={STATUS_VARIANT[row.statusAnamnese]}>{STATUS_LABEL[row.statusAnamnese]}</Badge> : <Badge variant="gray">Não iniciada</Badge>
    ) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/pdi" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar</Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Anamnese</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Alunos com Anamnese pendente</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            {escolaAtiva ? <>Alunos de <strong>{escolaAtiva.nome}</strong> cuja Anamnese ainda não foi concluída (nunca iniciada ou em preenchimento).</> : 'Selecione uma escola no topo da tela para ver os alunos pendentes.'}
          </p>
        </div>

        {activeEscolaId === null ? (
          <Card><EmptyState title="Nenhuma escola selecionada" description="Escolha uma escola no seletor do topo para consultar a Anamnese pendente dos alunos dela." /></Card>
        ) : erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">Não foi possível carregar: {erro}</div>
        ) : carregando ? (
          <Card><p className="text-center text-slate-500">Carregando...</p></Card>
        ) : (
          <DataTable
            columns={columns}
            rows={alunos}
            onRowClick={row => navigate(`/pdi/alunos/${row.id}/anamnese`)}
            emptyMessage="Nenhum aluno pendente — todas as Anamneses desta escola estão concluídas."
          />
        )}
      </div>
    </MainLayout>
  );
};

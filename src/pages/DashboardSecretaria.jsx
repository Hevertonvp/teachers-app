import { Badge, Card, DataTable, StatCard } from '../components/Common';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';

export const DashboardSecretaria = () => {
  const { escolas, turmas } = useData();
  const { activeEscolaId, setActiveEscolaId } = useEscola();

  const escolasVisualizadas = activeEscolaId === null ? escolas : escolas.filter(escola => escola.id === activeEscolaId);
  const escolasAtivas = escolasVisualizadas.filter(escola => escola.status === 'ativa').length;
  const escolasInativas = escolasVisualizadas.length - escolasAtivas;
  const turmasVisualizadas = activeEscolaId === null ? turmas : turmas.filter(turma => turma.escolaId === activeEscolaId);
  const titulo = activeEscolaId === null ? 'Secretaria de Educação' : escolasVisualizadas[0]?.nome;
  const descricao = activeEscolaId === null ? 'Indicadores gerais da rede municipal de ensino.' : 'Indicadores agregados da escola selecionada.';

  const resumos = escolasVisualizadas.map(escola => ({
    id: escola.id,
    escola,
    totalTurmas: turmas.filter(turma => turma.escolaId === escola.id).length,
  }));

  const columns = [
    { key: 'escola', header: 'Escola', render: row => row.escola.nome },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.escola.status === 'ativa' ? 'green' : 'gray'}>{row.escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge> },
    { key: 'totalTurmas', header: 'Turmas' },
    { key: 'totalAlunos', header: 'Alunos PDI', render: () => '—' },
  ];

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Visão geral da rede</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">{titulo}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{descricao}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Escolas" value={activeEscolaId === null ? escolas.length : 1} description={activeEscolaId === null ? 'na rede' : 'selecionada'} />
              <StatCard label="Ativas" value={escolasAtivas} description="escolas" />
              <StatCard label="Inativas" value={escolasInativas} description="escolas" />
              <StatCard label="Turmas" value={turmasVisualizadas.length} description={activeEscolaId === null ? 'na rede' : 'na escola'} />
            </div>
          </div>
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">{activeEscolaId === null ? 'Escolas da Rede' : 'Resumo da Escola'}</h2>
              <p className="mt-1 text-sm text-slate-600">Estrutura cadastrada por escola. O módulo PDI é gerenciado em Escolas/Turmas/Pessoas e no menu PDI.</p>
            </div>
            <DataTable columns={columns} rows={resumos} onRowClick={activeEscolaId === null ? row => setActiveEscolaId(row.escola.id) : undefined} emptyMessage="Nenhuma escola cadastrada" />
          </Card>
        </section>

        <section>
          <Card className="border-dashed bg-slate-50 text-center">
            <p className="font-semibold text-slate-800">Em construção</p>
            <p className="mt-1 text-sm text-slate-500">Indicadores de Formulário 1/3, Correções de simulados e demais instrumentos serão liberados nas próximas entregas.</p>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

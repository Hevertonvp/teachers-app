import { Link } from 'react-router-dom';
import { Badge, Button, Card, DataTable, ProgressRing, StatCard } from '../components/Common';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { resumoEscola } from '../utils/escolas';

const percentageComplete = (items) => {
  if (!items.length) return 0;
  return Math.round((items.filter(item => ['concluido', 'concluído'].includes(item.status)).length / items.length) * 100);
};

export const DashboardSecretaria = () => {
  const { escolas, professores, gestores, diretores, turmas, formularios, pdis, correcoes, vinculosEscolares } = useData();
  const { activeEscolaId, setActiveEscolaId } = useEscola();

  const contexto = { turmas, formularios, pdis, correcoes, vinculosEscolares };
  const escolasVisualizadas = activeEscolaId === null ? escolas : escolas.filter(escola => escola.id === activeEscolaId);
  const resumos = escolasVisualizadas.map(escola => resumoEscola(escola, contexto));
  const totalAlunos = resumos.reduce((total, item) => total + item.totalAlunos, 0);
  const profissionais = [
    ...professores.map(professor => ({ tipo: 'professor', id: professor.id, status: professor.status })),
    ...gestores.map(gestor => ({ tipo: 'gestor', id: gestor.id, status: gestor.status })),
    ...diretores.map(diretor => ({ tipo: 'diretora', id: diretor.id, status: diretor.status })),
  ];
  const idsProfissionaisVisualizados = new Set(vinculosEscolares
    .filter(vinculo => vinculo.status === 'ativo' && escolasVisualizadas.some(escola => escola.id === vinculo.escolaId))
    .map(vinculo => `${vinculo.usuarioTipo}:${vinculo.usuarioId}`));
  const totalProfissionais = activeEscolaId === null
    ? new Set(profissionais.filter(pessoa => pessoa.status === 'ativo').map(pessoa => `${pessoa.tipo}:${pessoa.id}`)).size
    : idsProfissionaisVisualizados.size;
  const escolasAtivas = escolasVisualizadas.filter(escola => escola.status === 'ativa').length;
  const escolasInativas = escolasVisualizadas.length - escolasAtivas;
  const turmasVisualizadas = activeEscolaId === null ? turmas : turmas.filter(turma => turma.escolaId === activeEscolaId);
  const formulariosVisualizados = activeEscolaId === null ? formularios : formularios.filter(item => item.escolaId === activeEscolaId);
  const pdisVisualizados = activeEscolaId === null ? pdis : pdis.filter(item => item.escolaId === activeEscolaId);
  const correcoesVisualizadas = activeEscolaId === null ? correcoes : correcoes.filter(item => item.escolaId === activeEscolaId);
  const indicadores = [
    { label: 'Formulário 1/3', value: percentageComplete(formulariosVisualizados) },
    { label: 'PDI', value: percentageComplete(pdisVisualizados) },
    { label: 'Correções', value: percentageComplete(correcoesVisualizadas) },
  ];
  const titulo = activeEscolaId === null ? 'Secretaria de Educação' : resumos[0]?.escola.nome;
  const descricao = activeEscolaId === null ? 'Indicadores gerais da rede municipal de ensino.' : 'Indicadores agregados da escola selecionada.';

  const columns = [
    { key: 'escola', header: 'Escola', render: row => row.escola.nome },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.escola.status === 'ativa' ? 'green' : 'gray'}>{row.escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge> },
    { key: 'formulario', header: 'Formulário 1/3', render: row => `${row.formulario}%` },
    { key: 'pdi', header: 'PDI', render: row => `${row.pdi}%` },
    { key: 'correcoes', header: 'Correções', render: row => `${row.correcoes}%` },
    { key: 'totalProfissionais', header: 'Pessoas' },
    { key: 'totalTurmas', header: 'Turmas' },
    { key: 'totalAlunos', header: 'Alunos' },
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
              {activeEscolaId !== null && (
                <Link to="/mensagens" state={{ openCompose: true }} className="mt-4 inline-block">
                  <Button variant="outline" size="sm">Enviar mensagem à diretoria</Button>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Escolas" value={activeEscolaId === null ? escolas.length : 1} description={activeEscolaId === null ? 'na rede' : 'selecionada'} />
              <StatCard label="Ativas" value={escolasAtivas} description="escolas" />
              <StatCard label="Inativas" value={escolasInativas} description="escolas" />
              <StatCard label="Profissionais" value={totalProfissionais} description="na rede" />
              <StatCard label="Turmas" value={turmasVisualizadas.length} description={activeEscolaId === null ? 'na rede' : 'na escola'} />
              <StatCard label="Alunos" value={totalAlunos} description="matriculados" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {indicadores.map(indicador => <Card key={indicador.label}><ProgressRing value={indicador.value} label={indicador.label} /></Card>)}
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">{activeEscolaId === null ? 'Escolas da Rede' : 'Resumo da Escola'}</h2>
              <p className="mt-1 text-sm text-slate-600">{activeEscolaId === null ? 'Situação dos instrumentos pedagógicos por escola.' : 'Situação agregada dos instrumentos pedagógicos.'}</p>
            </div>
            <DataTable columns={columns} rows={resumos} onRowClick={activeEscolaId === null ? row => setActiveEscolaId(row.escola.id) : undefined} emptyMessage="Nenhuma escola cadastrada" />
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

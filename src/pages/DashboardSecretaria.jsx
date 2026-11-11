import { useEffect, useState } from 'react';
import { Badge, Button, Card, DataTable, StatCard } from '../components/Common';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { EntregaPdiGestao } from '../components/EntregaPdiGestao';
import { EntregaUmTercoGestao } from '../components/EntregaUmTercoGestao';
import { FeedbackSistemaBanner } from '../components/FeedbackSistemaBanner';
import { MainLayout } from '../layouts/Layouts';
import { obterIndicadoresPdiReais } from '../services/pdiAplicacoes';
import { PDI_ATIVO } from '../config/modulos';

export const DashboardSecretaria = () => {
  const { escolas, turmas, escolasLoading, escolasError, turmasLoading, loadEscolas } = useData();
  const { activeEscolaId, setActiveEscolaId } = useEscola();

  // Indicadores REAIS de preenchimento de PDI (nunca mock) — um item por escola, carregado à
  // parte (não é um recurso "global" do DataContext, só esta tela usa).
  const [indicadores, setIndicadores] = useState([]);
  const [indicadoresLoading, setIndicadoresLoading] = useState(true);
  const [indicadoresError, setIndicadoresError] = useState('');

  const carregarIndicadores = async () => {
    setIndicadoresLoading(true);
    setIndicadoresError('');
    try {
      setIndicadores(await obterIndicadoresPdiReais());
    } catch (error) {
      setIndicadoresError(error.message);
    } finally {
      setIndicadoresLoading(false);
    }
  };

  useEffect(() => { if (PDI_ATIVO) carregarIndicadores(); }, []);

  // Sem isso, a tela mostrava "0" em tudo por um instante a cada carregamento (e, num cold start
  // do backend em produção, por bem mais que um instante) — fácil de confundir com "sumiram as
  // escolas", quando na real os dados só ainda não tinham chegado.
  if (escolasLoading || turmasLoading) {
    return (
      <MainLayout>
        <p className="text-center text-slate-500">Carregando indicadores da rede...</p>
      </MainLayout>
    );
  }

  if (escolasError) {
    return (
      <MainLayout>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar as escolas: {escolasError}</span>
          <Button size="sm" variant="outline" onClick={loadEscolas}>Tentar novamente</Button>
        </div>
      </MainLayout>
    );
  }

  const escolasVisualizadas = activeEscolaId === null ? escolas : escolas.filter(escola => escola.id === activeEscolaId);
  const escolasAtivas = escolasVisualizadas.filter(escola => escola.status === 'ativa').length;
  const escolasInativas = escolasVisualizadas.length - escolasAtivas;
  const turmasVisualizadas = activeEscolaId === null ? turmas : turmas.filter(turma => turma.escolaId === activeEscolaId);
  const titulo = activeEscolaId === null ? 'Secretaria de Educação' : escolasVisualizadas[0]?.nome;
  const descricao = activeEscolaId === null ? 'Indicadores gerais da rede municipal de ensino.' : 'Indicadores agregados da escola selecionada.';

  const indicadorPorEscola = new Map(indicadores.map(item => [item.escolaId, item]));

  const resumos = escolasVisualizadas.map(escola => ({
    id: escola.id,
    escola,
    totalTurmas: turmas.filter(turma => turma.escolaId === escola.id).length,
    indicador: indicadorPorEscola.get(escola.id) ?? null,
  }));

  const columns = [
    { key: 'escola', header: 'Escola', render: row => row.escola.nome },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.escola.status === 'ativa' ? 'green' : 'gray'}>{row.escola.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge> },
    { key: 'totalTurmas', header: 'Turmas' },
    ...(!PDI_ATIVO ? [] : [{
      key: 'pdi',
      header: 'PDI preenchido',
      render: row => {
        if (indicadoresLoading) return <span className="text-slate-400">Carregando...</span>;
        if (!row.indicador || row.indicador.aplicacaoId === null) return <span className="text-slate-400">Sem aplicação ativa</span>;
        const { concluidas, totalEsperado } = row.indicador;
        if (totalEsperado === 0) return <span className="text-slate-400">Sem fichas esperadas</span>;
        const percentual = Math.round((concluidas / totalEsperado) * 100);
        return <span className="font-semibold text-slate-800">{concluidas}/{totalEsperado} <span className="font-normal text-slate-500">({percentual}%)</span></span>;
      },
    }]),
  ];

  return (
    <MainLayout>
      <div className="space-y-7">
        <FeedbackSistemaBanner />
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

        {/* Entrega do PDI e do Formulário 1/3 — mesmos números das telas de cada módulo (versão compacta). */}
        <section className="grid gap-6 lg:grid-cols-2">
          {PDI_ATIVO && <EntregaPdiGestao activeEscolaId={activeEscolaId} compacto link={{ para: '/pdi', texto: 'Abrir PDI' }} />}
          <EntregaUmTercoGestao activeEscolaId={activeEscolaId} compacto link={{ para: '/formulario-um-terco', texto: 'Abrir 1/3' }} />
        </section>

        <section>
          <Card>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-950">{activeEscolaId === null ? 'Escolas da Rede' : 'Resumo da Escola'}</h2>
            </div>
            <DataTable columns={columns} rows={resumos} onRowClick={activeEscolaId === null ? row => setActiveEscolaId(row.escola.id) : undefined} emptyMessage="Nenhuma escola cadastrada" />
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

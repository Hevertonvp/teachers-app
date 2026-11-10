import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, LoadingBlock } from '../components/Common';
import { EntregaPdiGestao } from '../components/EntregaPdiGestao';
import { PainelEntrega, ordenarPorEntrega, textoPrazo } from '../components/PainelEntrega';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { obterIndicadoresPdiReais } from '../services/pdiAplicacoes';
import { formatFullDate, formStatusClasses, formStatusLabel } from '../utils/formAvailability';
import { canManagePedagogico, isDiretora, isProfessor as isProfessorRole, isSecretaria } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';
import { BotaoExportarExcel } from '../components/BotaoExportarExcel';
import { obterExportacaoPdi } from '../services/exportacoes';
import { exportarExcel } from '../utils/exportarExcel';

// Página principal do PDI: painel de ENTREGA (dados reais) + atalhos do módulo.
// - Secretaria/Gestor/Diretora: GET /api/pdi-aplicacoes/indicadores (Fichas esperadas x concluídas
//   x em preenchimento da Aplicação vigente de cada escola, no escopo de quem consulta), filtrado
//   pela escola selecionada no topo quando houver.
// - Professor: as próprias Fichas (GET /api/pdi-fichas/meus-pdis), só das Aplicações vigentes.

const EntregaProfessor = () => {
  const { meusPdisReais, meusPdisReaisLoading, loadMeusPdisReais } = useData();
  useEffect(() => { loadMeusPdisReais(); }, [loadMeusPdisReais]);
  if (meusPdisReaisLoading) return <Card><LoadingBlock text="Carregando..." className="py-4" /></Card>;

  const vigentes = meusPdisReais.filter(item => item.statusVigencia === 'active' || item.editavelAgora);
  const agendadas = meusPdisReais.filter(item => item.statusVisual === 'agendado').length;
  const contar = (itens) => ({
    concluidas: itens.filter(i => i.statusVisual === 'concluido').length,
    emAndamento: itens.filter(i => i.statusVisual === 'em_andamento').length,
    naoIniciadas: itens.filter(i => i.statusVisual === 'nao_iniciado' || i.statusVisual === 'prazo_encerrado').length,
  });
  const porDisciplina = [...new Map(vigentes.map(i => [i.disciplinaId, i.disciplinaNome])).entries()]
    .map(([id, nome]) => ({ id, nome, ...contar(vigentes.filter(i => i.disciplinaId === id)) }));
  const porDisciplinaOrdenada = ordenarPorEntrega(porDisciplina);
  const alunos = new Set(vigentes.map(i => `${i.aplicacaoId}-${i.alunoId}`)).size;
  const prazoMaisProximo = vigentes.map(i => i.dataFim).filter(Boolean).sort()[0];

  return (
    <PainelEntrega
      titulo="Minhas fichas"
      descricao={vigentes.length ? `${alunos} ${alunos === 1 ? 'aluno' : 'alunos'}${prazoMaisProximo ? ` · ${textoPrazo(prazoMaisProximo)}` : ''}` : null}
      totais={contar(vigentes)}
      grupos={porDisciplinaOrdenada.length > 1 ? porDisciplinaOrdenada : []}
      vazio="Nenhuma Aplicação aberta."
      rodape={agendadas > 0 ? `${agendadas} ${agendadas === 1 ? 'ficha agendada' : 'fichas agendadas'}.` : null}
    />
  );
};

const STATUS_FICHA = { PENDENTE: 'Não iniciada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };

// Exportação do PDI: entrega por escola (mesmos números do painel acima) + Fichas, respostas e
// perguntas comuns no escopo de quem exporta. Respeita a escola escolhida no topo.
const exportarPdi = async ({ activeEscolaId, escolaNome, usuario }) => {
  const [indicadores, dados] = await Promise.all([
    obterIndicadoresPdiReais(),
    obterExportacaoPdi({ escolaId: activeEscolaId }),
  ]);
  const entrega = (activeEscolaId === null ? indicadores : indicadores.filter(i => i.escolaId === activeEscolaId));
  const aplicacaoNome = new Map(dados.fichas.map(f => [f.aplicacaoId, f.aplicacaoNome]));
  const ident = [
    { titulo: 'Escola', valor: l => l.escolaNome, largura: 30 },
    { titulo: 'Turma', valor: l => l.turmaNome },
    { titulo: 'Aluno', valor: l => l.alunoNome, largura: 32 },
  ];
  await exportarExcel({
    arquivo: 'nexo-pdi',
    usuario,
    filtros: [['Escola', activeEscolaId === null ? 'Todas as escolas (do seu acesso)' : escolaNome]],
    abas: [
      { nome: 'Fichas', linhas: dados.fichas, colunas: [
        ...ident,
        { titulo: 'Disciplina', valor: f => f.disciplinaNome, largura: 20 },
        { titulo: 'Professor', valor: f => f.professorNome, largura: 30 },
        { titulo: 'Aplicação', valor: f => f.aplicacaoNome || `Aplicação #${f.aplicacaoId}`, largura: 28 },
        { titulo: 'Trimestre', valor: f => f.aplicacaoTrimestre, tipo: 'numero' },
        { titulo: 'Início', valor: f => f.aplicacaoDataInicio, tipo: 'data' },
        { titulo: 'Fim', valor: f => f.aplicacaoDataFim, tipo: 'data' },
        { titulo: 'Status', valor: f => STATUS_FICHA[f.status] ?? f.status },
        { titulo: 'Concluída em', valor: f => f.concluidaEm, tipo: 'dataHora', largura: 18 },
        { titulo: 'Última alteração', valor: f => f.updatedAt, tipo: 'dataHora', largura: 18 },
        // A Ficha guarda a escola/turma de quando foi feita; o aluno pode ter sido transferido depois.
        { titulo: 'Escola atual do aluno', valor: f => f.alunoEscolaAtualNome, largura: 30 },
        { titulo: 'Turma atual do aluno', valor: f => f.alunoTurmaAtualNome },
      ] },
      { nome: 'Respostas', linhas: dados.respostas, colunas: [
        ...ident,
        { titulo: 'Disciplina', valor: r => r.disciplinaNome, largura: 20 },
        { titulo: 'Professor', valor: r => r.professorNome, largura: 30 },
        { titulo: 'Aplicação', valor: r => aplicacaoNome.get(r.aplicacaoId) || `Aplicação #${r.aplicacaoId}`, largura: 28 },
        { titulo: 'Seção', valor: r => r.secao, largura: 24 },
        { titulo: 'Subseção', valor: r => r.subsecao, largura: 20 },
        { titulo: 'Código', valor: r => r.codigo },
        { titulo: 'Pergunta', valor: r => r.pergunta, largura: 50 },
        { titulo: 'Resposta', valor: r => r.resposta, largura: 50 },
        { titulo: 'Complemento', valor: r => r.complemento, largura: 40 },
      ] },
      { nome: 'Perguntas comuns', linhas: dados.perguntasComuns, colunas: [
        ...ident,
        { titulo: 'Professor', valor: r => r.professorNome, largura: 30 },
        { titulo: 'Aplicação', valor: r => aplicacaoNome.get(r.aplicacaoId) || `Aplicação #${r.aplicacaoId}`, largura: 28 },
        { titulo: 'Pergunta', valor: r => r.pergunta, largura: 50 },
        { titulo: 'Resposta', valor: r => r.resposta, largura: 50 },
        { titulo: 'Complemento', valor: r => r.complemento, largura: 40 },
      ] },
      { nome: 'Entrega por escola', linhas: entrega, colunas: [
        { titulo: 'Escola', valor: i => i.escolaNome, largura: 30 },
        { titulo: 'Aplicação vigente', valor: i => i.aplicacaoId === null ? 'Sem Aplicação vigente' : (i.aplicacaoNome || `Aplicação #${i.aplicacaoId}`), largura: 28 },
        { titulo: 'Início', valor: i => i.aplicacaoDataInicio, tipo: 'data' },
        { titulo: 'Fim', valor: i => i.aplicacaoDataFim, tipo: 'data' },
        { titulo: 'Fichas esperadas', valor: i => i.totalEsperado, tipo: 'numero' },
        { titulo: 'Concluídas', valor: i => i.concluidas, tipo: 'numero' },
        { titulo: 'Em andamento', valor: i => i.emAndamento ?? 0, tipo: 'numero' },
        { titulo: 'Não iniciadas', valor: i => Math.max(0, i.totalEsperado - i.concluidas - (i.emAndamento ?? 0)), tipo: 'numero' },
      ] },
    ],
  });
};

const Atalho = ({ eyebrow, titulo, descricao, children }) => (
  <Card className="flex h-full flex-col justify-between gap-5 transition hover:border-slate-300 hover:shadow-md">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{eyebrow}</p>
      <h2 className="mt-1.5 text-lg font-bold text-slate-950">{titulo}</h2>
      <p className="mt-1.5 text-sm text-slate-600">{descricao}</p>
    </div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </Card>
);

export const PdiHomePage = () => {
  const { user } = useAuth();
  const { pdiAplicacoesReais, loadPdiAplicacoesReais } = useData();
  const { activeEscolaId, userEscolas } = useEscola();
  const isGestor = canManagePedagogico(user);
  const isProfessorUser = isProfessorRole(user);
  const souSecretaria = isSecretaria(user);
  const veEntregaGestao = isGestor || isDiretora(user);
  const pdiAplicavel = activeEscolaId !== null && isEscolaAplicavel(RECURSOS.PDI, activeEscolaId);

  useEffect(() => { if (isGestor) loadPdiAplicacoesReais(); }, [isGestor, loadPdiAplicacoesReais]);

  // Vigência do PDI é por Aplicação real (ver AplicacaoPdi/pdiAplicacoesReais) — pode haver várias
  // aplicações para a mesma escola. Aqui mostramos todas as aplicações da escola selecionada pelo
  // Gestor no topo.
  const aplicacoesDaEscola = pdiAplicavel ? pdiAplicacoesReais.filter(aplicacao => aplicacao.escolaId === activeEscolaId) : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Módulo PDI</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Plano de Desenvolvimento Individual</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* "Gerenciar formulário" e "Ver alunos" ficam só nos cartões abaixo (pedido do usuário: sem botões duplicados no topo). */}
            {isProfessorUser && <Link to="/pdi/meus-pdis"><Button>Meus PDIs</Button></Link>}
            {veEntregaGestao && <BotaoExportarExcel gerar={() => exportarPdi({ activeEscolaId, escolaNome: userEscolas.find(e => e.id === activeEscolaId)?.nome, usuario: user?.nome })} />}
          </div>
        </div>

        {veEntregaGestao && <EntregaPdiGestao activeEscolaId={activeEscolaId} />}
        {isProfessorUser && <EntregaProfessor />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Atalho eyebrow={isGestor ? 'Modelos e aplicações' : 'PDI por disciplina'} titulo="Formulário PDI" descricao={isGestor ? 'Modelos, perguntas e Aplicações.' : 'Preencha as fichas dos seus alunos.'}>
            {isGestor ? <Link to="/pdi/formulario"><Button size="sm" variant="outline">Gerenciar formulário</Button></Link> : <Link to="/pdi/meus-pdis"><Button size="sm" variant="outline">Meus PDIs</Button></Link>}
          </Atalho>
          <Atalho eyebrow="Acompanhamento pedagógico" titulo="Alunos PDI" descricao={isProfessorUser ? 'Seus alunos PDI.' : 'Indicadores de cada aluno.'}>
            <Link to={isProfessorUser ? '/pdi/meus-pdis' : '/pdi/alunos'}><Button size="sm" variant="outline">Ver alunos</Button></Link>
          </Atalho>
          {souSecretaria && (
            <Atalho eyebrow="Perfil inicial do aluno" titulo="Anamnese" descricao="Modelo e anamneses pendentes.">
              <Link to="/pdi/anamnese-modelo"><Button size="sm" variant="outline">Configurar modelo</Button></Link>
              <Link to="/pdi/anamnese/pendentes"><Button size="sm">Preencher anamnese</Button></Link>
            </Atalho>
          )}
        </div>

        {isGestor && aplicacoesDaEscola.length > 0 && <Card>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-xl font-bold text-slate-950">Aplicações PDI desta escola</h2></div>
            <Link to="/pdi/formulario"><Button size="sm" variant="outline">Gerenciar formulário</Button></Link>
          </div>
          <div className="space-y-3">
            {aplicacoesDaEscola.map(aplicacao => (
              <Link key={aplicacao.id} to="/pdi/formulario" className="block rounded-xl border border-slate-200 p-4 transition hover:border-teal-200 hover:bg-teal-50/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{aplicacao.escolaNome}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {aplicacao.modelos.map(modelo => <Badge key={modelo.modeloId} variant="blue">{modelo.disciplinaNome}</Badge>)}
                    </div>
                  </div>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(aplicacao.status)}`}>{formStatusLabel(aplicacao.status)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>Início: {formatFullDate(aplicacao.dataInicio)}</span><span>Encerramento: {formatFullDate(aplicacao.dataFim)}</span></div>
              </Link>
            ))}
          </div>
        </Card>}
      </div>
    </MainLayout>
  );
};

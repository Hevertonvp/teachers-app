import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ActionMenu, Button, Card, ConfirmDialog, EmptyState, FormField, LoadingBlock, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscolaDoTopo, useFiltroEscolaDoTopo } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { BotaoExportarExcel } from '../components/BotaoExportarExcel';
import { listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { exportarExcel } from '../utils/exportarExcel';
import { escolaName, inputClass } from '../utils/display';
import { canManageTurmas } from '../utils/roles';
import { CabecalhoDesativados, ListaDesativados } from '../components/ListaDesativados';
import { listarDesativados } from '../services/desativados';
import { listarNiveisInfantil } from '../services/niveisInfantil';
import { listarVinculosProfessorTurmaAtuacao } from '../services/professorTurmaAtuacao';
import { listarVinculosAuxiliarTurma } from '../services/auxiliaresTurma';

// Turmas desativadas em tela própria (pedido do usuário, 15/11/2026): lista paginada, mais recentes primeiro.
const carregarDesativadas = (pagina, porPagina) => listarDesativados('turmas', { pagina, porPagina });
import {
  ANOS_FUNDAMENTAL, ETAPAS, SEGMENTOS_INFANTIL, TURNOS,
  descricaoTurma, niveisDoSegmento, turnoLabel,
} from '../utils/turmas';

const ANO_LETIVO_PADRAO = 2026;
const TURMAS_POR_PAGINA = 15;

const blankTurma = (escolaId) => ({
  escolaId: escolaId ?? '',
  anoLetivo: ANO_LETIVO_PADRAO,
  etapa: 'fundamental',
  anoSerie: 1,
  segmento: 'creche',
  nivel: SEGMENTOS_INFANTIL[0].niveis[0].value,
  turno: 'manha',
  identificador: 1,
});

export const GestaoTurmas = () => {
  const { user } = useAuth();
  const {
    escolas, turmas, turmasLoading, turmasError, loadTurmas, pdiAlunosReais,
    createTurma, updateTurma, inativarTurma, reativarTurma,
  } = useData();
  const escolaDoTopo = useEscolaDoTopo();

  const [filtroEscolaId, setFiltroEscolaId] = useFiltroEscolaDoTopo('todas');
  const [filtroAnoLetivo, setFiltroAnoLetivo] = useState('todos');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  // A lista principal mostra só as ativas; as desativadas têm tela própria (?ver=desativadas).
  const filtroStatus = 'ativa';
  const [params] = useSearchParams();
  const verDesativadas = params.get('ver') === 'desativadas';
  const [recarregar, setRecarregar] = useState(0);
  const [turmaForm, setTurmaForm] = useState(null);
  const [editingTurma, setEditingTurma] = useState(null);
  const [turmaError, setTurmaError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [inativandoTurma, setInativandoTurma] = useState(null);
  const [reativandoTurma, setReativandoTurma] = useState(null);
  const [message, setMessage] = useState('');
  const [paginaTurmas, setPaginaTurmas] = useState(1);
  // 16/11/2026: vindo de "Nova escola", abre "Nova turma" com a escola escolhida (uma vez; o estado da navegação é
  // limpo para não reabrir ao recarregar). Espera a escola aparecer na lista e o catálogo de níveis carregar.
  const location = useLocation();
  const navigate = useNavigate();
  const abrirNovaTurmaDaEscolaRef = useRef(null);
  // 16/11/2026: escola com etapas informadas só oferece as suas etapas/anos/níveis (níveis do catálogo local).
  const [niveisCatalogo, setNiveisCatalogo] = useState([]);
  useEffect(() => { listarNiveisInfantil().then(setNiveisCatalogo).catch(() => setNiveisCatalogo([])); }, []);
  // 16/11/2026: vínculos de cada turma pelos dados REAIS (antes vinham dos dados de demonstração, já removidos):
  // professores (por disciplina e por atuação), alunos do PDI ativos e Auxiliar.
  const [vinculosReais, setVinculosReais] = useState({ professores: new Map(), auxiliares: new Set() });
  useEffect(() => {
    Promise.all([
      listarVinculosProfessorTurmaDisciplina().catch(() => []),
      listarVinculosProfessorTurmaAtuacao().catch(() => []),
      listarVinculosAuxiliarTurma().catch(() => []),
    ]).then(([porDisciplina, porAtuacao, aux]) => {
      const professores = new Map();
      for (const v of [...porDisciplina, ...porAtuacao].filter(x => x.status === 'ATIVO')) {
        if (!professores.has(v.turmaId)) professores.set(v.turmaId, new Set());
        professores.get(v.turmaId).add(v.professorId);
      }
      setVinculosReais({ professores, auxiliares: new Set(aux.filter(x => x.status === 'ATIVO').map(x => x.turmaId)) });
    });
  }, []);
  const vinculosDaTurma = (turmaId) => {
    const id = Number(turmaId);
    const professores = vinculosReais.professores.get(id)?.size ?? 0;
    const alunos = (pdiAlunosReais ?? []).filter(a => a.turmaId === id && a.status === 'ativo').length;
    const auxiliar = vinculosReais.auxiliares.has(id) ? 1 : 0;
    return { professores, alunos, auxiliar, total: professores + alunos + auxiliar };
  };

  const novaTurmaEscolaId = location.state?.novaTurmaEscolaId;
  useEffect(() => {
    if (!novaTurmaEscolaId || niveisCatalogo.length === 0 || !escolas.some(e => e.id === Number(novaTurmaEscolaId))) return;
    abrirNovaTurmaDaEscolaRef.current?.(Number(novaTurmaEscolaId), location.state?.mensagem);
    navigate('/turmas', { replace: true, state: null });
  }, [novaTurmaEscolaId, niveisCatalogo, escolas]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canManageTurmas(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const escolasOrdenadas = [...escolas].sort((a, b) => a.nome.localeCompare(b.nome));
  // 16/11/2026: escola inativa não recebe turma — some de "Nova turma". Ao editar turma antiga de escola já inativa,
  // a escola dela continua na lista (só ela), para a edição não quebrar. O filtro do topo continua com todas.
  const escolasAtivas = escolasOrdenadas.filter(e => e.status === 'ativa');
  const escolasDoFormulario = escolasOrdenadas.filter(e => e.status === 'ativa' || (editingTurma && e.id === Number(editingTurma.escolaId)));
  const anosLetivos = [...new Set(turmas.map(turma => turma.anoLetivo).filter(Boolean))].sort((a, b) => b - a);

  const turmasFiltradas = turmas
    .filter(turma => filtroEscolaId === 'todas' || turma.escolaId === Number(filtroEscolaId))
    .filter(turma => filtroAnoLetivo === 'todos' || Number(turma.anoLetivo) === Number(filtroAnoLetivo))
    .filter(turma => filtroEtapa === 'todas' || turma.etapa === filtroEtapa)
    .filter(turma => filtroStatus === 'todas' || turma.status === filtroStatus)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const totalPaginasTurmas = Math.max(1, Math.ceil(turmasFiltradas.length / TURMAS_POR_PAGINA));
  const paginaAtualTurmas = Math.min(paginaTurmas, totalPaginasTurmas);
  const turmasPaginadas = turmasFiltradas.slice((paginaAtualTurmas - 1) * TURMAS_POR_PAGINA, paginaAtualTurmas * TURMAS_POR_PAGINA);

  // Estrutura da escola escolhida no formulário (vazia = "não informada": formulário de sempre).
  const estruturaDe = (escolaId, turmaEditada = null) => {
    const escola = escolas.find(e => e.id === Number(escolaId));
    const etapas = escola?.etapasOferecidas ?? [];
    const informada = etapas.length > 0;
    const antigaInfantil = !!turmaEditada && turmaEditada.etapa === 'educacao_infantil' && !turmaEditada.nivelLocalId;
    return {
      informada,
      etapas: informada ? ETAPAS.filter(e => (e.value === 'fundamental' ? etapas.some(x => x.startsWith('FUNDAMENTAL')) : etapas.includes('EDUCACAO_INFANTIL'))) : ETAPAS,
      anos: informada ? ANOS_FUNDAMENTAL.filter(a => (escola.anosFundamental ?? []).includes(a.value)) : ANOS_FUNDAMENTAL,
      niveis: niveisCatalogo.filter(n => (escola?.niveisInfantilIds ?? []).includes(n.id)),
      usaNivelLocal: informada && !antigaInfantil,
    };
  };
  // Ajusta etapa/ano/nível aos que a escola oferece (sem mudar o que já é válido).
  const ajustarAEscola = (form, turmaEditada = editingTurma) => {
    const e = estruturaDe(form.escolaId, turmaEditada);
    const etapa = e.etapas.some(x => x.value === form.etapa) ? form.etapa : (e.etapas[0]?.value ?? form.etapa);
    const anoSerie = e.anos.some(a => a.value === Number(form.anoSerie)) ? form.anoSerie : (e.anos[0]?.value ?? form.anoSerie);
    const nivelLocalId = e.niveis.some(n => n.id === Number(form.nivelLocalId)) ? form.nivelLocalId : (e.niveis[0]?.id ?? '');
    return { ...form, etapa, anoSerie, nivelLocalId };
  };
  abrirNovaTurmaDaEscolaRef.current = (escolaId, mensagem) => {
    setEditingTurma(null); setTurmaError('');
    if (mensagem) setMessage(mensagem);
    setTurmaForm(ajustarAEscola(blankTurma(escolaId), null));
  };
  const abrirNovaTurma = () => { setEditingTurma(null); setTurmaError(''); setTurmaForm(ajustarAEscola(blankTurma(escolaDoTopo(escolasAtivas, escolasAtivas[0]?.id)), null)); };
  // Turmas legadas sem turno/identificador definidos (ver mockData.js) recebem aqui um valor de
  // partida editável — só passam a valer de fato quando a Secretaria confirmar "Salvar".
  const abrirEdicao = (turma) => {
    setEditingTurma(turma);
    setTurmaError('');
    setTurmaForm({
      ...blankTurma(turma.escolaId),
      ...turma,
      turno: turma.turno || 'manha',
      identificador: turma.identificador || 1,
      anoSerie: turma.anoSerie || ANOS_FUNDAMENTAL[0].value,
    });
  };
  const fecharModal = () => { setTurmaForm(null); setEditingTurma(null); setTurmaError(''); };

  const mudarEtapa = (etapa) => {
    setTurmaForm(prev => ajustarAEscola({
      ...prev,
      etapa,
      anoSerie: ANOS_FUNDAMENTAL[0].value,
      segmento: SEGMENTOS_INFANTIL[0].value,
      nivel: SEGMENTOS_INFANTIL[0].niveis[0].value,
    }));
  };

  const mudarSegmento = (segmento) => {
    setTurmaForm(prev => ({ ...prev, segmento, nivel: niveisDoSegmento(segmento)[0]?.value }));
  };

  const salvarTurma = async (event) => {
    event.preventDefault();
    setTurmaError('');
    const base = {
      escolaId: Number(turmaForm.escolaId),
      anoLetivo: Number(turmaForm.anoLetivo),
      etapa: turmaForm.etapa,
      turno: turmaForm.turno,
      identificador: Number(turmaForm.identificador),
    };
    const est = estruturaDe(turmaForm.escolaId, editingTurma);
    if (turmaForm.etapa === 'educacao_infantil' && est.usaNivelLocal && !turmaForm.nivelLocalId) {
      setTurmaError('Esta escola não tem níveis da Educação Infantil marcados. Ajuste em Escolas.');
      return;
    }
    const payload = turmaForm.etapa === 'fundamental'
      ? { ...base, anoSerie: Number(turmaForm.anoSerie), segmento: null, nivel: null }
      : est.usaNivelLocal
        ? { ...base, anoSerie: null, segmento: null, nivel: null, nivelLocalId: Number(turmaForm.nivelLocalId) }
        : { ...base, anoSerie: null, segmento: turmaForm.segmento, nivel: turmaForm.nivel };

    setSalvando(true);
    const resultado = editingTurma ? await updateTurma(editingTurma.id, payload) : await createTurma(payload);
    setSalvando(false);
    if (!resultado.ok) {
      setTurmaError(resultado.error);
      return;
    }
    setMessage(editingTurma ? `Turma "${resultado.turma.nome}" atualizada com sucesso.` : `Turma "${resultado.turma.nome}" criada com sucesso.`);
    fecharModal();
  };

  // Exportação: TODAS as turmas dos filtros escolhidos (não só a página visível) + professores e
  // disciplinas ATIVOS dessas turmas (vínculos reais da API, nunca os dados de demonstração).
  const exportarTurmas = async () => {
    const ids = new Set(turmasFiltradas.map(t => t.id));
    const vinculos = (await listarVinculosProfessorTurmaDisciplina())
      .filter(v => v.status === 'ATIVO' && ids.has(v.turmaId));
    const turmaPorId = new Map(turmasFiltradas.map(t => [t.id, t]));
    const nomeEscola = (id) => escolaName(escolas, id);
    const ordenadas = [...turmasFiltradas].sort((a, b) => nomeEscola(a.escolaId).localeCompare(nomeEscola(b.escolaId)) || (a.nome || '').localeCompare(b.nome || ''));
    const linhasVinculos = vinculos
      .map(v => ({ ...v, escolaNome: nomeEscola(turmaPorId.get(v.turmaId).escolaId) }))
      .sort((a, b) => a.escolaNome.localeCompare(b.escolaNome) || a.turmaNome.localeCompare(b.turmaNome) || a.disciplinaNome.localeCompare(b.disciplinaNome));
    const rotulo = (lista, v) => lista.find(i => String(i.value) === String(v))?.label;
    await exportarExcel({
      arquivo: 'educa-sao-joao-turmas',
      usuario: user?.nome,
      filtros: [
        ['Escola', filtroEscolaId === 'todas' ? 'Todas as escolas' : nomeEscola(Number(filtroEscolaId))],
        ['Ano letivo', filtroAnoLetivo === 'todos' ? 'Todos' : filtroAnoLetivo],
        ['Etapa', filtroEtapa === 'todas' ? 'Todas' : rotulo(ETAPAS, filtroEtapa)],
        ['Status', 'Ativas'],
      ],
      abas: [
        { nome: 'Turmas', linhas: ordenadas, colunas: [
          { titulo: 'Escola', valor: t => nomeEscola(t.escolaId), largura: 34 },
          { titulo: 'Turma', valor: t => t.nome, largura: 24 },
          { titulo: 'Etapa', valor: t => rotulo(ETAPAS, t.etapa) ?? t.etapa, largura: 20 },
          { titulo: 'Ano/série', valor: t => (t.anoSerie ? `${t.anoSerie}º ano` : '') },
          { titulo: 'Turno', valor: t => (t.turno ? turnoLabel(t.turno) : '') },
          { titulo: 'Ano letivo', valor: t => t.anoLetivo, tipo: 'numero' },
          { titulo: 'Status', valor: t => (t.status === 'ativa' ? 'Ativa' : 'Inativa') },
          { titulo: 'Professores/disciplinas ativos', valor: t => vinculos.filter(v => v.turmaId === t.id).length, tipo: 'numero', largura: 18 },
        ] },
        { nome: 'Professores e disciplinas', linhas: linhasVinculos, colunas: [
          { titulo: 'Escola', valor: v => v.escolaNome, largura: 34 },
          { titulo: 'Turma', valor: v => v.turmaNome, largura: 24 },
          { titulo: 'Disciplina', valor: v => v.disciplinaNome, largura: 22 },
          { titulo: 'Professor', valor: v => v.professorNome, largura: 34 },
          { titulo: 'Desde', valor: v => v.dataInicio, tipo: 'data' },
        ] },
      ],
    });
  };

  const vinculosDaTurmaEmEdicao = editingTurma ? vinculosDaTurma(editingTurma.id) : null;
  const estruturaForm = turmaForm ? estruturaDe(turmaForm.escolaId, editingTurma) : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {verDesativadas ? (
          <>
            <CabecalhoDesativados titulo="Turmas desativadas" voltarPara="/turmas" voltarTexto="← Voltar para Turmas" descricao="Turmas inativadas não aparecem nas listas nem como opção para novos vínculos. Os vínculos e o histórico continuam guardados. Reativar devolve a turma à lista." />
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
            <ListaDesativados carregar={carregarDesativadas} recarregarChave={recarregar} vazio="Nenhuma turma desativada." acoes={item => <Button size="sm" variant="outline" onClick={() => setReativandoTurma({ id: item.id, nome: item.titulo })}>Reativar</Button>} />
          </>
        ) : (<>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Turmas</h1>
            <Link to="/turmas?ver=desativadas" className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver turmas desativadas ({turmas.filter(t => t.status !== 'ativa').length}) →</Link>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <BotaoExportarExcel size="md" gerar={exportarTurmas} disabled={turmasLoading || turmasFiltradas.length === 0} />
            <Button onClick={abrirNovaTurma} disabled={escolasAtivas.length === 0 || turmasLoading}>+ Nova turma</Button>
          </div>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {turmasError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar as turmas: {turmasError}</span>
            <Button size="sm" variant="outline" onClick={loadTurmas}>Tentar novamente</Button>
          </div>
        )}

        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Escola">
              <select className={inputClass} value={filtroEscolaId} onChange={event => { setFiltroEscolaId(event.target.value); setPaginaTurmas(1); }}>
                <option value="todas">Todas as escolas</option>
                {escolasOrdenadas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Ano letivo">
              <select className={inputClass} value={filtroAnoLetivo} onChange={event => { setFiltroAnoLetivo(event.target.value); setPaginaTurmas(1); }}>
                <option value="todos">Todos</option>
                {anosLetivos.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </FormField>
            <FormField label="Etapa">
              <select className={inputClass} value={filtroEtapa} onChange={event => { setFiltroEtapa(event.target.value); setPaginaTurmas(1); }}>
                <option value="todas">Todas</option>
                {ETAPAS.map(etapa => <option key={etapa.value} value={etapa.value}>{etapa.label}</option>)}
              </select>
            </FormField>
          </div>
        </Card>

        {turmasLoading ? (
          <Card><LoadingBlock text="Carregando turmas..." /></Card>
        ) : turmasFiltradas.length === 0 ? (
          turmas.length === 0 ? (
            !turmasError && (
              <EmptyState title="Nenhuma turma cadastrada" description="Crie a primeira turma escolhendo uma escola.">
                <Button onClick={abrirNovaTurma}>+ Nova turma</Button>
              </EmptyState>
            )
          ) : (
            <EmptyState title="Nenhuma turma para os filtros escolhidos" description="Ajuste os filtros acima para ver outras turmas." />
          )
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-slate-200">
              {turmasPaginadas.map(turma => {
                const vinculos = vinculosDaTurma(turma.id);
                return (
                  <div key={turma.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{turma.nome}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{descricaoTurma(turma)}</p>
                      <p className="mt-1 text-xs text-slate-500">{escolaName(escolas, turma.escolaId)} • {turma.anoLetivo}{vinculos.total > 0 ? ` • ${vinculos.total} vínculo${vinculos.total > 1 ? 's' : ''} ativo${vinculos.total > 1 ? 's' : ''}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(turma)}>Editar</Button>
                      <ActionMenu items={[{ label: 'Inativar turma', variant: 'danger', onClick: () => setInativandoTurma(turma) }]} />
                    </div>
                  </div>
                );
              })}
            </div>
            {turmasFiltradas.length > TURMAS_POR_PAGINA && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
                <Button size="sm" variant="outline" disabled={paginaAtualTurmas === 1} onClick={() => setPaginaTurmas(p => Math.max(1, p - 1))}>Anterior</Button>
                <span className="font-semibold text-slate-600">Página {paginaAtualTurmas} de {totalPaginasTurmas}</span>
                <Button size="sm" variant="outline" disabled={paginaAtualTurmas === totalPaginasTurmas} onClick={() => setPaginaTurmas(p => Math.min(totalPaginasTurmas, p + 1))}>Próxima</Button>
              </div>
            )}
          </Card>
        )}
        </>)}

        {turmaForm && (
          <Modal title={editingTurma ? `Editar turma — ${editingTurma.nome}` : 'Nova turma'} onClose={fecharModal}>
            <form onSubmit={salvarTurma} className="space-y-4">
              {turmaError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{turmaError}</div>}
              {vinculosDaTurmaEmEdicao && vinculosDaTurmaEmEdicao.total > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Esta turma tem {vinculosDaTurmaEmEdicao.total} vínculo(s) ativo(s) ({vinculosDaTurmaEmEdicao.professores} professor(es), {vinculosDaTurmaEmEdicao.alunos} aluno(s) PDI{vinculosDaTurmaEmEdicao.auxiliar ? ', 1 auxiliar' : ''}). Alterar série/segmento, turno ou identificador muda o nome de exibição desta turma, mas todos os vínculos continuam preservados (eles apontam para o mesmo registro).
                </div>
              )}

              <FormField label="Escola">
                <select className={inputClass} value={turmaForm.escolaId} onChange={event => setTurmaForm(prev => ajustarAEscola({ ...prev, escolaId: event.target.value }))} required>
                  <option value="" disabled>Selecione</option>
                  {escolasDoFormulario.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Ano letivo">
                  <input className={inputClass} type="number" value={turmaForm.anoLetivo} onChange={event => setTurmaForm(prev => ({ ...prev, anoLetivo: event.target.value }))} required />
                </FormField>
                <FormField label="Etapa">
                  <select className={inputClass} value={turmaForm.etapa} onChange={event => mudarEtapa(event.target.value)}>
                    {estruturaForm.etapas.map(etapa => <option key={etapa.value} value={etapa.value}>{etapa.label}</option>)}
                  </select>
                </FormField>
              </div>

              {turmaForm.etapa === 'fundamental' ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Ano/série">
                    <select className={inputClass} value={turmaForm.anoSerie} onChange={event => setTurmaForm(prev => ({ ...prev, anoSerie: event.target.value }))}>
                      {estruturaForm.anos.map(ano => <option key={ano.value} value={ano.value}>{ano.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turno">
                    <select className={inputClass} value={turmaForm.turno} onChange={event => setTurmaForm(prev => ({ ...prev, turno: event.target.value }))}>
                      {TURNOS.map(turno => <option key={turno.value} value={turno.value}>{turno.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Identificador da turma">
                    <input className={inputClass} type="number" min="1" value={turmaForm.identificador} onChange={event => setTurmaForm(prev => ({ ...prev, identificador: event.target.value }))} required />
                  </FormField>
                </div>
              ) : estruturaForm.usaNivelLocal ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Nível">
                    <select className={inputClass} value={turmaForm.nivelLocalId} onChange={event => setTurmaForm(prev => ({ ...prev, nivelLocalId: event.target.value }))}>
                      {estruturaForm.niveis.length === 0 && <option value="">Nenhum nível marcado na escola</option>}
                      {estruturaForm.niveis.map(nivel => <option key={nivel.id} value={nivel.id}>{nivel.nome}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turno">
                    <select className={inputClass} value={turmaForm.turno} onChange={event => setTurmaForm(prev => ({ ...prev, turno: event.target.value }))}>
                      {TURNOS.map(turno => <option key={turno.value} value={turno.value}>{turno.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turma (A, B, C…)">
                    <select className={inputClass} value={turmaForm.identificador} onChange={event => setTurmaForm(prev => ({ ...prev, identificador: event.target.value }))}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{String.fromCharCode(64 + n)}</option>)}
                    </select>
                  </FormField>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Segmento">
                    <select className={inputClass} value={turmaForm.segmento} onChange={event => mudarSegmento(event.target.value)}>
                      {SEGMENTOS_INFANTIL.map(segmento => <option key={segmento.value} value={segmento.value}>{segmento.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Nível">
                    <select className={inputClass} value={turmaForm.nivel} onChange={event => setTurmaForm(prev => ({ ...prev, nivel: event.target.value }))}>
                      {niveisDoSegmento(turmaForm.segmento).map(nivel => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turno">
                    <select className={inputClass} value={turmaForm.turno} onChange={event => setTurmaForm(prev => ({ ...prev, turno: event.target.value }))}>
                      {TURNOS.map(turno => <option key={turno.value} value={turno.value}>{turno.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Identificador da turma">
                    <input className={inputClass} type="number" min="1" value={turmaForm.identificador} onChange={event => setTurmaForm(prev => ({ ...prev, identificador: event.target.value }))} required />
                  </FormField>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={fecharModal} disabled={salvando}>Cancelar</Button>
                <Button type="submit" loading={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </Modal>
        )}

        {inativandoTurma && (
          <ConfirmDialog
            title="Inativar turma"
            message={(() => {
              const vinculos = vinculosDaTurma(inativandoTurma.id);
              return `Deseja inativar a turma "${inativandoTurma.nome}"? Ela deixa de aparecer como opção para novos vínculos, mas continua existindo para consulta histórica.${vinculos.total > 0 ? ` Os ${vinculos.total} vínculo(s) ativo(s) hoje (professores, alunos PDI, auxiliar) NÃO são removidos.` : ''}`;
            })()}
            confirmLabel="Inativar"
            onCancel={() => setInativandoTurma(null)}
            onConfirm={async () => {
              const alvo = inativandoTurma;
              setInativandoTurma(null);
              const resultado = await inativarTurma(alvo.id);
              setMessage(resultado.ok ? `Turma "${alvo.nome}" inativada com sucesso.` : resultado.error);
            }}
          />
        )}

        {reativandoTurma && (
          <ConfirmDialog
            title="Reativar turma"
            message={`Deseja reativar a turma "${reativandoTurma.nome}"? Ela volta a aparecer como opção normal para novos vínculos.`}
            confirmLabel="Reativar"
            onCancel={() => setReativandoTurma(null)}
            onConfirm={async () => {
              const alvo = reativandoTurma;
              setReativandoTurma(null);
              const resultado = await reativarTurma(alvo.id);
              setRecarregar(n => n + 1);
              setMessage(resultado.ok ? `Turma "${alvo.nome}" reativada com sucesso. Ela voltou para a lista de turmas.` : resultado.error);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};

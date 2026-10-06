import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, EmptyState, FormField, Modal, OrderButtons } from '../components/Common';
import { blankPerguntaPdi, PerguntaPdiFormModal, tipoRespostaLabel } from '../components/PerguntaPdiFormModal';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { formatFullDate, formStatusClasses, formStatusLabel } from '../utils/formAvailability';
import { canViewAplicacoesPdi, isSecretaria } from '../utils/roles';
import { getEscolasAplicaveis, RECURSOS } from '../utils/aplicabilidade';

const SOLICITADO_POR_OPTIONS = [
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'diretora', label: 'Diretora' },
  { value: 'professor', label: 'Professor' },
  { value: 'auxiliar', label: 'Auxiliar' },
];

// Troca a `ordem` entre a pergunta e a vizinha (-1 sobe, +1 desce) — a API real espera o par
// completo {id, ordem} de tudo que muda, aplicado em transação (ver reordenarPdiModeloPerguntasReais).
const calcularReordenacao = (perguntasOrdenadas, perguntaId, direction) => {
  const index = perguntasOrdenadas.findIndex(item => item.id === perguntaId);
  const vizinha = perguntasOrdenadas[index + direction];
  if (!vizinha) return [];
  const atual = perguntasOrdenadas[index];
  return [{ id: atual.id, ordem: vizinha.ordem }, { id: vizinha.id, ordem: atual.ordem }];
};
// Data de hoje DE VERDADE (nunca CURRENT_DATE — essa constante é uma data simulada fixa da época
// do mock, '2026-09-02', e usá-la aqui faria toda Aplicação PDI nova nascer com vigência no
// passado em relação à data real do servidor; ver utils/formAvailability.js).
const hojeISO = () => new Date().toISOString().slice(0, 10);

// Criação: uma ou mais escolas de uma vez (`escolaIds` + `todasEscolas`). A seleção de disciplinas
// (`modeloIds`) começa com TODOS os modelos ativos marcados — preserva o comportamento antigo por
// padrão, a Secretaria só precisa desmarcar quem não quer incluir. Edição continua sendo sempre de
// uma aplicação já existente, então usa `escolaId` único e nunca mexe em modeloIds (seção 16 do
// pedido original: edição nunca toca no snapshot).
const blankAplicacao = (modeloIdsAtivos = []) => ({ escolaIds: [], todasEscolas: false, dataInicio: hojeISO(), dataFim: hojeISO(), modeloIds: modeloIdsAtivos });

// Reabertura sempre começa sugerindo o dia seguinte ao fim original — o backend exige
// estritamente depois disso, nunca dentro da vigência normal (ver domain/pdiAplicacoes.ts).
const blankReabertura = (aplicacao) => ({ dataInicio: aplicacao.dataFim, dataFim: aplicacao.dataFim, solicitadoPorTipo: 'secretaria', motivo: '' });

const tabButtonClass = (active) => `rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;

// Grupos da visão OPERACIONAL (tela principal) — nunca inclui Encerradas normais, que ficam só no
// histórico (ver "Ver aplicações encerradas" abaixo). Uma Encerrada com Reabertura ativa agora
// aparece aqui, sob "Reabertas" — o campo `status` dela continua 'expired' (vigência original),
// só muda de onde ela é exibida; nenhum status novo é persistido (ver reaberturaAtivaAgora no
// backend, calculado na hora a partir de ReaberturaPdi).
const GRUPOS_APLICACAO_OPERACIONAIS = [
  { status: 'scheduled', titulo: 'Agendadas' },
  { status: 'active', titulo: 'Vigentes' },
  { status: 'expired', titulo: 'Reabertas' },
];

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export const FormularioPdiPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    disciplinasReais, escolas,
    pdiModelosReais, pdiModelosReaisLoading, pdiModelosReaisError, loadPdiModelosReais,
    createPdiModeloReal, inativarPdiModelo, reativarPdiModeloReal,
    createPdiModeloPerguntaReal, updatePdiModeloPerguntaReal, inativarPdiPergunta, reativarPdiPergunta, reorderPdiModeloPerguntaReal, excluirPdiModelo,
    pdiAplicacoesReais, pdiAplicacoesReaisLoading, pdiAplicacoesReaisError, loadPdiAplicacoesReais,
    createPdiAplicacaoReal, updatePdiAplicacaoReal, removePdiAplicacaoReal, listarReaberturasPdiAplicacao, criarReaberturaPdiAplicacao,
  } = useData();

  const souSecretaria = isSecretaria(user);
  // Gerenciar (criar/editar/reabrir) Aplicações é exclusivo da Secretaria — Gestor e Diretora só
  // consultam, dentro do próprio escopo de escola (correção explícita pedida nesta tarefa: Gestor
  // administrava Aplicações mock antes, e isso deixou de ser permitido). Modelo PDI continua
  // exclusivo da Secretaria, que nem vê a aba. O backend recusa (403) qualquer tentativa de
  // gerenciar Modelo/Aplicação/Reabertura fora do permitido, então isso não é só cosmético.
  const [tab, setTab] = useState(souSecretaria ? 'modelos' : 'aplicacoes');
  // null = grade de modelos; com valor = editor ("construtor de formulário") do modelo aberto.
  const [modeloEditandoId, setModeloEditandoId] = useState(null);
  const [novoModeloForm, setNovoModeloForm] = useState(null);
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  const [perguntaForm, setPerguntaForm] = useState(null);
  const [salvandoPergunta, setSalvandoPergunta] = useState(false);
  const [inativandoPergunta, setInativandoPergunta] = useState(null);
  const [mudandoStatusModelo, setMudandoStatusModelo] = useState(null);
  const [excluindoModelo, setExcluindoModelo] = useState(null);
  const [mostrarHistoricoModelos, setMostrarHistoricoModelos] = useState(false);
  const [mostrarAplicacoesEncerradas, setMostrarAplicacoesEncerradas] = useState(false);
  const [mostrarAplicacoesRemovidas, setMostrarAplicacoesRemovidas] = useState(false);
  const [aplicacaoForm, setAplicacaoForm] = useState(null);
  const [editingAplicacao, setEditingAplicacao] = useState(null);
  const [removendoAplicacao, setRemovendoAplicacao] = useState(null);
  const [aplicacaoError, setAplicacaoError] = useState('');
  const [salvandoAplicacao, setSalvandoAplicacao] = useState(false);
  const [reaberturaForm, setReaberturaForm] = useState(null);
  const [reaberturaError, setReaberturaError] = useState('');
  const [salvandoReabertura, setSalvandoReabertura] = useState(false);
  const [historicoReaberturas, setHistoricoReaberturas] = useState({});
  const [aplicacaoExpandida, setAplicacaoExpandida] = useState(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [message, setMessage] = useState('');
  const [buscaEscolaAplicacao, setBuscaEscolaAplicacao] = useState('');

  // Modelos só é carregado para quem administra (Secretaria) — o backend recusa leitura de
  // Modelos pra qualquer outro perfil desde esta tarefa (a criação de Aplicação passou a
  // resolver o snapshot no próprio backend, sem o frontend precisar ler Modelos pra isso).
  useEffect(() => { if (souSecretaria) loadPdiModelosReais(); }, [souSecretaria, loadPdiModelosReais]);
  // Aplicações é carregado para todo mundo com acesso a esta tela (Secretaria/Gestor/Diretora).
  useEffect(() => { loadPdiAplicacoesReais(); }, [loadPdiAplicacoesReais]);

  if (!canViewAplicacoesPdi(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const escolasAplicaveis = getEscolasAplicaveis(RECURSOS.PDI, escolas).filter(escola => escola.status === 'ativa');
  const modelosAtivos = pdiModelosReais.filter(modelo => modelo.status === 'ativa');
  // Histórico de Modelos (INATIVA) — nunca aparece na tela principal, só sob demanda (seção 4/16).
  // Nunca é limpo (é o próprio propósito do histórico) — por isso sem contador no botão (poderia
  // chegar a centenas com o tempo) e sempre ordenado pela desativação mais recente primeiro.
  const modelosInativos = pdiModelosReais
    .filter(modelo => modelo.status === 'inativa')
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt));
  const disciplinasComModeloAtivo = new Set(modelosAtivos.map(modelo => modelo.disciplinaId));
  const disciplinasDisponiveis = disciplinasReais.filter(disciplina => !disciplinasComModeloAtivo.has(disciplina.id));
  const modeloSelecionado = pdiModelosReais.find(modelo => modelo.id === modeloEditandoId) || null;
  const perguntasDoModelo = modeloSelecionado ? [...(modeloSelecionado.perguntas || [])].sort((left, right) => Number(left.ordem) - Number(right.ordem)) : [];
  // `status` já vem calculado pelo backend com os mesmos 3 valores que formStatusLabel/
  // formStatusClasses esperam ('scheduled'/'active'/'expired') — nunca recalculado aqui.
  // `operacional` decide só ONDE o item aparece (tela principal vs histórico de encerradas) — uma
  // Encerrada com Reabertura ativa agora continua 'expired' no badge, só muda de seção.
  // Removida (statusRegistro INATIVA) nunca entra em "operacional"/"encerradas" — fica no próprio
  // grupo, fora da tela principal por padrão (só o botão "Ver aplicações removidas" mostra),
  // porque uma Aplicação removida não é mais "Vigente" nem "Encerrada normal": ela saiu de
  // circulação de propósito (ver DELETE /api/pdi-aplicacoes/:id) e misturar os dois rótulos no
  // mesmo card confundia (pedido do usuário).
  const aplicacoesComStatus = [...pdiAplicacoesReais]
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .map(aplicacao => ({ aplicacao, status: aplicacao.status, operacional: aplicacao.status !== 'expired' || !!aplicacao.reaberturaAtivaAgora }));
  const aplicacoesAtivas = aplicacoesComStatus.filter(item => item.aplicacao.statusRegistro !== 'inativa');
  const aplicacoesRemovidas = [...aplicacoesComStatus.filter(item => item.aplicacao.statusRegistro === 'inativa')].reverse();
  const aplicacoesOperacionais = aplicacoesAtivas.filter(item => item.operacional);
  const aplicacoesEncerradas = [...aplicacoesAtivas.filter(item => !item.operacional)].reverse();

  const abrirNovoModelo = () => setNovoModeloForm({ nome: '', disciplinaId: disciplinasDisponiveis[0]?.id ?? '', carregarPerguntasPadrao: true });
  const abrirNovaAplicacao = () => { setEditingAplicacao(null); setAplicacaoError(''); setAplicacaoForm(blankAplicacao(modelosAtivos.map(modelo => modelo.id))); setBuscaEscolaAplicacao(''); };
  const abrirReabertura = (aplicacao) => { setReaberturaError(''); setReaberturaForm({ aplicacaoId: aplicacao.id, ...blankReabertura(aplicacao) }); };

  const toggleHistoricoReaberturas = async (aplicacaoId) => {
    if (aplicacaoExpandida === aplicacaoId) {
      setAplicacaoExpandida(null);
      return;
    }
    setAplicacaoExpandida(aplicacaoId);
    if (historicoReaberturas[aplicacaoId]) return;
    setCarregandoHistorico(true);
    const resultado = await listarReaberturasPdiAplicacao(aplicacaoId);
    setCarregandoHistorico(false);
    if (resultado.ok) {
      setHistoricoReaberturas(prev => ({ ...prev, [aplicacaoId]: resultado.reaberturas }));
    } else {
      setMessage(resultado.error);
    }
  };

  const salvarReabertura = async (event) => {
    event.preventDefault();
    setReaberturaError('');
    if (reaberturaForm.dataFim < reaberturaForm.dataInicio) {
      setReaberturaError('A data de encerramento não pode ser anterior à data de início.');
      return;
    }
    setSalvandoReabertura(true);
    const resultado = await criarReaberturaPdiAplicacao(reaberturaForm.aplicacaoId, reaberturaForm);
    setSalvandoReabertura(false);
    if (!resultado.ok) {
      setReaberturaError(resultado.error);
      return;
    }
    setHistoricoReaberturas(prev => ({
      ...prev,
      [reaberturaForm.aplicacaoId]: [...(prev[reaberturaForm.aplicacaoId] || []), resultado.reabertura].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)),
    }));
    setAplicacaoExpandida(reaberturaForm.aplicacaoId);
    setReaberturaForm(null);
    setMessage('Reabertura registrada com sucesso.');
  };

  const criarModelo = async (event) => {
    event.preventDefault();
    if (!novoModeloForm?.disciplinaId) {
      setMessage('Escolha a disciplina do novo modelo.');
      return;
    }
    const disciplina = disciplinasReais.find(item => item.id === Number(novoModeloForm.disciplinaId));
    setSalvandoModelo(true);
    const resultado = await createPdiModeloReal({ nome: novoModeloForm.nome?.trim() || `PDI - ${disciplina?.nome}`, disciplinaId: Number(novoModeloForm.disciplinaId), carregarPerguntasPadrao: novoModeloForm.carregarPerguntasPadrao });
    setSalvandoModelo(false);
    if (!resultado.ok) {
      setMessage(resultado.error);
      return;
    }
    // Fluxo direto: criar já abre a edição do modelo recém-criado, sem passo intermediário.
    setModeloEditandoId(resultado.modelo.id);
    setNovoModeloForm(null);
    setMessage('Modelo PDI criado com sucesso.');
  };

  const salvarPergunta = async (event) => {
    event.preventDefault();
    if (!modeloSelecionado) return;
    const opcoes = perguntaForm.tipoResposta === 'selecao' ? perguntaForm.opcoes.map(opcao => opcao.trim()).filter(Boolean) : [];
    if (perguntaForm.tipoResposta === 'selecao' && opcoes.length < 2) {
      setMessage('Cadastre ao menos duas opções para um item de seleção.');
      return;
    }
    if (perguntaForm.complementar && perguntaForm.tipoResposta === 'selecao' && !opcoes.includes(perguntaForm.complementar.gatilho)) {
      setMessage('Escolha qual opção ativa o campo complementar.');
      return;
    }
    if (perguntaForm.complementar && !perguntaForm.complementar.label.trim()) {
      setMessage('Informe o texto exibido no campo complementar.');
      return;
    }

    const payload = { ...perguntaForm, opcoes };
    setSalvandoPergunta(true);
    const resultado = perguntaForm.id
      ? await updatePdiModeloPerguntaReal(modeloSelecionado.id, perguntaForm.id, payload)
      : await createPdiModeloPerguntaReal(modeloSelecionado.id, payload);
    setSalvandoPergunta(false);
    if (!resultado.ok) {
      setMessage(resultado.error);
      return;
    }
    setMessage(perguntaForm.id ? 'Item atualizado com sucesso.' : 'Item adicionado ao modelo com sucesso.');
    setPerguntaForm(null);
  };

  const salvarAplicacao = async (event) => {
    event.preventDefault();
    setAplicacaoError('');
    if (aplicacaoForm.dataFim < aplicacaoForm.dataInicio) {
      setAplicacaoError('A data de encerramento não pode ser anterior à data de início.');
      return;
    }

    if (editingAplicacao) {
      setSalvandoAplicacao(true);
      const resultado = await updatePdiAplicacaoReal(editingAplicacao.id, { nome: editingAplicacao.nome, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim });
      setSalvandoAplicacao(false);
      // Sobreposição de vigência na mesma escola, escola inexistente etc.: o backend já valida
      // tudo isso e devolve uma mensagem pronta (ver POST/PUT /api/pdi-aplicacoes) — não
      // duplicamos a checagem aqui.
      if (!resultado.ok) {
        setAplicacaoError(resultado.error);
        return;
      }
      setMessage('Vigência da aplicação atualizada com sucesso.');
      setAplicacaoForm(null);
      setEditingAplicacao(null);
      return;
    }

    // Criação: uma ou mais escolas de uma vez, incluindo "todas as escolas" — a MESMA seleção de
    // disciplinas (modeloIds) vale para todas elas nesta ação. Cada escola é uma chamada
    // independente: uma escola com conflito de período não impede a criação nas demais.
    const escolaIdsSelecionadas = aplicacaoForm.todasEscolas ? escolasAplicaveis.map(escola => escola.id) : aplicacaoForm.escolaIds;
    if (escolaIdsSelecionadas.length === 0) {
      setAplicacaoError('Escolha ao menos uma escola.');
      return;
    }
    if (aplicacaoForm.modeloIds.length === 0) {
      setAplicacaoError('Escolha ao menos uma disciplina.');
      return;
    }

    setSalvandoAplicacao(true);
    const resultados = [];
    for (const escolaId of escolaIdsSelecionadas) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await createPdiAplicacaoReal({ escolaId, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim, modeloIds: aplicacaoForm.modeloIds });
      resultados.push({ escolaId, ...resultado });
    }
    setSalvandoAplicacao(false);

    const sucesso = resultados.filter(item => item.ok);
    const falha = resultados.filter(item => !item.ok);
    if (falha.length > 0) {
      const detalhes = falha.map(item => `${escolas.find(escola => escola.id === item.escolaId)?.nome || `Escola #${item.escolaId}`}: ${item.error}`);
      setAplicacaoError(sucesso.length > 0
        ? `Criada para ${sucesso.length} ${sucesso.length === 1 ? 'escola' : 'escolas'}, mas falhou para: ${detalhes.join('; ')}`
        : detalhes.join('; '));
      if (sucesso.length === 0) return;
    }
    if (falha.length === 0) setMessage(`Aplicação PDI criada com sucesso para ${sucesso.length} ${sucesso.length === 1 ? 'escola' : 'escolas'}.`);
    setAplicacaoForm(null);
    setEditingAplicacao(null);
  };

  // Linha de UMA Aplicação — reaproveitada tanto na visão operacional (Agendadas/Vigentes/
  // Reabertas) quanto no Histórico de encerradas: as ações (Reabrir, Editar vigência, Histórico de
  // reaberturas) continuam as mesmas nos dois lugares, "Reabrir" inclusive só faz sentido
  // justamente sobre uma Aplicação já encerrada.
  const renderAplicacaoItem = ({ aplicacao, status }) => (
    <div key={aplicacao.id} className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{aplicacao.escolaNome || escolas.find(item => item.id === aplicacao.escolaId)?.nome || 'Escola não encontrada'}</p>
            {aplicacao.statusRegistro === 'inativa' ? (
              <Badge variant="gray">Removida</Badge>
            ) : (
              <>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(status)}`}>{formStatusLabel(status)}</span>
                {aplicacao.reaberturaAtivaAgora && <Badge variant="blue">Reabertura ativa agora</Badge>}
              </>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{formatFullDate(aplicacao.dataInicio)} a {formatFullDate(aplicacao.dataFim)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {aplicacao.modelos.length === 0
              ? <Badge variant="gray">Nenhum modelo disponível no momento da criação</Badge>
              // Mostra o nome do modelo já snapshotado, nunca re-consulta disciplina por id: o
              // snapshot é imutável e independente do Modelo/Disciplina vivos mudarem depois.
              : aplicacao.modelos.map(modelo => <Badge key={modelo.modeloId} variant="blue">{modelo.nome}</Badge>)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => toggleHistoricoReaberturas(aplicacao.id)}>
            {aplicacaoExpandida === aplicacao.id ? 'Ocultar reaberturas' : 'Histórico de reaberturas'}
          </Button>
          {souSecretaria && aplicacao.statusRegistro !== 'inativa' && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditingAplicacao(aplicacao); setAplicacaoError(''); setAplicacaoForm({ dataInicio: aplicacao.dataInicio, dataFim: aplicacao.dataFim }); }}>Editar vigência</Button>
              <Button size="sm" onClick={() => abrirReabertura(aplicacao)}>Reabrir</Button>
              <Button size="sm" variant="danger" onClick={() => setRemovendoAplicacao(aplicacao)}>Remover</Button>
            </>
          )}
        </div>
      </div>

      {aplicacaoExpandida === aplicacao.id && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {carregandoHistorico && !historicoReaberturas[aplicacao.id] ? (
            <p className="text-sm text-slate-500">Carregando histórico...</p>
          ) : (historicoReaberturas[aplicacao.id] || []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma reabertura registrada para esta aplicação.</p>
          ) : (
            <ul className="space-y-2">
              {historicoReaberturas[aplicacao.id].map(reabertura => (
                <li key={reabertura.id} className="text-sm text-slate-700">
                  <span className="font-semibold">{formatFullDate(reabertura.dataInicio)} a {formatFullDate(reabertura.dataFim)}</span>
                  {' — solicitado por '}{SOLICITADO_POR_OPTIONS.find(option => option.value === reabertura.solicitadoPorTipo)?.label || reabertura.solicitadoPorTipo}
                  {reabertura.motivo && <span className="text-slate-500"> · {reabertura.motivo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Configuração do PDI</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              <strong className="font-semibold text-slate-800">Modelos</strong> definem o que é perguntado em cada disciplina. <strong className="font-semibold text-slate-800">Aplicações</strong> definem quando e em qual escola os professores preenchem esses formulários.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button>
          </div>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <div className="flex gap-2">
          {souSecretaria && <button type="button" onClick={() => setTab('modelos')} className={tabButtonClass(tab === 'modelos')}>Modelos</button>}
          <button type="button" onClick={() => setTab('aplicacoes')} className={tabButtonClass(tab === 'aplicacoes')}>Aplicações</button>
        </div>

        {/* --- Modelos PDI (exclusivo da Secretaria) ----------------------------------------- */}
        {tab === 'modelos' && souSecretaria && (
          <Card>
            {pdiModelosReaisError && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                <span>Não foi possível carregar os modelos: {pdiModelosReaisError}</span>
                <Button size="sm" variant="outline" onClick={loadPdiModelosReais}>Tentar novamente</Button>
              </div>
            )}
            {pdiModelosReaisLoading ? (
              <p className="text-center text-slate-500">Carregando modelos...</p>
            ) : modeloSelecionado ? (
              <>
                <button type="button" onClick={() => setModeloEditandoId(null)} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar aos modelos</button>

                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{modeloSelecionado.disciplinaNome || 'Disciplina não encontrada'}</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">{modeloSelecionado.nome}</h2>
                    <p className="mt-1 text-sm text-slate-600">Itens do formulário — todos podem ser editados, reordenados ou inativados, inclusive os que vieram prontos.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={modeloSelecionado.status === 'ativa' ? 'green' : 'gray'}>{modeloSelecionado.status === 'ativa' ? 'Ativo' : 'Inativo'}</Badge>
                    <Button size="sm" onClick={() => setPerguntaForm(blankPerguntaPdi())}>+ Adicionar item</Button>
                    <ActionMenu items={[
                      modeloSelecionado.status === 'ativa'
                        ? { label: 'Excluir modelo', variant: 'danger', onClick: () => setExcluindoModelo(modeloSelecionado) }
                        : { label: 'Reativar modelo', onClick: () => setMudandoStatusModelo({ modelo: modeloSelecionado, ativar: true }) },
                    ]} />
                  </div>
                </div>

                <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {perguntasDoModelo.map((pergunta, index) => (
                    <div key={pergunta.id} className="flex items-center gap-3 p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{pergunta.codigo ? `${pergunta.codigo} — ${pergunta.pergunta}` : pergunta.pergunta}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {tipoRespostaLabel(pergunta.tipoResposta)}
                          {pergunta.tipoResposta === 'selecao' && pergunta.opcoes?.length > 0 && ` • ${pergunta.opcoes.length} opções`}
                          {pergunta.secao && ` · ${pergunta.secao}${pergunta.subsecao ? ` › ${pergunta.subsecao}` : ''}`}
                          {pergunta.status !== 'ativa' && ' · Inativa'}
                        </p>
                      </div>
                      <OrderButtons
                        onUp={() => reorderPdiModeloPerguntaReal(modeloSelecionado.id, calcularReordenacao(perguntasDoModelo, pergunta.id, -1))}
                        onDown={() => reorderPdiModeloPerguntaReal(modeloSelecionado.id, calcularReordenacao(perguntasDoModelo, pergunta.id, 1))}
                        upDisabled={index === 0}
                        downDisabled={index === perguntasDoModelo.length - 1}
                      />
                      <ActionMenu items={[
                        { label: 'Editar', onClick: () => setPerguntaForm({ ...pergunta, opcoes: pergunta.opcoes || [] }) },
                        pergunta.status === 'ativa'
                          ? { label: 'Inativar', variant: 'danger', onClick: () => setInativandoPergunta({ pergunta, ativar: false }) }
                          : { label: 'Reativar', onClick: () => setInativandoPergunta({ pergunta, ativar: true }) },
                      ]} />
                    </div>
                  ))}
                  {perguntasDoModelo.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum item cadastrado neste modelo ainda.</p>}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Modelos PDI</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">Formulários por disciplina</h2>
                    <p className="mt-1 text-sm text-slate-600">Configurado poucas vezes — normalmente só quando uma disciplina nova entra no PDI.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {modelosInativos.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setMostrarHistoricoModelos(prev => !prev)}>
                        {mostrarHistoricoModelos ? 'Ocultar histórico' : 'Ver histórico de modelos'}
                      </Button>
                    )}
                    {pdiModelosReais.length > 0 && <Button size="sm" onClick={abrirNovoModelo} disabled={disciplinasDisponiveis.length === 0}>+ Novo modelo</Button>}
                  </div>
                </div>
                {disciplinasDisponiveis.length === 0 && pdiModelosReais.length > 0 && <p className="mt-2 text-xs text-slate-500">Todas as disciplinas cadastradas já possuem um modelo PDI ativo.</p>}

                {pdiModelosReais.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title="Nenhum modelo PDI configurado" description="Crie o primeiro modelo escolhendo uma disciplina.">
                      <Button size="sm" onClick={abrirNovoModelo}>+ Novo modelo</Button>
                    </EmptyState>
                  </div>
                ) : modelosAtivos.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title="Nenhum modelo ativo no momento" description="Todos os modelos foram excluídos ou estão arquivados no histórico." />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {modelosAtivos.map(modelo => {
                      return (
                        <div key={modelo.id} className="flex flex-col justify-between rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:shadow-sm">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{modelo.disciplinaNome || 'Disciplina não encontrada'}</p>
                              <ActionMenu items={[
                                { label: 'Excluir modelo', variant: 'danger', onClick: () => setExcluindoModelo(modelo) },
                              ]} />
                            </div>
                            <p className="mt-0.5 text-sm text-slate-500">{modelo.nome}</p>
                            <p className="mt-3 text-sm text-slate-600">{modelo.perguntas.length} {modelo.perguntas.length === 1 ? 'item' : 'itens'}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Modelo ativo
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => setModeloEditandoId(modelo.id)}>Editar modelo</Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {mostrarHistoricoModelos && modelosInativos.length > 0 && (
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico de modelos</p>
                    <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                      {modelosInativos.map(modelo => (
                        <div key={modelo.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{modelo.disciplinaNome || 'Disciplina não encontrada'} — {modelo.nome}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Criado em {formatDateTime(modelo.createdAt)} · Última atualização: {formatDateTime(modelo.updatedAt)} · {modelo.usadoEmAplicacao ? 'Já usado em alguma Aplicação' : 'Nunca usado em nenhuma Aplicação'}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button size="sm" variant="outline" onClick={() => setModeloEditandoId(modelo.id)}>Ver</Button>
                            <Button size="sm" onClick={() => setMudandoStatusModelo({ modelo, ativar: true })}>Reativar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* --- Aplicações PDI ---------------------------------------------------------------- */}
        {tab === 'aplicacoes' && (
          <Card>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Aplicações PDI</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Vigência por escola</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {souSecretaria ? 'Agendadas e vigentes no momento — encerradas ficam no histórico, para não acumular na tela principal.' : 'Consulta das aplicações PDI das suas escolas.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {aplicacoesEncerradas.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setMostrarAplicacoesEncerradas(prev => !prev)}>
                    {mostrarAplicacoesEncerradas ? 'Ocultar encerradas' : 'Ver aplicações encerradas'}
                  </Button>
                )}
                {aplicacoesRemovidas.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setMostrarAplicacoesRemovidas(prev => !prev)}>
                    {mostrarAplicacoesRemovidas ? 'Ocultar removidas' : 'Ver aplicações removidas'}
                  </Button>
                )}
                {souSecretaria && <Button size="sm" onClick={abrirNovaAplicacao} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>+ Nova aplicação</Button>}
              </div>
            </div>
            {souSecretaria && modelosAtivos.length === 0 && <p className="mt-2 text-xs text-slate-500">Cadastre ao menos um modelo PDI ativo na aba Modelos antes de criar uma aplicação.</p>}

            {pdiAplicacoesReaisError && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                <span>Não foi possível carregar as aplicações: {pdiAplicacoesReaisError}</span>
                <Button size="sm" variant="outline" onClick={loadPdiAplicacoesReais}>Tentar novamente</Button>
              </div>
            )}

            {pdiAplicacoesReaisLoading ? (
              <p className="mt-4 text-center text-slate-500">Carregando aplicações...</p>
            ) : pdiAplicacoesReais.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Nenhuma aplicação PDI criada" description={souSecretaria ? 'Abra uma aplicação para disponibilizar os formulários aos professores de uma escola.' : 'Nenhuma aplicação PDI foi criada para suas escolas ainda.'}>
                  {souSecretaria && <Button size="sm" onClick={abrirNovaAplicacao} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>+ Nova aplicação</Button>}
                </EmptyState>
              </div>
            ) : aplicacoesOperacionais.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nenhuma aplicação agendada ou vigente no momento"
                  description={[
                    aplicacoesEncerradas.length > 0 ? `${aplicacoesEncerradas.length} encerrada(s)` : null,
                    aplicacoesRemovidas.length > 0 ? `${aplicacoesRemovidas.length} removida(s)` : null,
                  ].filter(Boolean).join(' e ') + ' — use os botões acima para consultá-las.'}
                >
                  {souSecretaria && <Button size="sm" onClick={abrirNovaAplicacao} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>+ Nova aplicação</Button>}
                </EmptyState>
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {GRUPOS_APLICACAO_OPERACIONAIS.map(grupo => {
                  const itens = aplicacoesOperacionais.filter(item => item.status === grupo.status);
                  if (itens.length === 0) return null;
                  return (
                    <div key={grupo.status}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{grupo.titulo}</p>
                      <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                        {itens.map(renderAplicacaoItem)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mostrarAplicacoesEncerradas && aplicacoesEncerradas.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico de aplicações encerradas</p>
                <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 opacity-75">
                  {aplicacoesEncerradas.map(renderAplicacaoItem)}
                </div>
              </div>
            )}

            {mostrarAplicacoesRemovidas && aplicacoesRemovidas.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aplicações removidas</p>
                <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 opacity-75">
                  {aplicacoesRemovidas.map(renderAplicacaoItem)}
                </div>
              </div>
            )}
          </Card>
        )}

        {novoModeloForm && (
          <Modal title="Novo modelo PDI" onClose={() => setNovoModeloForm(null)}>
            <form onSubmit={criarModelo} className="space-y-4">
              <FormField label="Disciplina">
                <select className={inputClass} value={novoModeloForm.disciplinaId} onChange={event => setNovoModeloForm(prev => ({ ...prev, disciplinaId: event.target.value }))} required>
                  <option value="" disabled>Selecione</option>
                  {disciplinasDisponiveis.map(disciplina => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Nome do modelo (opcional)"><input className={inputClass} value={novoModeloForm.nome} onChange={event => setNovoModeloForm(prev => ({ ...prev, nome: event.target.value }))} placeholder="Ex.: PDI - Matemática" /></FormField>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={novoModeloForm.carregarPerguntasPadrao} onChange={event => setNovoModeloForm(prev => ({ ...prev, carregarPerguntasPadrao: event.target.checked }))} />
                Carregar perguntas padrão
              </label>
              <p className="text-xs text-slate-500">
                {novoModeloForm.carregarPerguntasPadrao
                  ? 'O modelo já nasce com o conjunto padrão de itens (gerenciado em Configurações) e abre direto para edição.'
                  : 'O modelo nasce vazio — você adiciona os itens manualmente depois de criar.'}
              </p>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setNovoModeloForm(null)} disabled={salvandoModelo}>Cancelar</Button><Button type="submit" disabled={salvandoModelo}>{salvandoModelo ? 'Criando...' : 'Criar modelo'}</Button></div>
            </form>
          </Modal>
        )}

        {perguntaForm && (
          <PerguntaPdiFormModal
            title={perguntaForm.id ? 'Editar item' : 'Adicionar item'}
            value={perguntaForm}
            onChange={setPerguntaForm}
            onSubmit={salvarPergunta}
            onClose={() => setPerguntaForm(null)}
            saving={salvandoPergunta}
          />
        )}

        {aplicacaoForm && (
          <Modal title={editingAplicacao ? 'Editar vigência da aplicação' : 'Nova aplicação PDI'} onClose={() => { setAplicacaoForm(null); setEditingAplicacao(null); setAplicacaoError(''); }}>
            <form onSubmit={salvarAplicacao} className="space-y-4">
              {aplicacaoError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{aplicacaoError}</div>}
              {!editingAplicacao && (
                <p className="text-sm text-slate-600">Durante esta vigência, os professores da escola terão acesso aos formulários PDI correspondentes às disciplinas que lecionam e que possuem modelo configurado.</p>
              )}
              {editingAplicacao ? (
                <FormField label="Escola">
                  <input className={inputClass} value={escolas.find(item => item.id === editingAplicacao.escolaId)?.nome || ''} disabled />
                </FormField>
              ) : (
                <FormField label="Escolas">
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={aplicacaoForm.todasEscolas}
                        onChange={event => setAplicacaoForm(prev => ({ ...prev, todasEscolas: event.target.checked, escolaIds: [] }))}
                      />
                      Todas as escolas ({escolasAplicaveis.length})
                    </label>
                    {!aplicacaoForm.todasEscolas && (
                      <div className="border-t border-slate-100 pt-2">
                        {escolasAplicaveis.length > 6 && (
                          <input className={`${inputClass} mb-2`} value={buscaEscolaAplicacao} onChange={event => setBuscaEscolaAplicacao(event.target.value)} placeholder="Buscar escola..." />
                        )}
                        <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
                        {escolasAplicaveis.filter(escola => escola.nome.toLowerCase().includes(buscaEscolaAplicacao.toLowerCase())).map(escola => (
                          <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={aplicacaoForm.escolaIds.includes(escola.id)}
                              onChange={() => setAplicacaoForm(prev => ({
                                ...prev,
                                escolaIds: prev.escolaIds.includes(escola.id) ? prev.escolaIds.filter(id => id !== escola.id) : [...prev.escolaIds, escola.id],
                              }))}
                            />
                            {escola.nome}
                          </label>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                </FormField>
              )}
              {!editingAplicacao && (
                <FormField label="Disciplinas (modelos ativos)">
                  {modelosAtivos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum Modelo PDI ativo no momento — cadastre um na aba "Modelos" antes de criar a Aplicação.</p>
                  ) : (
                    <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                      {modelosAtivos.map(modelo => (
                        <label key={modelo.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={aplicacaoForm.modeloIds.includes(modelo.id)}
                            onChange={() => setAplicacaoForm(prev => ({
                              ...prev,
                              modeloIds: prev.modeloIds.includes(modelo.id) ? prev.modeloIds.filter(id => id !== modelo.id) : [...prev.modeloIds, modelo.id],
                            }))}
                          />
                          {modelo.disciplinaNome} <span className="text-xs text-slate-400">({modelo.nome})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </FormField>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Início">
                  <input
                    className={inputClass}
                    type="date"
                    value={aplicacaoForm.dataInicio}
                    // min só na criação — editar uma aplicação já existente (possivelmente com
                    // início no passado, legítimo com o tempo) não pode ficar travado por isso.
                    min={editingAplicacao ? undefined : hojeISO()}
                    onChange={event => setAplicacaoForm(prev => ({ ...prev, dataInicio: event.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Encerramento"><input className={inputClass} type="date" value={aplicacaoForm.dataFim} onChange={event => setAplicacaoForm(prev => ({ ...prev, dataFim: event.target.value }))} required /></FormField>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => { setAplicacaoForm(null); setEditingAplicacao(null); setAplicacaoError(''); }} disabled={salvandoAplicacao}>Cancelar</Button>
                <Button type="submit" disabled={salvandoAplicacao}>{salvandoAplicacao ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </Modal>
        )}

        {reaberturaForm && (
          <Modal title="Reabrir aplicação PDI" onClose={() => { setReaberturaForm(null); setReaberturaError(''); }}>
            <form onSubmit={salvarReabertura} className="space-y-4">
              {reaberturaError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{reaberturaError}</div>}
              <p className="text-sm text-slate-600">A vigência original da aplicação nunca é alterada — a reabertura cria um novo período extra, separado, sempre depois do fim original.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Início"><input className={inputClass} type="date" value={reaberturaForm.dataInicio} onChange={event => setReaberturaForm(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
                <FormField label="Encerramento"><input className={inputClass} type="date" value={reaberturaForm.dataFim} onChange={event => setReaberturaForm(prev => ({ ...prev, dataFim: event.target.value }))} required /></FormField>
              </div>
              <FormField label="Solicitado por">
                <select className={inputClass} value={reaberturaForm.solicitadoPorTipo} onChange={event => setReaberturaForm(prev => ({ ...prev, solicitadoPorTipo: event.target.value }))}>
                  {SOLICITADO_POR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>
              <FormField label="Motivo (opcional)"><textarea className={inputClass} rows="3" value={reaberturaForm.motivo} onChange={event => setReaberturaForm(prev => ({ ...prev, motivo: event.target.value }))} /></FormField>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => { setReaberturaForm(null); setReaberturaError(''); }} disabled={salvandoReabertura}>Cancelar</Button>
                <Button type="submit" disabled={salvandoReabertura}>{salvandoReabertura ? 'Salvando...' : 'Reabrir'}</Button>
              </div>
            </form>
          </Modal>
        )}

        {inativandoPergunta && (
          <ConfirmDialog
            title={inativandoPergunta.ativar ? 'Reativar item' : 'Inativar item'}
            message={inativandoPergunta.ativar
              ? 'Deseja reativar este item? Ele volta a aparecer no modelo operacional.'
              : 'Deseja inativar este item? Aplicações já criadas continuam com a versão que tinham no momento em que foram abertas — só novas aplicações deixam de incluir este item. O histórico é preservado.'}
            confirmLabel={inativandoPergunta.ativar ? 'Reativar' : 'Inativar'}
            onCancel={() => setInativandoPergunta(null)}
            onConfirm={async () => {
              const { pergunta, ativar } = inativandoPergunta;
              setInativandoPergunta(null);
              const resultado = ativar ? await reativarPdiPergunta(modeloSelecionado.id, pergunta.id) : await inativarPdiPergunta(modeloSelecionado.id, pergunta.id);
              setMessage(resultado.ok ? `Item ${ativar ? 'reativado' : 'inativado'} com sucesso.` : resultado.error);
            }}
          />
        )}

        {mudandoStatusModelo && (
          <ConfirmDialog
            title={mudandoStatusModelo.ativar ? 'Reativar modelo PDI' : 'Inativar modelo PDI'}
            message={mudandoStatusModelo.ativar
              ? `Deseja reativar o modelo "${mudandoStatusModelo.modelo.nome}"? Bloqueado se já existir outro modelo ativo para a mesma disciplina.`
              : `Deseja inativar o modelo "${mudandoStatusModelo.modelo.nome}"? Ele deixa de estar disponível para novas aplicações, mas aplicações já criadas mantêm a cópia dos itens de quando foram abertas. O histórico é preservado.`}
            confirmLabel={mudandoStatusModelo.ativar ? 'Reativar' : 'Inativar'}
            onCancel={() => setMudandoStatusModelo(null)}
            onConfirm={async () => {
              const { modelo, ativar } = mudandoStatusModelo;
              setMudandoStatusModelo(null);
              const resultado = ativar ? await reativarPdiModeloReal(modelo.id) : await inativarPdiModelo(modelo.id);
              setMessage(resultado.ok ? `Modelo PDI ${ativar ? 'reativado' : 'inativado'} com sucesso.` : resultado.error);
            }}
          />
        )}

        {excluindoModelo && (
          <ConfirmDialog
            title="Excluir modelo PDI"
            message={`Tem certeza que deseja excluir o modelo "${excluindoModelo.nome}"? Se ele nunca foi usado em nenhuma Aplicação, será removido definitivamente, junto com suas perguntas. Se já foi usado, ele some da tela principal e fica arquivado no Histórico de modelos — nenhuma Aplicação ou Ficha já criada é afetada.`}
            confirmLabel="Excluir"
            onCancel={() => setExcluindoModelo(null)}
            onConfirm={async () => {
              const modelo = excluindoModelo;
              setExcluindoModelo(null);
              if (modeloEditandoId === modelo.id) setModeloEditandoId(null);
              const resultado = await excluirPdiModelo(modelo.id);
              setMessage(resultado.ok
                ? (resultado.removidoFisicamente ? 'Modelo excluído definitivamente — nunca havia sido usado em nenhuma Aplicação.' : 'Modelo removido da tela principal e arquivado no Histórico (já havia sido usado em alguma Aplicação).')
                : resultado.error);
            }}
          />
        )}

        {removendoAplicacao && (
          <ConfirmDialog
            title="Remover aplicação PDI"
            message={`Tem certeza que deseja remover esta aplicação (${removendoAplicacao.escolaNome || escolas.find(item => item.id === removendoAplicacao.escolaId)?.nome})? Se nenhum professor respondeu nada ainda, ela é excluída definitivamente. Se já houver alguma resposta salva, ela só sai de circulação (deixa de aparecer em Meus PDIs e nos indicadores) — as Fichas e Respostas já preenchidas continuam guardadas.`}
            confirmLabel="Remover"
            onCancel={() => setRemovendoAplicacao(null)}
            onConfirm={async () => {
              const aplicacao = removendoAplicacao;
              setRemovendoAplicacao(null);
              const resultado = await removePdiAplicacaoReal(aplicacao.id);
              if (!resultado.ok) {
                setMessage(resultado.error);
                return;
              }
              setMessage(
                resultado.modo === 'excluida'
                  ? 'Aplicação excluída definitivamente — nunca havia resposta registrada.'
                  : 'Aplicação removida de circulação (inativada) — já havia resposta registrada, o histórico foi preservado.',
              );
            }}
          />
        )}

      </div>
    </MainLayout>
  );
};

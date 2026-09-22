import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, EmptyState, FormField, Modal, OrderButtons } from '../components/Common';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { CURRENT_DATE, formatFullDate, formStatusClasses, formStatusLabel } from '../utils/formAvailability';
import { canManagePedagogico } from '../utils/roles';
import { getEscolasAplicaveis, RECURSOS } from '../utils/aplicabilidade';
import { aplicacaoConflitanteNaEscola, statusVigenciaAplicacao } from '../utils/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';

// Tipos de resposta disponíveis na edição de itens do modelo. Diferente do antigo
// `perguntaTipoOptions` (utils/pdi.js), inclui 'numero' e 'orientacao' porque, aqui, TODO
// item do modelo é editável — não há mais um conjunto restrito só para personalizadas.
const TIPO_RESPOSTA_OPTIONS = [
  { value: 'texto', label: 'Texto' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'marcacao', label: 'Marcação' },
  { value: 'numero', label: 'Número' },
  { value: 'orientacao', label: 'Informativa (sem resposta)' },
];

const tipoLabel = (value) => TIPO_RESPOSTA_OPTIONS.find(option => option.value === value)?.label || value;

const blankPergunta = (ordem) => ({ secao: 'Registro pedagógico', pergunta: '', tipoResposta: 'texto', opcoes: [], complementar: null, ordem, status: 'ativa' });
// Criação: uma ou mais escolas de uma vez (`escolaIds` + `todasEscolas`). A Secretaria não
// escolhe modelos/disciplinas aqui — a aplicação é da escola, e usa automaticamente todos os
// modelos ativos no momento da criação (ver salvarAplicacao). Edição continua sendo sempre de
// uma aplicação já existente, então usa `escolaId` único (ver editar vigência abaixo).
const blankAplicacao = () => ({ escolaIds: [], todasEscolas: false, dataInicio: CURRENT_DATE, dataFim: CURRENT_DATE });

const tabButtonClass = (active) => `rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;

const GRUPOS_APLICACAO = [
  { status: 'active', titulo: 'Vigentes' },
  { status: 'scheduled', titulo: 'Agendadas' },
  { status: 'expired', titulo: 'Encerradas' },
];

export const FormularioPdiPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    disciplinas, escolas, pdiModelos, pdiAplicacoes,
    createPdiModelo, deletePdiModelo, createPdiModeloPergunta, updatePdiModeloPergunta, deletePdiModeloPergunta, reorderPdiModeloPergunta,
    createPdiAplicacao, updatePdiAplicacao, deletePdiAplicacao, deleteAllPdiAplicacoes,
  } = useData();

  const [tab, setTab] = useState('modelos');
  // null = grade de modelos; com valor = editor ("construtor de formulário") do modelo aberto.
  const [modeloEditandoId, setModeloEditandoId] = useState(null);
  const [novoModeloForm, setNovoModeloForm] = useState(null);
  const [perguntaForm, setPerguntaForm] = useState(null);
  const [deletingPergunta, setDeletingPergunta] = useState(null);
  const [deletingModelo, setDeletingModelo] = useState(null);
  const [aplicacaoForm, setAplicacaoForm] = useState(null);
  const [editingAplicacao, setEditingAplicacao] = useState(null);
  const [aplicacaoError, setAplicacaoError] = useState('');
  const [deletingAplicacao, setDeletingAplicacao] = useState(null);
  const [confirmandoExcluirTodasAplicacoes, setConfirmandoExcluirTodasAplicacoes] = useState(false);
  const [message, setMessage] = useState('');

  if (!canManagePedagogico(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const escolasAplicaveis = getEscolasAplicaveis(RECURSOS.PDI, escolas);
  const modelosAtivos = pdiModelos.filter(modelo => modelo.status === 'ativa');
  const disciplinasComModelo = new Set(modelosAtivos.map(modelo => modelo.disciplinaId));
  const disciplinasDisponiveis = disciplinas.filter(disciplina => !disciplinasComModelo.has(disciplina.id));
  const modeloSelecionado = pdiModelos.find(modelo => modelo.id === modeloEditandoId) || null;
  const perguntasDoModelo = modeloSelecionado ? [...modeloSelecionado.perguntas].sort((left, right) => Number(left.ordem) - Number(right.ordem)) : [];
  const aplicacoesComStatus = [...pdiAplicacoes]
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
    .map(aplicacao => ({ aplicacao, status: statusVigenciaAplicacao(aplicacao) }));

  const abrirNovoModelo = () => setNovoModeloForm({ nome: '', disciplinaId: disciplinasDisponiveis[0]?.id ?? '' });
  const abrirNovaAplicacao = () => { setEditingAplicacao(null); setAplicacaoError(''); setAplicacaoForm(blankAplicacao()); };

  const criarModelo = (event) => {
    event.preventDefault();
    if (!novoModeloForm?.disciplinaId) {
      setMessage('Escolha a disciplina do novo modelo.');
      return;
    }
    const disciplina = disciplinas.find(item => item.id === Number(novoModeloForm.disciplinaId));
    const modelo = createPdiModelo({ nome: novoModeloForm.nome?.trim() || `PDI - ${disciplina?.nome}`, disciplinaId: novoModeloForm.disciplinaId });
    // Fluxo direto: criar já abre a edição do modelo recém-criado, sem passo intermediário.
    setModeloEditandoId(modelo.id);
    setNovoModeloForm(null);
    setMessage('Modelo PDI criado com sucesso.');
  };

  const changeTipoResposta = (tipoResposta) => {
    setPerguntaForm(prev => ({
      ...prev,
      tipoResposta,
      opcoes: tipoResposta === 'selecao' ? (prev.opcoes?.length ? prev.opcoes : ['', '']) : [],
      complementar: (tipoResposta === 'texto' || tipoResposta === 'numero' || tipoResposta === 'orientacao') ? null : prev.complementar,
    }));
  };

  const toggleComplementar = (habilitado) => {
    setPerguntaForm(prev => ({
      ...prev,
      complementar: habilitado
        ? { gatilho: prev.tipoResposta === 'marcacao' ? true : (prev.opcoes.find(opcao => opcao.trim()) || ''), label: prev.complementar?.label || '' }
        : null,
    }));
  };

  const salvarPergunta = (event) => {
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
    if (perguntaForm.id) {
      updatePdiModeloPergunta(modeloSelecionado.id, perguntaForm.id, payload);
      setMessage('Item atualizado com sucesso.');
    } else {
      createPdiModeloPergunta(modeloSelecionado.id, payload);
      setMessage('Item adicionado ao modelo com sucesso.');
    }
    setPerguntaForm(null);
  };

  const salvarAplicacao = (event) => {
    event.preventDefault();
    setAplicacaoError('');
    if (aplicacaoForm.dataFim < aplicacaoForm.dataInicio) {
      setAplicacaoError('A data de encerramento não pode ser anterior à data de início.');
      return;
    }

    if (editingAplicacao) {
      const resultado = updatePdiAplicacao(editingAplicacao.id, { dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim });
      // Sobreposição de vigência na mesma escola: não salva, mantém o modal aberto com os dados
      // preenchidos e mostra o erro ali mesmo (ver src/utils/pdiFichas.js). A regra em si vem de
      // updatePdiAplicacao; aqui só buscamos a vigência conflitante para deixar a mensagem clara.
      if (!resultado.ok) {
        const conflito = aplicacaoConflitanteNaEscola(pdiAplicacoes, { escolaId: editingAplicacao.escolaId, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim, ignorarId: editingAplicacao.id });
        setAplicacaoError(conflito
          ? `Já existe uma aplicação PDI para esta escola de ${formatFullDate(conflito.dataInicio)} a ${formatFullDate(conflito.dataFim)}. Escolha um período sem sobreposição.`
          : resultado.error);
        return;
      }
      setMessage('Vigência da aplicação atualizada com sucesso.');
      setAplicacaoForm(null);
      setEditingAplicacao(null);
      return;
    }

    // Criação: uma ou mais escolas de uma vez, incluindo "todas as escolas". A disciplina não é
    // escolhida aqui — a aplicação sempre usa todos os modelos ativos no momento da criação.
    const escolaIdsSelecionadas = aplicacaoForm.todasEscolas ? escolasAplicaveis.map(escola => escola.id) : aplicacaoForm.escolaIds;
    if (escolaIdsSelecionadas.length === 0) {
      setAplicacaoError('Escolha ao menos uma escola.');
      return;
    }
    if (modelosAtivos.length === 0) {
      setAplicacaoError('Cadastre ao menos um modelo PDI ativo antes de criar uma aplicação.');
      return;
    }
    // Valida a sobreposição em TODAS as escolas selecionadas antes de criar qualquer uma —
    // tudo ou nada, para nunca deixar a seleção pela metade.
    const conflitos = escolaIdsSelecionadas
      .map(escolaId => ({ escolaId, conflito: aplicacaoConflitanteNaEscola(pdiAplicacoes, { escolaId, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim }) }))
      .filter(item => item.conflito);
    if (conflitos.length > 0) {
      const detalhes = conflitos.map(({ escolaId, conflito }) => {
        const nomeEscola = escolas.find(item => item.id === escolaId)?.nome || `Escola #${escolaId}`;
        return `${nomeEscola} (${formatFullDate(conflito.dataInicio)} a ${formatFullDate(conflito.dataFim)})`;
      });
      setAplicacaoError(`Já existe uma aplicação PDI sobreposta para: ${detalhes.join('; ')}. Ajuste o período ou remova essas escolas da seleção.`);
      return;
    }

    const modeloIds = modelosAtivos.map(modelo => modelo.id);
    escolaIdsSelecionadas.forEach(escolaId => createPdiAplicacao({ escolaId, modeloIds, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim }));
    setMessage(`Aplicação PDI criada com sucesso para ${escolaIdsSelecionadas.length} ${escolaIdsSelecionadas.length === 1 ? 'escola' : 'escolas'}.`);
    setAplicacaoForm(null);
    setEditingAplicacao(null);
  };

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
          <Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <div className="flex gap-2">
          <button type="button" onClick={() => setTab('modelos')} className={tabButtonClass(tab === 'modelos')}>Modelos</button>
          <button type="button" onClick={() => setTab('aplicacoes')} className={tabButtonClass(tab === 'aplicacoes')}>Aplicações</button>
        </div>

        {/* --- Modelos PDI ------------------------------------------------------------------ */}
        {tab === 'modelos' && (
          <Card>
            {modeloSelecionado ? (
              <>
                <button type="button" onClick={() => setModeloEditandoId(null)} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar aos modelos</button>

                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{disciplinas.find(item => item.id === modeloSelecionado.disciplinaId)?.nome || 'Disciplina não encontrada'}</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">{modeloSelecionado.nome}</h2>
                    <p className="mt-1 text-sm text-slate-600">Itens do formulário — todos podem ser editados, reordenados ou excluídos, inclusive os que vieram prontos.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setPerguntaForm(blankPergunta(perguntasDoModelo.length + 1))}>+ Adicionar item</Button>
                    <ActionMenu items={[{ label: 'Excluir modelo', variant: 'danger', onClick: () => setDeletingModelo(modeloSelecionado) }]} />
                  </div>
                </div>

                <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {perguntasDoModelo.map((pergunta, index) => (
                    <div key={pergunta.id} className="flex items-center gap-3 p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{pergunta.codigo ? `${pergunta.codigo} — ${pergunta.pergunta}` : pergunta.pergunta}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {tipoLabel(pergunta.tipoResposta)}
                          {pergunta.tipoResposta === 'selecao' && pergunta.opcoes?.length > 0 && ` • ${pergunta.opcoes.length} opções`}
                          {pergunta.secao && ` · ${pergunta.secao}${pergunta.subsecao ? ` › ${pergunta.subsecao}` : ''}`}
                          {pergunta.status !== 'ativa' && ' · Inativa'}
                        </p>
                      </div>
                      <OrderButtons
                        onUp={() => reorderPdiModeloPergunta(modeloSelecionado.id, pergunta.id, -1)}
                        onDown={() => reorderPdiModeloPergunta(modeloSelecionado.id, pergunta.id, 1)}
                        upDisabled={index === 0}
                        downDisabled={index === perguntasDoModelo.length - 1}
                      />
                      <ActionMenu items={[
                        { label: 'Editar', onClick: () => setPerguntaForm({ ...pergunta, opcoes: pergunta.opcoes || [] }) },
                        { label: 'Excluir', variant: 'danger', onClick: () => setDeletingPergunta(pergunta) },
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
                  {pdiModelos.length > 0 && <Button size="sm" onClick={abrirNovoModelo} disabled={disciplinasDisponiveis.length === 0}>+ Novo modelo</Button>}
                </div>
                {disciplinasDisponiveis.length === 0 && pdiModelos.length > 0 && <p className="mt-2 text-xs text-slate-500">Todas as disciplinas cadastradas já possuem um modelo PDI ativo.</p>}

                {pdiModelos.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title="Nenhum modelo PDI configurado" description="Crie o primeiro modelo escolhendo uma disciplina.">
                      <Button size="sm" onClick={abrirNovoModelo}>+ Novo modelo</Button>
                    </EmptyState>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pdiModelos.map(modelo => {
                      const disciplina = disciplinas.find(item => item.id === modelo.disciplinaId);
                      return (
                        <div key={modelo.id} className="flex flex-col justify-between rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:shadow-sm">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{disciplina?.nome || 'Disciplina não encontrada'}</p>
                              <ActionMenu items={[{ label: 'Excluir modelo', variant: 'danger', onClick: () => setDeletingModelo(modelo) }]} />
                            </div>
                            <p className="mt-0.5 text-sm text-slate-500">{modelo.nome}</p>
                            <p className="mt-3 text-sm text-slate-600">{modelo.perguntas.length} {modelo.perguntas.length === 1 ? 'item' : 'itens'}</p>
                            {modelo.status === 'ativa' && (
                              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Modelo ativo
                              </p>
                            )}
                          </div>
                          <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => setModeloEditandoId(modelo.id)}>Editar modelo</Button>
                        </div>
                      );
                    })}
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
                <p className="mt-1 text-sm text-slate-600">Em quais escolas existe ou existiu período de preenchimento de PDI.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={abrirNovaAplicacao} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>+ Nova aplicação</Button>
                <ActionMenu items={[{ label: 'Excluir todas as aplicações', variant: 'danger', disabled: pdiAplicacoes.length === 0, onClick: () => setConfirmandoExcluirTodasAplicacoes(true) }]} />
              </div>
            </div>
            {modelosAtivos.length === 0 && <p className="mt-2 text-xs text-slate-500">Cadastre ao menos um modelo PDI ativo na aba Modelos antes de criar uma aplicação.</p>}

            {pdiAplicacoes.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Nenhuma aplicação PDI criada" description="Abra uma aplicação para disponibilizar os formulários aos professores de uma escola.">
                  <Button size="sm" onClick={abrirNovaAplicacao} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>+ Nova aplicação</Button>
                </EmptyState>
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {GRUPOS_APLICACAO.map(grupo => {
                  const itens = aplicacoesComStatus.filter(item => item.status === grupo.status);
                  if (itens.length === 0) return null;
                  return (
                    <div key={grupo.status}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{grupo.titulo}</p>
                      <div className={`mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 ${grupo.status === 'expired' ? 'opacity-75' : ''}`}>
                        {itens.map(({ aplicacao, status }) => (
                          <div key={aplicacao.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{escolas.find(item => item.id === aplicacao.escolaId)?.nome || 'Escola não encontrada'}</p>
                                <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(status)}`}>{formStatusLabel(status)}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">{formatFullDate(aplicacao.dataInicio)} a {formatFullDate(aplicacao.dataFim)}</p>
                              {aplicacao.criadaEm && <p className="mt-0.5 text-xs text-slate-400">Criado em {formatFullDate(aplicacao.criadaEm.slice(0, 10))}</p>}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {aplicacao.modelos.length === 0
                                  ? <Badge variant="gray">Nenhum modelo disponível no momento da criação</Badge>
                                  : aplicacao.modelos.map(modelo => <Badge key={modelo.modeloId} variant="blue">{disciplinas.find(item => item.id === modelo.disciplinaId)?.nome || modelo.nome}</Badge>)}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditingAplicacao(aplicacao); setAplicacaoError(''); setAplicacaoForm({ escolaId: aplicacao.escolaId, dataInicio: aplicacao.dataInicio, dataFim: aplicacao.dataFim }); }}>Editar vigência</Button>
                              <ActionMenu items={[{ label: 'Excluir', variant: 'danger', onClick: () => setDeletingAplicacao(aplicacao) }]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
              <p className="text-xs text-slate-500">O modelo já nasce com o conjunto padrão de itens (conforme a opção em Configurações) e abre direto para edição.</p>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setNovoModeloForm(null)}>Cancelar</Button><Button type="submit">Criar modelo</Button></div>
            </form>
          </Modal>
        )}

        {perguntaForm && (
          <Modal title={perguntaForm.id ? 'Editar item' : 'Adicionar item'} onClose={() => setPerguntaForm(null)}>
            <form onSubmit={salvarPergunta} className="space-y-4">
              <FormField label="Tipo">
                <select className={inputClass} value={perguntaForm.tipoResposta} onChange={event => changeTipoResposta(event.target.value)}>
                  {TIPO_RESPOSTA_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>

              <FormField label={perguntaForm.tipoResposta === 'orientacao' ? 'Conteúdo / orientação' : 'Pergunta / texto'}>
                <textarea className={inputClass} rows="4" spellCheck lang="pt-BR" value={perguntaForm.pergunta} onChange={event => setPerguntaForm(prev => ({ ...prev, pergunta: event.target.value }))} onBlur={() => setPerguntaForm(prev => ({ ...prev, pergunta: aplicarAutoCorrecao(prev.pergunta) }))} required />
              </FormField>

              {perguntaForm.tipoResposta === 'selecao' && (
                <FormField label="Opções">
                  <div className="space-y-2">
                    {perguntaForm.opcoes.map((opcao, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          className={inputClass}
                          value={opcao}
                          onChange={event => setPerguntaForm(prev => ({ ...prev, opcoes: prev.opcoes.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) }))}
                          placeholder={`Opção ${index + 1}`}
                          required
                        />
                        <Button type="button" variant="outline" size="sm" disabled={perguntaForm.opcoes.length <= 2} onClick={() => setPerguntaForm(prev => ({ ...prev, opcoes: prev.opcoes.filter((_, itemIndex) => itemIndex !== index) }))}>Remover</Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setPerguntaForm(prev => ({ ...prev, opcoes: [...prev.opcoes, ''] }))}>+ Adicionar opção</Button>
                  </div>
                </FormField>
              )}

              {(perguntaForm.tipoResposta === 'selecao' || perguntaForm.tipoResposta === 'marcacao') && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={!!perguntaForm.complementar} onChange={event => toggleComplementar(event.target.checked)} />
                    Habilitar campo complementar de texto
                  </label>
                  {perguntaForm.complementar && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {perguntaForm.tipoResposta === 'selecao' && (
                        <FormField label="Quando a resposta for">
                          <select className={inputClass} value={perguntaForm.complementar.gatilho} onChange={event => setPerguntaForm(prev => ({ ...prev, complementar: { ...prev.complementar, gatilho: event.target.value } }))}>
                            {perguntaForm.opcoes.filter(Boolean).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                          </select>
                        </FormField>
                      )}
                      {perguntaForm.tipoResposta === 'marcacao' && <p className="text-sm text-slate-600 md:col-span-1">Exibido quando a marcação estiver marcada.</p>}
                      <FormField label="Texto exibido (ex.: Como?)"><input className={inputClass} value={perguntaForm.complementar.label} onChange={event => setPerguntaForm(prev => ({ ...prev, complementar: { ...prev.complementar, label: event.target.value } }))} required /></FormField>
                    </div>
                  )}
                </div>
              )}

              <FormField label="Seção (agrupamento no formulário)"><input className={inputClass} value={perguntaForm.secao || ''} onChange={event => setPerguntaForm(prev => ({ ...prev, secao: event.target.value }))} placeholder="Ex.: Registro pedagógico" /></FormField>

              <FormField label="Status"><select className={inputClass} value={perguntaForm.status} onChange={event => setPerguntaForm(prev => ({ ...prev, status: event.target.value }))}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></FormField>

              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setPerguntaForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
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
                      <div className="grid max-h-48 gap-1.5 overflow-y-auto border-t border-slate-100 pt-2 sm:grid-cols-2">
                        {escolasAplicaveis.map(escola => (
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
                    )}
                  </div>
                </FormField>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Início"><input className={inputClass} type="date" value={aplicacaoForm.dataInicio} onChange={event => setAplicacaoForm(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
                <FormField label="Encerramento"><input className={inputClass} type="date" value={aplicacaoForm.dataFim} onChange={event => setAplicacaoForm(prev => ({ ...prev, dataFim: event.target.value }))} required /></FormField>
              </div>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => { setAplicacaoForm(null); setEditingAplicacao(null); setAplicacaoError(''); }}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {deletingPergunta && (
          <ConfirmDialog
            title="Excluir item"
            message="Deseja excluir este item do modelo? Aplicações já criadas continuam com a versão que tinham no momento em que foram abertas — só novas aplicações deixam de incluir este item."
            onCancel={() => setDeletingPergunta(null)}
            onConfirm={() => { deletePdiModeloPergunta(modeloSelecionado.id, deletingPergunta.id); setDeletingPergunta(null); setMessage('Item excluído do modelo com sucesso.'); }}
          />
        )}

        {deletingModelo && (
          <ConfirmDialog
            title="Excluir modelo PDI"
            message={`Deseja excluir o modelo "${deletingModelo.nome}"? Todos os seus itens serão removidos. Aplicações já criadas não são afetadas — elas mantêm a cópia dos itens de quando foram abertas. Novas aplicações deixam de incluir esta disciplina até um novo modelo ser cadastrado.`}
            onCancel={() => setDeletingModelo(null)}
            onConfirm={() => {
              deletePdiModelo(deletingModelo.id);
              if (modeloEditandoId === deletingModelo.id) setModeloEditandoId(null);
              setDeletingModelo(null);
              setMessage('Modelo PDI excluído com sucesso.');
            }}
          />
        )}

        {deletingAplicacao && (
          <ConfirmDialog
            title="Excluir aplicação"
            message="Deseja excluir esta aplicação PDI? As fichas e respostas associadas a ela deixarão de aparecer para os professores."
            onCancel={() => setDeletingAplicacao(null)}
            onConfirm={() => { deletePdiAplicacao(deletingAplicacao.id); setDeletingAplicacao(null); setMessage('Aplicação excluída com sucesso.'); }}
          />
        )}

        {confirmandoExcluirTodasAplicacoes && (
          <ConfirmDialog
            title="Excluir todas as aplicações"
            message={`Deseja excluir TODAS as ${pdiAplicacoes.length} aplicações PDI, de todas as escolas? As fichas e respostas associadas a elas deixarão de aparecer para os professores. Esta ação não pode ser desfeita.`}
            confirmLabel="Excluir todas"
            onCancel={() => setConfirmandoExcluirTodasAplicacoes(false)}
            onConfirm={() => { deleteAllPdiAplicacoes(); setConfirmandoExcluirTodasAplicacoes(false); setMessage('Todas as aplicações PDI foram excluídas com sucesso.'); }}
          />
        )}
      </div>
    </MainLayout>
  );
};

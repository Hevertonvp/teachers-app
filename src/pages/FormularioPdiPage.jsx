import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, FormField, Modal } from '../components/Common';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { CURRENT_DATE, formatFullDate, formStatusClasses, formStatusLabel, getFormStatus } from '../utils/formAvailability';
import { canManagePedagogico } from '../utils/roles';
import { getEscolasAplicaveis, RECURSOS } from '../utils/aplicabilidade';
import { existeSobreposicaoNaEscola } from '../utils/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';

// Tipos de resposta disponíveis na edição de perguntas do modelo. Diferente do antigo
// `perguntaTipoOptions` (utils/pdi.js), inclui 'numero' e 'orientacao' porque, aqui, TODA
// pergunta do modelo é editável — não há mais um conjunto restrito só para personalizadas
// (ver seção 6/33 do pedido: origem é só informação organizacional, nunca proteção).
const TIPO_RESPOSTA_OPTIONS = [
  { value: 'texto', label: 'Texto' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'marcacao', label: 'Marcação' },
  { value: 'numero', label: 'Número' },
  { value: 'orientacao', label: 'Orientação (texto informativo, sem resposta)' },
];

const ORIGEM_LABEL = {
  estruturada: 'Acompanhamento estruturado',
  qualitativa: 'Registro pedagógico',
  habilidade: 'Habilidade / procedimento esperado',
  orientacao: 'Orientação',
  personalizada: 'Personalizada',
};

const tipoLabel = (value) => TIPO_RESPOSTA_OPTIONS.find(option => option.value === value)?.label || value;

const blankPergunta = (ordem) => ({ secao: 'Registro pedagógico', pergunta: '', tipoResposta: 'texto', opcoes: [], complementar: null, ordem, status: 'ativa' });
// Criação: uma ou mais escolas de uma vez (`escolaIds` + `todasEscolas`) e um ou mais modelos
// (`modeloIds`, pré-marcados com todos os ativos, mas ajustável). Edição continua sendo sempre
// de uma aplicação já existente, então usa `escolaId` único (ver editar vigência abaixo).
const blankAplicacao = (modeloIdsAtivos) => ({ escolaIds: [], todasEscolas: false, modeloIds: modeloIdsAtivos, dataInicio: CURRENT_DATE, dataFim: CURRENT_DATE });

export const FormularioPdiPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    disciplinas, escolas, pdiModelos, pdiAplicacoes,
    createPdiModelo, deletePdiModelo, createPdiModeloPergunta, updatePdiModeloPergunta, deletePdiModeloPergunta, reorderPdiModeloPergunta,
    createPdiAplicacao, updatePdiAplicacao, deletePdiAplicacao, deleteAllPdiAplicacoes,
  } = useData();

  const [modeloSelecionadoId, setModeloSelecionadoId] = useState(pdiModelos[0]?.id ?? null);
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
  const modeloSelecionado = pdiModelos.find(modelo => modelo.id === modeloSelecionadoId) || null;
  const perguntasDoModelo = modeloSelecionado ? [...modeloSelecionado.perguntas].sort((left, right) => Number(left.ordem) - Number(right.ordem)) : [];

  const criarModelo = (event) => {
    event.preventDefault();
    if (!novoModeloForm?.disciplinaId) {
      setMessage('Escolha a disciplina do novo modelo.');
      return;
    }
    const disciplina = disciplinas.find(item => item.id === Number(novoModeloForm.disciplinaId));
    const modelo = createPdiModelo({ nome: novoModeloForm.nome?.trim() || `PDI - ${disciplina?.nome}`, disciplinaId: novoModeloForm.disciplinaId });
    setModeloSelecionadoId(modelo.id);
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
      setMessage('Cadastre ao menos duas opções para uma pergunta de seleção.');
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
      setMessage('Pergunta atualizada com sucesso.');
    } else {
      createPdiModeloPergunta(modeloSelecionado.id, payload);
      setMessage('Pergunta adicionada ao modelo com sucesso.');
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
      // preenchidos e mostra o erro ali mesmo (ver src/utils/pdiFichas.js).
      if (!resultado.ok) {
        setAplicacaoError(resultado.error);
        return;
      }
      setMessage('Aplicação PDI atualizada com sucesso.');
      setAplicacaoForm(null);
      setEditingAplicacao(null);
      return;
    }

    // Criação: uma ou mais escolas de uma vez, incluindo "todas as escolas", e um ou mais
    // modelos (disciplinas) escolhidos entre os ativos — não é mais automático para todos.
    const escolaIdsSelecionadas = aplicacaoForm.todasEscolas ? escolasAplicaveis.map(escola => escola.id) : aplicacaoForm.escolaIds;
    if (escolaIdsSelecionadas.length === 0) {
      setAplicacaoError('Escolha ao menos uma escola.');
      return;
    }
    if (aplicacaoForm.modeloIds.length === 0) {
      setAplicacaoError('Escolha ao menos um modelo PDI.');
      return;
    }
    // Valida a sobreposição em TODAS as escolas selecionadas antes de criar qualquer uma —
    // tudo ou nada, para nunca deixar a seleção pela metade.
    const escolasComConflito = escolaIdsSelecionadas
      .filter(escolaId => existeSobreposicaoNaEscola(pdiAplicacoes, { escolaId, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim }))
      .map(escolaId => escolas.find(item => item.id === escolaId)?.nome || `Escola #${escolaId}`);
    if (escolasComConflito.length > 0) {
      setAplicacaoError(`Já existe uma aplicação PDI dentro desse período para: ${escolasComConflito.join(', ')}. Ajuste o período ou remova essas escolas da seleção.`);
      return;
    }

    escolaIdsSelecionadas.forEach(escolaId => createPdiAplicacao({ escolaId, modeloIds: aplicacaoForm.modeloIds, dataInicio: aplicacaoForm.dataInicio, dataFim: aplicacaoForm.dataFim }));
    setMessage(`Aplicação PDI criada com sucesso para ${escolaIdsSelecionadas.length} ${escolaIdsSelecionadas.length === 1 ? 'escola' : 'escolas'}, com os modelos selecionados.`);
    setAplicacaoForm(null);
    setEditingAplicacao(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Formulário PDI</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Cada modelo PDI pertence a uma disciplina. Uma aplicação abre o preenchimento para uma escola inteira: as disciplinas com modelo configurado ficam disponíveis automaticamente aos professores que lecionam cada uma delas naquela escola.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {/* --- Modelos PDI ------------------------------------------------------------------ */}
        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Modelos PDI</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Um modelo por disciplina</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setNovoModeloForm({ nome: '', disciplinaId: disciplinasDisponiveis[0]?.id ?? '' })} disabled={disciplinasDisponiveis.length === 0}>Novo modelo</Button>
              <Button size="sm" variant="danger" onClick={() => setDeletingModelo(modeloSelecionado)} disabled={!modeloSelecionado}>Excluir modelo</Button>
            </div>
          </div>
          {disciplinasDisponiveis.length === 0 && <p className="mt-2 text-xs text-slate-500">Todas as disciplinas cadastradas já possuem um modelo PDI ativo.</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {pdiModelos.map(modelo => (
              <button
                key={modelo.id}
                onClick={() => setModeloSelecionadoId(modelo.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${modeloSelecionadoId === modelo.id ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200'}`}
              >
                {modelo.nome}
                <span className="ml-2 text-xs font-normal text-slate-400">{disciplinas.find(item => item.id === modelo.disciplinaId)?.nome}</span>
              </button>
            ))}
          </div>

          {modeloSelecionado && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Disciplina: {disciplinas.find(item => item.id === modeloSelecionado.disciplinaId)?.nome || 'Não encontrada'}</p>
                  <p className="text-xs text-slate-500">Todas as perguntas abaixo podem ser editadas, reordenadas ou excluídas — inclusive as que vieram prontas.</p>
                </div>
                <Button size="sm" onClick={() => setPerguntaForm(blankPergunta(perguntasDoModelo.length + 1))}>Adicionar pergunta</Button>
              </div>

              <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {perguntasDoModelo.map((pergunta, index) => (
                  <div key={pergunta.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{pergunta.codigo ? `${pergunta.codigo} — ${pergunta.pergunta}` : pergunta.pergunta}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pergunta.secao && <Badge variant="blue">{pergunta.secao}{pergunta.subsecao ? ` · ${pergunta.subsecao}` : ''}</Badge>}
                        <Badge variant="gray">{ORIGEM_LABEL[pergunta.origem] || pergunta.origem}</Badge>
                        <Badge variant="gray">{tipoLabel(pergunta.tipoResposta)}</Badge>
                        {pergunta.opcoes?.length > 0 && pergunta.opcoes.map(opcao => <Badge key={opcao} variant="gray">{opcao}</Badge>)}
                        <Badge variant={pergunta.status === 'ativa' ? 'green' : 'gray'}>{pergunta.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={index === 0} onClick={() => reorderPdiModeloPergunta(modeloSelecionado.id, pergunta.id, -1)}>Subir</Button>
                      <Button size="sm" variant="outline" disabled={index === perguntasDoModelo.length - 1} onClick={() => reorderPdiModeloPergunta(modeloSelecionado.id, pergunta.id, 1)}>Descer</Button>
                      <Button size="sm" variant="outline" onClick={() => setPerguntaForm({ ...pergunta, opcoes: pergunta.opcoes || [] })}>Editar</Button>
                      <Button size="sm" variant="danger" onClick={() => setDeletingPergunta(pergunta)}>Excluir</Button>
                    </div>
                  </div>
                ))}
                {perguntasDoModelo.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma pergunta cadastrada neste modelo ainda.</p>}
              </div>
            </div>
          )}
        </Card>

        {/* --- Aplicações PDI ---------------------------------------------------------------- */}
        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Aplicações PDI</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Vigência por escola</h2>
              <p className="mt-1 text-sm text-slate-600">Uma aplicação vale para a escola inteira. Pode haver mais de uma aplicação na mesma escola, desde que os períodos não se sobreponham.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { setEditingAplicacao(null); setAplicacaoError(''); setAplicacaoForm(blankAplicacao(modelosAtivos.map(modelo => modelo.id))); }} disabled={escolasAplicaveis.length === 0 || modelosAtivos.length === 0}>Nova aplicação</Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmandoExcluirTodasAplicacoes(true)} disabled={pdiAplicacoes.length === 0}>Excluir todas as aplicações</Button>
            </div>
          </div>
          {modelosAtivos.length === 0 && <p className="mt-2 text-xs text-slate-500">Cadastre ao menos um modelo PDI ativo acima antes de criar uma aplicação.</p>}

          <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {pdiAplicacoes.map(aplicacao => {
              const status = getFormStatus(aplicacao.dataInicio, aplicacao.dataFim);
              return (
                <div key={aplicacao.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{escolas.find(item => item.id === aplicacao.escolaId)?.nome || 'Escola não encontrada'}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatFullDate(aplicacao.dataInicio)} a {formatFullDate(aplicacao.dataFim)}</p>
                    {aplicacao.criadaEm && <p className="mt-0.5 text-xs text-slate-400">Criado em {formatFullDate(aplicacao.criadaEm.slice(0, 10))}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${formStatusClasses(status)}`}>{formStatusLabel(status)}</span>
                      {aplicacao.modelos.length === 0
                        ? <Badge variant="gray">Nenhum modelo disponível no momento da criação</Badge>
                        : aplicacao.modelos.map(modelo => <Badge key={modelo.modeloId} variant="blue">{disciplinas.find(item => item.id === modelo.disciplinaId)?.nome || modelo.nome}</Badge>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingAplicacao(aplicacao); setAplicacaoError(''); setAplicacaoForm({ escolaId: aplicacao.escolaId, dataInicio: aplicacao.dataInicio, dataFim: aplicacao.dataFim }); }}>Editar vigência</Button>
                    <Button size="sm" variant="danger" onClick={() => setDeletingAplicacao(aplicacao)}>Excluir</Button>
                  </div>
                </div>
              );
            })}
            {pdiAplicacoes.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma aplicação PDI criada ainda.</p>}
          </div>
        </Card>

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
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setNovoModeloForm(null)}>Cancelar</Button><Button type="submit">Criar modelo</Button></div>
            </form>
          </Modal>
        )}

        {perguntaForm && (
          <Modal title={perguntaForm.id ? 'Editar pergunta' : 'Adicionar pergunta'} onClose={() => setPerguntaForm(null)}>
            <form onSubmit={salvarPergunta} className="space-y-4">
              <FormField label="Seção (agrupamento no formulário)"><input className={inputClass} value={perguntaForm.secao || ''} onChange={event => setPerguntaForm(prev => ({ ...prev, secao: event.target.value }))} placeholder="Ex.: Registro pedagógico" /></FormField>
              <FormField label="Pergunta / texto"><textarea className={inputClass} rows="4" spellCheck lang="pt-BR" value={perguntaForm.pergunta} onChange={event => setPerguntaForm(prev => ({ ...prev, pergunta: event.target.value }))} onBlur={() => setPerguntaForm(prev => ({ ...prev, pergunta: aplicarAutoCorrecao(prev.pergunta) }))} required /></FormField>

              <FormField label="Tipo de resposta">
                <select className={inputClass} value={perguntaForm.tipoResposta} onChange={event => changeTipoResposta(event.target.value)}>
                  {TIPO_RESPOSTA_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
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

              <FormField label="Status"><select className={inputClass} value={perguntaForm.status} onChange={event => setPerguntaForm(prev => ({ ...prev, status: event.target.value }))}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></FormField>

              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setPerguntaForm(null)}>Cancelar</Button><Button type="submit">Salvar pergunta</Button></div>
            </form>
          </Modal>
        )}

        {aplicacaoForm && (
          <Modal title={editingAplicacao ? 'Editar vigência da aplicação' : 'Nova aplicação PDI'} onClose={() => { setAplicacaoForm(null); setEditingAplicacao(null); setAplicacaoError(''); }}>
            <form onSubmit={salvarAplicacao} className="space-y-4">
              {aplicacaoError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{aplicacaoError}</div>}
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
              {!editingAplicacao && (
                <FormField label="Modelos (disciplinas)">
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
                        {modelo.nome} <span className="text-xs text-slate-400">({disciplinas.find(item => item.id === modelo.disciplinaId)?.nome})</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Início"><input className={inputClass} type="date" value={aplicacaoForm.dataInicio} onChange={event => setAplicacaoForm(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
                <FormField label="Encerramento"><input className={inputClass} type="date" value={aplicacaoForm.dataFim} onChange={event => setAplicacaoForm(prev => ({ ...prev, dataFim: event.target.value }))} required /></FormField>
              </div>
              {!editingAplicacao && <p className="text-xs text-slate-500">Só os modelos marcados acima entram em cada aplicação criada — uma aplicação separada por escola selecionada.</p>}
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => { setAplicacaoForm(null); setEditingAplicacao(null); setAplicacaoError(''); }}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {deletingPergunta && (
          <ConfirmDialog
            title="Excluir pergunta"
            message="Deseja excluir esta pergunta do modelo? Aplicações já criadas continuam com a versão que tinham no momento em que foram abertas — só novas aplicações deixam de incluir esta pergunta."
            onCancel={() => setDeletingPergunta(null)}
            onConfirm={() => { deletePdiModeloPergunta(modeloSelecionado.id, deletingPergunta.id); setDeletingPergunta(null); setMessage('Pergunta excluída do modelo com sucesso.'); }}
          />
        )}

        {deletingModelo && (
          <ConfirmDialog
            title="Excluir modelo PDI"
            message={`Deseja excluir o modelo "${deletingModelo.nome}"? Todas as suas perguntas serão removidas. Aplicações já criadas não são afetadas — elas mantêm a cópia das perguntas de quando foram abertas. Novas aplicações deixam de incluir esta disciplina até um novo modelo ser cadastrado.`}
            onCancel={() => setDeletingModelo(null)}
            onConfirm={() => {
              deletePdiModelo(deletingModelo.id);
              if (modeloSelecionadoId === deletingModelo.id) setModeloSelecionadoId(null);
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

import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormField, Modal, StatCard } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { MetaStatusBadge, PdiLevelSelector, TrendBadge } from '../components/PdiControls';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { escolaName, inputClass, professorName, turmaName } from '../utils/display';
import { canAccessEscola, filterByEscola, gestorVinculadoEscola, professoresDaEscola, professoresDaTurma, turmasDoProfessor } from '../utils/escolas';
import { formatDate, metaStatusOptions, parentescoOptions, pdiAreas, pdiNivelOptions, pdiTrend } from '../utils/pdi';
import { historicoAuxiliaresDoAluno, vinculoAtivoDoAluno } from '../utils/auxiliares';
import { CURRENT_DATE } from '../utils/formAvailability';
import { isAuxiliar, isDiretora, isGestor, isProfessor as isProfessorRole, isSecretaria, canManagePedagogico } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const flatIndicators = pdiAreas.flatMap(group => group.indicadores.map(indicador => ({ area: group.area, indicador })));
const blankAvaliacao = (alunoId) => ({ alunoId, area: 'Aprendizagem', indicador: 'Leitura', nivel: 3, observacao: '', data: '' });
const blankMeta = (alunoId) => ({ alunoId, area: 'Aprendizagem', indicador: 'Leitura', descricao: '', nivelInicial: 2, nivelEsperado: 4, prazo: '', estrategias: '', status: 'nao_iniciada' });
const blankAcompanhamento = (alunoId) => ({ alunoId, perguntaId: 1, data: '', area: 'Aprendizagem', indicador: 'Leitura', nivelObservado: 3, evidencia: '', estrategia: '', observacao: '' });

const byDateDesc = (left, right) => new Date(right.data) - new Date(left.data);
const monthLabel = (date) => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][Number(date.split('-')[1]) - 1];

const SectionHeader = ({ title, description, action }) => (
  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div>
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
    {action}
  </div>
);

export const PdiAlunoPerfil = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    pdiAlunos,
    pdiAvaliacoes,
    pdiMetas,
    pdiAcompanhamentos,
    pdiPerguntas,
    pdiRespostas,
    professores,
    turmas,
    turmaProfessores,
    disciplinas,
    escolas,
    vinculosEscolares,
    auxiliares,
    pdiAuxiliaresVinculos,
    vincularAuxiliar,
    encerrarAuxiliar,
    updatePdiAluno,
    createPdiAvaliacao,
    updatePdiAvaliacao,
    deletePdiAvaliacao,
    createPdiMeta,
    updatePdiMeta,
    deletePdiMeta,
    createPdiAcompanhamento,
    updatePdiAcompanhamento,
    deletePdiAcompanhamento,
    createPdiResposta,
  } = useData();

  const aluno = pdiAlunos.find(item => item.id === Number(id));
  const isProfessor = isProfessorRole(user);
  const canManagePdi = canManagePedagogico(user);
  const { activeEscolaId } = useEscola();
  const turmasDaEscola = filterByEscola(turmas, activeEscolaId, user);
  const availableTurmas = isProfessor ? turmasDoProfessor(turmasDaEscola, turmaProfessores, user.id) : turmasDaEscola;
  const professoresOptions = professoresDaEscola(professores, vinculosEscolares, activeEscolaId, user);
  // Supervisora: consulta permitida mesmo com a escola inativa (histórico), desde que
  // vinculada a ela — diferente de canAccessEscola, que bloqueia integralmente escola inativa.
  const hasEscolaAccess = isSecretaria(user)
    || (aluno && isGestor(user) && gestorVinculadoEscola(user, aluno.escolaId, { vinculosEscolares }))
    || (aluno && canAccessEscola(user, aluno.escolaId, { escolas, vinculosEscolares }));
  const escolaAtivaAluno = aluno ? escolas.find(item => item.id === aluno.escolaId)?.status === 'ativa' : false;
  // Escola inativa vinculada à Supervisora: consulta sempre permitida, edição nunca. Secretaria
  // não é afetada por esta regra (ver instrução do módulo PDI: escopo é "Gestor/Supervisora").
  const canEditPdi = canManagePdi && (!isGestor(user) || escolaAtivaAluno);
  const [tab, setTab] = useState('avaliacao');
  const [alunoForm, setAlunoForm] = useState(null);
  const [avaliacaoForm, setAvaliacaoForm] = useState(null);
  const [metaForm, setMetaForm] = useState(null);
  const [acompanhamentoForm, setAcompanhamentoForm] = useState(null);
  const [selectedPerguntaId, setSelectedPerguntaId] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const [auxiliarForm, setAuxiliarForm] = useState(null);
  const [encerrandoAuxiliar, setEncerrandoAuxiliar] = useState(false);
  const acompanhamentos = pdiAcompanhamentos.filter(item => item.alunoId === Number(id)).sort(byDateDesc);
  // Hooks precisam ser chamados sempre na mesma ordem — este useMemo fica antes do "return"
  // condicional logo abaixo, para não violar as regras de hooks do React.
  const evolutionGroups = useMemo(() => {
    return flatIndicators.map(indicator => ({
      ...indicator,
      registros: acompanhamentos
        .filter(item => item.area === indicator.area && item.indicador === indicator.indicador)
        .sort((left, right) => new Date(left.data) - new Date(right.data)),
    })).filter(group => group.registros.length > 0);
  }, [acompanhamentos]);

  // A Secretaria administra o PDI (perguntas, escolas e vigência) e por isso também precisa
  // consultar alunos e gráficos de evolução — Diretora e Auxiliar ficam de fora deste módulo
  // (Auxiliar tem sua própria tela de consulta em /meus-alunos/:id).
  if (isDiretora(user) || isAuxiliar(user)) return <Navigate to="/dashboard" replace />;

  const avaliacoes = pdiAvaliacoes.filter(item => item.alunoId === Number(id));
  const metas = pdiMetas.filter(item => item.alunoId === Number(id));
  // Só perguntas de tipo 'numero' (ex.: rendimento trimestral) alimentam este gráfico — as
  // demais (seleção/marcação/texto) não têm valor numérico real e ficaram de fora depois da
  // reestruturação do PDI (ver a nova Análise de Desenvolvimento, que cobre os indicadores
  // estruturados de seleção com o gráfico próprio deles).
  const perguntasAtivas = [...pdiPerguntas].filter(pergunta => pergunta.status === 'ativa' && pergunta.tipoResposta === 'numero').sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const perguntaSelecionadaId = Number(selectedPerguntaId || perguntasAtivas[0]?.id);
  const perguntaSelecionada = perguntasAtivas.find(pergunta => pergunta.id === perguntaSelecionadaId);
  // Apenas respostas com valor numérico real alimentam este gráfico (nível 1-5). Respostas de
  // marcação/seleção não são numéricas e ficam de fora — não geramos dados fictícios para
  // "preencher" o gráfico quando não há histórico suficiente (ver EmptyState no render).
  const respostasGrafico = pdiRespostas
    .filter(resposta => resposta.alunoId === Number(id) && resposta.perguntaId === perguntaSelecionadaId && typeof resposta.resposta !== 'boolean' && resposta.resposta !== '' && Number.isFinite(Number(resposta.resposta)))
    .sort((left, right) => new Date(left.data) - new Date(right.data));
  const historicoRespostas = pdiRespostas
    .filter(resposta => resposta.alunoId === Number(id))
    .sort((left, right) => new Date(right.data) - new Date(left.data));
  const trend = pdiTrend(respostasGrafico);
  const vinculoAuxiliarAtivo = vinculoAtivoDoAluno(pdiAuxiliaresVinculos, Number(id));
  const chartPoints = respostasGrafico.map((resposta, index) => {
    const x = respostasGrafico.length === 1 ? 400 : 64 + index * (672 / (respostasGrafico.length - 1));
    const y = 220 - ((Number(resposta.resposta) - 1) / 4) * 176;
    return { ...resposta, x, y };
  });
  const chartPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const chartAreaPath = chartPoints.length > 1 ? `${chartPath} L ${chartPoints[chartPoints.length - 1].x} 220 L ${chartPoints[0].x} 220 Z` : '';

  const metaTrends = metas.map(meta => pdiTrend(acompanhamentos.filter(item => item.area === meta.area && item.indicador === meta.indicador)).key);
  const summary = {
    totalMetas: metas.length,
    evolucao: metaTrends.filter(item => item === 'evolucao').length,
    estavel: metaTrends.filter(item => item === 'estavel').length,
    atencao: metaTrends.filter(item => item === 'atencao').length,
    totalAcompanhamentos: acompanhamentos.length,
  };

  if (!aluno || !hasEscolaAccess || (isProfessor && !availableTurmas.some(turma => turma.id === aluno.turmaId))) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">Aluno não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/pdi')}>Voltar para alunos</Button>
        </Card>
      </MainLayout>
    );
  }

  if (isProfessor) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <Link to="/pdi/alunos" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para alunos</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{aluno.nome}</h1>
            <p className="mt-2 text-slate-600">{turmaName(turmas, aluno.turmaId)} · {escolaName(escolas, aluno.escolaId)}</p>
          </div>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Dados do aluno</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <p><strong>Data de nascimento:</strong> {formatDate(aluno.dataNascimento)}</p>
              <p><strong>Entrada na rede:</strong> {formatDate(aluno.dataEntradaRede)}</p>
              <p><strong>Início do acompanhamento:</strong> {formatDate(aluno.dataInicio)}</p>
              <p><strong>Condição informada:</strong> {aluno.condicaoInformada || 'Não informada'}</p>
              <p><strong>Responsável legal:</strong> {aluno.responsavelNome || 'Não informado'}{aluno.responsavelParentesco ? ` (${parentescoOptions.find(item => item.value === aluno.responsavelParentesco)?.label || aluno.responsavelParentesco})` : ''}</p>
              <p><strong>Telefone do responsável:</strong> {aluno.responsavelTelefone1 || 'Não informado'}</p>
            </div>
          </Card>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Professores da turma</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {professoresDaTurma(turmaProfessores, professores, disciplinas, aluno.turmaId).map(vinculo => (
                <li key={`${vinculo.professorId}-${vinculo.disciplinaId}`}>{vinculo.professor?.nome || 'Professor não encontrado'} — {vinculo.disciplina?.nome || 'Disciplina não encontrada'}</li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-slate-900">Avaliação trimestral</p><p className="mt-1 text-sm text-slate-600">Preencha ou consulte o Formulário PDI deste aluno.</p></div>
            <Link to={`/pdi/alunos/${aluno.id}/formulario`}><Button>Formulário PDI</Button></Link>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const saveAluno = (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (!alunoForm.nome?.trim() || !alunoForm.escolaId || !alunoForm.turmaId) {
      setMessage('Preencha nome, escola e turma antes de salvar.');
      return;
    }
    if (!alunoForm.responsavelNome?.trim() || !alunoForm.responsavelParentesco || !alunoForm.responsavelTelefone1?.trim()) {
      setMessage('Informe nome, parentesco e telefone principal do responsável legal.');
      return;
    }
    const turmaSelecionada = turmas.find(item => item.id === Number(alunoForm.turmaId));
    if (!turmaSelecionada || turmaSelecionada.escolaId !== Number(alunoForm.escolaId)) {
      setMessage('A turma selecionada não pertence à escola selecionada.');
      return;
    }
    updatePdiAluno(aluno.id, isProfessor ? { ...alunoForm, professorId: user.id } : alunoForm);
    setAlunoForm(null);
    setMessage('Dados do aluno atualizados com sucesso.');
  };

  // Gestão do vínculo Auxiliar <-> aluno é exclusiva da Secretaria (ver guard nos botões).
  const saveAuxiliar = (event) => {
    event.preventDefault();
    if (!auxiliarForm.auxiliarId || !auxiliarForm.dataInicio) {
      setMessage('Selecione o Auxiliar e a data de início.');
      return;
    }
    vincularAuxiliar(aluno.id, auxiliarForm.auxiliarId, auxiliarForm.dataInicio);
    setAuxiliarForm(null);
    setMessage('Auxiliar de Aprendizagem vinculado com sucesso.');
  };

  const confirmEncerrarAuxiliar = (dataFim) => {
    encerrarAuxiliar(aluno.id, dataFim);
    setEncerrandoAuxiliar(false);
    setMessage('Vínculo com o Auxiliar de Aprendizagem encerrado.');
  };

  const saveAvaliacao = (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (avaliacaoForm.id) updatePdiAvaliacao(avaliacaoForm.id, avaliacaoForm);
    else createPdiAvaliacao(avaliacaoForm);
    setAvaliacaoForm(null);
    setMessage('Avaliação inicial salva com sucesso.');
  };

  const saveMeta = (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (metaForm.id) updatePdiMeta(metaForm.id, metaForm);
    else createPdiMeta(metaForm);
    setMetaForm(null);
    setMessage('Meta salva com sucesso.');
  };

  const saveAcompanhamento = (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (acompanhamentoForm.id) updatePdiAcompanhamento(acompanhamentoForm.id, acompanhamentoForm);
    else {
      createPdiAcompanhamento(acompanhamentoForm);
      if (acompanhamentoForm.perguntaId) {
        createPdiResposta({
          alunoId: aluno.id,
          perguntaId: Number(acompanhamentoForm.perguntaId),
          data: acompanhamentoForm.data,
          resposta: Number(acompanhamentoForm.nivelObservado),
          observacao: acompanhamentoForm.observacao,
        });
      }
    }
    setAcompanhamentoForm(null);
    setMessage('Acompanhamento salvo com sucesso.');
  };

  const confirmDelete = () => {
    if (!canEditPdi) return;
    if (deleting.type === 'avaliacao') deletePdiAvaliacao(deleting.record.id);
    if (deleting.type === 'meta') deletePdiMeta(deleting.record.id);
    if (deleting.type === 'acompanhamento') deletePdiAcompanhamento(deleting.record.id);
    setDeleting(null);
    setMessage('Registro excluído com sucesso.');
  };

  const renderIndicatorFields = (form, setForm, levelKey) => (
    <>
      <FormField label="Área">
        <select className={inputClass} value={form.area} onChange={event => {
          const area = event.target.value;
          const indicador = pdiAreas.find(group => group.area === area)?.indicadores[0] || '';
          setForm(prev => ({ ...prev, area, indicador }));
        }}>
          {pdiAreas.map(group => <option key={group.area} value={group.area}>{group.area}</option>)}
        </select>
      </FormField>
      <FormField label="Indicador">
        <select className={inputClass} value={form.indicador} onChange={event => setForm(prev => ({ ...prev, indicador: event.target.value }))}>
          {pdiAreas.find(group => group.area === form.area)?.indicadores.map(indicador => <option key={indicador} value={indicador}>{indicador}</option>)}
        </select>
      </FormField>
      <div className="md:col-span-2">
        <FormField label="Nível de desenvolvimento observado">
          <PdiLevelSelector value={form[levelKey]} onChange={value => setForm(prev => ({ ...prev, [levelKey]: value }))} />
        </FormField>
      </div>
    </>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <Link to="/pdi/alunos" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para alunos</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{aluno.nome}</h1>
            <p className="mt-2 text-slate-600">{turmaName(turmas, aluno.turmaId)} · {escolaName(escolas, aluno.escolaId)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={aluno.status === 'arquivado' ? 'gray' : 'green'}>{aluno.status === 'arquivado' ? 'Arquivado' : 'Ativo'}</Badge>
              <TrendBadge trend={trend} />
              <span className="text-sm text-slate-500">Início: {formatDate(aluno.dataInicio)}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <div><strong>Professor responsável:</strong> <ProfessorName professorId={aluno.professorId} className="mt-1" /></div>
              <p><strong>Entrada na rede:</strong> {formatDate(aluno.dataEntradaRede)}</p>
              <p><strong>Condição informada:</strong> {aluno.condicaoInformada || 'Não informada'}</p>
              <p><strong>CID:</strong> {aluno.cid || 'Não informado'}</p>
              <p><strong>Responsável legal:</strong> {aluno.responsavelNome || 'Não informado'}{aluno.responsavelParentesco ? ` (${parentescoOptions.find(item => item.value === aluno.responsavelParentesco)?.label || aluno.responsavelParentesco})` : ''}</p>
              <p><strong>Telefone do responsável:</strong> {aluno.responsavelTelefone1 || 'Não informado'}{aluno.responsavelTelefone2 ? ` / ${aluno.responsavelTelefone2}` : ''}</p>
              <div className="md:col-span-2">
                <strong>Professores da turma:</strong>
                <ul className="mt-1 space-y-0.5">
                  {professoresDaTurma(turmaProfessores, professores, disciplinas, aluno.turmaId).map(vinculo => (
                    <li key={`${vinculo.professorId}-${vinculo.disciplinaId}`}>{vinculo.professor?.nome || 'Professor não encontrado'} — {vinculo.disciplina?.nome || 'Disciplina não encontrada'}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSecretaria(user) && <Link to={`/pdi/alunos/${aluno.id}/anamnese`}><Button variant="outline">Anamnese</Button></Link>}
            {isGestor(user) && <Link to={`/pdi/alunos/${aluno.id}/formulario`}><Button variant="outline">Formulário PDI</Button></Link>}
            {canEditPdi && <Button variant="outline" onClick={() => setAlunoForm({ ...aluno })}>Editar aluno</Button>}
            {canEditPdi && <Button variant="outline" onClick={() => { setTab('acompanhamentos'); setAcompanhamentoForm(blankAcompanhamento(aluno.id)); }}>Novo acompanhamento</Button>}
            {canEditPdi && <Button onClick={() => { setTab('metas'); setMetaForm(blankMeta(aluno.id)); }}>Nova meta</Button>}
          </div>
        </div>

        {isGestor(user) && !escolaAtivaAluno && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Esta escola está inativa. Os registros estão disponíveis apenas para consulta histórica — preenchimento, edição e correção estão desabilitados.
          </div>
        )}

        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Auxiliar de Aprendizagem</p>
              {vinculoAuxiliarAtivo ? (
                <>
                  <p className="mt-1 font-semibold text-slate-900">{auxiliares.find(item => item.id === vinculoAuxiliarAtivo.auxiliarId)?.nome || 'Auxiliar não encontrado'}</p>
                  <p className="text-sm text-slate-600">Desde: {formatDate(vinculoAuxiliarAtivo.dataInicio)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Nenhum Auxiliar de Aprendizagem vinculado no momento.</p>
              )}
            </div>
            {isSecretaria(user) && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAuxiliarForm({ auxiliarId: '', dataInicio: CURRENT_DATE })}>{vinculoAuxiliarAtivo ? 'Alterar auxiliar' : 'Vincular auxiliar'}</Button>
                {vinculoAuxiliarAtivo && <Button variant="outline" onClick={() => setEncerrandoAuxiliar(true)}>Encerrar vínculo</Button>}
              </div>
            )}
          </div>
          {isSecretaria(user) && historicoAuxiliaresDoAluno(pdiAuxiliaresVinculos, aluno.id).length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Histórico de Auxiliares</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Auxiliar</th><th className="pb-2 pr-4">Início</th><th className="pb-2 pr-4">Fim</th><th className="pb-2">Status</th></tr></thead>
                  <tbody>
                    {historicoAuxiliaresDoAluno(pdiAuxiliaresVinculos, aluno.id).map(item => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4">{auxiliares.find(a => a.id === item.auxiliarId)?.nome || 'Auxiliar não encontrado'}</td>
                        <td className="py-2 pr-4">{formatDate(item.dataInicio)}</td>
                        <td className="py-2 pr-4">{item.dataFim ? formatDate(item.dataFim) : '—'}</td>
                        <td className="py-2"><Badge variant={item.status === 'ativo' ? 'green' : 'gray'}>{item.status === 'ativo' ? 'Ativo' : 'Encerrado'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Desenvolvimento do aluno</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Gráfico alimentado pelas respostas do Formulário PDI</h2>
              <p className="mt-1 text-sm text-slate-600">Formulário respondido → histórico de respostas → gráfico de desenvolvimento.</p>
            </div>
            <FormField label="Indicador">
              <select className={inputClass} value={perguntaSelecionadaId || ''} onChange={event => setSelectedPerguntaId(event.target.value)}>
                {perguntasAtivas.map(pergunta => <option key={pergunta.id} value={pergunta.id}>{pergunta.pergunta}</option>)}
              </select>
            </FormField>
          </div>
          {perguntaSelecionada && <p className="mb-4 text-sm text-slate-600"><strong>Pergunta:</strong> {perguntaSelecionada.pergunta}</p>}
          {chartPoints.length === 0 ? (
            <EmptyState title="Dados insuficientes para apresentar a evolução" description="Ainda não há respostas numéricas registradas para esta pergunta. O gráfico aparece automaticamente assim que houver histórico suficiente." />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-3 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Primeiro registro</p><p className="text-2xl font-bold text-slate-900">{chartPoints[0]?.resposta ?? '-'}</p></div>
                <div className="rounded-lg bg-white p-3 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Último registro</p><p className="text-2xl font-bold text-slate-900">{chartPoints[chartPoints.length - 1]?.resposta ?? '-'}</p></div>
                <div className="rounded-lg bg-white p-3 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Tendência</p><div className="mt-1">{chartPoints.length >= 2 ? <TrendBadge trend={trend} /> : <span className="text-xs text-slate-500">Ainda não calculável</span>}</div></div>
              </div>
              <div className="overflow-hidden">
                <svg viewBox="0 0 800 280" className="block h-auto w-full" role="img" aria-label="Gráfico de desenvolvimento do aluno">
                  {[1, 2, 3, 4, 5].map(level => {
                    const y = 220 - ((level - 1) / 4) * 176;
                    return (
                      <g key={level}>
                        <line x1="64" x2="736" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                        <text x="28" y={y + 5} fill="#64748b" fontSize="13" fontWeight="700">{level}</text>
                      </g>
                    );
                  })}
                  <line x1="64" x2="64" y1="44" y2="220" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="64" x2="736" y1="220" y2="220" stroke="#94a3b8" strokeWidth="1.5" />
                  {chartAreaPath && <path d={chartAreaPath} fill="#0f766e" opacity="0.08" />}
                  {chartPath && <path d={chartPath} fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                  {chartPoints.map(point => (
                    <g key={point.id}>
                      <circle cx={point.x} cy={point.y} r="7" fill="#0f766e" stroke="#ffffff" strokeWidth="3" />
                      <text x={point.x} y={point.y - 14} textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="800">{point.resposta}</text>
                      <text x={point.x} y="250" textAnchor="middle" fill="#64748b" fontSize="13" fontWeight="700">{monthLabel(point.data)}</text>
                    </g>
                  ))}
                  <text x="56" y="24" fill="#334155" fontSize="13" fontWeight="700">Nível de desenvolvimento</text>
                </svg>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Histórico do desenvolvimento" description="Respostas vinculadas a aluno, pergunta e data. Este histórico alimenta o gráfico principal." />
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Área</th><th className="px-4 py-3">Indicador</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Detalhes</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historicoRespostas.map(resposta => {
                  const pergunta = pdiPerguntas.find(item => item.id === resposta.perguntaId);
                  return (
                    <tr key={resposta.id}>
                      <td data-label="Data" className="px-4 py-3 text-slate-700">{formatDate(resposta.data)}</td>
                      <td data-label="Área" className="px-4 py-3 text-slate-700">{pergunta?.area}</td>
                      <td data-label="Indicador" className="px-4 py-3 text-slate-700">{pergunta?.indicador}</td>
                      <td data-label="Resultado" className="px-4 py-3 font-bold text-slate-900">{resposta.resposta}</td>
                      <td data-label="Detalhes" className="px-4 py-3 text-slate-600">{resposta.observacao}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Metas" value={summary.totalMetas} description="total cadastradas" />
          <StatCard label="Em evolução" value={summary.evolucao} description="metas com avanço" />
          <StatCard label="Estáveis" value={summary.estavel} description="sem variação recente" />
          <StatCard label="Atenção" value={summary.atencao} description="queda recente" />
          <StatCard label="Acompanhamentos" value={summary.totalAcompanhamentos} description="histórico registrado" />
        </section>

        <Card>
          <div className="flex flex-wrap gap-2">
            {[['avaliacao', 'Avaliação inicial'], ['metas', 'Metas de desenvolvimento'], ['acompanhamentos', 'Histórico de acompanhamentos'], ['evolucao', 'Evolução do aluno']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
        </Card>

        {tab === 'avaliacao' && (
          <Card>
            <SectionHeader title="Avaliação inicial" description="Indicadores pedagógicos observados no contexto escolar, sem finalidade clínica ou diagnóstica." action={canEditPdi && <Button onClick={() => setAvaliacaoForm(blankAvaliacao(aluno.id))}>Criar avaliação</Button>} />
            <div className="grid gap-3 md:grid-cols-2">
              {avaliacoes.map(avaliacao => (
                <div key={avaliacao.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{avaliacao.indicador}</p><p className="text-sm text-slate-500">{avaliacao.area} · {formatDate(avaliacao.data)}</p></div><Badge>{avaliacao.nivel}</Badge></div>
                  <p className="mt-3 text-sm text-slate-600">{avaliacao.observacao}</p>
                  {canEditPdi && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => setAvaliacaoForm({ ...avaliacao })}>Editar</Button><Button size="sm" variant="danger" onClick={() => setDeleting({ type: 'avaliacao', record: avaliacao })}>Excluir</Button></div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'metas' && (
          <Card>
            <SectionHeader title="Metas de desenvolvimento" action={canEditPdi && <Button onClick={() => setMetaForm(blankMeta(aluno.id))}>Nova meta</Button>} />
            <div className="space-y-3">
              {metas.map(meta => (
                <div key={meta.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-900">{meta.area} · {meta.indicador}</p><p className="mt-1 text-sm text-slate-600">{meta.descricao}</p></div><MetaStatusBadge status={meta.status} /></div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3"><p>Nível inicial: <strong>{meta.nivelInicial}</strong></p><p>Nível esperado: <strong>{meta.nivelEsperado}</strong></p><p>Prazo: <strong>{formatDate(meta.prazo)}</strong></p></div>
                  <p className="mt-3 text-sm text-slate-600"><strong>Estratégias:</strong> {meta.estrategias}</p>
                  {canEditPdi && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => setMetaForm({ ...meta })}>Editar</Button><Button size="sm" variant="danger" onClick={() => setDeleting({ type: 'meta', record: meta })}>Excluir</Button></div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'acompanhamentos' && (
          <Card>
            <SectionHeader title="Histórico de acompanhamentos" action={canEditPdi && <Button onClick={() => setAcompanhamentoForm(blankAcompanhamento(aluno.id))}>Novo acompanhamento</Button>} />
            <div className="space-y-3">
              {acompanhamentos.map(acompanhamento => (
                <div key={acompanhamento.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-900">{formatDate(acompanhamento.data)}</p><p className="text-sm text-slate-500">{acompanhamento.area} · {acompanhamento.indicador} · Nível {acompanhamento.nivelObservado}</p></div><Badge variant="blue">Acompanhamento</Badge></div>
                  <p className="mt-3 text-sm text-slate-600"><strong>Evidência:</strong> {acompanhamento.evidencia}</p>
                  <p className="mt-2 text-sm text-slate-600"><strong>Estratégia:</strong> {acompanhamento.estrategia}</p>
                  <p className="mt-2 text-sm text-slate-600"><strong>Observação:</strong> {acompanhamento.observacao}</p>
                  {canEditPdi && <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" onClick={() => setAcompanhamentoForm({ ...acompanhamento })}>Editar</Button><Button size="sm" variant="danger" onClick={() => setDeleting({ type: 'acompanhamento', record: acompanhamento })}>Excluir</Button></div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'evolucao' && (
          <Card>
            <SectionHeader title="Evolução do aluno" description="Síntese calculada a partir dos acompanhamentos históricos cadastrados." />
            <div className="grid gap-4 md:grid-cols-2">
              {evolutionGroups.map(group => (
                <div key={`${group.area}-${group.indicador}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2"><div><p className="font-bold text-slate-900">{group.indicador}</p><p className="text-sm text-slate-500">{group.area}</p></div><TrendBadge trend={pdiTrend(group.registros)} /></div>
                  <div className="mt-4 space-y-3">
                    {group.registros.map(registro => <div key={registro.id} className="flex items-center gap-3"><span className="w-20 text-xs font-semibold text-slate-500">{formatDate(registro.data).slice(3)}</span><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${registro.nivelObservado * 20}%` }} /></div><span className="w-8 text-sm font-bold text-slate-800">{registro.nivelObservado}</span></div>)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {alunoForm && (
          <Modal title="Editar aluno" onClose={() => setAlunoForm(null)}>
            <form onSubmit={saveAluno} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nome completo"><input className={inputClass} value={alunoForm.nome} onChange={event => setAlunoForm(prev => ({ ...prev, nome: event.target.value }))} required /></FormField>
                <FormField label="Escola"><select className={inputClass} value={alunoForm.escolaId} onChange={event => { const escolaId = Number(event.target.value); setAlunoForm(prev => ({ ...prev, escolaId, turmaId: turmas.some(item => item.id === prev.turmaId && item.escolaId === escolaId) ? prev.turmaId : '' })); }} required disabled={activeEscolaId !== null}>{(activeEscolaId !== null ? escolas.filter(item => item.id === activeEscolaId) : escolas).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={alunoForm.turmaId} onChange={event => setAlunoForm(prev => ({ ...prev, turmaId: Number(event.target.value) }))} required>
                  <option value="" disabled>{alunoForm.escolaId ? 'Selecione a turma' : 'Selecione a escola primeiro'}</option>
                  {turmas.filter(item => item.escolaId === Number(alunoForm.escolaId)).map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select></FormField>
                {!isProfessor && <FormField label="Professor responsável"><select className={inputClass} value={alunoForm.professorId} onChange={event => setAlunoForm(prev => ({ ...prev, professorId: Number(event.target.value) }))}>{professoresOptions.map(professor => <option key={professor.id} value={professor.id}>{professor.nome}</option>)}</select></FormField>}
                <div className="md:col-span-2">
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">Professores da turma</p>
                  {(() => {
                    const vinculos = alunoForm.turmaId ? professoresDaTurma(turmaProfessores, professores, disciplinas, Number(alunoForm.turmaId)) : [];
                    return vinculos.length === 0
                      ? <p className="text-sm text-slate-500">Selecione uma turma para ver os professores vinculados.</p>
                      : <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{vinculos.map(vinculo => <li key={`${vinculo.professorId}-${vinculo.disciplinaId}`}>{vinculo.professor?.nome || 'Professor não encontrado'} — {vinculo.disciplina?.nome || 'Disciplina não encontrada'}</li>)}</ul>;
                  })()}
                </div>
                <div className="md:col-span-2 grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                  <p className="text-sm font-semibold text-slate-700 md:col-span-2">Responsável legal</p>
                  <FormField label="Nome do responsável"><input className={inputClass} value={alunoForm.responsavelNome || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelNome: event.target.value }))} required /></FormField>
                  <FormField label="Parentesco"><select className={inputClass} value={alunoForm.responsavelParentesco || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelParentesco: event.target.value }))} required><option value="" disabled>Selecione</option>{parentescoOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
                  <FormField label="Telefone principal"><input className={inputClass} value={alunoForm.responsavelTelefone1 || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelTelefone1: event.target.value }))} required /></FormField>
                  <FormField label="Telefone secundário"><input className={inputClass} value={alunoForm.responsavelTelefone2 || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelTelefone2: event.target.value }))} placeholder="Opcional" /></FormField>
                </div>
                <FormField label="Data de entrada na rede"><input className={inputClass} type="date" value={alunoForm.dataEntradaRede || ''} onChange={event => setAlunoForm(prev => ({ ...prev, dataEntradaRede: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Data de início do acompanhamento"><input className={inputClass} type="date" value={alunoForm.dataInicio || ''} onChange={event => setAlunoForm(prev => ({ ...prev, dataInicio: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="Transtorno/condição informada"><input className={inputClass} value={alunoForm.condicaoInformada || ''} onChange={event => setAlunoForm(prev => ({ ...prev, condicaoInformada: event.target.value }))} placeholder="Opcional" /></FormField>
                <FormField label="CID, quando houver"><input className={inputClass} value={alunoForm.cid || ''} onChange={event => setAlunoForm(prev => ({ ...prev, cid: event.target.value }))} placeholder="Opcional" /></FormField>
              </div>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAlunoForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {avaliacaoForm && (
          <Modal title={avaliacaoForm.id ? 'Editar avaliação' : 'Criar avaliação'} onClose={() => setAvaliacaoForm(null)}>
            <form onSubmit={saveAvaliacao} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{renderIndicatorFields(avaliacaoForm, setAvaliacaoForm, 'nivel')}<FormField label="Data"><input className={inputClass} type="date" value={avaliacaoForm.data} onChange={event => setAvaliacaoForm(prev => ({ ...prev, data: event.target.value }))} required /></FormField><div className="md:col-span-2"><FormField label="Observação"><textarea className={inputClass} rows="3" value={avaliacaoForm.observacao} onChange={event => setAvaliacaoForm(prev => ({ ...prev, observacao: event.target.value }))} required /></FormField></div></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAvaliacaoForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div></form>
          </Modal>
        )}

        {metaForm && (
          <Modal title={metaForm.id ? 'Editar meta' : 'Nova meta'} onClose={() => setMetaForm(null)}>
            <form onSubmit={saveMeta} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><FormField label="Área"><select className={inputClass} value={metaForm.area} onChange={event => { const area = event.target.value; const indicador = pdiAreas.find(group => group.area === area)?.indicadores[0] || ''; setMetaForm(prev => ({ ...prev, area, indicador })); }}>{pdiAreas.map(group => <option key={group.area} value={group.area}>{group.area}</option>)}</select></FormField><FormField label="Indicador"><select className={inputClass} value={metaForm.indicador} onChange={event => setMetaForm(prev => ({ ...prev, indicador: event.target.value }))}>{pdiAreas.find(group => group.area === metaForm.area)?.indicadores.map(indicador => <option key={indicador} value={indicador}>{indicador}</option>)}</select></FormField><div className="md:col-span-2"><FormField label="Descrição da meta"><textarea className={inputClass} rows="3" value={metaForm.descricao} onChange={event => setMetaForm(prev => ({ ...prev, descricao: event.target.value }))} required /></FormField></div><FormField label="Nível inicial"><select className={inputClass} value={metaForm.nivelInicial} onChange={event => setMetaForm(prev => ({ ...prev, nivelInicial: Number(event.target.value) }))}>{pdiNivelOptions.map(option => <option key={option.value} value={option.value}>{option.value} - {option.label}</option>)}</select></FormField><FormField label="Nível esperado"><select className={inputClass} value={metaForm.nivelEsperado} onChange={event => setMetaForm(prev => ({ ...prev, nivelEsperado: Number(event.target.value) }))}>{pdiNivelOptions.map(option => <option key={option.value} value={option.value}>{option.value} - {option.label}</option>)}</select></FormField><FormField label="Prazo"><input className={inputClass} type="date" value={metaForm.prazo} onChange={event => setMetaForm(prev => ({ ...prev, prazo: event.target.value }))} required /></FormField><FormField label="Status"><select className={inputClass} value={metaForm.status} onChange={event => setMetaForm(prev => ({ ...prev, status: event.target.value }))}>{metaStatusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><div className="md:col-span-2"><FormField label="Estratégias"><textarea className={inputClass} rows="3" value={metaForm.estrategias} onChange={event => setMetaForm(prev => ({ ...prev, estrategias: event.target.value }))} required /></FormField></div></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setMetaForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div></form>
          </Modal>
        )}

        {acompanhamentoForm && (
          <Modal title={acompanhamentoForm.id ? 'Editar acompanhamento' : 'Novo acompanhamento'} onClose={() => setAcompanhamentoForm(null)}>
            <form onSubmit={saveAcompanhamento} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FormField label="Pergunta do Formulário PDI"><select className={inputClass} value={acompanhamentoForm.perguntaId || perguntasAtivas[0]?.id || ''} onChange={event => setAcompanhamentoForm(prev => ({ ...prev, perguntaId: Number(event.target.value) }))}>{perguntasAtivas.map(pergunta => <option key={pergunta.id} value={pergunta.id}>{pergunta.indicador} - {pergunta.pergunta}</option>)}</select></FormField></div>{renderIndicatorFields(acompanhamentoForm, setAcompanhamentoForm, 'nivelObservado')}<FormField label="Data"><input className={inputClass} type="date" value={acompanhamentoForm.data} onChange={event => setAcompanhamentoForm(prev => ({ ...prev, data: event.target.value }))} required /></FormField><div className="md:col-span-2"><FormField label="Evidência"><textarea className={inputClass} rows="3" value={acompanhamentoForm.evidencia} onChange={event => setAcompanhamentoForm(prev => ({ ...prev, evidencia: event.target.value }))} required /></FormField></div><div className="md:col-span-2"><FormField label="Estratégia utilizada"><textarea className={inputClass} rows="3" value={acompanhamentoForm.estrategia} onChange={event => setAcompanhamentoForm(prev => ({ ...prev, estrategia: event.target.value }))} required /></FormField></div><div className="md:col-span-2"><FormField label="Observação"><textarea className={inputClass} rows="3" value={acompanhamentoForm.observacao} onChange={event => setAcompanhamentoForm(prev => ({ ...prev, observacao: event.target.value }))} required /></FormField></div></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAcompanhamentoForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div></form>
          </Modal>
        )}

        {deleting && <ConfirmDialog title="Excluir registro" message="Deseja excluir este registro do PDI? A alteração será refletida imediatamente no perfil." onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}

        {auxiliarForm && (
          <Modal title={vinculoAuxiliarAtivo ? 'Alterar Auxiliar de Aprendizagem' : 'Vincular Auxiliar de Aprendizagem'} onClose={() => setAuxiliarForm(null)}>
            <form onSubmit={saveAuxiliar} className="space-y-4">
              {vinculoAuxiliarAtivo && (
                <p className="text-sm text-slate-600">Auxiliar atual: <strong>{auxiliares.find(item => item.id === vinculoAuxiliarAtivo.auxiliarId)?.nome}</strong></p>
              )}
              <FormField label={vinculoAuxiliarAtivo ? 'Novo Auxiliar' : 'Auxiliar'}>
                <select className={inputClass} value={auxiliarForm.auxiliarId} onChange={event => setAuxiliarForm(prev => ({ ...prev, auxiliarId: Number(event.target.value) }))} required>
                  <option value="" disabled>Selecione um Auxiliar</option>
                  {auxiliares.filter(item => item.status === 'ativo').map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Data de início">
                <input className={inputClass} type="date" value={auxiliarForm.dataInicio} onChange={event => setAuxiliarForm(prev => ({ ...prev, dataInicio: event.target.value }))} required />
              </FormField>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAuxiliarForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {encerrandoAuxiliar && (
          <ConfirmDialog
            title="Encerrar vínculo"
            message="O aluno ficará sem Auxiliar de Aprendizagem vinculado até que a Secretaria vincule um novo. O histórico deste vínculo é preservado."
            confirmLabel="Encerrar vínculo"
            onCancel={() => setEncerrandoAuxiliar(false)}
            onConfirm={() => confirmEncerrarAuxiliar(CURRENT_DATE)}
          />
        )}
      </div>
    </MainLayout>
  );
};
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField, Modal } from '../components/Common';
import { SegmentedToggle } from '../components/AnamneseFields';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { inputClass, turmaName } from '../utils/display';
import { canAccessEscola, gestorVinculadoEscola } from '../utils/escolas';
import { CURRENT_DATE, formatFullDate, getFormStatus } from '../utils/formAvailability';
import { getTrimestreAtual } from '../utils/trimestres';
import { ACAO_PDI_LABEL, autoriaPdi, autorLabel } from '../utils/pdiHistorico';
import { isGestor, isProfessor } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';
import { MainLayout } from '../layouts/Layouts';

const answerFromResposta = (question, resposta) => {
  if (question.tipoResposta === 'numero') {
    const valor = resposta?.resposta;
    return { valor: valor === undefined || valor === null || valor === '' ? '' : String(valor) };
  }
  if (question.tipoResposta === 'selecao') return { opcao: resposta?.resposta || '', complementar: resposta?.complementarTexto || '' };
  if (question.tipoResposta === 'marcacao') return { marcado: !!resposta?.resposta, complementar: resposta?.complementarTexto || '' };
  return { texto: resposta?.resposta || '', complementar: '' };
};

const formatDateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const FormularioPdiProfessor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeEscolaId } = useEscola();
  const {
    pdiAlunos, pdiPerguntas, pdiRespostas, pdiHistoricoPreenchimento, trimestrePeriods, turmas,
    escolas, vinculosEscolares, professores, gestores, formPeriods,
    createPdiResposta, updatePdiResposta, registrarPreenchimentoPdi,
  } = useData();
  const [message, setMessage] = useState('');
  const [showHistorico, setShowHistorico] = useState(false);

  const aluno = pdiAlunos.find(item => item.id === Number(id));
  const isProfessorUser = isProfessor(user);
  const isGestorUser = isGestor(user);

  // Professor só acessa o Formulário PDI de alunos dos quais é o professor responsável — não
  // de qualquer aluno das turmas em que leciona (mesma regra em PdiPage.jsx/PdiAlunoPerfil.jsx).
  const professorPodeAcessar = isProfessorUser && !!aluno && isEscolaAplicavel(RECURSOS.PDI, aluno.escolaId)
    && aluno.professorId === user.id
    && canAccessEscola(user, aluno.escolaId, { escolas, vinculosEscolares });

  // Escopo da Supervisora: só a escola ATUALMENTE selecionada (activeEscolaId) e só se
  // vinculada a ela — nunca "todas as minhas escolas". Diferente do Professor, a consulta
  // funciona mesmo com a escola inativa; a edição é bloqueada separadamente (`escolaAtiva`).
  const gestorPodeVisualizar = isGestorUser && !!aluno && isEscolaAplicavel(RECURSOS.PDI, aluno.escolaId)
    && aluno.escolaId === activeEscolaId
    && gestorVinculadoEscola(user, aluno.escolaId, { vinculosEscolares });

  const isAllowed = professorPodeAcessar || gestorPodeVisualizar;
  // Vigência do PDI: prazo PADRÃO, o mesmo para todas as escolas selecionadas em "Gerenciar
  // formulário" (Secretaria) — não é mais individual por aluno. Uma linha por escola em
  // formPeriods, mas todas atualizadas juntas (ver FormularioPdiPage.jsx, updateFormPeriodsForEscolas).
  const period = formPeriods.find(item => item.id === 'pdi' && item.escolaId === aluno?.escolaId);
  const isActive = period && getFormStatus(period.startDate, period.endDate) === 'active';
  const escolaAtiva = aluno ? escolas.find(item => item.id === aluno.escolaId)?.status === 'ativa' : false;
  const questions = [...pdiPerguntas].filter(question => question.status === 'ativa').sort((left, right) => Number(left.ordem) - Number(right.ordem));
  // O trimestre não é escolhido pela Professora: é sempre o período vigente na data atual,
  // configurado pela Secretaria em Configurações (ver utils/trimestres.js getTrimestreAtual).
  const trimestre = getTrimestreAtual(trimestrePeriods, CURRENT_DATE);
  // O registro é sempre do professor responsável do aluno (aluno.professorId) — quando a
  // Supervisora preenche/corrige, ela edita o MESMO preenchimento, nunca cria um paralelo.
  const professorIdAlvo = aluno?.professorId;

  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map(question => {
    const resposta = trimestre && professorIdAlvo
      ? pdiRespostas.find(item => item.alunoId === Number(id) && item.professorId === professorIdAlvo && item.perguntaId === question.id && item.trimestre === trimestre)
      : null;
    return [question.id, answerFromResposta(question, resposta)];
  })));

  if (!isAllowed || !period) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">Aluno não encontrado</p><Button className="mt-4" onClick={() => navigate('/pdi/alunos')}>Voltar para alunos</Button></Card></MainLayout>;
  }

  // Escola inativa vinculada à Supervisora: consulta sempre permitida, edição nunca.
  const podeEditar = escolaAtiva;
  const podePreencher = podeEditar && isActive && !!trimestre;
  const autoria = trimestre && professorIdAlvo ? autoriaPdi(pdiHistoricoPreenchimento, aluno.id, professorIdAlvo, trimestre) : null;

  const updateAnswer = (question, value) => setAnswers(prev => ({ ...prev, [question.id]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!trimestre || !podePreencher) return;
    const existingAnswers = pdiRespostas.filter(answer => answer.alunoId === Number(id) && answer.professorId === professorIdAlvo && answer.trimestre === trimestre);
    questions.forEach(question => {
      const current = answers[question.id];
      const existing = existingAnswers.find(answer => answer.perguntaId === question.id);
      const resposta = question.tipoResposta === 'numero' ? (current.valor === '' ? '' : Number(current.valor))
        : question.tipoResposta === 'selecao' ? current.opcao
        : question.tipoResposta === 'marcacao' ? current.marcado
        : current.texto;
      const complementarAtivo = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado === true : current.opcao === question.complementar.gatilho);
      const payload = { alunoId: aluno.id, professorId: professorIdAlvo, perguntaId: question.id, trimestre, data: period.endDate, resposta, complementarTexto: complementarAtivo ? current.complementar : '' };
      if (existing) updatePdiResposta(existing.id, payload);
      else createPdiResposta(payload);
    });
    registrarPreenchimentoPdi(aluno.id, professorIdAlvo, trimestre, { tipo: user.tipo, id: user.id }, autoria ? 'edicao' : 'preenchimento_inicial');
    setMessage('Formulário PDI enviado com sucesso.');
  };

  // Perguntas padrão "estruturadas" e "habilidade" usam um clique (SegmentedToggle) — são a
  // fonte da Análise de Desenvolvimento e têm poucas opções fixas. "Qualitativa" é texto livre.
  // "Personalizada" preserva o renderizador antigo (dropdown/checkbox), pois pode ter qualquer
  // número de opções definidas livremente pela Secretaria.
  const renderEstruturadaOuHabilidade = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    const complementarVisivel = question.complementar && current.opcao === question.complementar.gatilho;
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
        <div className="mt-2">
          {question.tipoResposta === 'numero' ? (
            <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => updateAnswer(question, { valor: event.target.value })} readOnly={!podePreencher} required={podePreencher} />
          ) : (
            <SegmentedToggle
              value={current.opcao}
              onChange={value => updateAnswer(question, { ...current, opcao: value })}
              options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))}
              disabled={!podePreencher}
            />
          )}
        </div>
        {complementarVisivel && (
          <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} readOnly={!podePreencher} required={podePreencher} /></FormField></div>
        )}
      </div>
    );
  };

  const renderQualitativa = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={inputClass} rows="4" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} readOnly={!podePreencher} required={podePreencher} />
        </FormField>
      </div>
    );
  };

  const renderPersonalizada = (question, index) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
    return (
      <Card key={question.id}>
        <p className="text-sm font-bold text-slate-900">{index + 1}. {question.pergunta}</p>
        <div className="mt-4 space-y-4">
          {question.tipoResposta === 'texto' && (
            <FormField label="Resposta">
              <textarea className={inputClass} rows="5" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} readOnly={!podePreencher} required={podePreencher} />
            </FormField>
          )}
          {question.tipoResposta === 'selecao' && (
            <FormField label="Resposta">
              <select className={inputClass} value={current.opcao} onChange={event => updateAnswer(question, { ...current, opcao: event.target.value })} disabled={!podePreencher} required={podePreencher}>
                <option value="">Selecione</option>
                {question.opcoes.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
              </select>
            </FormField>
          )}
          {question.tipoResposta === 'marcacao' && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={current.marcado} onChange={event => updateAnswer(question, { ...current, marcado: event.target.checked })} disabled={!podePreencher} />
              Marcar
            </label>
          )}
          {complementarVisivel && (
            <FormField label={question.complementar.label}>
              <input className={inputClass} value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} readOnly={!podePreencher} required={podePreencher} />
            </FormField>
          )}
        </div>
      </Card>
    );
  };

  const estruturadas = questions.filter(question => question.origem === 'estruturada');
  const habilidades = questions.filter(question => question.origem === 'habilidade');
  const qualitativas = questions.filter(question => question.origem === 'qualitativa');
  const personalizadas = questions.filter(question => question.origem === 'personalizada');

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={`/pdi/alunos/${aluno.id}`} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para aluno</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Formulário PDI</h1>
          <p className="mt-2 text-slate-600">{aluno.nome} · {turmaName(turmas, aluno.turmaId)}{trimestre ? ` · ${trimestre}` : ''}</p>
        </div>

        {!escolaAtiva && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Escola inativa — consulta histórica. Os registros estão disponíveis apenas para consulta; preenchimento, edição e correção estão desabilitados.
          </div>
        )}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-700">Vigência definida pela gestão</p><p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(period.startDate)} a {formatFullDate(period.endDate)}</p></div>
          <Badge variant={isActive && escolaAtiva ? 'green' : 'gray'}>{isActive && escolaAtiva ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
        </Card>

        {autoria && (
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              <p><strong>Preenchido por:</strong> {autorLabel(autoria.inicial, { professores, gestores }).nome} — {autorLabel(autoria.inicial, { professores, gestores }).perfil}</p>
              <p className="mt-1"><strong>Última alteração:</strong> {autorLabel(autoria.ultima, { professores, gestores }).nome} — {autorLabel(autoria.ultima, { professores, gestores }).perfil}, em {formatDateTime(autoria.ultima.dataHora)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowHistorico(true)}>Ver histórico</Button>
          </Card>
        )}

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {!trimestre ? (
          <EmptyState title="Nenhum trimestre do PDI em andamento" description="A Secretaria de Educação ainda não configurou um período de trimestre que inclua a data de hoje. Procure a Secretaria para ajustar o calendário em Configurações." />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {estruturadas.length > 0 && (
              <Card>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Acompanhamento estruturado</p>
                <p className="mt-1 text-xs text-slate-500">Estas respostas alimentam a Análise de Desenvolvimento do aluno.</p>
                <div className="mt-3">{estruturadas.map(renderEstruturadaOuHabilidade)}</div>
              </Card>
            )}

            {habilidades.length > 0 && (
              <Card>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Habilidades (BNCC)</p>
                <p className="mt-1 text-xs text-slate-500">Procedimentos esperados observados nesta disciplina. Estruturado, mas ainda fora da Análise de Desenvolvimento.</p>
                <div className="mt-3">{habilidades.map(renderEstruturadaOuHabilidade)}</div>
              </Card>
            )}

            {qualitativas.length > 0 && (
              <Card>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Registro pedagógico</p>
                <p className="mt-1 text-xs text-slate-500">Texto livre para leitura humana — não alimenta gráfico nem indicador.</p>
                <div className="mt-3">{qualitativas.map(renderQualitativa)}</div>
              </Card>
            )}

            {personalizadas.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Perguntas adicionais da Secretaria</p>
                {personalizadas.map((question, index) => renderPersonalizada(question, index))}
              </div>
            )}

            {podePreencher && <div className="flex justify-end"><Button type="submit">Enviar formulário</Button></div>}
          </form>
        )}

        {showHistorico && autoria && (
          <Modal title="Histórico de preenchimento" onClose={() => setShowHistorico(false)}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Data/hora</th><th className="pb-2 pr-4">Usuário</th><th className="pb-2 pr-4">Perfil</th><th className="pb-2">Ação</th></tr></thead>
                <tbody>
                  {autoria.eventos.map(evento => {
                    const autor = autorLabel(evento, { professores, gestores });
                    return (
                      <tr key={evento.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4">{formatDateTime(evento.dataHora)}</td>
                        <td className="py-2 pr-4">{autor.nome}</td>
                        <td className="py-2 pr-4">{autor.perfil}</td>
                        <td className="py-2">{ACAO_PDI_LABEL[evento.acao] || evento.acao}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => setShowHistorico(false)}>Fechar</Button></div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};

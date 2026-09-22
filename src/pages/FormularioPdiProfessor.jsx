import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField, Modal } from '../components/Common';
import { SegmentedToggle } from '../components/AnamneseFields';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass, turmaName } from '../utils/display';
import { canAccessEscola, gestorVinculadoEscola } from '../utils/escolas';
import { formatFullDate, getFormStatus } from '../utils/formAvailability';
import { snapshotDaDisciplina } from '../utils/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';
import { ACAO_PDI_LABEL, autoriaFicha, autorLabel } from '../utils/pdiHistorico';
import { isGestor, isProfessor } from '../utils/roles';
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

// Agrupa as perguntas por seção/subseção preservando a ordem em que aparecem no modelo —
// genérico para qualquer disciplina, não assume nenhuma seção específica.
const agruparPorSecao = (questions) => {
  const secoes = [];
  questions.forEach(question => {
    const secaoNome = question.secao || 'Perguntas';
    let secao = secoes.find(item => item.nome === secaoNome);
    if (!secao) { secao = { nome: secaoNome, subsecoes: [] }; secoes.push(secao); }
    const subsecaoNome = question.subsecao || null;
    let subsecao = secao.subsecoes.find(item => item.nome === subsecaoNome);
    if (!subsecao) { subsecao = { nome: subsecaoNome, questions: [] }; secao.subsecoes.push(subsecao); }
    subsecao.questions.push(question);
  });
  return secoes;
};

export const FormularioPdiProfessor = () => {
  const { aplicacaoId, disciplinaId, alunoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    pdiAlunos, pdiAplicacoes, pdiFichaRespostas, pdiFichaHistorico, turmas, turmaProfessores,
    disciplinas, escolas, vinculosEscolares, professores, gestores,
    salvarRespostaFicha, registrarPreenchimentoFicha,
  } = useData();
  const [showHistorico, setShowHistorico] = useState(false);

  const aplicacao = pdiAplicacoes.find(item => item.id === Number(aplicacaoId));
  const snapshot = aplicacao ? snapshotDaDisciplina(aplicacao, disciplinaId) : null;
  const aluno = pdiAlunos.find(item => item.id === Number(alunoId));
  const turma = aluno ? turmas.find(item => item.id === aluno.turmaId) : null;
  const disciplina = disciplinas.find(item => item.id === Number(disciplinaId));

  const isProfessorUser = isProfessor(user);
  const isGestorUser = isGestor(user);

  // Professor: só acessa quando existe vínculo turma+professor+disciplina em turmaProfessores —
  // nunca mais via aluno.professorId (ver seção 9/10 do pedido).
  const professorPodeAcessar = isProfessorUser && !!aluno && !!turma && !!aplicacao && turma.escolaId === aplicacao.escolaId
    && turmaProfessores.some(vinculo => vinculo.turmaId === turma.id && vinculo.professorId === user.id && vinculo.disciplinaId === Number(disciplinaId) && vinculo.status === 'ativo')
    && canAccessEscola(user, turma.escolaId, { escolas, vinculosEscolares });

  // Gestor/Supervisor: escopo é a escola da aplicação, sem exigir vínculo de "leciona" — ele
  // supervisiona, podendo preencher em nome de qualquer disciplina com modelo configurado.
  const gestorPodeVisualizar = isGestorUser && !!aluno && !!turma && !!aplicacao && turma.escolaId === aplicacao.escolaId
    && gestorVinculadoEscola(user, aplicacao.escolaId, { vinculosEscolares });

  const isAllowed = professorPodeAcessar || gestorPodeVisualizar;
  // `questions` precisa existir mesmo quando a ficha não é válida, porque o useState abaixo tem
  // que ser chamado sempre, na mesma ordem (regras de hooks) — o "return" de "não encontrada"
  // só pode acontecer DEPOIS de todos os hooks já terem sido chamados.
  const questions = snapshot ? [...snapshot.perguntas].filter(question => question.status === 'ativa').sort((left, right) => Number(left.ordem) - Number(right.ordem)) : [];

  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map(question => {
    const resposta = pdiFichaRespostas.find(item => (
      item.aplicacaoId === Number(aplicacaoId) && item.disciplinaId === Number(disciplinaId) && item.alunoId === Number(alunoId) && item.perguntaId === question.id
    ));
    return [question.id, answerFromResposta(question, resposta)];
  })));

  if (!aluno || !aplicacao || !snapshot || !isAllowed) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">Ficha não encontrada</p><Button className="mt-4" onClick={() => navigate(-1)}>Voltar</Button></Card></MainLayout>;
  }

  const escolaAtiva = escolas.find(item => item.id === aplicacao.escolaId)?.status === 'ativa';
  const vigencia = getFormStatus(aplicacao.dataInicio, aplicacao.dataFim);
  const podeEditar = escolaAtiva;
  const podePreencher = podeEditar && vigencia === 'active';
  const autoria = autoriaFicha(pdiFichaHistorico, aplicacaoId, disciplinaId, alunoId);

  const updateAnswer = (question, value) => setAnswers(prev => ({ ...prev, [question.id]: value }));

  // Salva a resposta de UMA pergunta imediatamente (não só no envio final) — assim, um
  // formulário preenchido pela metade não se perde: cada resposta já fica gravada como
  // rascunho assim que o professor sai do campo/marca a opção, e o status da ficha em "Meus
  // PDIs" passa a refletir isso ("Em preenchimento") mesmo antes de clicar em "Enviar formulário".
  const persistAnswer = (question, current) => {
    if (!podePreencher) return;
    const resposta = question.tipoResposta === 'numero' ? (current.valor === '' ? '' : Number(current.valor))
      : question.tipoResposta === 'selecao' ? current.opcao
      : question.tipoResposta === 'marcacao' ? current.marcado
      : current.texto;
    const complementarAtivo = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado === true : current.opcao === question.complementar.gatilho);
    salvarRespostaFicha({
      aplicacaoId: Number(aplicacaoId),
      disciplinaId: Number(disciplinaId),
      alunoId: Number(alunoId),
      perguntaId: question.id,
      professorId: isProfessorUser ? user.id : null,
      autorTipo: user.tipo,
      autorId: user.id,
      data: aplicacao.dataFim,
      resposta,
      complementarTexto: complementarAtivo ? current.complementar : '',
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!podePreencher) return;
    // Garante que a última alteração de cada campo esteja salva (na prática, já está — cada
    // resposta é persistida assim que muda — isto é só a rede de segurança final).
    questions.filter(question => question.tipoResposta !== 'orientacao').forEach(question => {
      persistAnswer(question, answers[question.id]);
    });
    registrarPreenchimentoFicha(aplicacaoId, disciplinaId, alunoId, { tipo: user.tipo, id: user.id }, autoria ? 'edicao' : 'preenchimento_inicial');
    // Mostra a confirmação já na tela de destino (Meus PDIs para o professor; perfil do aluno
    // para o Gestor/Supervisor, de onde ele normalmente abriu a ficha) — a página não fica mais
    // "parada" depois de enviar.
    const destino = isProfessorUser ? '/pdi/meus-pdis' : `/pdi/alunos/${alunoId}`;
    navigate(destino, { state: { pdiMensagemSucesso: 'Formulário PDI enviado com sucesso.' } });
  };

  const renderOrientacao = (question) => (
    <div key={question.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{question.pergunta}</div>
  );

  const renderSelecaoOuMarcacao = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
        <div className="mt-2">
          {question.tipoResposta === 'numero' ? (
            <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => updateAnswer(question, { valor: event.target.value })} onBlur={() => persistAnswer(question, current)} readOnly={!podePreencher} required={podePreencher} />
          ) : question.tipoResposta === 'marcacao' ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={current.marcado} onChange={event => { const proximo = { ...current, marcado: event.target.checked }; updateAnswer(question, proximo); persistAnswer(question, proximo); }} disabled={!podePreencher} />
              Marcar
            </label>
          ) : (
            <SegmentedToggle
              value={current.opcao}
              onChange={value => { const proximo = { ...current, opcao: value }; updateAnswer(question, proximo); persistAnswer(question, proximo); }}
              options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))}
              disabled={!podePreencher}
            />
          )}
        </div>
        {complementarVisivel && (
          <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} spellCheck lang="pt-BR" value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} onBlur={() => { const corrigido = { ...current, complementar: aplicarAutoCorrecao(current.complementar) }; updateAnswer(question, corrigido); persistAnswer(question, corrigido); }} readOnly={!podePreencher} required={podePreencher} /></FormField></div>
        )}
      </div>
    );
  };

  const renderTexto = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={inputClass} rows="4" spellCheck lang="pt-BR" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} onBlur={() => { const corrigido = { ...current, texto: aplicarAutoCorrecao(current.texto) }; updateAnswer(question, corrigido); persistAnswer(question, corrigido); }} readOnly={!podePreencher} required={podePreencher} />
        </FormField>
      </div>
    );
  };

  const renderQuestion = (question) => {
    if (question.tipoResposta === 'orientacao') return renderOrientacao(question);
    if (question.tipoResposta === 'texto') return renderTexto(question);
    return renderSelecaoOuMarcacao(question);
  };

  const secoes = agruparPorSecao(questions);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <button type="button" onClick={() => navigate(-1)} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar</button>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{snapshot.nome}</h1>
          <p className="mt-2 text-slate-600">{aluno.nome} · {turmaName(turmas, aluno.turmaId)} · {disciplina?.nome}</p>
        </div>

        {!escolaAtiva && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Escola inativa — consulta histórica. Os registros estão disponíveis apenas para consulta; preenchimento e edição estão desabilitados.
          </div>
        )}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-700">Vigência da aplicação</p><p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(aplicacao.dataInicio)} a {formatFullDate(aplicacao.dataFim)}</p></div>
          <Badge variant={podePreencher ? 'green' : 'gray'}>{podePreencher ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
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

        {!vigencia && (
          <EmptyState title="Aplicação sem vigência definida" description="Procure a Secretaria para ajustar as datas desta aplicação PDI." />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {secoes.map(secao => (
            <Card key={secao.nome}>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{secao.nome}</p>
              {secao.subsecoes.map(subsecao => (
                <div key={subsecao.nome || 'default'} className="mt-3">
                  {subsecao.nome && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{subsecao.nome}</p>}
                  <div>{subsecao.questions.map(renderQuestion)}</div>
                </div>
              ))}
            </Card>
          ))}

          {podePreencher && <div className="flex justify-end"><Button type="submit">Enviar formulário</Button></div>}
        </form>

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

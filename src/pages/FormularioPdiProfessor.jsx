import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { SegmentedToggle } from '../components/AnamneseFields';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { formatFullDate } from '../utils/formAvailability';
import { paraPayloadValor } from '../services/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';
import { isGestor, isProfessor } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento', concluida: 'Concluído' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue', concluida: 'green' };

const answerFromResposta = (question, respostaRow) => {
  const valor = respostaRow?.valor || {};
  if (question.tipoResposta === 'numero') {
    return { valor: valor.resposta === undefined || valor.resposta === null || valor.resposta === '' ? '' : String(valor.resposta) };
  }
  if (question.tipoResposta === 'selecao') return { opcao: valor.resposta || '', complementar: valor.complementarTexto || '' };
  if (question.tipoResposta === 'marcacao') return { marcado: !!valor.resposta, complementar: valor.complementarTexto || '' };
  return { texto: valor.resposta || '', complementar: '' };
};

// Agrupa as perguntas por seção/subseção preservando a ordem em que aparecem no snapshot —
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
  const { obterOuCriarFichaPdi, obterFichaPdi, salvarRespostasFichaPdi, concluirFichaPdi } = useData();

  const podeEditarPerfil = isProfessor(user) || isGestor(user);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null); // { ficha, perguntas, respostas, editavelAgora }
  const [answers, setAnswers] = useState({});
  // Um Set de ids em vez de um booleano único: travar o formulário INTEIRO enquanto só UMA
  // resposta está sendo salva fazia cada clique parecer travar a tela inteira (cada salvamento é
  // uma chamada de rede de verdade) — agora só a pergunta que está salvando fica desabilitada,
  // as outras continuam respondíveis em paralelo.
  const [salvandoIds, setSalvandoIds] = useState(() => new Set());
  const [concluindo, setConcluindo] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  // Guarda a CHAVE (aplicação+aluno+disciplina) já carregada/em carregamento — nunca só um
  // booleano. A rota reaproveita a mesma instância do componente ao navegar de uma Ficha para
  // outra (mesmo padrão de rota, só os parâmetros mudam), então o efeito PRECISA rodar de novo
  // quando os parâmetros mudam; o que ele evita é só a chamada dupla do StrictMode/dev PARA A
  // MESMA combinação (ver seção 32 do pedido). Sem isso, abrir uma segunda Ficha continuava
  // mostrando os dados/respostas da primeira.
  const chaveCarregadaRef = useRef(null);

  useEffect(() => {
    const chave = `${aplicacaoId}-${alunoId}-${disciplinaId}`;
    if (chaveCarregadaRef.current === chave) return;
    chaveCarregadaRef.current = chave;

    setCarregando(true);
    setErro('');
    setDados(null);
    setAnswers({});
    setMensagemErro('');

    (async () => {
      const resultado = podeEditarPerfil
        ? await obterOuCriarFichaPdi({ aplicacaoId, alunoId, disciplinaId })
        : await obterFichaPdi(aplicacaoId, alunoId, disciplinaId);
      // Parâmetros já mudaram de novo (navegou pra outra Ficha antes desta responder) — descarta
      // esta resposta atrasada, nunca aplica um resultado que não é mais da Ficha atual.
      if (chaveCarregadaRef.current !== chave) return;
      setCarregando(false);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setDados(resultado);
      setAnswers(Object.fromEntries(resultado.perguntas.map(question => {
        const respostaRow = resultado.respostas.find(item => item.aplicacaoPerguntaId === question.id);
        return [question.id, answerFromResposta(question, respostaRow)];
      })));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId, alunoId, disciplinaId]);

  if (carregando) {
    return <MainLayout><Card className="py-12 text-center"><p className="text-slate-500">Carregando ficha...</p></Card></MainLayout>;
  }

  if (erro || !dados) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">{erro || 'Ficha não encontrada'}</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
        </Card>
      </MainLayout>
    );
  }

  const { ficha, perguntas, editavelAgora } = dados;
  const podePreencher = podeEditarPerfil && editavelAgora;
  const questions = [...perguntas];
  const secoes = agruparPorSecao(questions);

  const updateAnswer = (question, value) => setAnswers(prev => ({ ...prev, [question.id]: value }));

  // Salva a resposta de UMA pergunta imediatamente (rascunho) — mesma UX de sempre: cada resposta
  // já fica gravada assim que o professor sai do campo/marca a opção, sem precisar de envio final
  // (seções 17/18 do pedido: salvamento parcial, sem exigir formulário completo).
  const persistAnswer = async (question, current) => {
    if (!podePreencher || salvandoIds.has(question.id)) return;
    setMensagemErro('');
    setSalvandoIds(prev => new Set(prev).add(question.id));
    const resultado = await salvarRespostasFichaPdi(ficha.id, [
      { aplicacaoPerguntaId: question.id, valor: paraPayloadValor(question.tipoResposta, current) },
    ]);
    setSalvandoIds(prev => { const proximo = new Set(prev); proximo.delete(question.id); return proximo; });
    if (!resultado.ok) {
      // Nunca limpa o campo nem navega em caso de erro — o valor digitado continua na tela e o
      // usuário pode tentar novamente (seção 34 do pedido).
      setMensagemErro(resultado.error);
      return;
    }
    setDados(prev => ({ ...prev, ficha: resultado.ficha, respostas: resultado.respostas }));
  };

  const concluir = async () => {
    if (!podePreencher || concluindo) return;
    setConcluindo(true);
    const resultado = await concluirFichaPdi(ficha.id);
    setConcluindo(false);
    if (!resultado.ok) {
      setMensagemErro(resultado.error);
      return;
    }
    const destino = isProfessor(user) ? '/pdi/meus-pdis' : `/pdi/alunos/${alunoId}`;
    navigate(destino, { state: { pdiMensagemSucesso: 'Ficha PDI concluída com sucesso.' } });
  };

  const renderOrientacao = (question) => (
    <div key={question.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{question.pergunta}</div>
  );

  const renderSelecaoOuMarcacao = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
    const emSalvamento = salvandoIds.has(question.id);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
        <div className="mt-2">
          {question.tipoResposta === 'numero' ? (
            <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => updateAnswer(question, { valor: event.target.value })} onBlur={() => persistAnswer(question, current)} readOnly={!podePreencher} disabled={emSalvamento && podePreencher} />
          ) : question.tipoResposta === 'marcacao' ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={current.marcado} onChange={event => { const proximo = { ...current, marcado: event.target.checked }; updateAnswer(question, proximo); persistAnswer(question, proximo); }} disabled={!podePreencher || emSalvamento} />
              Marcar
            </label>
          ) : (
            <SegmentedToggle
              value={current.opcao}
              onChange={value => { const proximo = { ...current, opcao: value }; updateAnswer(question, proximo); persistAnswer(question, proximo); }}
              options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))}
              disabled={!podePreencher || emSalvamento}
            />
          )}
        </div>
        {complementarVisivel && (
          <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} spellCheck lang="pt-BR" value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} onBlur={() => { const corrigido = { ...current, complementar: aplicarAutoCorrecao(current.complementar) }; updateAnswer(question, corrigido); persistAnswer(question, corrigido); }} readOnly={!podePreencher} disabled={emSalvamento && podePreencher} /></FormField></div>
        )}
      </div>
    );
  };

  const renderTexto = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    const emSalvamento = salvandoIds.has(question.id);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={inputClass} rows="4" spellCheck lang="pt-BR" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} onBlur={() => { const corrigido = { ...current, texto: aplicarAutoCorrecao(current.texto) }; updateAnswer(question, corrigido); persistAnswer(question, corrigido); }} readOnly={!podePreencher} disabled={emSalvamento && podePreencher} />
        </FormField>
      </div>
    );
  };

  const renderQuestion = (question) => {
    if (question.tipoResposta === 'orientacao') return renderOrientacao(question);
    if (question.tipoResposta === 'texto') return renderTexto(question);
    return renderSelecaoOuMarcacao(question);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <button type="button" onClick={() => navigate(-1)} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar</button>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{ficha.disciplinaNome}</h1>
            <p className="mt-2 text-slate-600">{ficha.alunoNome} · {ficha.turmaNome} · {ficha.escolaNome}</p>
          </div>
          <Link to={`/pdi/alunos/${alunoId}/anamnese`}><Button variant="outline">Ver Anamnese</Button></Link>
        </div>

        {mensagemErro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{mensagemErro}</div>}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Vigência da aplicação</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(ficha.aplicacaoDataInicio)} a {formatFullDate(ficha.aplicacaoDataFim)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[ficha.status]}>{STATUS_LABEL[ficha.status]}</Badge>
            <Badge variant={podePreencher ? 'green' : 'gray'}>{podePreencher ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
          </div>
        </Card>

        {questions.length === 0 ? (
          <EmptyState title="Nenhuma pergunta neste modelo" description="Este modelo PDI não possui itens ativos no momento em que esta aplicação foi criada." />
        ) : (
          <div className="space-y-6">
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

            {podePreencher && (
              <div className="flex justify-end">
                <Button onClick={concluir} disabled={concluindo || salvandoIds.size > 0 || ficha.status === 'concluida'}>
                  {ficha.status === 'concluida' ? 'Ficha concluída' : concluindo ? 'Concluindo...' : 'Concluir Ficha PDI'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

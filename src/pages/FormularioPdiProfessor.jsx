import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { SegmentedToggle } from '../components/AnamneseFields';
import { HabilidadesCrmgSelecao } from '../components/HabilidadesCrmgSelecao';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { formatFullDate } from '../utils/formAvailability';
import { paraPayloadValor } from '../services/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';
import { isGestor, isProfessor } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { SavingIndicator } from '../components/SavingIndicator';

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento', concluida: 'Concluído' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue', concluida: 'green' };

const answerFromResposta = (question, respostaRow) => {
  const valor = respostaRow?.valor || {};
  if (question.tipoResposta === 'numero') {
    return { valor: valor.resposta === undefined || valor.resposta === null || valor.resposta === '' ? '' : String(valor.resposta) };
  }
  if (question.tipoResposta === 'selecao') return { opcao: valor.resposta || '', complementar: valor.complementarTexto || '' };
  // Habilidades do CRMG: o valor salvo já traz código/descrição congelados das marcadas.
  if (question.tipoResposta === 'habilidade_crmg') return { todas: !!valor.todas, habilidades: valor.habilidades || [], componenteNome: valor.componenteNome };
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
  const { obterOuCriarFichaPdi, obterFichaPdi, salvarRespostasFichaPdi, salvarRespostasPadraoFichaPdi, concluirFichaPdi } = useData();
  const { online } = useNetworkStatus();
  const userId = user?.email?.toLowerCase();

  const podeEditarPerfil = isProfessor(user) || isGestor(user);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null); // { ficha, perguntas, respostas, editavelAgora }
  const [answers, setAnswers] = useState({});
  // Nada é salvo a cada clique/tecla mais (era 1 chamada de rede por resposta — pra um formulário
  // de 20+ perguntas isso virava 20+ chamadas, cada uma pagando sozinha toda a validação/
  // autorização no backend). Agora só acumula localmente em `answers`, e `touchedIds` marca QUAIS
  // perguntas foram mexidas nesta visita (precisa disso separado do valor em si: um checkbox
  // desmarcado e um checkbox nunca tocado têm o mesmo valor `false`, só o Set distingue os dois).
  // O salvamento de verdade — tudo que estiver em `touchedIds`, numa chamada só — só acontece em
  // dois momentos: clicar em "Voltar" sem ter concluído, ou clicar em "Concluir".
  const [touchedIds, setTouchedIds] = useState(() => new Set());
  // Mesmo idioma de answers/touchedIds, só que para o bloco comum de perguntas padrão (seção 21
  // do pedido de bloco compartilhado) — guardado SEPARADO de propósito: são duas entidades
  // diferentes no backend (FichaPdi/RespostaPdi vs BlocoRespostasPadraoPdi/RespostaPadraoPdi),
  // salvas por endpoints diferentes, cada uma com sua própria granularidade de erro.
  const [blocoAnswers, setBlocoAnswers] = useState({});
  const [blocoTouchedIds, setBlocoTouchedIds] = useState(() => new Set());
  const [salvandoSaida, setSalvandoSaida] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  // Infra offline (ver src/offline/): "Salvo"/"Salvando..." local, separado da fila/conectividade
  // global (SyncStatusBanner). `conflito` é a mensagem de "alguém salvou por cima" — nunca
  // sobrescreve, só informa e preserva o rascunho local (ver salvarPendentes/salvarBlocoPendentes).
  const [statusLocal, setStatusLocal] = useState('idle');
  const [conflito, setConflito] = useState('');
  // Guarda a CHAVE (aplicação+aluno+disciplina) já carregada/em carregamento — nunca só um
  // booleano. A rota reaproveita a mesma instância do componente ao navegar de uma Ficha para
  // outra (mesmo padrão de rota, só os parâmetros mudam), então o efeito PRECISA rodar de novo
  // quando os parâmetros mudam; o que ele evita é só a chamada dupla do StrictMode/dev PARA A
  // MESMA combinação (ver seção 32 do pedido). Sem isso, abrir uma segunda Ficha continuava
  // mostrando os dados/respostas da primeira.
  const chaveCarregadaRef = useRef(null);

  // Chaves do rascunho local (IndexedDB) — isoladas por usuário (seção "Logout" do pedido) e por
  // Ficha; só existem depois que a Ficha carrega (precisa do id real).
  const draftKeyEspecifica = dados?.ficha ? `${userId}::ficha-resposta::${dados.ficha.id}` : null;
  const draftKeyPadrao = dados?.ficha ? `${userId}::bloco-resposta::${dados.ficha.id}` : null;

  useEffect(() => {
    const chave = `${aplicacaoId}-${alunoId}-${disciplinaId}`;
    if (chaveCarregadaRef.current === chave) return;
    chaveCarregadaRef.current = chave;

    setCarregando(true);
    setErro('');
    setDados(null);
    setAnswers({});
    setTouchedIds(new Set());
    setBlocoAnswers({});
    setBlocoTouchedIds(new Set());
    setMensagemErro('');
    setConflito('');

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
      const respostasBase = Object.fromEntries(resultado.perguntas.map(question => {
        const respostaRow = resultado.respostas.find(item => item.aplicacaoPerguntaId === question.id);
        return [question.id, answerFromResposta(question, respostaRow)];
      }));
      const respostasPadraoBase = resultado.blocoPadrao
        ? Object.fromEntries(resultado.blocoPadrao.perguntas.map(question => {
            const respostaRow = resultado.blocoPadrao.respostas.find(item => item.aplicacaoPerguntaPadraoId === question.id);
            return [question.id, answerFromResposta(question, respostaRow)];
          }))
        : {};

      // Restaura rascunho local (sobrevive a reload/fechamento — seção "Armazenamento local" do
      // pedido): se havia algo tocado e ainda não sincronizado, prevalece sobre o que veio do
      // servidor, nunca o contrário (nunca perder o que o usuário digitou).
      const [draftEspecifica, draftPadrao] = await Promise.all([
        lerDraft(`${userId}::ficha-resposta::${resultado.ficha.id}`),
        resultado.blocoPadrao ? lerDraft(`${userId}::bloco-resposta::${resultado.ficha.id}`) : Promise.resolve(null),
      ]);
      setAnswers(draftEspecifica ? { ...respostasBase, ...draftEspecifica.answers } : respostasBase);
      setTouchedIds(draftEspecifica ? new Set(draftEspecifica.touchedIds) : new Set());
      setBlocoAnswers(draftPadrao ? { ...respostasPadraoBase, ...draftPadrao.answers } : respostasPadraoBase);
      setBlocoTouchedIds(draftPadrao ? new Set(draftPadrao.touchedIds) : new Set());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId, alunoId, disciplinaId]);

  // Salvamento local com debounce leve (seção "Eficiência": nunca a cada tecla) — só grava
  // enquanto houver algo tocado ainda não sincronizado; some sozinho depois que salvarPendentes
  // confirma com o servidor (apagarDraft).
  useEffect(() => {
    if (!draftKeyEspecifica || touchedIds.size === 0) return undefined;
    const t = setTimeout(() => {
      salvarDraft(draftKeyEspecifica, { userId, answers, touchedIds: [...touchedIds], savedAt: Date.now() });
    }, 500);
    return () => clearTimeout(t);
  }, [answers, touchedIds, draftKeyEspecifica, userId]);

  useEffect(() => {
    if (!draftKeyPadrao || blocoTouchedIds.size === 0) return undefined;
    const t = setTimeout(() => {
      salvarDraft(draftKeyPadrao, { userId, answers: blocoAnswers, touchedIds: [...blocoTouchedIds], savedAt: Date.now() });
    }, 500);
    return () => clearTimeout(t);
  }, [blocoAnswers, blocoTouchedIds, draftKeyPadrao, userId]);

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

  const { ficha, perguntas, respostas, editavelAgora, blocoPadrao } = dados;
  const podePreencher = podeEditarPerfil && editavelAgora;
  const podePreencherBloco = podeEditarPerfil && !!blocoPadrao?.editavelAgora;
  const questions = [...perguntas];
  const secoes = agruparPorSecao(questions);
  const questionsPadrao = blocoPadrao?.perguntas || [];

  // "Respondida" pra fins de exibição/validação no frontend = já estava salva (veio do servidor
  // no load) OU foi tocada agora nesta visita (ainda não enviada, mas já preenchida na tela) —
  // precisa ser assim porque, sem salvamento incremental, `respostas` do servidor só reflete o
  // que existia ANTES de abrir a tela. ORIENTACAO nunca entra na conta, é só texto informativo.
  const perguntasObrigatorias = questions.filter(question => question.tipoResposta !== 'orientacao');
  const idsJaSalvos = new Set(respostas.map(resposta => resposta.aplicacaoPerguntaId));
  const perguntasFaltandoEspecificas = perguntasObrigatorias.filter(question => !idsJaSalvos.has(question.id) && !touchedIds.has(question.id)).length;

  // Mesmo critério, só que para as perguntas do bloco comum (seção 11 do pedido: concluir exige
  // as duas — específicas E padrão) — nenhuma pergunta padrão é ORIENTACAO (bloqueado no backend).
  const idsPadraoJaSalvos = new Set((blocoPadrao?.respostas || []).map(resposta => resposta.aplicacaoPerguntaPadraoId));
  const perguntasFaltandoPadrao = questionsPadrao.filter(question => !idsPadraoJaSalvos.has(question.id) && !blocoTouchedIds.has(question.id)).length;
  const perguntasFaltando = perguntasFaltandoEspecificas + perguntasFaltandoPadrao;

  const bloqueado = salvandoSaida || concluindo;

  const updateAnswer = (question, value) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
    setTouchedIds(prev => (prev.has(question.id) ? prev : new Set(prev).add(question.id)));
  };

  const updateBlocoAnswer = (question, value) => {
    setBlocoAnswers(prev => ({ ...prev, [question.id]: value }));
    setBlocoTouchedIds(prev => (prev.has(question.id) ? prev : new Set(prev).add(question.id)));
  };

  // Único ponto que de fato manda algo pro backend — tudo que foi tocado desde o último envio,
  // numa chamada só (nunca mais uma por pergunta). Chamado só nos dois momentos que importam:
  // clicar em "Voltar" sem ter concluído, ou clicar em "Concluir" (que chama isto primeiro e só
  // depois valida/fecha a Ficha). Nada tocado = não manda nada (evita uma chamada vazia à toa).
  // Infra offline: falha de REDE nunca é tratada como erro — fica numa fila local (sobrevive a
  // reload/fechamento) e sincroniza sozinha quando a conexão voltar (seção "Fila offline" do
  // pedido); CONFLITO_VERSAO nunca sobrescreve, preserva o rascunho e avisa (seção "Conflitos").
  const salvarPendentes = async () => {
    if (touchedIds.size === 0) return { ok: true };
    const respostasPendentes = [...touchedIds].map(id => {
      const question = questions.find(item => item.id === id);
      return { aplicacaoPerguntaId: id, valor: paraPayloadValor(question.tipoResposta, answers[id]) };
    });
    setStatusLocal('saving');
    const resultado = await salvarRespostasFichaPdi(ficha.id, respostasPendentes, ficha.updatedAt);
    if (resultado.ok) {
      setDados(prev => ({ ...prev, ficha: resultado.ficha, respostas: resultado.respostas }));
      setTouchedIds(new Set());
      if (draftKeyEspecifica) apagarDraft(draftKeyEspecifica);
      setStatusLocal('saved');
      return resultado;
    }
    if (resultado.codigo === 'CONFLITO_VERSAO') {
      setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.');
      setStatusLocal('idle');
      return { ...resultado, conflito: true };
    }
    if (!resultado.codigo && /conectar ao servidor/.test(resultado.error || '')) {
      await enfileirar({
        userId, resourceType: 'ficha-resposta', resourceId: ficha.id, operation: 'respostas',
        endpoint: `/api/pdi-fichas/${ficha.id}/respostas`, method: 'PUT',
        payload: { respostas: respostasPendentes }, baseTokenField: 'baseUpdatedAt', baseToken: ficha.updatedAt,
      });
      setTouchedIds(new Set());
      setStatusLocal('saved');
      return { ok: true, queued: true };
    }
    setStatusLocal('idle');
    return resultado;
  };

  // Mesmo idioma de salvarPendentes, para o bloco comum — só manda algo se o bloco existe e está
  // editável agora e algo foi de fato tocado nesta visita. `version` vai sempre a que está em
  // tela no momento do envio (seção 23 do pedido: nunca sobrescrever silenciosamente outra aba).
  const salvarBlocoPendentes = async () => {
    if (!podePreencherBloco || blocoTouchedIds.size === 0) return { ok: true };
    const respostasPendentes = [...blocoTouchedIds].map(id => {
      const question = questionsPadrao.find(item => item.id === id);
      return { aplicacaoPerguntaPadraoId: id, valor: paraPayloadValor(question.tipoResposta, blocoAnswers[id]) };
    });
    setStatusLocal('saving');
    const resultado = await salvarRespostasPadraoFichaPdi(ficha.id, respostasPendentes, blocoPadrao.version);
    if (resultado.ok) {
      setDados(prev => ({ ...prev, blocoPadrao: resultado.blocoPadrao }));
      setBlocoTouchedIds(new Set());
      if (draftKeyPadrao) apagarDraft(draftKeyPadrao);
      setStatusLocal('saved');
      return resultado;
    }
    if (resultado.codigo === 'CONFLITO_VERSAO') {
      setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.');
      setStatusLocal('idle');
      return { ...resultado, conflito: true };
    }
    if (!resultado.codigo && /conectar ao servidor/.test(resultado.error || '')) {
      await enfileirar({
        userId, resourceType: 'bloco-resposta', resourceId: ficha.id, operation: 'respostas-padrao',
        endpoint: `/api/pdi-fichas/${ficha.id}/respostas-padrao`, method: 'PUT',
        payload: { respostas: respostasPendentes }, baseTokenField: 'version', baseToken: blocoPadrao.version,
      });
      setBlocoTouchedIds(new Set());
      setStatusLocal('saved');
      return { ok: true, queued: true };
    }
    setStatusLocal('idle');
    return resultado;
  };

  // Sair sem concluir: salva tudo que foi preenchido até aqui de uma vez (Ficha fica com o status
  // que já tinha — PENDENTE/EM_ANDAMENTO, nunca CONCLUIDA — ver POST /:id/concluir no backend, que
  // só libera a conclusão com 100% respondido). Em erro, NUNCA navega — fica na tela com o que foi
  // digitado intacto, pro professor tentar de novo (mesmo princípio de antes: nunca perder dado
  // silenciosamente).
  const handleVoltar = async () => {
    if (!podePreencher || ficha.status === 'concluida' || bloqueado) { navigate(-1); return; }
    setMensagemErro('');
    setConflito('');
    setSalvandoSaida(true);
    const resultado = await salvarPendentes();
    const resultadoBloco = resultado.ok ? await salvarBlocoPendentes() : resultado;
    setSalvandoSaida(false);
    if (!resultado.ok || !resultadoBloco.ok) {
      // Conflito já tem a própria mensagem (setConflito) — nunca duplica em mensagemErro.
      if (!resultado.conflito && !resultadoBloco.conflito) setMensagemErro(resultado.ok ? resultadoBloco.error : resultado.error);
      return;
    }
    navigate(-1);
  };

  const concluir = async () => {
    if (!podePreencher || bloqueado) return;
    setMensagemErro('');
    setConflito('');
    // Conclusão definitiva exige conexão (seção "Concluir ficha" do pedido) — nunca simulada
    // localmente. Ainda salva/enfileira o que foi preenchido antes de bloquear, pra nada se
    // perder enquanto a conexão não volta.
    if (!online) {
      setConcluindo(true);
      await salvarPendentes();
      await salvarBlocoPendentes();
      setConcluindo(false);
      setMensagemErro('Para concluir a ficha, é necessário estar conectado. Suas respostas estão protegidas e poderão ser concluídas assim que a conexão voltar.');
      return;
    }
    setConcluindo(true);
    const salvo = await salvarPendentes();
    const salvoBloco = salvo.ok ? await salvarBlocoPendentes() : salvo;
    if (!salvo.ok || !salvoBloco.ok) {
      setConcluindo(false);
      if (!salvo.conflito && !salvoBloco.conflito) setMensagemErro(salvo.ok ? salvoBloco.error : salvo.error);
      return;
    }
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
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
        <div className="mt-2">
          {question.tipoResposta === 'numero' ? (
            <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => updateAnswer(question, { valor: event.target.value })} readOnly={!podePreencher} disabled={bloqueado && podePreencher} />
          ) : question.tipoResposta === 'marcacao' ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={current.marcado} onChange={event => updateAnswer(question, { ...current, marcado: event.target.checked })} disabled={!podePreencher || bloqueado} />
              Marcar
            </label>
          ) : (
            <SegmentedToggle
              value={current.opcao}
              onChange={value => updateAnswer(question, { ...current, opcao: value })}
              options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))}
              disabled={!podePreencher || bloqueado}
            />
          )}
        </div>
        {complementarVisivel && (
          <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} spellCheck lang="pt-BR" value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} onBlur={() => updateAnswer(question, { ...current, complementar: aplicarAutoCorrecao(current.complementar) })} readOnly={!podePreencher} disabled={bloqueado && podePreencher} /></FormField></div>
        )}
      </div>
    );
  };

  const renderTexto = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={`${inputClass} resize-none`} rows="4" spellCheck lang="pt-BR" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} onBlur={() => updateAnswer(question, { ...current, texto: aplicarAutoCorrecao(current.texto) })} readOnly={!podePreencher} disabled={bloqueado && podePreencher} />
        </FormField>
      </div>
    );
  };

  // Habilidades do CRMG: o Professor marca habilidades da disciplina desta Ficha (o que já foi
  // salvo aparece a partir do valor congelado, nunca relido do catálogo).
  const renderHabilidadesCrmg = (question) => {
    const current = answers[question.id] || answerFromResposta(question, null);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.pergunta}</p>
        <div className="mt-2">
          <HabilidadesCrmgSelecao
            disciplinaId={ficha.disciplinaId}
            value={current}
            onChange={value => updateAnswer(question, { ...current, ...value })}
            readOnly={!podePreencher}
            disabled={bloqueado}
          />
        </div>
      </div>
    );
  };

  const renderQuestion = (question) => {
    if (question.tipoResposta === 'orientacao') return renderOrientacao(question);
    if (question.tipoResposta === 'texto') return renderTexto(question);
    if (question.tipoResposta === 'habilidade_crmg') return renderHabilidadesCrmg(question);
    return renderSelecaoOuMarcacao(question);
  };

  // Mesmos tipos de pergunta, mesmo visual, só que lendo/escrevendo blocoAnswers/updateBlocoAnswer
  // e travando por podePreencherBloco em vez de podePreencher — perguntas padrão nunca são do tipo
  // habilidade_crmg (bloqueado no backend, ver PerguntaPdiPadrao), por isso não existe aqui.
  // Duplicado de propósito em vez de parametrizar as funções de cima: evita qualquer risco de
  // regressão no fluxo de preenchimento específico por disciplina, já testado.
  const renderSelecaoOuMarcacaoPadrao = (question) => {
    const current = blocoAnswers[question.id] || answerFromResposta(question, null);
    const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
        <div className="mt-2">
          {question.tipoResposta === 'numero' ? (
            <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => updateBlocoAnswer(question, { valor: event.target.value })} readOnly={!podePreencherBloco} disabled={bloqueado && podePreencherBloco} />
          ) : question.tipoResposta === 'marcacao' ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={current.marcado} onChange={event => updateBlocoAnswer(question, { ...current, marcado: event.target.checked })} disabled={!podePreencherBloco || bloqueado} />
              Marcar
            </label>
          ) : (
            <SegmentedToggle
              value={current.opcao}
              onChange={value => updateBlocoAnswer(question, { ...current, opcao: value })}
              options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))}
              disabled={!podePreencherBloco || bloqueado}
            />
          )}
        </div>
        {complementarVisivel && (
          <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} spellCheck lang="pt-BR" value={current.complementar} onChange={event => updateBlocoAnswer(question, { ...current, complementar: event.target.value })} onBlur={() => updateBlocoAnswer(question, { ...current, complementar: aplicarAutoCorrecao(current.complementar) })} readOnly={!podePreencherBloco} disabled={bloqueado && podePreencherBloco} /></FormField></div>
        )}
      </div>
    );
  };

  const renderTextoPadrao = (question) => {
    const current = blocoAnswers[question.id] || answerFromResposta(question, null);
    return (
      <div key={question.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={`${inputClass} resize-none`} rows="4" spellCheck lang="pt-BR" value={current.texto} onChange={event => updateBlocoAnswer(question, { ...current, texto: event.target.value })} onBlur={() => updateBlocoAnswer(question, { ...current, texto: aplicarAutoCorrecao(current.texto) })} readOnly={!podePreencherBloco} disabled={bloqueado && podePreencherBloco} />
        </FormField>
      </div>
    );
  };

  const renderQuestionPadrao = (question) => {
    if (question.tipoResposta === 'orientacao') return renderOrientacao(question);
    if (question.tipoResposta === 'texto') return renderTextoPadrao(question);
    return renderSelecaoOuMarcacaoPadrao(question);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleVoltar} disabled={bloqueado} className="text-sm font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">{salvandoSaida ? 'Salvando...' : '← Voltar'}</button>
              <SavingIndicator estado={statusLocal} />
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{ficha.disciplinaNome}</h1>
            <p className="mt-2 text-slate-600">{ficha.alunoNome} · {ficha.turmaNome} · {ficha.escolaNome}</p>
          </div>
          <Link to={`/pdi/alunos/${alunoId}/anamnese`}><Button variant="outline">Ver Anamnese</Button></Link>
        </div>

        {conflito && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <span>{conflito}</span>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        )}
        {mensagemErro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{mensagemErro}</div>}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Vigência da aplicação</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(ficha.aplicacaoDataInicio)} a {formatFullDate(ficha.aplicacaoDataFim)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[ficha.status]}>{STATUS_LABEL[ficha.status]}</Badge>
              <Badge variant={podePreencher ? 'green' : 'gray'}>{podePreencher ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
            </div>
            {(perguntasObrigatorias.length + questionsPadrao.length) > 0 && (
              <p className="text-xs font-semibold text-slate-500">
                {(perguntasObrigatorias.length + questionsPadrao.length) - perguntasFaltando}/{perguntasObrigatorias.length + questionsPadrao.length} perguntas respondidas
              </p>
            )}
          </div>
        </Card>

        {blocoPadrao && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Perguntas padrão</p>
              <Badge variant={podePreencherBloco ? 'green' : 'gray'}>{podePreencherBloco ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
            </div>
            {blocoPadrao.compartilhadoCom.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Compartilhada com: {blocoPadrao.compartilhadoCom.map(f => f.disciplinaNome).join(', ')}. Preencher aqui já preenche nas outras — cada disciplina continua com seu próprio status/conclusão.
              </p>
            )}
            <div className="mt-3">{questionsPadrao.map(renderQuestionPadrao)}</div>
          </Card>
        )}

        {questions.length === 0 && !blocoPadrao ? (
          <EmptyState title="Nenhuma pergunta neste modelo" description="Este modelo PDI não possui itens ativos no momento em que esta aplicação foi criada." />
        ) : (
          <div className="space-y-6">
            {questions.length > 0 && secoes.map(secao => (
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
              <div className="flex flex-col items-end gap-2">
                {ficha.status !== 'concluida' && perguntasFaltando > 0 && (
                  <p className="text-sm font-semibold text-amber-700">
                    Faltam {perguntasFaltando} {perguntasFaltando === 1 ? 'pergunta' : 'perguntas'} para poder concluir.
                  </p>
                )}
                <Button onClick={concluir} disabled={bloqueado || ficha.status === 'concluida' || perguntasFaltando > 0}>
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

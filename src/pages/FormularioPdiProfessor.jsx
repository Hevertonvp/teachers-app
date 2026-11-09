import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField, LoadingBlock, Spinner } from '../components/Common';
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
import { chaveFila, enfileirar, removerDaFila } from '../offline/syncQueue';
import { SavingIndicator } from '../components/SavingIndicator';
import { agruparPorSecao, analisarRascunho, answerFromResposta, MENSAGEM_CONFLITO_RASCUNHO } from '../utils/pdiFicha';

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento', concluida: 'Concluído' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue', concluida: 'green' };


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
  // DEF-19: rascunho deste aparelho escrito sobre uma versão que mudou depois no servidor — fica
  // aqui (sem misturar nos campos) até o usuário escolher. { especifica, padrao }: { answers, ids } | null.
  const [rascunhoPendente, setRascunhoPendente] = useState({ especifica: null, padrao: null });
  const pendenteRef = useRef(rascunhoPendente);
  pendenteRef.current = rascunhoPendente;
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
    setRascunhoPendente({ especifica: null, padrao: null });

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
      // DEF-19: só recupera direto se o servidor não mudou depois do rascunho; se mudou, os campos
      // mostram a versão salva e o rascunho fica pendente da escolha (nada é misturado nem enviado).
      const analiseEsp = analisarRascunho(draftEspecifica, resultado.perguntas, respostasBase, id => resultado.respostas.some(r => r.aplicacaoPerguntaId === id), resultado.ficha.updatedAt);
      const analisePad = resultado.blocoPadrao
        ? analisarRascunho(draftPadrao, resultado.blocoPadrao.perguntas, respostasPadraoBase, id => resultado.blocoPadrao.respostas.some(r => r.aplicacaoPerguntaPadraoId === id), resultado.blocoPadrao.version)
        : { tipo: 'nenhum' };
      if (analiseEsp.tipo === 'igual') apagarDraft(`${userId}::ficha-resposta::${resultado.ficha.id}`);
      if (analisePad.tipo === 'igual') apagarDraft(`${userId}::bloco-resposta::${resultado.ficha.id}`);
      setAnswers(analiseEsp.tipo === 'recuperar' ? { ...respostasBase, ...draftEspecifica.answers } : respostasBase);
      setTouchedIds(analiseEsp.tipo === 'recuperar' ? new Set(analiseEsp.ids) : new Set());
      setBlocoAnswers(analisePad.tipo === 'recuperar' ? { ...respostasPadraoBase, ...draftPadrao.answers } : respostasPadraoBase);
      setBlocoTouchedIds(analisePad.tipo === 'recuperar' ? new Set(analisePad.ids) : new Set());
      const pendentes = {
        especifica: analiseEsp.tipo === 'conflito' ? { answers: analiseEsp.answers, ids: analiseEsp.ids } : null,
        padrao: analisePad.tipo === 'conflito' ? { answers: analisePad.answers, ids: analisePad.ids } : null,
      };
      setRascunhoPendente(pendentes);
      if (pendentes.especifica || pendentes.padrao) setConflito(MENSAGEM_CONFLITO_RASCUNHO);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId, alunoId, disciplinaId]);

  // Salvamento local com debounce leve (seção "Eficiência": nunca a cada tecla) — só grava
  // enquanto houver algo tocado ainda não sincronizado; some sozinho depois que salvarPendentes
  // confirma com o servidor (apagarDraft).
  // `base` (DEF-19): versão do servidor sobre a qual as alterações foram feitas. Com rascunho
  // pendente de escolha, não regrava (o rascunho original fica intacto no aparelho).
  useEffect(() => {
    if (!draftKeyEspecifica || touchedIds.size === 0 || rascunhoPendente.especifica) return undefined;
    const t = setTimeout(() => {
      salvarDraft(draftKeyEspecifica, { userId, answers, touchedIds: [...touchedIds], base: dados?.ficha?.updatedAt, savedAt: Date.now() });
    }, 500);
    return () => clearTimeout(t);
  }, [answers, touchedIds, draftKeyEspecifica, userId, rascunhoPendente.especifica, dados?.ficha?.updatedAt]);

  useEffect(() => {
    if (!draftKeyPadrao || blocoTouchedIds.size === 0 || rascunhoPendente.padrao) return undefined;
    const t = setTimeout(() => {
      salvarDraft(draftKeyPadrao, { userId, answers: blocoAnswers, touchedIds: [...blocoTouchedIds], base: dados?.blocoPadrao?.version, savedAt: Date.now() });
    }, 500);
    return () => clearTimeout(t);
  }, [blocoAnswers, blocoTouchedIds, draftKeyPadrao, userId, rascunhoPendente.padrao, dados?.blocoPadrao?.version]);

  // DEF-19: escolha do usuário diante do rascunho pendente.
  const filaEspecifica = () => chaveFila(userId, 'ficha-resposta', dados.ficha.id, 'respostas');
  const filaPadrao = () => chaveFila(userId, 'bloco-resposta', dados.ficha.id, 'respostas-padrao');
  const usarVersaoSalva = () => {
    if (rascunhoPendente.especifica) { apagarDraft(draftKeyEspecifica); removerDaFila(filaEspecifica()); }
    if (rascunhoPendente.padrao) { apagarDraft(draftKeyPadrao); removerDaFila(filaPadrao()); }
    setRascunhoPendente({ especifica: null, padrao: null });
    setConflito('');
  };
  const restaurarMeuTexto = () => {
    const { especifica, padrao } = rascunhoPendente;
    if (especifica) {
      removerDaFila(filaEspecifica());
      setAnswers(prev => ({ ...prev, ...Object.fromEntries(especifica.ids.map(id => [id, especifica.answers[id]])) }));
      setTouchedIds(prev => new Set([...prev, ...especifica.ids]));
    }
    if (padrao) {
      removerDaFila(filaPadrao());
      setBlocoAnswers(prev => ({ ...prev, ...Object.fromEntries(padrao.ids.map(id => [id, padrao.answers[id]])) }));
      setBlocoTouchedIds(prev => new Set([...prev, ...padrao.ids]));
    }
    setRascunhoPendente({ especifica: null, padrao: null });
    setConflito('');
  };

  if (carregando) {
    return <MainLayout><Card><LoadingBlock text="Carregando ficha..." className="py-12" /></Card></MainLayout>;
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
  // DEF-19: com rascunho deste aparelho pendente de escolha, os campos daquela parte ficam travados
  // (mostram a versão salva) até o usuário escolher "Usar a versão salva" ou "Restaurar o meu texto".
  const podePreencher = podeEditarPerfil && editavelAgora && !rascunhoPendente.especifica;
  const podePreencherBloco = podeEditarPerfil && !!blocoPadrao?.editavelAgora && !rascunhoPendente.padrao;
  const questions = [...perguntas];
  const secoes = agruparPorSecao(questions);
  const questionsPadrao = blocoPadrao?.perguntas || [];
  const perguntasPadraoObrigatorias = questionsPadrao.filter(question => question.tipoResposta !== 'orientacao');

  // "Respondida" pra fins de exibição/validação no frontend = já estava salva (veio do servidor
  // no load) OU foi tocada agora nesta visita (ainda não enviada, mas já preenchida na tela) —
  // precisa ser assim porque, sem salvamento incremental, `respostas` do servidor só reflete o
  // que existia ANTES de abrir a tela. ORIENTACAO nunca entra na conta, é só texto informativo.
  const perguntasObrigatorias = questions.filter(question => question.tipoResposta !== 'orientacao');
  const idsJaSalvos = new Set(respostas.map(resposta => resposta.aplicacaoPerguntaId));
  const perguntasFaltandoEspecificas = perguntasObrigatorias.filter(question => !idsJaSalvos.has(question.id) && !touchedIds.has(question.id)).length;

  // Mesmo critério, só que para as perguntas do bloco comum (seção 11 do pedido: concluir exige
  // as duas — específicas E padrão). ORIENTACAO também pode estar no bloco ("Objetivo: …") e,
  // como nas específicas, nunca conta: é só texto, nunca recebe resposta.
  const idsPadraoJaSalvos = new Set((blocoPadrao?.respostas || []).map(resposta => resposta.aplicacaoPerguntaPadraoId));
  const perguntasFaltandoPadrao = questionsPadrao.filter(question => question.tipoResposta !== 'orientacao' && !idsPadraoJaSalvos.has(question.id) && !blocoTouchedIds.has(question.id)).length;
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
    if (pendenteRef.current.especifica) return { ok: false, conflito: true }; // DEF-19: aguardando escolha
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
      removerDaFila(chaveFila(userId, 'ficha-resposta', ficha.id, 'respostas')); // envio antigo na fila ficou obsoleto
      setStatusLocal('saved');
      return resultado;
    }
    if (resultado.codigo === 'CONFLITO_VERSAO') {
      setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações foram guardadas.');
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
      setStatusLocal('queued'); // DEF-08: só na fila deste aparelho, não no servidor
      return { ok: true, queued: true };
    }
    setStatusLocal('idle');
    return resultado;
  };

  // Mesmo idioma de salvarPendentes, para o bloco comum — só manda algo se o bloco existe e está
  // editável agora e algo foi de fato tocado nesta visita. `version` vai sempre a que está em
  // tela no momento do envio (seção 23 do pedido: nunca sobrescrever silenciosamente outra aba).
  const salvarBlocoPendentes = async () => {
    if (pendenteRef.current.padrao) return { ok: false, conflito: true }; // DEF-19: aguardando escolha
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
      removerDaFila(chaveFila(userId, 'bloco-resposta', ficha.id, 'respostas-padrao')); // envio antigo na fila ficou obsoleto
      setStatusLocal('saved');
      return resultado;
    }
    if (resultado.codigo === 'CONFLITO_VERSAO') {
      setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações foram guardadas.');
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
      setStatusLocal('queued'); // DEF-08: só na fila deste aparelho, não no servidor
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
      setMensagemErro('Conecte-se à internet para concluir. Suas respostas foram guardadas.');
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
              <button type="button" onClick={handleVoltar} disabled={bloqueado} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">{salvandoSaida ? <><Spinner className="h-3.5 w-3.5" />Salvando...</> : '← Voltar'}</button>
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
            {(rascunhoPendente.especifica || rascunhoPendente.padrao) ? (
              // DEF-19: texto deste aparelho preservado, à vista, até o usuário escolher.
              <div className="w-full space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide">Texto guardado neste aparelho (ainda não enviado):</p>
                <ul className="space-y-1 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
                  {[[rascunhoPendente.padrao, questionsPadrao], [rascunhoPendente.especifica, questions]].filter(([pendente]) => pendente).flatMap(([pendente, lista]) => pendente.ids.map(id => {
                    const valor = pendente.answers[id];
                    const texto = valor && typeof valor === 'object' ? [valor.texto, valor.resposta, valor.opcao, valor.valor, valor.complementar].filter(item => item !== undefined && item !== null && item !== '').join(' — ') || JSON.stringify(valor) : String(valor ?? '(vazio)');
                    return <li key={`${lista === questions ? 'e' : 'p'}-${id}`}><span className="font-semibold">{lista.find(question => question.id === id)?.pergunta ?? 'Pergunta'}:</span> {texto}</li>;
                  }))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={usarVersaoSalva}>Usar a versão salva</Button>
                  <Button size="sm" onClick={restaurarMeuTexto}>Restaurar o meu texto</Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
            )}
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
            {(perguntasObrigatorias.length + perguntasPadraoObrigatorias.length) > 0 && (
              <p className="text-xs font-semibold text-slate-500">
                {(perguntasObrigatorias.length + perguntasPadraoObrigatorias.length) - perguntasFaltando}/{perguntasObrigatorias.length + perguntasPadraoObrigatorias.length} perguntas respondidas
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
                Vale também para: {blocoPadrao.compartilhadoCom.map(f => f.disciplinaNome).join(', ')}.
              </p>
            )}
            <div className="mt-3">{questionsPadrao.map(renderQuestionPadrao)}</div>
          </Card>
        )}

        {questions.length === 0 && !blocoPadrao ? (
          <EmptyState title="Nenhuma pergunta neste formulário" />
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
                <Button onClick={concluir} loading={concluindo} disabled={bloqueado || ficha.status === 'concluida' || perguntasFaltando > 0}>
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

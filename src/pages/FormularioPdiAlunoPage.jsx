import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { SegmentedToggle } from '../components/AnamneseFields';
import { HabilidadesCrmgSelecao } from '../components/HabilidadesCrmgSelecao';
import { SavingIndicator } from '../components/SavingIndicator';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { MainLayout } from '../layouts/Layouts';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { listarMeusPdisReais, paraPayloadValor } from '../services/pdiFichas';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';
import { inputClass } from '../utils/display';
import { formatFullDate } from '../utils/formAvailability';
import { agruparPorSecao, answerFromResposta } from '../utils/pdiFicha';
import { isProfessor } from '../utils/roles';

// Formulário ÚNICO do aluno para o Professor (mesma Aplicação, todas as disciplinas que ele
// leciona para aquele aluno). Só experiência de tela: por baixo continuam existindo as Fichas
// separadas por disciplina, carregadas/salvas/concluídas pelos MESMOS endpoints de sempre
// (obter-ou-criar, PUT respostas, PUT respostas-padrao, POST concluir) — nenhum endpoint novo,
// nenhuma transação entre Fichas. O bloco comum (BlocoRespostasPadraoPdi) aparece uma vez só e é
// salvo uma vez só; cada disciplina salva a própria Ficha, e uma falha numa disciplina nunca
// desfaz o que já foi salvo nas outras (o rascunho local daquela disciplina continua guardado).

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento', concluida: 'Concluído' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue', concluida: 'green' };

const ehFalhaDeRede = (resultado) => !resultado.codigo && /conectar ao servidor/.test(resultado.error || '');
const obrigatoria = (question) => question.tipoResposta !== 'orientacao';

const chaveDraftFicha = (userId, fichaId) => `${userId}::ficha-resposta::${fichaId}`;
// Mesma chave da tela de UMA Ficha (por fichaId) — rascunho do bloco feito lá continua sendo
// encontrado aqui, e vice-versa. Aqui sempre grava pela Ficha "âncora" (menor id do agrupamento).
const chaveDraftBloco = (userId, fichaId) => `${userId}::bloco-resposta::${fichaId}`;

// Uma pergunta, qualquer tipo — mesmo visual da tela de UMA Ficha.
const CampoPergunta = ({ question, value, onChange, editavel, bloqueado, disciplinaId }) => {
  const current = value || answerFromResposta(question, null);
  if (question.tipoResposta === 'orientacao') {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{question.pergunta}</div>;
  }
  if (question.tipoResposta === 'texto') {
    return (
      <div className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={question.pergunta}>
          <textarea className={`${inputClass} resize-none`} rows="4" spellCheck lang="pt-BR" value={current.texto} onChange={event => onChange({ ...current, texto: event.target.value })} onBlur={() => onChange({ ...current, texto: aplicarAutoCorrecao(current.texto) })} readOnly={!editavel} disabled={bloqueado && editavel} />
        </FormField>
      </div>
    );
  }
  if (question.tipoResposta === 'habilidade_crmg') {
    return (
      <div className="border-b border-slate-100 py-3 last:border-0">
        <p className="text-sm font-semibold text-slate-800">{question.pergunta}</p>
        <div className="mt-2">
          <HabilidadesCrmgSelecao disciplinaId={disciplinaId} value={current} onChange={novo => onChange({ ...current, ...novo })} readOnly={!editavel} disabled={bloqueado} />
        </div>
      </div>
    );
  }
  const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-sm font-semibold text-slate-800">{question.codigo && <span className="mr-1.5 text-xs font-bold text-teal-700">{question.codigo}</span>}{question.pergunta}</p>
      <div className="mt-2">
        {question.tipoResposta === 'numero' ? (
          <input type="number" className={`${inputClass} max-w-40`} value={current.valor} onChange={event => onChange({ valor: event.target.value })} readOnly={!editavel} disabled={bloqueado && editavel} />
        ) : question.tipoResposta === 'marcacao' ? (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={current.marcado} onChange={event => onChange({ ...current, marcado: event.target.checked })} disabled={!editavel || bloqueado} />
            Marcar
          </label>
        ) : (
          <SegmentedToggle value={current.opcao} onChange={opcao => onChange({ ...current, opcao })} options={question.opcoes.map(opcao => ({ value: opcao, label: opcao }))} disabled={!editavel || bloqueado} />
        )}
      </div>
      {complementarVisivel && (
        <div className="mt-2"><FormField label={question.complementar.label}><input className={inputClass} spellCheck lang="pt-BR" value={current.complementar} onChange={event => onChange({ ...current, complementar: event.target.value })} onBlur={() => onChange({ ...current, complementar: aplicarAutoCorrecao(current.complementar) })} readOnly={!editavel} disabled={bloqueado && editavel} /></FormField></div>
      )}
    </div>
  );
};

// Estado inicial de UMA disciplina a partir do payload de obter-ou-criar (+ rascunho local).
const montarEstadoFicha = (linha, resultado, draft) => {
  const base = Object.fromEntries(resultado.perguntas.map(question => [question.id, answerFromResposta(question, resultado.respostas.find(r => r.aplicacaoPerguntaId === question.id))]));
  return {
    disciplinaId: linha.disciplinaId,
    disciplinaNome: linha.disciplinaNome,
    carregando: false,
    erroCarga: '',
    dados: { ficha: resultado.ficha, perguntas: resultado.perguntas, respostas: resultado.respostas, editavelAgora: resultado.editavelAgora, blocoPadrao: resultado.blocoPadrao },
    answers: draft ? { ...base, ...draft.answers } : base,
    touched: draft ? new Set(draft.touchedIds) : new Set(),
    salvar: null, // { estado: 'erro' | 'conflito' | 'fila' | 'salvo' | 'concluida', mensagem }
  };
};

// Agrupa as Fichas carregadas pelo bloco comum a que pertencem — identidade do bloco é
// aplicação+aluno+turma+PROFESSOR RESPONSÁVEL da Ficha (ver domain/pdiBlocoPadrao.ts): normalmente
// um só; mais de um só se o professor responsável mudou no meio da Aplicação. `anteriores`
// preserva o que já foi digitado e ainda não salvo quando o agrupamento é recalculado.
const montarBlocos = (fichas, anteriores = {}) => {
  const grupos = {};
  Object.values(fichas).forEach(f => {
    if (!f.dados?.blocoPadrao) return;
    const chave = String(f.dados.ficha.professorResponsavelId);
    (grupos[chave] ||= []).push(f);
  });
  return Object.fromEntries(Object.entries(grupos).map(([chave, membros]) => {
    const ordenados = [...membros].sort((a, b) => a.dados.ficha.id - b.dados.ficha.id);
    const maisNovo = ordenados.reduce((acc, f) => (f.dados.blocoPadrao.version > acc.dados.blocoPadrao.version ? f : acc), ordenados[0]);
    const perguntas = [];
    const donoPorPergunta = {};
    ordenados.forEach(f => f.dados.blocoPadrao.perguntas.forEach(question => {
      if (donoPorPergunta[question.id] !== undefined) return;
      donoPorPergunta[question.id] = f.dados.ficha.id; // a Ficha cujo snapshot inclui a pergunta salva por ela
      perguntas.push(question);
    }));
    perguntas.sort((a, b) => a.ordem - b.ordem);
    const anterior = anteriores[chave];
    const respostas = maisNovo.dados.blocoPadrao.respostas;
    const base = Object.fromEntries(perguntas.map(question => [question.id, answerFromResposta(question, respostas.find(r => r.aplicacaoPerguntaPadraoId === question.id))]));
    const touched = anterior ? anterior.touched : new Set();
    return [chave, {
      chave,
      fichaIds: ordenados.map(f => f.dados.ficha.id),
      anchorFichaId: ordenados[0].dados.ficha.id,
      disciplinas: ordenados.map(f => f.disciplinaNome),
      perguntas,
      donoPorPergunta,
      respostas,
      version: maisNovo.dados.blocoPadrao.version,
      editavelAgora: maisNovo.dados.blocoPadrao.editavelAgora,
      answers: anterior ? { ...base, ...Object.fromEntries([...touched].map(id => [id, anterior.answers[id]])) } : base,
      touched,
      salvar: anterior?.salvar ?? null,
    }];
  }));
};

export const FormularioPdiAlunoPage = () => {
  const { aplicacaoId, alunoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { obterOuCriarFichaPdi, salvarRespostasFichaPdi, salvarRespostasPadraoFichaPdi, concluirFichaPdi } = useData();
  const { online } = useNetworkStatus();
  const userId = user?.email?.toLowerCase();
  const souProfessor = isProfessor(user);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState([]); // itens de Meus PDIs desta Aplicação+aluno (uma por disciplina)
  const [fichas, setFichas] = useState({}); // disciplinaId -> estado da disciplina
  const [blocos, setBlocos] = useState({}); // professorResponsavelId -> estado do bloco comum
  const [ocupado, setOcupado] = useState(null); // null | 'salvando' | 'concluindo'
  const [statusLocal, setStatusLocal] = useState('idle');
  const [mensagem, setMensagem] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');
  const [resultadoConclusao, setResultadoConclusao] = useState(null); // [{ disciplinaNome, ok, mensagem }]

  // Espelho do estado mais recente — os laços de salvamento são sequenciais (await) e precisam
  // ler o que já foi atualizado pelas chamadas anteriores, nunca o estado capturado no clique.
  const fichasRef = useRef(fichas);
  const blocosRef = useRef(blocos);
  fichasRef.current = fichas;
  blocosRef.current = blocos;
  const chaveCarregadaRef = useRef(null);

  const atualizarFicha = (disciplinaId, mudar) => setFichas(prev => {
    const proximo = { ...prev, [disciplinaId]: mudar(prev[disciplinaId]) };
    fichasRef.current = proximo;
    return proximo;
  });
  const atualizarBloco = (chave, mudar) => setBlocos(prev => {
    const proximo = { ...prev, [chave]: mudar(prev[chave]) };
    blocosRef.current = proximo;
    return proximo;
  });

  // Bloco comum veio atualizado do servidor (salvar bloco, concluir) — respostas/versão novas;
  // o que ainda está tocado e não salvo continua como o Professor deixou.
  const aplicarBlocoDoServidor = (chave, blocoPadrao, idsSalvos = []) => atualizarBloco(chave, bloco => {
    const touched = new Set([...bloco.touched].filter(id => !idsSalvos.includes(id)));
    const answers = Object.fromEntries(bloco.perguntas.map(question => [question.id, touched.has(question.id)
      ? bloco.answers[question.id]
      : answerFromResposta(question, blocoPadrao.respostas.find(r => r.aplicacaoPerguntaPadraoId === question.id))]));
    return { ...bloco, respostas: blocoPadrao.respostas, version: blocoPadrao.version, editavelAgora: blocoPadrao.editavelAgora, answers, touched };
  });

  const carregarFicha = async (linha) => {
    const resultado = await obterOuCriarFichaPdi({ aplicacaoId, alunoId, disciplinaId: linha.disciplinaId });
    if (!resultado.ok) {
      return { disciplinaId: linha.disciplinaId, disciplinaNome: linha.disciplinaNome, carregando: false, erroCarga: resultado.error, dados: null, answers: {}, touched: new Set(), salvar: null };
    }
    const draft = await lerDraft(chaveDraftFicha(userId, resultado.ficha.id));
    return montarEstadoFicha(linha, resultado, draft);
  };

  // Rascunhos do bloco podem existir sob a chave de qualquer Ficha do agrupamento (tela de UMA
  // Ficha grava pela Ficha aberta) — junta todos, o mais recente por último.
  const restaurarDraftsDosBlocos = async (blocosMontados) => {
    for (const bloco of Object.values(blocosMontados)) {
      const drafts = (await Promise.all(bloco.fichaIds.map(id => lerDraft(chaveDraftBloco(userId, id))))).filter(Boolean).sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
      if (drafts.length === 0) continue;
      const idsValidos = new Set(bloco.perguntas.map(question => question.id));
      drafts.forEach(draft => draft.touchedIds.filter(id => idsValidos.has(id)).forEach(id => {
        bloco.answers[id] = draft.answers[id];
        bloco.touched.add(id);
      }));
    }
    return blocosMontados;
  };

  useEffect(() => {
    if (!souProfessor) return;
    const chave = `${aplicacaoId}-${alunoId}`;
    if (chaveCarregadaRef.current === chave) return;
    chaveCarregadaRef.current = chave;
    setCarregando(true);
    setErro('');
    (async () => {
      let todas;
      try {
        todas = await listarMeusPdisReais();
      } catch (error) {
        if (chaveCarregadaRef.current !== chave) return;
        setErro(error.message);
        setCarregando(false);
        return;
      }
      const doAluno = todas
        .filter(item => String(item.aplicacaoId) === String(aplicacaoId) && String(item.alunoId) === String(alunoId))
        .sort((a, b) => a.disciplinaNome.localeCompare(b.disciplinaNome, 'pt-BR'));
      // Em paralelo: cada obter-ou-criar é independente (transação própria, curta).
      const estados = await Promise.all(doAluno.map(carregarFicha));
      if (chaveCarregadaRef.current !== chave) return;
      const porDisciplina = Object.fromEntries(estados.map(estado => [estado.disciplinaId, estado]));
      const blocosMontados = await restaurarDraftsDosBlocos(montarBlocos(porDisciplina));
      setLinhas(doAluno);
      setFichas(porDisciplina);
      setBlocos(blocosMontados);
      setCarregando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId, alunoId, souProfessor]);

  // Rascunho local com debounce leve (mesma infra da tela de UMA Ficha): só o que foi tocado.
  useEffect(() => {
    const t = setTimeout(() => {
      Object.values(fichas).forEach(f => {
        if (f.dados && f.touched.size > 0) salvarDraft(chaveDraftFicha(userId, f.dados.ficha.id), { userId, answers: f.answers, touchedIds: [...f.touched], savedAt: Date.now() });
      });
      Object.values(blocos).forEach(b => {
        if (b.touched.size > 0) salvarDraft(chaveDraftBloco(userId, b.anchorFichaId), { userId, answers: b.answers, touchedIds: [...b.touched], savedAt: Date.now() });
      });
    }, 500);
    return () => clearTimeout(t);
  }, [fichas, blocos, userId]);

  const tentarCarregarDeNovo = async (disciplinaId) => {
    const linha = linhas.find(item => item.disciplinaId === disciplinaId);
    atualizarFicha(disciplinaId, f => ({ ...f, carregando: true, erroCarga: '' }));
    const estado = await carregarFicha(linha);
    const proximas = { ...fichasRef.current, [disciplinaId]: estado };
    fichasRef.current = proximas;
    setFichas(proximas);
    const novosBlocos = montarBlocos(proximas, blocosRef.current);
    blocosRef.current = novosBlocos;
    setBlocos(novosBlocos);
  };

  if (!souProfessor) return <Navigate to="/pdi" replace />;

  const bloqueado = ocupado !== null;
  const blocoDaFicha = (f) => Object.values(blocos).find(b => b.fichaIds.includes(f.dados?.ficha.id));

  // Quantas perguntas desta disciplina ainda faltam (específicas + as do bloco comum que o snapshot
  // DESTA Ficha inclui) — mesmo critério do backend ao concluir; ORIENTACAO nunca conta.
  const faltandoNaFicha = (f) => {
    if (!f.dados) return 0;
    const salvas = new Set(f.dados.respostas.map(r => r.aplicacaoPerguntaId));
    const especificas = f.dados.perguntas.filter(obrigatoria).filter(q => !salvas.has(q.id) && !f.touched.has(q.id)).length;
    const bloco = blocoDaFicha(f);
    if (!bloco || !f.dados.blocoPadrao) return especificas;
    const salvasBloco = new Set(bloco.respostas.map(r => r.aplicacaoPerguntaPadraoId));
    const doBloco = f.dados.blocoPadrao.perguntas.filter(obrigatoria).filter(q => !salvasBloco.has(q.id) && !bloco.touched.has(q.id)).length;
    return especificas + doBloco;
  };

  const atualizarResposta = (disciplinaId, question, valor) => atualizarFicha(disciplinaId, f => ({
    ...f, answers: { ...f.answers, [question.id]: valor }, touched: f.touched.has(question.id) ? f.touched : new Set(f.touched).add(question.id), salvar: null,
  }));
  const atualizarRespostaBloco = (chave, question, valor) => atualizarBloco(chave, b => ({
    ...b, answers: { ...b.answers, [question.id]: valor }, touched: b.touched.has(question.id) ? b.touched : new Set(b.touched).add(question.id), salvar: null,
  }));

  // --- Salvamento: bloco comum uma vez, depois cada Ficha separadamente --------------------------
  // Sequencial e sem transação entre Fichas (nunca uma transação longa no Neon/pgbouncer): cada
  // chamada é a mesma de sempre, atômica por si. Falha numa parte nunca desfaz as outras — a parte
  // que falhou fica marcada, com o rascunho local intacto, e "Salvar" reenvia só o que falta.
  const salvarBloco = async (chave) => {
    const bloco = blocosRef.current[chave];
    if (!bloco || !bloco.editavelAgora || bloco.touched.size === 0) return { ok: true };
    // Cada pergunta é salva pela Ficha cujo snapshot a inclui (normalmente todas pela âncora).
    const porFicha = new Map();
    [...bloco.touched].forEach(id => {
      const dono = bloco.donoPorPergunta[id];
      if (!porFicha.has(dono)) porFicha.set(dono, []);
      porFicha.get(dono).push(id);
    });
    let version = bloco.version;
    for (const [fichaId, ids] of porFicha) {
      const respostas = ids.map(id => ({ aplicacaoPerguntaPadraoId: id, valor: paraPayloadValor(bloco.perguntas.find(q => q.id === id).tipoResposta, blocosRef.current[chave].answers[id]) }));
      const resultado = await salvarRespostasPadraoFichaPdi(fichaId, respostas, version);
      if (resultado.ok) {
        version = resultado.blocoPadrao.version;
        aplicarBlocoDoServidor(chave, resultado.blocoPadrao, ids);
        continue;
      }
      if (resultado.codigo === 'CONFLITO_VERSAO') {
        atualizarBloco(chave, b => ({ ...b, salvar: { estado: 'conflito', mensagem: 'As perguntas comuns foram alteradas em outra aba/sessão enquanto você editava. Suas respostas continuam guardadas neste aparelho — recarregue a página para revisar antes de salvar de novo.' } }));
        return { ok: false };
      }
      if (ehFalhaDeRede(resultado)) {
        await enfileirar({
          userId, resourceType: 'bloco-resposta', resourceId: fichaId, operation: 'respostas-padrao',
          endpoint: `/api/pdi-fichas/${fichaId}/respostas-padrao`, method: 'PUT',
          payload: { respostas }, baseTokenField: 'version', baseToken: version,
        });
        atualizarBloco(chave, b => ({ ...b, touched: new Set([...b.touched].filter(id => !ids.includes(id))), salvar: { estado: 'fila', mensagem: 'Sem conexão: as perguntas comuns ficaram guardadas e serão enviadas quando a conexão voltar.' } }));
        return { ok: true, fila: true };
      }
      atualizarBloco(chave, b => ({ ...b, salvar: { estado: 'erro', mensagem: resultado.error } }));
      return { ok: false };
    }
    bloco.fichaIds.forEach(id => apagarDraft(chaveDraftBloco(userId, id)));
    atualizarBloco(chave, b => ({ ...b, salvar: { estado: 'salvo', mensagem: '' } }));
    return { ok: true };
  };

  const salvarFicha = async (disciplinaId) => {
    const f = fichasRef.current[disciplinaId];
    if (!f?.dados || !f.dados.editavelAgora || f.touched.size === 0) return { ok: true };
    const { ficha, perguntas } = f.dados;
    const ids = [...f.touched];
    const respostas = ids.map(id => ({ aplicacaoPerguntaId: id, valor: paraPayloadValor(perguntas.find(q => q.id === id).tipoResposta, f.answers[id]) }));
    const resultado = await salvarRespostasFichaPdi(ficha.id, respostas, ficha.updatedAt);
    if (resultado.ok) {
      apagarDraft(chaveDraftFicha(userId, ficha.id));
      atualizarFicha(disciplinaId, atual => ({
        ...atual,
        dados: { ...atual.dados, ficha: resultado.ficha, respostas: resultado.respostas },
        touched: new Set([...atual.touched].filter(id => !ids.includes(id))),
        salvar: { estado: 'salvo', mensagem: '' },
      }));
      return { ok: true };
    }
    if (resultado.codigo === 'CONFLITO_VERSAO') {
      atualizarFicha(disciplinaId, atual => ({ ...atual, salvar: { estado: 'conflito', mensagem: `A Ficha de ${atual.disciplinaNome} foi alterada em outra aba/sessão enquanto você editava. Suas respostas continuam guardadas neste aparelho — recarregue a página para revisar antes de salvar de novo.` } }));
      return { ok: false };
    }
    if (ehFalhaDeRede(resultado)) {
      await enfileirar({
        userId, resourceType: 'ficha-resposta', resourceId: ficha.id, operation: 'respostas',
        endpoint: `/api/pdi-fichas/${ficha.id}/respostas`, method: 'PUT',
        payload: { respostas }, baseTokenField: 'baseUpdatedAt', baseToken: ficha.updatedAt,
      });
      atualizarFicha(disciplinaId, atual => ({ ...atual, touched: new Set(), salvar: { estado: 'fila', mensagem: 'Sem conexão: respostas guardadas, serão enviadas quando a conexão voltar.' } }));
      return { ok: true, fila: true };
    }
    atualizarFicha(disciplinaId, atual => ({ ...atual, salvar: { estado: 'erro', mensagem: resultado.error } }));
    return { ok: false };
  };

  const salvarTudo = async () => {
    const falhas = [];
    for (const chave of Object.keys(blocosRef.current)) {
      const r = await salvarBloco(chave);
      if (!r.ok) falhas.push({ bloco: chave });
    }
    for (const disciplinaId of Object.keys(fichasRef.current)) {
      const r = await salvarFicha(disciplinaId);
      if (!r.ok) falhas.push({ disciplinaId: Number(disciplinaId) });
    }
    return falhas;
  };

  const temAlgoParaSalvar = () => Object.values(fichasRef.current).some(f => f.dados?.editavelAgora && f.touched.size > 0)
    || Object.values(blocosRef.current).some(b => b.editavelAgora && b.touched.size > 0);

  const handleSalvar = async () => {
    setMensagem('');
    setMensagemErro('');
    setResultadoConclusao(null);
    if (!temAlgoParaSalvar()) { setMensagem('Nada novo para salvar.'); return; }
    setOcupado('salvando');
    setStatusLocal('saving');
    const falhas = await salvarTudo();
    setOcupado(null);
    setStatusLocal(falhas.length ? 'idle' : 'saved');
    if (falhas.length) setMensagemErro('Algumas partes não foram salvas — veja os avisos em vermelho abaixo. O que foi salvo nas outras disciplinas continua salvo; clique em "Salvar" para reenviar.');
  };

  const handleVoltar = async () => {
    if (bloqueado) return;
    if (!temAlgoParaSalvar()) { navigate('/pdi/meus-pdis'); return; }
    setOcupado('salvando');
    setStatusLocal('saving');
    const falhas = await salvarTudo();
    setOcupado(null);
    if (falhas.length) {
      setStatusLocal('idle');
      setMensagemErro('Algumas partes não foram salvas — veja os avisos em vermelho abaixo. Nada foi perdido: corrija/reenvie antes de sair.');
      return;
    }
    navigate('/pdi/meus-pdis');
  };

  // Conclusão continua por Ficha (cada disciplina conclui sozinha, regra do backend). "Concluir"
  // de uma disciplina e "Concluir todas" usam a mesma chamada de sempre, uma Ficha por vez.
  const concluirUma = async (disciplinaId) => {
    const f = fichasRef.current[disciplinaId];
    const resultado = await concluirFichaPdi(f.dados.ficha.id);
    if (!resultado.ok) return { ok: false, mensagem: resultado.error };
    atualizarFicha(disciplinaId, atual => ({ ...atual, dados: { ...atual.dados, ficha: resultado.ficha, respostas: resultado.respostas, editavelAgora: resultado.editavelAgora }, salvar: { estado: 'concluida', mensagem: '' } }));
    const bloco = Object.values(blocosRef.current).find(b => b.fichaIds.includes(f.dados.ficha.id));
    if (bloco && resultado.blocoPadrao) aplicarBlocoDoServidor(bloco.chave, resultado.blocoPadrao);
    return { ok: true };
  };

  const concluir = async (disciplinaIds) => {
    setMensagem('');
    setMensagemErro('');
    setResultadoConclusao(null);
    if (!online) {
      // Conclusão definitiva exige conexão (mesma regra da tela de UMA Ficha) — ainda salva/enfileira.
      setOcupado('salvando');
      await salvarTudo();
      setOcupado(null);
      setMensagemErro('Para concluir, é necessário estar conectado. Suas respostas estão protegidas e poderão ser concluídas assim que a conexão voltar.');
      return;
    }
    setOcupado('concluindo');
    const falhas = await salvarTudo();
    const resultados = [];
    for (const disciplinaId of disciplinaIds) {
      const f = fichasRef.current[disciplinaId];
      const bloco = Object.values(blocosRef.current).find(b => b.fichaIds.includes(f.dados.ficha.id));
      const falhouAoSalvar = falhas.some(item => item.disciplinaId === disciplinaId || (bloco && item.bloco === bloco.chave));
      if (falhouAoSalvar) {
        resultados.push({ disciplinaNome: f.disciplinaNome, ok: false, mensagem: 'não concluída: há respostas desta disciplina (ou das perguntas comuns) que não foram salvas.' });
        continue;
      }
      const r = await concluirUma(disciplinaId);
      resultados.push({ disciplinaNome: f.disciplinaNome, ok: r.ok, mensagem: r.ok ? 'concluída.' : r.mensagem });
    }
    setOcupado(null);
    setStatusLocal('idle');
    setResultadoConclusao(resultados);
  };

  const disciplinasConcluiveis = Object.values(fichas).filter(f => f.dados?.editavelAgora && f.dados.ficha.status !== 'concluida').map(f => f.disciplinaId);

  if (carregando) {
    return <MainLayout><Card className="py-12 text-center"><p className="text-slate-500">Carregando formulário do aluno...</p></Card></MainLayout>;
  }
  if (erro) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">{erro}</p><Button className="mt-4" onClick={() => navigate('/pdi/meus-pdis')}>Voltar</Button></Card></MainLayout>;
  }
  if (linhas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma disciplina disponível" description="Você não leciona, hoje, nenhuma disciplina com PDI nesta Aplicação para este aluno." />
        <div className="mt-4 text-center"><Button onClick={() => navigate('/pdi/meus-pdis')}>Voltar para Meus PDIs</Button></div>
      </MainLayout>
    );
  }

  const referencia = Object.values(fichas).find(f => f.dados)?.dados.ficha;
  const linha0 = linhas[0];

  const renderAvisoSalvar = (salvar, onTentar) => {
    if (!salvar || salvar.estado === 'salvo' || salvar.estado === 'concluida') return null;
    const cor = salvar.estado === 'fila' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800';
    return (
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${cor}`}>
        <span>{salvar.estado === 'erro' ? `Não salvo: ${salvar.mensagem}` : salvar.mensagem}</span>
        {salvar.estado === 'erro' && <Button size="sm" variant="outline" onClick={onTentar} disabled={bloqueado}>Tentar novamente</Button>}
        {salvar.estado === 'conflito' && <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleVoltar} disabled={bloqueado} className="text-sm font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">{ocupado === 'salvando' ? 'Salvando...' : '← Voltar'}</button>
              <SavingIndicator estado={statusLocal} />
            </div>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">PDI do aluno</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{referencia?.alunoNome ?? linha0.alunoNome}</h1>
            <p className="mt-2 text-slate-600">{referencia?.turmaNome ?? linha0.turmaNome} · {referencia?.escolaNome ?? linha0.escolaNome}</p>
          </div>
          <Link to={`/pdi/alunos/${alunoId}/anamnese`}><Button variant="outline">Ver Anamnese</Button></Link>
        </div>

        {mensagemErro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{mensagemErro}</div>}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {resultadoConclusao && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-slate-800">Resultado da conclusão</p>
            <ul className="mt-2 space-y-1">
              {resultadoConclusao.map(item => (
                <li key={item.disciplinaNome} className={item.ok ? 'text-emerald-700' : 'text-red-700'}><strong>{item.disciplinaNome}</strong>: {item.mensagem}</li>
              ))}
            </ul>
          </div>
        )}

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Vigência da aplicação</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(linha0.dataInicio)} a {formatFullDate(linha0.dataFim)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(fichas).map(f => (
              <Badge key={f.disciplinaId} variant={f.dados ? STATUS_VARIANT[f.dados.ficha.status] : 'red'}>{f.disciplinaNome}: {f.dados ? STATUS_LABEL[f.dados.ficha.status] : 'erro'}</Badge>
            ))}
          </div>
        </Card>

        {Object.values(blocos).map(bloco => (
          <Card key={bloco.chave}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Perguntas comuns</p>
              <Badge variant={bloco.editavelAgora ? 'green' : 'gray'}>{bloco.editavelAgora ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Respondidas uma única vez{bloco.disciplinas.length > 1 ? ` para: ${bloco.disciplinas.join(', ')}` : ''}. Cada disciplina continua com seu próprio status e conclusão.
            </p>
            {Object.keys(blocos).length > 1 && (
              <p className="mt-1 text-xs font-semibold text-amber-700">O professor responsável mudou durante esta Aplicação: estas disciplinas têm um bloco comum separado.</p>
            )}
            {renderAvisoSalvar(bloco.salvar, handleSalvar)}
            <div className="mt-3">
              {bloco.perguntas.map(question => (
                <CampoPergunta key={question.id} question={question} value={bloco.answers[question.id]} onChange={valor => atualizarRespostaBloco(bloco.chave, question, valor)} editavel={bloco.editavelAgora} bloqueado={bloqueado} />
              ))}
            </div>
          </Card>
        ))}

        {Object.values(fichas).map(f => {
          if (f.carregando) return <Card key={f.disciplinaId}><p className="text-slate-500">Carregando {f.disciplinaNome}...</p></Card>;
          if (!f.dados) {
            return (
              <Card key={f.disciplinaId}>
                <p className="text-xl font-bold text-slate-950">{f.disciplinaNome}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  <span>Não foi possível abrir esta disciplina: {f.erroCarga}</span>
                  <Button size="sm" variant="outline" onClick={() => tentarCarregarDeNovo(f.disciplinaId)} disabled={bloqueado}>Tentar novamente</Button>
                </div>
              </Card>
            );
          }
          const { ficha, perguntas, editavelAgora } = f.dados;
          const faltando = faltandoNaFicha(f);
          const concluida = ficha.status === 'concluida';
          return (
            <Card key={f.disciplinaId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-bold text-slate-950">{f.disciplinaNome}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[ficha.status]}>{STATUS_LABEL[ficha.status]}</Badge>
                  <Badge variant={editavelAgora ? 'green' : 'gray'}>{editavelAgora ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
                </div>
              </div>
              {!concluida && editavelAgora && (
                <p className="mt-1 text-xs font-semibold text-slate-500">{faltando === 0 ? 'Tudo respondido — pode concluir.' : `Faltam ${faltando} ${faltando === 1 ? 'pergunta' : 'perguntas'} (incluindo as comuns) para concluir.`}</p>
              )}
              {renderAvisoSalvar(f.salvar, handleSalvar)}
              {perguntas.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nenhuma pergunta específica desta disciplina — só as perguntas comuns acima.</p>
              ) : agruparPorSecao(perguntas).map(secao => (
                <div key={secao.nome} className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{secao.nome}</p>
                  {secao.subsecoes.map(subsecao => (
                    <div key={subsecao.nome || 'default'} className="mt-2">
                      {subsecao.nome && <p className="mb-2 text-xs font-semibold text-slate-400">{subsecao.nome}</p>}
                      {subsecao.questions.map(question => (
                        <CampoPergunta key={question.id} question={question} value={f.answers[question.id]} onChange={valor => atualizarResposta(f.disciplinaId, question, valor)} editavel={editavelAgora} bloqueado={bloqueado} disciplinaId={ficha.disciplinaId} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {editavelAgora && !concluida && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => concluir([f.disciplinaId])} disabled={bloqueado || faltando > 0}>Concluir {f.disciplinaNome}</Button>
                </div>
              )}
            </Card>
          );
        })}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={handleSalvar} disabled={bloqueado}>{ocupado === 'salvando' ? 'Salvando...' : 'Salvar'}</Button>
          {disciplinasConcluiveis.length > 1 && (
            <Button onClick={() => concluir(disciplinasConcluiveis)} disabled={bloqueado}>{ocupado === 'concluindo' ? 'Concluindo...' : 'Concluir todas as disciplinas'}</Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

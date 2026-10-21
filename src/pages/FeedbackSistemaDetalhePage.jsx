import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField } from '../components/Common';
import { inputClass } from '../utils/display';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_LABEL, STATUS_OPTIONS, STATUS_VARIANT, RESPOSTAS_PRONTAS, categoriaLabel,
  obterMeuFeedbackReal, responderMeuFeedbackReal,
  obterFeedbackSistemaReal, responderFeedbackSistemaReal, mudarStatusFeedbackSistemaReal,
} from '../services/feedbackSistema';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { MainLayout } from '../layouts/Layouts';

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

const EVENTO_TEXTO = {
  CRIACAO: () => 'Feedback criado',
  MUDANCA_STATUS: (e) => `Status alterado para "${STATUS_LABEL[e.statusNovo] ?? e.statusNovo}"`,
  REABERTURA_AUTOMATICA: () => 'Reaberto automaticamente (nova mensagem após estar resolvido)',
};

// Detalhe de UM feedback — usado tanto por quem enviou ("Meus feedbacks") quanto por
// SUPORTE_SISTEMA (caixa global). A URL decide o modo: /feedback-sistema/meus/:id é sempre
// escopado ao próprio autor (backend garante); /feedback-sistema/:id exige SUPORTE_SISTEMA.
export const FeedbackSistemaDetalhePage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.email?.toLowerCase();
  const comoSuporte = !location.pathname.startsWith('/feedback-sistema/meus/');
  const draftKey = `${userId}::feedback-resposta::${id}`;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState(location.state?.mensagemSucesso || '');
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [statusEscolhido, setStatusEscolhido] = useState('');
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await (comoSuporte ? obterFeedbackSistemaReal(id) : obterMeuFeedbackReal(id));
      setDados(resultado);
      setStatusEscolhido(resultado.status);
      // Restaura rascunho local da resposta ainda não enviada (sobrevive a reload/fechamento).
      const draft = await lerDraft(draftKey);
      if (draft?.resposta) setResposta(draft.resposta);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salvamento local com debounce leve — nunca envia nada por conta própria (continuidade da
  // conversa continua sendo uma ação explícita, seção "Mensagens"/"Feedback" do pedido).
  useEffect(() => {
    if (!resposta.trim()) return undefined;
    const t = setTimeout(() => salvarDraft(draftKey, { userId, resposta, savedAt: Date.now() }), 500);
    return () => clearTimeout(t);
  }, [resposta, draftKey, userId]);

  const enviarResposta = async (event) => {
    event.preventDefault();
    if (!resposta.trim()) return;
    const texto = resposta.trim();
    setEnviando(true);
    setErro('');
    try {
      await (comoSuporte ? responderFeedbackSistemaReal(id, texto) : responderMeuFeedbackReal(id, texto));
      setResposta('');
      apagarDraft(draftKey);
      setMensagem('');
      await carregar();
    } catch (error) {
      if (!error.codigo && /conectar ao servidor/.test(error.message || '')) {
        await enfileirar({
          userId, resourceType: 'feedback-resposta', resourceId: id, operation: comoSuporte ? 'responder-suporte' : 'responder-autor',
          endpoint: comoSuporte ? `/api/feedback-sistema/${id}/responder` : `/api/feedback-sistema/meus/${id}/responder`,
          method: 'POST', payload: { conteudo: texto }, baseTokenField: '_semVersao', baseToken: null,
        });
        setResposta('');
        apagarDraft(draftKey);
        setMensagem('Sem conexão — sua resposta foi protegida e será enviada automaticamente quando a conexão voltar.');
        return;
      }
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const aplicarStatus = async () => {
    if (!statusEscolhido || statusEscolhido === dados.status) return;
    setMudandoStatus(true);
    setErro('');
    try {
      await mudarStatusFeedbackSistemaReal(id, statusEscolhido);
      await carregar();
    } catch (error) {
      setErro(error.message);
    } finally {
      setMudandoStatus(false);
    }
  };

  if (carregando) return <MainLayout><p className="text-center text-slate-500">Carregando...</p></MainLayout>;
  if (erro && !dados) return (
    <MainLayout>
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>
    </MainLayout>
  );
  if (!dados) return null;

  // Linha do tempo combinada (mensagens + eventos estruturais), ordenada por data.
  const linhaDoTempo = [
    ...dados.mensagens.map((m) => ({ tipo: 'mensagem', data: m.createdAt, item: m })),
    ...dados.eventos.filter((e) => e.tipo !== 'CRIACAO').map((e) => ({ tipo: 'evento', data: e.createdAt, item: e })),
  ].sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={comoSuporte ? '/feedback-sistema' : '/feedback-sistema/meus'} className="text-sm font-semibold text-teal-700 hover:underline">
            ← {comoSuporte ? 'Feedbacks do sistema' : 'Meus feedbacks'}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{dados.assunto}</h1>
          <p className="mt-1 text-slate-600">{categoriaLabel(dados.categoria)} · {dados.autorNome}{dados.escolaNome ? ` · ${dados.escolaNome}` : ''} · {formatarDataHora(dados.createdAt)}</p>
        </div>

        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={STATUS_VARIANT[dados.status]}>{STATUS_LABEL[dados.status]}</Badge>
            {comoSuporte && (
              <div className="flex flex-wrap items-center gap-2">
                <select className={`${inputClass} w-auto`} value={statusEscolhido} onChange={(event) => setStatusEscolhido(event.target.value)}>
                  {STATUS_OPTIONS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={aplicarStatus} disabled={mudandoStatus || statusEscolhido === dados.status}>
                  {mudandoStatus ? 'Salvando...' : 'Alterar status'}
                </Button>
              </div>
            )}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{dados.descricao}</p>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Conversa</p>
          <ul className="mt-3 space-y-3">
            {linhaDoTempo.length === 0 && <li className="text-sm text-slate-500">Nenhuma resposta ainda.</li>}
            {linhaDoTempo.map(({ tipo, item }) => (
              tipo === 'mensagem' ? (
                <li key={`m${item.id}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">{item.autorNome}{item.autorPerfil === 'SUPORTE_SISTEMA' ? ' (Suporte)' : ''}</span>
                    <span className="text-xs text-slate-500">{formatarDataHora(item.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-slate-700">{item.conteudo}</p>
                </li>
              ) : (
                <li key={`e${item.id}`} className="text-center text-xs italic text-slate-500">
                  {(EVENTO_TEXTO[item.tipo] || (() => item.tipo))(item)} · {formatarDataHora(item.createdAt)}
                </li>
              )
            ))}
          </ul>
        </Card>

        <Card>
          {comoSuporte && (
            <div className="mb-3 flex flex-wrap gap-2">
              {RESPOSTAS_PRONTAS.map((rp) => (
                <Button key={rp.titulo} type="button" size="sm" variant="outline" onClick={() => setResposta(rp.texto)}>{rp.titulo}</Button>
              ))}
            </div>
          )}
          <form onSubmit={enviarResposta} className="space-y-3">
            <FormField label="Responder">
              <textarea className={`${inputClass} resize-none`} rows="4" value={resposta} onChange={(event) => setResposta(event.target.value)} placeholder="Escreva sua mensagem..." />
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" disabled={enviando || !resposta.trim()}>{enviando ? 'Enviando...' : 'Enviar'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
};

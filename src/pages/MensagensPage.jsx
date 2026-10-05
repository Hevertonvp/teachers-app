import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  listarConversasReais, listarDestinatariosReais, obterConversaReal,
  criarConversaReal, responderConversaReal, ocultarConversaReal,
} from '../services/mensagens';
import { MainLayout } from '../layouts/Layouts';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100';
const emptyCompose = { escolaId: '', destinatarioIds: [], assunto: '', conteudo: '' };

const formatDate = (date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

// Botão de anexo — infraestrutura de upload fica pra depois (seção 17 do pedido): só avisa.
const BotaoAnexo = () => {
  const [aviso, setAviso] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAviso(true)}
        title="Anexar arquivo"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50"
      >
        📎
      </button>
      {aviso && (
        <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg" onMouseLeave={() => setAviso(false)}>
          Anexos ainda não estão disponíveis.
        </div>
      )}
    </div>
  );
};

export const MensagensPage = () => {
  const { user } = useAuth();
  const { loadMensagensNaoLidas } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('entrada');
  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState(emptyCompose);
  const [escolasDisponiveis, setEscolasDisponiveis] = useState([]);
  const [destinatarios, setDestinatarios] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [composeError, setComposeError] = useState('');

  const carregarConversas = async () => {
    setCarregando(true);
    setErro('');
    try {
      setConversas(await listarConversasReais());
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarConversas(); }, []);

  const incoming = conversas.filter(c => !c.iniciadaPorMim);
  const sent = conversas.filter(c => c.iniciadaPorMim);
  const unread = conversas.filter(c => c.naoLidas > 0);
  const visibleConversas = tab === 'enviadas' ? sent : tab === 'naoLidas' ? unread : incoming;

  const abrirConversa = async (id) => {
    setSelectedId(id);
    setThread(null);
    setRespostaTexto('');
    try {
      const detalhe = await obterConversaReal(id);
      setThread(detalhe);
      await carregarConversas();
      await loadMensagensNaoLidas();
    } catch (error) {
      setMensagem(error.message);
      setSelectedId(null);
    }
  };

  // Clique numa notificação de "nova mensagem" leva direto pra conversa (seção 12 do pedido) —
  // link vem como /mensagens?conversa=ID. Limpa o parâmetro depois de abrir pra não reabrir ao
  // navegar de volta pra esta página.
  useEffect(() => {
    const conversaId = searchParams.get('conversa');
    if (!conversaId) return;
    abrirConversa(Number(conversaId));
    setSearchParams((prev) => { prev.delete('conversa'); return prev; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const enviarResposta = async (event) => {
    event.preventDefault();
    if (!respostaTexto.trim()) return;
    setEnviandoResposta(true);
    try {
      await responderConversaReal(selectedId, respostaTexto.trim());
      setRespostaTexto('');
      setThread(await obterConversaReal(selectedId));
      await carregarConversas();
    } catch (error) {
      setMensagem(error.message);
    } finally {
      setEnviandoResposta(false);
    }
  };

  const excluirParaMim = async () => {
    try {
      await ocultarConversaReal(selectedId);
      setSelectedId(null);
      setThread(null);
      await carregarConversas();
      setMensagem('Conversa removida da sua caixa. Ela continua existindo para a outra pessoa.');
    } catch (error) {
      setMensagem(error.message);
    }
  };

  // --- Composição ------------------------------------------------------------------------
  const abrirCompose = async () => {
    setComposeError('');
    setForm(emptyCompose);
    setDestinatarios([]);
    try {
      const resultado = await listarDestinatariosReais();
      setEscolasDisponiveis(resultado.escolas || []);
      setDestinatarios(resultado.destinatarios || []);
      if ((resultado.escolas || []).length <= 1 && (resultado.destinatarios || []).length > 0) {
        setForm(prev => ({ ...prev, escolaId: resultado.escolas[0]?.id ?? '' }));
      }
    } catch (error) {
      setComposeError(error.message);
    }
    setComposeOpen(true);
  };

  const escolherEscola = async (escolaId) => {
    setForm(prev => ({ ...prev, escolaId, destinatarioIds: [] }));
    try {
      const resultado = await listarDestinatariosReais(escolaId);
      setDestinatarios(resultado.destinatarios || []);
    } catch (error) {
      setComposeError(error.message);
    }
  };

  const podeEnviarEmMassa = user?.tipo === 'secretaria' || user?.tipo === 'diretora' || user?.tipo === 'gestor';

  const toggleDestinatario = (destinatario) => {
    setForm(prev => {
      const chave = `${destinatario.pessoaId}:${destinatario.escolaId}`;
      const jaSelecionado = prev.destinatarioIds.some(d => `${d.pessoaId}:${d.escolaId}` === chave);
      if (jaSelecionado) return { ...prev, destinatarioIds: prev.destinatarioIds.filter(d => `${d.pessoaId}:${d.escolaId}` !== chave) };
      if (!podeEnviarEmMassa) return { ...prev, destinatarioIds: [{ pessoaId: destinatario.pessoaId, escolaId: destinatario.escolaId }] };
      return { ...prev, destinatarioIds: [...prev.destinatarioIds, { pessoaId: destinatario.pessoaId, escolaId: destinatario.escolaId }] };
    });
  };

  const enviarNovaConversa = async (event) => {
    event.preventDefault();
    setComposeError('');
    if (form.destinatarioIds.length === 0) {
      setComposeError('Selecione ao menos um destinatário.');
      return;
    }
    setEnviando(true);
    try {
      const resultado = await criarConversaReal({ destinatarios: form.destinatarioIds, assunto: form.assunto.trim(), conteudo: form.conteudo.trim() });
      setComposeOpen(false);
      setMensagem(resultado.conversas.length > 1 ? `Mensagem enviada para ${resultado.conversas.length} pessoas.` : 'Mensagem enviada com sucesso.');
      setTab('enviadas');
      await carregarConversas();
    } catch (error) {
      setComposeError(error.message);
    } finally {
      setEnviando(false);
    }
  };

  const escolaEscolhidaNome = escolasDisponiveis.find(e => e.id === Number(form.escolaId))?.nome;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Comunicação interna</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Mensagens</h1>
            <p className="mt-2 text-slate-600">Caixa de entrada para comunicações formais da equipe.</p>
          </div>
          <Button onClick={abrirCompose}>Nova mensagem</Button>
        </div>

        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregarConversas}>Tentar novamente</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {[['entrada', 'Caixa de entrada', incoming.length], ['enviadas', 'Enviadas', sent.length], ['naoLidas', 'Não lidas', unread.length]].map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {carregando ? (
          <Card><p className="text-center text-slate-500">Carregando...</p></Card>
        ) : visibleConversas.length ? (
          <div className="space-y-3">
            {visibleConversas.map(conversa => (
              <button key={conversa.id} type="button" onClick={() => abrirConversa(conversa.id)} className={`block w-full rounded-xl border p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/30 ${conversa.naoLidas > 0 ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {conversa.naoLidas > 0 && <span className="h-2.5 w-2.5 rounded-full bg-teal-600" aria-label="Não lida" />}
                      <p className="font-bold text-slate-900">{conversa.assunto}</p>
                      {conversa.naoLidas > 0 && <Badge variant="blue">{conversa.naoLidas} não lida{conversa.naoLidas > 1 ? 's' : ''}</Badge>}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{conversa.iniciadaPorMim ? 'Para' : 'De'}: {conversa.outraPessoa?.nome} <span className="font-normal text-slate-500">· {conversa.outraPessoa?.perfil}</span></p>
                    <p className="mt-1 text-sm text-slate-600">{conversa.ultimaMensagemTrecho}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{conversa.escolaNome}{conversa.loteId ? ' · envio em massa' : ''}</p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500">{formatDate(conversa.ultimaMensagemEm)}</time>
                </div>
              </button>
            ))}
          </div>
        ) : <EmptyState title="Nenhuma mensagem" description="Sua caixa de entrada não possui mensagens neste filtro." />}
      </div>

      {selectedId && (
        <Modal title={thread?.assunto || 'Conversa'} onClose={() => { setSelectedId(null); setThread(null); }}>
          {!thread ? (
            <p className="text-center text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Com</p><p className="font-semibold text-slate-900">{thread.outraPessoa?.nome} <span className="font-normal text-slate-500">({thread.outraPessoa?.perfil})</span></p></div>
                <div><p className="text-slate-500">Escola</p><p className="font-semibold text-slate-900">{thread.escolaNome}</p></div>
              </div>

              <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                {thread.mensagens.map(msg => (
                  <div key={msg.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${msg.remetenteId === thread.outraPessoa?.id ? 'bg-white' : 'ml-auto bg-teal-100'}`}>
                    <p className="mb-1 text-xs font-semibold text-slate-500">{msg.remetenteNome} · {formatDate(msg.createdAt)}</p>
                    <p className="whitespace-pre-wrap text-slate-800">{msg.conteudo}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={enviarResposta} className="space-y-2">
                <textarea className={inputClass} rows="3" placeholder="Responder..." value={respostaTexto} onChange={event => setRespostaTexto(event.target.value)} />
                <div className="flex items-center justify-between gap-3">
                  <BotaoAnexo />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={excluirParaMim}>Excluir para mim</Button>
                    <Button type="submit" disabled={enviandoResposta || !respostaTexto.trim()}>{enviandoResposta ? 'Enviando...' : 'Responder'}</Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </Modal>
      )}

      {composeOpen && (
        <Modal title="Nova mensagem" onClose={() => setComposeOpen(false)}>
          <form onSubmit={enviarNovaConversa} className="space-y-4">
            {composeError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{composeError}</div>}

            {escolasDisponiveis.length > 1 && (
              <FormField label="Escola">
                <select className={inputClass} value={form.escolaId} onChange={event => escolherEscola(Number(event.target.value))} required>
                  <option value="" disabled>Selecione a escola</option>
                  {escolasDisponiveis.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>
            )}

            {(escolasDisponiveis.length <= 1 || form.escolaId) && (
              <FormField label={podeEnviarEmMassa ? 'Destinatários (pode selecionar vários)' : 'Destinatário'}>
                {destinatarios.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum destinatário disponível{escolaEscolhidaNome ? ` em ${escolaEscolhidaNome}` : ''}.</p>
                ) : (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-300 p-3">
                    {destinatarios.map(destinatario => {
                      const chave = `${destinatario.pessoaId}:${destinatario.escolaId}`;
                      const marcado = form.destinatarioIds.some(d => `${d.pessoaId}:${d.escolaId}` === chave);
                      return (
                        <label key={chave} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type={podeEnviarEmMassa ? 'checkbox' : 'radio'} name="destinatario" checked={marcado} onChange={() => toggleDestinatario(destinatario)} />
                          {destinatario.nome} <span className="text-xs text-slate-400">· {destinatario.perfil}{destinatario.escolaNome ? ` · ${destinatario.escolaNome}` : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </FormField>
            )}

            <FormField label="Assunto"><input className={inputClass} value={form.assunto} onChange={event => setForm(prev => ({ ...prev, assunto: event.target.value }))} required /></FormField>
            <FormField label="Mensagem"><textarea className={inputClass} rows="6" value={form.conteudo} onChange={event => setForm(prev => ({ ...prev, conteudo: event.target.value }))} required /></FormField>

            <div className="flex items-center justify-between gap-3">
              <BotaoAnexo />
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setComposeOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={enviando}>{enviando ? 'Enviando...' : (form.destinatarioIds.length > 1 ? `Enviar para ${form.destinatarioIds.length} pessoas` : 'Enviar mensagem')}</Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </MainLayout>
  );
};

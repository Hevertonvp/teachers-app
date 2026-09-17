import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { getAllowedRecipients, identityKey, personName } from '../utils/mensagens';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100';
const emptyForm = { recipientKey: '', escolaId: '', assunto: '', corpo: '', respondendoA: null };

const formatDate = (date) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(date));

const messageExcerpt = (body) => body.length > 110 ? `${body.slice(0, 110)}...` : body;

export const MensagensPage = () => {
  const { user } = useAuth();
  const { escolas, gestores, diretores, professores, secretarias, vinculosEscolares, mensagens, criarMensagem, marcarMensagemComoLida } = useData();
  const { activeEscolaId } = useEscola();
  const location = useLocation();
  const [tab, setTab] = useState('entrada');
  const [selected, setSelected] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sendToAll, setSendToAll] = useState(false);
  const [error, setError] = useState('');

  const peopleData = { gestores, diretores, professores, secretarias, vinculosEscolares };
  const identity = identityKey(user?.tipo, user?.id);
  const recipients = useMemo(() => getAllowedRecipients(user, peopleData), [user, gestores, diretores, professores, secretarias, vinculosEscolares]);
  const diretoraRecipients = useMemo(() => recipients.filter(recipient => recipient.tipo === 'diretora'), [recipients]);
  const incoming = mensagens.filter(message => identityKey(message.destinatarioTipo, message.destinatarioId) === identity);
  const sent = mensagens.filter(message => identityKey(message.remetenteTipo, message.remetenteId) === identity);
  const unread = incoming.filter(message => !message.lidaEm);
  const visibleMessages = tab === 'enviadas' ? sent : tab === 'naoLidas' ? unread : incoming;

  // Com uma escola selecionada (Secretaria ou Gestor com múltiplas escolas): por padrão a
  // mensagem vai para a diretoria daquela escola, em vez do primeiro destinatário da lista.
  const diretorDaEscolaAtiva = activeEscolaId !== null
    ? recipients.find(recipient => recipient.tipo === 'diretora' && recipient.escolaIds.includes(activeEscolaId))
    : null;

  const openNewMessage = () => {
    setError('');
    const defaultRecipient = diretorDaEscolaAtiva || recipients[0];
    setForm({ ...emptyForm, recipientKey: defaultRecipient?.key || '', escolaId: diretorDaEscolaAtiva ? activeEscolaId : defaultRecipient?.escolaIds[0] || '' });
    // "Todas as escolas" selecionada no cabeçalho já sugere intenção de envio em massa.
    setSendToAll(activeEscolaId === null && diretoraRecipients.length > 1);
    setComposeOpen(true);
  };

  // Atalho vindo do dashboard (link "Enviar mensagem à diretoria") já abre o formulário direto.
  // Precisa ficar antes do "if (!user) return" abaixo — hooks não podem ser chamados condicionalmente.
  useEffect(() => {
    if (location.state?.openCompose) {
      openNewMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  const recipientByKey = (key) => recipients.find(recipient => recipient.key === key);

  const openMessage = (message) => {
    if (identityKey(message.destinatarioTipo, message.destinatarioId) === identity && !message.lidaEm) {
      marcarMensagemComoLida(message.id, user);
    }
    setSelected(message);
  };

  const startReply = () => {
    const recipientKey = identityKey(selected.remetenteTipo, selected.remetenteId);
    const recipient = recipientByKey(recipientKey);
    if (!recipient) return;
    setError('');
    setForm({
      recipientKey,
      escolaId: selected.escolaId || recipient.escolaIds[0] || '',
      assunto: selected.assunto.startsWith('Re:') ? selected.assunto : `Re: ${selected.assunto}`,
      corpo: '',
      respondendoA: selected.id,
    });
    setSendToAll(false);
    setSelected(null);
    setComposeOpen(true);
  };

  const handleRecipientChange = (event) => {
    const recipient = recipientByKey(event.target.value);
    setForm(prev => ({ ...prev, recipientKey: event.target.value, escolaId: recipient?.escolaIds[0] || '' }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (sendToAll) {
      if (!diretoraRecipients.length) {
        setError('Nenhuma diretoria disponível para envio.');
        return;
      }
      try {
        diretoraRecipients.forEach(recipient => {
          criarMensagem({
            destinatarioTipo: recipient.tipo,
            destinatarioId: recipient.id,
            escolaId: recipient.escolaIds[0] ?? null,
            assunto: form.assunto.trim(),
            corpo: form.corpo.trim(),
            respondendoA: null,
          }, user);
        });
        setForm(emptyForm);
        setSendToAll(false);
        setComposeOpen(false);
        setTab('enviadas');
        setError('');
      } catch (submissionError) {
        setError(submissionError.message);
      }
      return;
    }

    const recipient = recipientByKey(form.recipientKey);
    if (!recipient) {
      setError('Selecione um destinatário válido.');
      return;
    }
    try {
      criarMensagem({
        destinatarioTipo: recipient.tipo,
        destinatarioId: recipient.id,
        escolaId: form.escolaId === '' ? null : Number(form.escolaId),
        assunto: form.assunto.trim(),
        corpo: form.corpo.trim(),
        respondendoA: form.respondendoA,
      }, user);
      setForm(emptyForm);
      setComposeOpen(false);
      setTab('enviadas');
      setError('');
    } catch (submissionError) {
      setError(submissionError.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Comunicação interna</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Mensagens</h1>
            <p className="mt-2 text-slate-600">Caixa de entrada para comunicações formais da equipe.</p>
          </div>
          <Button onClick={openNewMessage} disabled={!recipients.length}>Nova mensagem</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[['entrada', 'Caixa de entrada', incoming.length], ['enviadas', 'Enviadas', sent.length], ['naoLidas', 'Não lidas', unread.length]].map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>
          ))}
          <Badge variant={unread.length ? 'red' : 'green'}>{unread.length} não lida(s)</Badge>
        </div>

        {visibleMessages.length ? (
          <div className="space-y-3">
            {visibleMessages.map(message => {
              const isIncoming = identityKey(message.destinatarioTipo, message.destinatarioId) === identity;
              const counterpart = isIncoming
                ? personName(message.remetenteTipo, message.remetenteId, peopleData)
                : personName(message.destinatarioTipo, message.destinatarioId, peopleData);
              const escola = escolas.find(item => item.id === message.escolaId);
              return (
                <button key={message.id} type="button" onClick={() => openMessage(message)} className={`block w-full rounded-xl border p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/30 ${!message.lidaEm && isIncoming ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!message.lidaEm && isIncoming && <span className="h-2.5 w-2.5 rounded-full bg-teal-600" aria-label="Não lida" />}
                        <p className="font-bold text-slate-900">{message.assunto}</p>
                        <Badge variant={isIncoming ? 'blue' : 'gray'}>{isIncoming ? 'Recebida' : 'Enviada'}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{isIncoming ? 'De' : 'Para'}: {counterpart}</p>
                      <p className="mt-1 text-sm text-slate-600">{messageExcerpt(message.corpo)}</p>
                      {escola && <p className="mt-2 text-xs font-semibold text-slate-500">{escola.nome}</p>}
                    </div>
                    <time className="shrink-0 text-xs text-slate-500">{formatDate(message.enviadaEm)}</time>
                  </div>
                </button>
              );
            })}
          </div>
        ) : <EmptyState title="Nenhuma mensagem" description="Sua caixa de entrada não possui mensagens neste filtro." />}
      </div>

      {selected && (
        <Modal title={selected.assunto} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-slate-500">Remetente</p><p className="font-semibold text-slate-900">{personName(selected.remetenteTipo, selected.remetenteId, peopleData)}</p></div>
              <div><p className="text-slate-500">Destinatário</p><p className="font-semibold text-slate-900">{personName(selected.destinatarioTipo, selected.destinatarioId, peopleData)}</p></div>
              <div><p className="text-slate-500">Data</p><p className="font-semibold text-slate-900">{formatDate(selected.enviadaEm)}</p></div>
              {selected.escolaId && <div><p className="text-slate-500">Escola</p><p className="font-semibold text-slate-900">{escolas.find(item => item.id === selected.escolaId)?.nome}</p></div>}
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.corpo}</div>
            {identityKey(selected.destinatarioTipo, selected.destinatarioId) === identity && recipientByKey(identityKey(selected.remetenteTipo, selected.remetenteId)) && <div className="flex justify-end"><Button onClick={startReply}>Responder</Button></div>}
          </div>
        </Modal>
      )}

      {composeOpen && (
        <Modal title={form.respondendoA ? 'Responder mensagem' : 'Nova mensagem'} onClose={() => setComposeOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}
            {!form.respondendoA && diretoraRecipients.length > 1 && (
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={sendToAll} onChange={event => setSendToAll(event.target.checked)} />
                Enviar para todas as escolas ({diretoraRecipients.length} diretorias)
              </label>
            )}
            {sendToAll ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Destinatários desta mensagem:</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {diretoraRecipients.map(recipient => (
                    <li key={recipient.key}>{recipient.nome} — {escolas.find(escola => escola.id === recipient.escolaIds[0])?.nome || 'Escola não informada'}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <FormField label="Destinatário">
                  <select className={inputClass} value={form.recipientKey} onChange={handleRecipientChange} required>
                    <option value="">Selecione</option>
                    {recipients.map(recipient => <option key={recipient.key} value={recipient.key}>{recipient.nome}{recipient.cargo ? ` · ${recipient.cargo}` : ''}</option>)}
                  </select>
                </FormField>
                {recipientByKey(form.recipientKey)?.escolaIds.length > 0 && <FormField label="Escola relacionada">
                  <select className={inputClass} value={form.escolaId} onChange={event => setForm(prev => ({ ...prev, escolaId: event.target.value }))} required>
                    {recipientByKey(form.recipientKey).escolaIds.map(escolaId => <option key={escolaId} value={escolaId}>{escolas.find(escola => escola.id === escolaId)?.nome}</option>)}
                  </select>
                </FormField>}
              </>
            )}
            <FormField label="Assunto"><input className={inputClass} value={form.assunto} onChange={event => setForm(prev => ({ ...prev, assunto: event.target.value }))} required /></FormField>
            <FormField label="Mensagem"><textarea className={inputClass} rows="7" value={form.corpo} onChange={event => setForm(prev => ({ ...prev, corpo: event.target.value }))} required /></FormField>
            <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setComposeOpen(false)}>Cancelar</Button><Button type="submit">{sendToAll ? `Enviar para ${diretoraRecipients.length} escolas` : 'Enviar mensagem'}</Button></div>
          </form>
        </Modal>
      )}
    </MainLayout>
  );
};

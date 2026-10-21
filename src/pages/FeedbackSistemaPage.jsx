import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, DataTable, EmptyState, FormField } from '../components/Common';
import { inputClass } from '../utils/display';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_LABEL, STATUS_VARIANT, categoriaLabel, listarMeusFeedbacksReais,
  CATEGORIA_OPTIONS, criarFeedbackSistemaReal, capturarContextoTecnico,
} from '../services/feedbackSistema';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { MainLayout } from '../layouts/Layouts';

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const formVazio = { categoria: '', assunto: '', descricao: '' };

const AbaLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
  >
    {children}
  </Link>
);

// Página única "Feedback" (seção 8/23 do pedido de Feedback do Sistema) — "Meus feedbacks" e
// "Novo feedback" nunca são itens separados de menu, só abas internas desta mesma página. As duas
// rotas (/feedback-sistema/meus e /feedback-sistema/novo) continuam existindo só pra manter os
// links diretos de fora (ex.: FeedbackSistemaBanner, redirecionamento após enviar) funcionando.
export const FeedbackSistemaPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const aba = location.pathname.endsWith('/novo') ? 'novo' : 'meus';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="text-3xl font-bold text-slate-950">Feedback</h1>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <AbaLink to="/feedback-sistema/meus" active={aba === 'meus'}>Meus feedbacks</AbaLink>
            <AbaLink to="/feedback-sistema/novo" active={aba === 'novo'}>+ Novo feedback</AbaLink>
          </div>
        </div>

        {aba === 'novo' ? <AbaNovoFeedback user={user} navigate={navigate} /> : <AbaMeusFeedbacks navigate={navigate} />}
      </div>
    </MainLayout>
  );
};

const AbaMeusFeedbacks = ({ navigate }) => {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarMeusFeedbacksReais().then(setItens).catch((error) => setErro(error.message)).finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="text-center text-slate-500">Carregando...</p>;
  if (erro) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>;
  if (itens.length === 0) {
    return (
      <EmptyState title="Nenhum feedback enviado ainda" description='Encontrou um problema ou tem uma sugestão? Clique em "+ Novo feedback".'>
        <Link to="/feedback-sistema/novo"><Button>+ Novo feedback</Button></Link>
      </EmptyState>
    );
  }
  return (
    <DataTable
      columns={[
        { key: 'assunto', header: 'Assunto' },
        { key: 'categoria', header: 'Categoria', render: (item) => categoriaLabel(item.categoria) },
        { key: 'status', header: 'Status', render: (item) => <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge> },
        { key: 'updatedAt', header: 'Última atualização', render: (item) => formatarDataHora(item.updatedAt ?? item.createdAt) },
      ]}
      rows={itens}
      onRowClick={(item) => navigate(`/feedback-sistema/meus/${item.id}`)}
    />
  );
};

const AbaNovoFeedback = ({ user, navigate }) => {
  const userId = user?.email?.toLowerCase();
  const draftKey = `${userId}::novo-feedback::rascunho`;
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    lerDraft(draftKey).then((draft) => { if (draft?.form) setForm(draft.form); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.categoria && !form.assunto && !form.descricao) return undefined;
    const t = setTimeout(() => salvarDraft(draftKey, { userId, form, savedAt: Date.now() }), 500);
    return () => clearTimeout(t);
  }, [form, draftKey, userId]);

  const enviar = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const criado = await criarFeedbackSistemaReal(form);
      apagarDraft(draftKey);
      navigate(`/feedback-sistema/meus/${criado.id}`, { state: { mensagemSucesso: 'Feedback enviado com sucesso. Você pode acompanhar a resposta aqui.' } });
    } catch (error) {
      if (!error.codigo && /conectar ao servidor/.test(error.message || '')) {
        await enfileirar({
          userId, resourceType: 'feedback-sistema', resourceId: 'novo', operation: `criar-${Date.now()}`,
          endpoint: '/api/feedback-sistema', method: 'POST',
          payload: { ...form, ...capturarContextoTecnico() }, baseTokenField: '_semVersao', baseToken: null,
        });
        apagarDraft(draftKey);
        setForm(formVazio);
        navigate('/feedback-sistema/meus', { state: { mensagemSucesso: 'Sem conexão — seu feedback foi protegido neste dispositivo e será enviado automaticamente quando a conexão voltar.' } });
        return;
      }
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5 sm:py-4">
        Este canal é destinado exclusivamente a problemas, dificuldades e sugestões relacionados ao funcionamento do sistema.
        Sua mensagem será enviada diretamente ao desenvolvedor.
      </div>

      <Card>
        <form onSubmit={enviar} className="space-y-4">
          {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

          <FormField label="Categoria">
            <select className={inputClass} value={form.categoria} onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))} required>
              <option value="">Selecione...</option>
              {CATEGORIA_OPTIONS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
            </select>
          </FormField>

          <FormField label="Assunto">
            <input className={inputClass} value={form.assunto} onChange={(event) => setForm((prev) => ({ ...prev, assunto: event.target.value }))} maxLength={200} required />
          </FormField>

          <FormField label="Descrição">
            <textarea className={`${inputClass} resize-none`} rows="6" value={form.descricao} onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))} placeholder="Descreva o que aconteceu, onde, e o que você esperava que acontecesse." required />
          </FormField>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Anexo</span>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Anexos em desenvolvimento
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link to="/feedback-sistema/meus"><Button type="button" variant="secondary" disabled={salvando}>Cancelar</Button></Link>
            <Button type="submit" disabled={salvando}>{salvando ? 'Enviando...' : 'Enviar feedback'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

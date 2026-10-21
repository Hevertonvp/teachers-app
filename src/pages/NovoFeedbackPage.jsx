import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField } from '../components/Common';
import { inputClass } from '../utils/display';
import { useAuth } from '../context/AuthContext';
import { CATEGORIA_OPTIONS, criarFeedbackSistemaReal, capturarContextoTecnico } from '../services/feedbackSistema';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { MainLayout } from '../layouts/Layouts';

const formVazio = { categoria: '', assunto: '', descricao: '' };

// Novo Feedback do Sistema (seções 3-7/20 do pedido) — canal técnico direto ao desenvolvedor,
// nunca a hierarquia pedagógica normal. Sem checkbox de confirmação (seção 4): o aviso é só texto.
// Infra offline: rascunho sobrevive a reload/fechamento; "enviar" offline nunca falha — fica
// protegido numa fila local e sincroniza sozinho quando a conexão voltar (nunca considerado
// "enviado" até a confirmação real do servidor, seção "Feedback do sistema" do pedido).
export const NovoFeedbackPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        navigate('/feedback-sistema/meus', { state: { mensagemSucesso: 'Sem conexão — seu feedback foi protegido neste dispositivo e será enviado automaticamente quando a conexão voltar.' } });
        return;
      }
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Novo feedback</h1>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5 sm:py-4">
          Este canal é destinado exclusivamente a problemas, dificuldades e sugestões relacionados ao funcionamento do sistema.
          Sua mensagem será enviada diretamente ao desenvolvedor. Questões sobre regras do PDI, prazos, decisões pedagógicas,
          organização escolar ou orientações da Secretaria devem ser tratadas com a gestão responsável.
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
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Enviando...' : 'Enviar feedback'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
};

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { formatFullDate } from '../utils/formAvailability';

const blankQuestion = (ordem) => ({ pergunta: '', indicador: '', codigoBncc: '', tipoResposta: 'texto', ordem, status: 'ativa' });

export const FormularioPdiPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pdiPerguntas, formPeriods, createPdiPergunta, updatePdiPergunta, deletePdiPergunta, updateFormPeriod } = useData();
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const questions = [...pdiPerguntas].sort((left, right) => Number(left.ordem) - Number(right.ordem));
  const pdiPeriod = formPeriods.find(period => period.id === 'pdi');

  if (user?.tipo !== 'gestor') {
    return <Navigate to="/dashboard" replace />;
  }

  const reorder = (question, direction) => {
    const index = questions.findIndex(item => item.id === question.id);
    const sibling = questions[index + direction];
    if (!sibling) return;
    updatePdiPergunta(question.id, { ordem: sibling.ordem });
    updatePdiPergunta(sibling.id, { ordem: question.ordem });
  };

  const saveQuestion = (event) => {
    event.preventDefault();
    if (form.id) {
      updatePdiPergunta(form.id, form);
      setMessage('Pergunta atualizada com sucesso.');
    } else {
      createPdiPergunta(form);
      setMessage('Pergunta adicionada com sucesso.');
    }
    setForm(null);
  };

  const savePeriod = (event) => {
    event.preventDefault();
    updateFormPeriod('pdi', { startDate: pdiPeriod.startDate, endDate: pdiPeriod.endDate });
    setMessage('Vigência atualizada com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold text-slate-950">Formulário PDI</h1><p className="mt-2 max-w-3xl text-slate-600">Defina as perguntas e a vigência exibidas aos professores no preenchimento trimestral.</p></div><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button><Button onClick={() => setForm(blankQuestion(questions.length + 1))}>Adicionar pergunta</Button></div></div>
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
        {pdiPeriod && <Card><form onSubmit={savePeriod} className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">Vigência do formulário</p><p className="mt-1 text-sm text-slate-600">Período atual: {formatFullDate(pdiPeriod.startDate)} a {formatFullDate(pdiPeriod.endDate)}</p></div><FormField label="Início"><input className={inputClass} type="date" value={pdiPeriod.startDate} onChange={event => updateFormPeriod('pdi', { startDate: event.target.value })} required /></FormField><FormField label="Encerramento"><input className={inputClass} type="date" value={pdiPeriod.endDate} onChange={event => updateFormPeriod('pdi', { endDate: event.target.value })} required /></FormField><Button type="submit">Salvar vigência</Button></form></Card>}
        <Card className="p-0"><div className="divide-y divide-slate-200">{questions.map((question, index) => <div key={question.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{question.ordem}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{question.pergunta}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="blue">{question.indicador || 'Sem indicador'}</Badge>{question.codigoBncc && <Badge variant="gray">BNCC: {question.codigoBncc}</Badge>}<Badge variant={question.status === 'ativa' ? 'green' : 'gray'}>{question.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={index === 0} onClick={() => reorder(question, -1)}>Subir</Button><Button size="sm" variant="outline" disabled={index === questions.length - 1} onClick={() => reorder(question, 1)}>Descer</Button><Button size="sm" variant="outline" onClick={() => setForm({ ...question })}>Editar</Button><Button size="sm" variant="danger" onClick={() => setDeleting(question)}>Excluir</Button></div></div>)}</div></Card>
        {form && <Modal title={form.id ? 'Editar pergunta' : 'Adicionar pergunta'} onClose={() => setForm(null)}><form onSubmit={saveQuestion} className="space-y-4"><FormField label="Pergunta"><textarea className={inputClass} rows="6" value={form.pergunta} onChange={event => setForm(prev => ({ ...prev, pergunta: event.target.value }))} required /></FormField><div className="grid gap-4 md:grid-cols-2"><FormField label="Indicador BNCC"><input className={inputClass} value={form.indicador} onChange={event => setForm(prev => ({ ...prev, indicador: event.target.value }))} placeholder="Ex.: Leitura e escrita" /></FormField><FormField label="Código BNCC"><input className={inputClass} value={form.codigoBncc} onChange={event => setForm(prev => ({ ...prev, codigoBncc: event.target.value }))} placeholder="Ex.: EF15LP01" /></FormField><FormField label="Status"><select className={inputClass} value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></FormField></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Salvar pergunta</Button></div></form></Modal>}
        {deleting && <ConfirmDialog title="Excluir pergunta" message="Esta pergunta deixará de aparecer nos próximos preenchimentos. Deseja continuar?" onCancel={() => setDeleting(null)} onConfirm={() => { deletePdiPergunta(deleting.id); setDeleting(null); setMessage('Pergunta excluída com sucesso.'); }} />}
      </div>
    </MainLayout>
  );
};
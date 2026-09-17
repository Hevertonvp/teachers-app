import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { formatFullDate } from '../utils/formAvailability';
import { perguntaTipoOptions } from '../utils/pdi';
import { canManagePedagogico } from '../utils/roles';
import { getEscolasAplicaveis, RECURSOS } from '../utils/aplicabilidade';

const tipoLabel = (value) => perguntaTipoOptions.find(option => option.value === value)?.label || value;

const blankQuestion = (ordem) => ({ pergunta: '', tipoResposta: 'texto', opcoes: [], complementar: null, ordem, status: 'ativa' });

export const FormularioPdiPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pdiPerguntas, formPeriods, escolas, createPdiPergunta, updatePdiPergunta, deletePdiPergunta, updateFormPeriodForEscola, setPdiEscolas } = useData();
  const { activeEscolaId, userEscolas } = useEscola();
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const escolasAplicaveis = getEscolasAplicaveis(RECURSOS.PDI, escolas).filter(escola => userEscolas.some(item => item.id === escola.id));
  const pdiEscolaIds = new Set(formPeriods.filter(period => period.id === 'pdi').map(period => Number(period.escolaId)));
  const [escolasSelecionadas, setEscolasSelecionadas] = useState(() => escolasAplicaveis.filter(escola => pdiEscolaIds.has(escola.id)).map(escola => escola.id));
  const questions = [...pdiPerguntas].sort((left, right) => Number(left.ordem) - Number(right.ordem));
  const pdiPeriod = activeEscolaId !== null ? formPeriods.find(period => period.id === 'pdi' && Number(period.escolaId) === Number(activeEscolaId)) : null;

  if (!canManagePedagogico(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const reorder = (question, direction) => {
    const index = questions.findIndex(item => item.id === question.id);
    const sibling = questions[index + direction];
    if (!sibling) return;
    updatePdiPergunta(question.id, { ordem: sibling.ordem });
    updatePdiPergunta(sibling.id, { ordem: question.ordem });
  };

  const changeTipoResposta = (tipoResposta) => {
    setForm(prev => ({
      ...prev,
      tipoResposta,
      opcoes: tipoResposta === 'selecao' ? (prev.opcoes.length ? prev.opcoes : ['', '']) : [],
      complementar: tipoResposta === 'texto' ? null : prev.complementar,
    }));
  };

  const toggleComplementar = (habilitado) => {
    setForm(prev => ({
      ...prev,
      complementar: habilitado
        ? { gatilho: prev.tipoResposta === 'marcacao' ? true : (prev.opcoes.find(opcao => opcao.trim()) || ''), label: prev.complementar?.label || '' }
        : null,
    }));
  };

  const saveQuestion = (event) => {
    event.preventDefault();
    const opcoes = form.tipoResposta === 'selecao' ? form.opcoes.map(opcao => opcao.trim()).filter(Boolean) : [];
    if (form.tipoResposta === 'selecao' && opcoes.length < 2) {
      setMessage('Cadastre ao menos duas opções para uma pergunta de seleção.');
      return;
    }
    if (form.complementar && form.tipoResposta === 'selecao' && !opcoes.includes(form.complementar.gatilho)) {
      setMessage('Escolha qual opção ativa o campo complementar.');
      return;
    }
    if (form.complementar && !form.complementar.label.trim()) {
      setMessage('Informe o texto exibido no campo complementar.');
      return;
    }

    const payload = { ...form, opcoes, complementar: form.tipoResposta === 'texto' ? null : form.complementar };
    if (form.id) {
      updatePdiPergunta(form.id, payload);
      setMessage('Pergunta atualizada com sucesso.');
    } else {
      createPdiPergunta({ ...payload, area: payload.area || 'Geral', indicador: payload.indicador || payload.pergunta.slice(0, 60) });
      setMessage('Pergunta adicionada com sucesso.');
    }
    setForm(null);
  };

  const saveEscolas = () => {
    setPdiEscolas(escolasSelecionadas);
    setMessage('Escolas do PDI atualizadas com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Formulário PDI</h1>
            <p className="mt-2 max-w-3xl text-slate-600">As mesmas perguntas valem para todas as escolas selecionadas abaixo. Defina o texto, o tipo de resposta e, quando necessário, um campo complementar.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button>
            <Button onClick={() => setForm({ ...blankQuestion(questions.length + 1) })}>Adicionar pergunta</Button>
          </div>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <Card>
          <p className="font-semibold text-slate-900">Escolas do PDI</p>
          <p className="mt-1 text-sm text-slate-600">Selecione quais escolas terão este PDI. As perguntas são as mesmas para todas elas.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {escolasAplicaveis.map(escola => (
              <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={escolasSelecionadas.includes(escola.id)}
                  onChange={() => setEscolasSelecionadas(prev => prev.includes(escola.id) ? prev.filter(id => id !== escola.id) : [...prev, escola.id])}
                />
                {escola.nome}
              </label>
            ))}
          </div>
          <div className="mt-4"><Button size="sm" onClick={saveEscolas}>Salvar escolas do PDI</Button></div>
        </Card>

        {activeEscolaId === null
          ? <Card><p className="text-sm text-slate-600">Selecione uma escola específica no topo da página para definir a vigência do preenchimento.</p></Card>
          : pdiPeriod && (
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">Vigência do formulário</p><p className="mt-1 text-sm text-slate-600">Período atual: {formatFullDate(pdiPeriod.startDate)} a {formatFullDate(pdiPeriod.endDate)}</p></div>
                <FormField label="Início"><input className={inputClass} type="date" value={pdiPeriod.startDate} onChange={event => updateFormPeriodForEscola('pdi', activeEscolaId, { startDate: event.target.value })} required /></FormField>
                <FormField label="Encerramento"><input className={inputClass} type="date" value={pdiPeriod.endDate} onChange={event => updateFormPeriodForEscola('pdi', activeEscolaId, { endDate: event.target.value })} required /></FormField>
              </div>
            </Card>
          )}

        <Card className="p-0">
          <div className="divide-y divide-slate-200">
            {questions.map((question, index) => (
              <div key={question.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{question.ordem}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{question.pergunta}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="blue">{tipoLabel(question.tipoResposta)}</Badge>
                    {question.tipoResposta === 'selecao' && question.opcoes.map(opcao => <Badge key={opcao} variant="gray">{opcao}</Badge>)}
                    {question.complementar && <Badge variant="yellow">Complementar: "{question.complementar.label}" quando {question.tipoResposta === 'marcacao' ? 'marcado' : `"${question.complementar.gatilho}"`}</Badge>}
                    <Badge variant={question.status === 'ativa' ? 'green' : 'gray'}>{question.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={index === 0} onClick={() => reorder(question, -1)}>Subir</Button>
                  <Button size="sm" variant="outline" disabled={index === questions.length - 1} onClick={() => reorder(question, 1)}>Descer</Button>
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...question })}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(question)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {form && (
          <Modal title={form.id ? 'Editar pergunta' : 'Adicionar pergunta'} onClose={() => setForm(null)}>
            <form onSubmit={saveQuestion} className="space-y-4">
              <FormField label="Pergunta"><textarea className={inputClass} rows="4" value={form.pergunta} onChange={event => setForm(prev => ({ ...prev, pergunta: event.target.value }))} required /></FormField>

              <FormField label="Tipo de resposta">
                <select className={inputClass} value={form.tipoResposta} onChange={event => changeTipoResposta(event.target.value)}>
                  {perguntaTipoOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>

              {form.tipoResposta === 'selecao' && (
                <FormField label="Opções do select">
                  <div className="space-y-2">
                    {form.opcoes.map((opcao, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          className={inputClass}
                          value={opcao}
                          onChange={event => setForm(prev => ({ ...prev, opcoes: prev.opcoes.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))}
                          placeholder={`Opção ${index + 1}`}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={form.opcoes.length <= 2}
                          onClick={() => setForm(prev => ({
                            ...prev,
                            opcoes: prev.opcoes.filter((_, itemIndex) => itemIndex !== index),
                            complementar: prev.complementar?.gatilho === opcao ? null : prev.complementar,
                          }))}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, opcoes: [...prev.opcoes, ''] }))}>+ Adicionar opção</Button>
                  </div>
                </FormField>
              )}

              {form.tipoResposta !== 'texto' && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={!!form.complementar} onChange={event => toggleComplementar(event.target.checked)} />
                    Habilitar campo complementar de texto
                  </label>
                  {form.complementar && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {form.tipoResposta === 'selecao' && (
                        <FormField label="Quando a resposta for">
                          <select className={inputClass} value={form.complementar.gatilho} onChange={event => setForm(prev => ({ ...prev, complementar: { ...prev.complementar, gatilho: event.target.value } }))}>
                            {form.opcoes.filter(Boolean).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                          </select>
                        </FormField>
                      )}
                      {form.tipoResposta === 'marcacao' && <p className="text-sm text-slate-600 md:col-span-1">Exibido quando a marcação estiver marcada.</p>}
                      <FormField label="Texto exibido (ex.: Como?)"><input className={inputClass} value={form.complementar.label} onChange={event => setForm(prev => ({ ...prev, complementar: { ...prev.complementar, label: event.target.value } }))} required /></FormField>
                    </div>
                  )}
                </div>
              )}

              <FormField label="Status"><select className={inputClass} value={form.status} onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></FormField>

              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Salvar pergunta</Button></div>
            </form>
          </Modal>
        )}

        {deleting && <ConfirmDialog title="Excluir pergunta" message="Deseja excluir esta pergunta do formulário PDI? Ela deixará de ser exibida para todas as escolas." onCancel={() => setDeleting(null)} onConfirm={() => { deletePdiPergunta(deleting.id); setDeleting(null); setMessage('Pergunta excluída com sucesso.'); }} />}
      </div>
    </MainLayout>
  );
};

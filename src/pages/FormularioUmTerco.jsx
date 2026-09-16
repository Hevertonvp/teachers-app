import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { escolaName } from '../utils/display';
import { formatFullDate, formStatusClasses, formStatusLabel, getFormStatus } from '../utils/formAvailability';
import { canManagePedagogico, isSecretaria } from '../utils/roles';
import { getEscolasAplicaveis, RECURSOS } from '../utils/aplicabilidade';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100';

const SelecioneEscolaCard = () => (
  <Card className="border-dashed bg-slate-50 text-center">
    <p className="font-semibold text-slate-800">Selecione uma escola</p>
    <p className="mt-1 text-sm text-slate-500">Escolha uma escola específica no seletor do topo da página para configurar o Formulário 1/3.</p>
  </Card>
);

const TeacherFormularioUmTerco = ({ user, escolaId, formularios, formPeriods, createFormulario, updateFormulario }) => {
  const [currentPeriod, setCurrentPeriod] = useState(0);
  const [message, setMessage] = useState('');
  const definition = formPeriods.find(item => item.id === 'formulario_um_terco' && item.escolaId === escolaId);
  const periods = definition?.fillingPeriods || [];
  const formulario = formularios.find(item => item.professorId === user.id && item.formularioUmTerco && item.escolaId === escolaId);
  const activities = formulario?.atividadesPlanejadas || {};
  const period = periods[currentPeriod];
  const isLastPeriod = currentPeriod === periods.length - 1;
  const isSent = formulario?.status === 'enviado';
  const [isEditing, setIsEditing] = useState(!isSent);

  if (!definition || !period) return null;

  const saveActivity = (value) => {
    const atividadesPlanejadas = { ...activities, [currentPeriod]: value };
    const payload = { professorId: user.id, escolaId, formularioUmTerco: true, atividadesPlanejadas, conteudo: Object.values(atividadesPlanejadas).filter(Boolean).join(' | '), status: formulario?.status || 'em_andamento', prazo: definition.endDate };
    if (formulario) updateFormulario(formulario.id, payload);
    else createFormulario(payload);
  };

  const handleSend = () => {
    const payload = { professorId: user.id, escolaId, formularioUmTerco: true, atividadesPlanejadas: activities, conteudo: Object.values(activities).filter(Boolean).join(' | '), status: 'enviado', prazo: definition.endDate };
    if (formulario) updateFormulario(formulario.id, payload);
    else createFormulario(payload);
    setMessage('Enviado com sucesso');
    setIsEditing(false);
  };

  return <MainLayout><div className="space-y-6"><div><h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 - Conteúdos</h1><p className="mt-2 text-slate-600">Registre as atividades planejadas em cada período de preenchimento.</p></div>{message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}<Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-700">Vigência geral</p><p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(definition.startDate)} a {formatFullDate(definition.endDate)}</p></div><Badge variant={isSent ? 'green' : 'yellow'}>{isSent ? 'Enviado' : 'Em preenchimento'}</Badge></div></Card>{isEditing ? <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-lg font-bold text-slate-900">Período {currentPeriod + 1} de {periods.length}</p><p className="mt-1 text-sm text-slate-600">{formatFullDate(period.startDate)} a {formatFullDate(period.endDate)}</p></div><div className="flex flex-wrap gap-2">{periods.map((item, index) => <span key={item.startDate} className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-1 ${index === currentPeriod ? 'bg-slate-800 text-white ring-slate-800' : activities[index]?.trim() ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{index + 1}</span>)}</div></div><div className="mt-6"><FormField label="Atividades planejadas"><textarea className={inputClass} rows="7" value={activities[currentPeriod] || ''} onChange={event => saveActivity(event.target.value)} placeholder="Descreva as atividades planejadas para este período" /></FormField></div><div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4"><Button variant="secondary" onClick={() => setCurrentPeriod(index => index - 1)} disabled={currentPeriod === 0}>Anterior</Button>{isLastPeriod ? <Button onClick={handleSend}>Enviar formulário</Button> : <Button onClick={() => setCurrentPeriod(index => index + 1)}>Próximo</Button>}</div></Card> : <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">Formulário enviado</p><p className="mt-1 text-sm text-slate-600">Você pode alterar as informações e enviar novamente até o fim da vigência.</p></div><Button variant="outline" onClick={() => { setMessage(''); setIsEditing(true); }}>Editar</Button></Card>}</div></MainLayout>;
};

const ManagerFormularioUmTerco = ({ escolas, escolaId, userEscolas, formPeriods, updateFormPeriodsForEscolas }) => {
  const escolasAplicaveis = getEscolasAplicaveis(RECURSOS.FORMULARIO_UM_TERCO, escolas).filter(escola => userEscolas.some(item => item.id === escola.id));
  const [selectionMode, setSelectionMode] = useState('active');
  const [selectedEscolaIds, setSelectedEscolaIds] = useState(() => escolaId && escolasAplicaveis.some(escola => escola.id === escolaId) ? [escolaId] : []);
  const definition = formPeriods.find(item => item.id === 'formulario_um_terco' && item.escolaId === escolaId)
    || formPeriods.find(item => item.id === 'formulario_um_terco' && selectedEscolaIds.includes(item.escolaId));
  const [form, setForm] = useState(() => ({ startDate: definition?.startDate || '', endDate: definition?.endDate || '', fillingPeriods: definition?.fillingPeriods || Array.from({ length: 4 }, () => ({ startDate: '', endDate: '' })) }));
  const [message, setMessage] = useState('');
  const targetIds = selectionMode === 'all' ? escolasAplicaveis.map(escola => escola.id) : selectedEscolaIds;
  const updatePeriod = (index, field, value) => setForm(prev => ({ ...prev, fillingPeriods: prev.fillingPeriods.map((period, periodIndex) => periodIndex === index ? { ...period, [field]: value } : period) }));
  const handleSubmit = (event) => { event.preventDefault(); if (!targetIds.length) { setMessage('Selecione ao menos uma escola compatível antes de salvar.'); return; } updateFormPeriodsForEscolas('formulario_um_terco', targetIds, form); setMessage('Formulário configurado com sucesso.'); };

  return <MainLayout><div className="space-y-6"><div><h1 className="text-3xl font-bold text-slate-950">Criar Formulário 1/3</h1><p className="mt-2 max-w-3xl text-slate-600">Defina a vigência geral e os quatro períodos do Formulário 1/3.</p></div>{message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}<Card><div className="space-y-4"><div><p className="font-semibold text-slate-900">Escolas do Formulário 1/3</p><p className="mt-1 text-sm text-slate-600">Escolha aqui as escolas que receberão esta configuração.</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={selectionMode === 'all' ? 'primary' : 'outline'} onClick={() => setSelectionMode('all')}>Todas as escolas compatíveis</Button><Button type="button" size="sm" variant={selectionMode === 'select' ? 'primary' : 'outline'} onClick={() => setSelectionMode('select')}>Selecionar escolas</Button></div>{selectionMode === 'select' && <div className="grid gap-2 sm:grid-cols-2">{escolasAplicaveis.map(escola => <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selectedEscolaIds.includes(escola.id)} onChange={() => setSelectedEscolaIds(prev => prev.includes(escola.id) ? prev.filter(id => id !== escola.id) : [...prev, escola.id])} />{escola.nome}</label>)}</div>}</div></Card><Card><form onSubmit={handleSubmit} className="space-y-6"><div><h2 className="text-xl font-bold text-slate-950">Vigência geral</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><FormField label="Data de início"><input className={inputClass} type="date" value={form.startDate} onChange={event => setForm(prev => ({ ...prev, startDate: event.target.value }))} required /></FormField><FormField label="Data de encerramento"><input className={inputClass} type="date" value={form.endDate} onChange={event => setForm(prev => ({ ...prev, endDate: event.target.value }))} required /></FormField></div></div><div className="border-t border-slate-200 pt-6"><h2 className="text-xl font-bold text-slate-950">Períodos de preenchimento</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{form.fillingPeriods.map((period, index) => <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="mb-3 font-semibold text-slate-900">Período {index + 1} de 4</p><div className="grid gap-3 sm:grid-cols-2"><FormField label="Início"><input className={inputClass} type="date" value={period.startDate} onChange={event => updatePeriod(index, 'startDate', event.target.value)} required /></FormField><FormField label="Fim"><input className={inputClass} type="date" value={period.endDate} onChange={event => updatePeriod(index, 'endDate', event.target.value)} required /></FormField></div></div>)}</div></div><div className="flex justify-end"><Button type="submit">Salvar configuração</Button></div></form></Card></div></MainLayout>;
};

const FormularioUmTercoHome = ({ escolas, escolaId, formPeriods }) => {
  const definition = formPeriods.find(item => item.id === 'formulario_um_terco' && item.escolaId === escolaId);
  const status = definition ? getFormStatus(definition.startDate, definition.endDate) : null;

  if (escolaId === null) return <MainLayout><SelecioneEscolaCard /></MainLayout>;

  return <MainLayout><div className="space-y-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 - Conteúdos</h1><p className="mt-2 max-w-3xl text-slate-600">Acompanhe os formulários configurados para preenchimento dos professores da {escolaName(escolas, escolaId)}.</p></div><Link to="/formulario-um-terco/criar"><Button>Criar formulário</Button></Link></div>{definition ? <Card className={`border ${formStatusClasses(status)}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xl font-bold">Formulário 1/3 - Conteúdos</p><Badge variant={status === 'active' ? 'green' : status === 'scheduled' ? 'blue' : 'gray'}>{formStatusLabel(status)}</Badge></div><p className="mt-3 text-sm font-semibold">Vigência: {formatFullDate(definition.startDate)} a {formatFullDate(definition.endDate)}</p><p className="mt-2 text-sm">{definition.fillingPeriods?.length || 0} períodos de preenchimento configurados</p></div><Link to="/formulario-um-terco/criar"><Button variant="outline">Editar configuração</Button></Link></div></Card> : <Card className="py-12 text-center"><p className="font-semibold text-slate-800">Nenhum formulário ativo</p><p className="mt-1 text-sm text-slate-500">Crie um formulário para definir a vigência e os períodos de preenchimento.</p></Card>}</div></MainLayout>;
};

export const FormularioUmTerco = () => {
  const { user } = useAuth();
  const { escolas, formularios, formPeriods, createFormulario, updateFormulario } = useData();
  const { activeEscolaId, userEscolas } = useEscola();

  if (!isSecretaria(user) && userEscolas.length === 0) {
    return <MainLayout><EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a Secretaria de Educação." /></MainLayout>;
  }

  if (canManagePedagogico(user)) return <FormularioUmTercoHome escolas={escolas} escolaId={activeEscolaId} formPeriods={formPeriods} />;
  return <TeacherFormularioUmTerco user={user} escolaId={activeEscolaId} formularios={formularios} formPeriods={formPeriods} createFormulario={createFormulario} updateFormulario={updateFormulario} />;
};

export const CriarFormularioUmTerco = () => {
  const { escolas, formPeriods, updateFormPeriodsForEscolas } = useData();
  const { activeEscolaId, userEscolas } = useEscola();
  return <ManagerFormularioUmTerco escolas={escolas} escolaId={activeEscolaId} userEscolas={userEscolas} formPeriods={formPeriods} updateFormPeriodsForEscolas={updateFormPeriodsForEscolas} />;
};

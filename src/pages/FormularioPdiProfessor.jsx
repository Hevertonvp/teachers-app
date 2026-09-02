import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass, turmaName } from '../utils/display';
import { formatFullDate, getFormStatus } from '../utils/formAvailability';
import { MainLayout } from '../layouts/Layouts';

const trimestreAtual = '3º trimestre';

export const FormularioPdiProfessor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pdiAlunos, pdiPerguntas, pdiRespostas, turmas, formPeriods, createPdiResposta, updatePdiResposta } = useData();
  const [message, setMessage] = useState('');
  const aluno = pdiAlunos.find(item => item.id === Number(id));
  const availableTurmas = turmas.filter(turma => turma.professores.includes(user?.id));
  const isAllowed = aluno && availableTurmas.some(turma => turma.id === aluno.turmaId);
  const period = formPeriods.find(item => item.id === 'pdi');
  const isActive = period && getFormStatus(period.startDate, period.endDate) === 'active';
  const questions = [...pdiPerguntas].filter(question => question.status === 'ativa' && question.tipoResposta === 'texto').sort((left, right) => left.ordem - right.ordem);
  const ownAnswers = pdiRespostas.filter(answer => answer.alunoId === Number(id) && answer.professorId === user?.id && answer.trimestre === trimestreAtual);
  const [answers, setAnswers] = useState(() => Object.fromEntries(ownAnswers.map(answer => [answer.perguntaId, { texto: answer.resposta || '', habilidadeBncc: answer.habilidadeBncc || '' }])));

  if (user?.tipo !== 'professor' || !isAllowed) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">Aluno não encontrado</p><Button className="mt-4" onClick={() => navigate('/pdi/alunos')}>Voltar para alunos</Button></Card></MainLayout>;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    questions.forEach(question => {
      const current = answers[question.id] || { texto: '', habilidadeBncc: '' };
      const existing = ownAnswers.find(answer => answer.perguntaId === question.id);
      const payload = { alunoId: aluno.id, professorId: user.id, perguntaId: question.id, trimestre: trimestreAtual, data: period.endDate, resposta: current.texto, habilidadeBncc: current.habilidadeBncc };
      if (existing) updatePdiResposta(existing.id, payload);
      else createPdiResposta(payload);
    });
    setMessage('Formulário PDI enviado com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={`/pdi/alunos/${aluno.id}`} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para aluno</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Formulário PDI</h1>
          <p className="mt-2 text-slate-600">{aluno.nome} · {turmaName(turmas, aluno.turmaId)} · {trimestreAtual}</p>
        </div>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-700">Vigência definida pela gestão</p><p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(period.startDate)} a {formatFullDate(period.endDate)}</p></div>
          <Badge variant={isActive ? 'green' : 'gray'}>{isActive ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
        </Card>
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((question, index) => {
            const answer = answers[question.id] || { texto: '', habilidadeBncc: '' };
            return <Card key={question.id}>
              <p className="text-sm font-bold text-slate-900">{index + 1}. {question.pergunta}</p>
              <div className="mt-4 space-y-4">
                <FormField label="Resposta"><textarea className={inputClass} rows="5" value={answer.texto} onChange={event => setAnswers(prev => ({ ...prev, [question.id]: { ...answer, texto: event.target.value } }))} readOnly={!isActive} required={isActive} /></FormField>
                <FormField label="Código da habilidade BNCC"><input className={inputClass} value={answer.habilidadeBncc} onChange={event => setAnswers(prev => ({ ...prev, [question.id]: { ...answer, habilidadeBncc: event.target.value } }))} readOnly={!isActive} placeholder="Ex.: EF15LP01" required={isActive} /></FormField>
              </div>
            </Card>;
          })}
          {isActive && <div className="flex justify-end"><Button type="submit">Enviar formulário</Button></div>}
        </form>
      </div>
    </MainLayout>
  );
};
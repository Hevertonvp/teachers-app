import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass, turmaName } from '../utils/display';
import { canAccessEscola, turmasDoProfessor } from '../utils/escolas';
import { formatFullDate, getFormStatus } from '../utils/formAvailability';
import { pdiTrimestres } from '../utils/pdi';
import { isProfessor } from '../utils/roles';
import { isEscolaAplicavel, RECURSOS } from '../utils/aplicabilidade';
import { MainLayout } from '../layouts/Layouts';

const answerKey = (trimestre, perguntaId) => `${trimestre}__${perguntaId}`;

const answerFromResposta = (question, resposta) => {
  if (question.tipoResposta === 'selecao') return { opcao: resposta?.resposta || '', complementar: resposta?.complementarTexto || '' };
  if (question.tipoResposta === 'marcacao') return { marcado: !!resposta?.resposta, complementar: resposta?.complementarTexto || '' };
  return { texto: resposta?.resposta || '', complementar: '' };
};

export const FormularioPdiProfessor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pdiAlunos, pdiPerguntas, pdiRespostas, turmas, turmaProfessores, escolas, vinculosEscolares, formPeriods, createPdiResposta, updatePdiResposta } = useData();
  const [message, setMessage] = useState('');
  const aluno = pdiAlunos.find(item => item.id === Number(id));
  const availableTurmas = turmasDoProfessor(turmas, turmaProfessores, user?.id);
  const isAllowed = aluno && isEscolaAplicavel(RECURSOS.PDI, aluno.escolaId) && availableTurmas.some(turma => turma.id === aluno.turmaId) && canAccessEscola(user, aluno.escolaId, { escolas, vinculosEscolares });
  const period = formPeriods.find(item => item.id === 'pdi' && item.escolaId === aluno?.escolaId);
  const isActive = period && getFormStatus(period.startDate, period.endDate) === 'active';
  const questions = [...pdiPerguntas].filter(question => question.status === 'ativa').sort((left, right) => Number(left.ordem) - Number(right.ordem));

  const [trimestre, setTrimestre] = useState(pdiTrimestres[pdiTrimestres.length - 1]);
  const [answers, setAnswers] = useState(() => {
    const initial = {};
    pdiTrimestres.forEach(trimestreValue => {
      questions.forEach(question => {
        const resposta = pdiRespostas.find(item => item.alunoId === Number(id) && item.professorId === user?.id && item.perguntaId === question.id && item.trimestre === trimestreValue);
        initial[answerKey(trimestreValue, question.id)] = answerFromResposta(question, resposta);
      });
    });
    return initial;
  });

  if (!isProfessor(user) || !isAllowed || !period) {
    return <MainLayout><Card className="py-12 text-center"><p className="font-semibold text-slate-800">Aluno não encontrado</p><Button className="mt-4" onClick={() => navigate('/pdi/alunos')}>Voltar para alunos</Button></Card></MainLayout>;
  }

  const updateAnswer = (question, value) => setAnswers(prev => ({ ...prev, [answerKey(trimestre, question.id)]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const ownAnswers = pdiRespostas.filter(answer => answer.alunoId === Number(id) && answer.professorId === user?.id && answer.trimestre === trimestre);
    questions.forEach(question => {
      const current = answers[answerKey(trimestre, question.id)];
      const existing = ownAnswers.find(answer => answer.perguntaId === question.id);
      const resposta = question.tipoResposta === 'selecao' ? current.opcao : question.tipoResposta === 'marcacao' ? current.marcado : current.texto;
      const complementarAtivo = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado === true : current.opcao === question.complementar.gatilho);
      const payload = { alunoId: aluno.id, professorId: user.id, perguntaId: question.id, trimestre, data: period.endDate, resposta, complementarTexto: complementarAtivo ? current.complementar : '' };
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
          <p className="mt-2 text-slate-600">{aluno.nome} · {turmaName(turmas, aluno.turmaId)}</p>
        </div>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-700">Vigência definida pela gestão</p><p className="mt-1 text-lg font-bold text-slate-900">{formatFullDate(period.startDate)} a {formatFullDate(period.endDate)}</p></div>
          <Badge variant={isActive ? 'green' : 'gray'}>{isActive ? 'Preenchimento disponível' : 'Somente consulta'}</Badge>
        </Card>

        <Card>
          <p className="mb-3 text-sm font-semibold text-slate-700">Trimestre</p>
          <div className="flex flex-wrap gap-2">
            {pdiTrimestres.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setTrimestre(item)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${trimestre === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((question, index) => {
            const current = answers[answerKey(trimestre, question.id)] || answerFromResposta(question, null);
            const complementarVisivel = question.complementar && (question.tipoResposta === 'marcacao' ? current.marcado : current.opcao === question.complementar.gatilho);
            return (
              <Card key={question.id}>
                <p className="text-sm font-bold text-slate-900">{index + 1}. {question.pergunta}</p>
                <div className="mt-4 space-y-4">
                  {question.tipoResposta === 'texto' && (
                    <FormField label="Resposta">
                      <textarea className={inputClass} rows="5" value={current.texto} onChange={event => updateAnswer(question, { ...current, texto: event.target.value })} readOnly={!isActive} required={isActive} />
                    </FormField>
                  )}
                  {question.tipoResposta === 'selecao' && (
                    <FormField label="Resposta">
                      <select className={inputClass} value={current.opcao} onChange={event => updateAnswer(question, { ...current, opcao: event.target.value })} disabled={!isActive} required={isActive}>
                        <option value="">Selecione</option>
                        {question.opcoes.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                      </select>
                    </FormField>
                  )}
                  {question.tipoResposta === 'marcacao' && (
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={current.marcado} onChange={event => updateAnswer(question, { ...current, marcado: event.target.checked })} disabled={!isActive} />
                      Marcar
                    </label>
                  )}
                  {complementarVisivel && (
                    <FormField label={question.complementar.label}>
                      <input className={inputClass} value={current.complementar} onChange={event => updateAnswer(question, { ...current, complementar: event.target.value })} readOnly={!isActive} required={isActive} />
                    </FormField>
                  )}
                </div>
              </Card>
            );
          })}
          {isActive && <div className="flex justify-end"><Button type="submit">Enviar formulário</Button></div>}
        </form>
      </div>
    </MainLayout>
  );
};

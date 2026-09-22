import { Link, Navigate } from 'react-router-dom';
import { Badge, Card, EmptyState } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { escolaName, turmaName } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { acessoAtivoDaTurma, alunosDoAuxiliar } from '../utils/auxiliares';
import { isAuxiliar } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Alunos PDI das turmas em que o Auxiliar logado tem vínculo ATIVO agora — nunca um vínculo
// individual por aluno (o vínculo é sempre Auxiliar<->turma, ver utils/auxiliares.js).
export const MeusAlunosAuxiliarPage = () => {
  const { user } = useAuth();
  const { pdiAlunos, pdiAuxiliaresVinculos, escolas, turmas } = useData();

  if (!isAuxiliar(user)) return <Navigate to="/dashboard" replace />;

  const meusAlunos = alunosDoAuxiliar(pdiAuxiliaresVinculos, user.id, pdiAlunos, turmas)
    .map(aluno => ({ aluno, vinculo: acessoAtivoDaTurma(pdiAuxiliaresVinculos, turmas, aluno.turmaId) }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Auxiliar de Aprendizagem</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Meus alunos</h1>
          <p className="mt-2 text-slate-600">Alunos que você acompanha atualmente.</p>
        </div>

        {meusAlunos.length === 0 ? (
          <EmptyState title="Nenhum aluno vinculado" description="Você não possui alunos sob acompanhamento no momento." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meusAlunos.map(({ aluno, vinculo }) => (
              // Escola e turma vêm sempre do próprio aluno — nunca de um vínculo paralelo com o Auxiliar.
              <Card key={aluno.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{aluno.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">{turmaName(turmas, aluno.turmaId)} · {escolaName(escolas, aluno.escolaId)}</p>
                  </div>
                  <Badge variant={aluno.status === 'arquivado' ? 'gray' : 'green'}>{aluno.status === 'arquivado' ? 'Arquivado' : 'Ativo'}</Badge>
                </div>
                {aluno.condicaoInformada && <p className="mt-3 text-sm text-slate-600"><strong>Condição informada:</strong> {aluno.condicaoInformada}</p>}
                <p className="mt-1 text-sm text-slate-500">Acompanhamento desde: {formatDate(vinculo.dataInicio)}</p>
                <Link to={`/meus-alunos/${aluno.id}`} className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver aluno →</Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

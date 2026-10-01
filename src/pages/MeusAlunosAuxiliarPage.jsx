import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { isAuxiliar } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Alunos PDI das turmas em que o Auxiliar logado tem VinculoEscolar + AuxiliarTurma ATIVOS agora
// (ver GET /api/pdi-alunos/meus-alunos) — nunca um vínculo individual por aluno, nunca o mock
// pdiAuxiliaresVinculos.
export const MeusAlunosAuxiliarPage = () => {
  const { user } = useAuth();
  const { meusAlunosAuxiliarReais, meusAlunosAuxiliarReaisLoading, meusAlunosAuxiliarReaisError, loadMeusAlunosAuxiliarReais } = useData();

  useEffect(() => { if (isAuxiliar(user)) loadMeusAlunosAuxiliarReais(); }, [user, loadMeusAlunosAuxiliarReais]);

  if (!isAuxiliar(user)) return <Navigate to="/dashboard" replace />;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Auxiliar de Aprendizagem</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Meus alunos</h1>
          <p className="mt-2 text-slate-600">Alunos que você acompanha atualmente.</p>
        </div>

        {meusAlunosAuxiliarReaisError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar seus alunos: {meusAlunosAuxiliarReaisError}</span>
            <Button size="sm" variant="outline" onClick={loadMeusAlunosAuxiliarReais}>Tentar novamente</Button>
          </div>
        )}

        {meusAlunosAuxiliarReaisLoading ? (
          <Card className="py-12 text-center"><p className="text-slate-500">Carregando...</p></Card>
        ) : meusAlunosAuxiliarReais.length === 0 ? (
          <EmptyState title="Nenhum aluno vinculado" description="Você não possui alunos sob acompanhamento no momento." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {meusAlunosAuxiliarReais.map(aluno => (
              <Card key={aluno.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{aluno.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">{aluno.turmaNome} · {aluno.escolaNome}</p>
                  </div>
                  <Badge variant="green">Ativo</Badge>
                </div>
                <Link to={`/meus-alunos/${aluno.id}`} className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver aluno →</Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

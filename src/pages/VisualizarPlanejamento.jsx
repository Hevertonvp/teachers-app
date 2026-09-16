import { useParams, useNavigate } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { Card, Badge, Button } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { planejamentos, professores, turmas, disciplinas } from '../data/mockData';
import { getUserEscolaIds } from '../utils/escolas';
import { isGestor, isProfessor } from '../utils/roles';

export const VisualizarPlanejamento = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vinculosEscolares } = useData();
  const planejamento = planejamentos.find(p => p.id === parseInt(id));
  const accessibleSchoolIds = isGestor(user) ? getUserEscolaIds(user, vinculosEscolares) : [];

  if (!isProfessor(user) && !isGestor(user)) return <Navigate to="/dashboard" replace />;

  if (!planejamento) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Planejamento não encontrado</p>
          <Button onClick={() => navigate(-1)} variant="primary" className="mt-4">
            ← Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  const planejamentoEscolaId = turmas.find(turma => turma.id === planejamento.turmaId)?.escolaId;
  const canView = isProfessor(user)
    ? planejamento.professorId === user.id
    : accessibleSchoolIds.includes(planejamentoEscolaId);

  if (!canView) return <Navigate to="/planejamentos" replace />;

  const professor = professores.find(p => p.id === planejamento.professorId);
  const turma = turmas.find(t => t.id === planejamento.turmaId);
  const disciplina = disciplinas.find(d => d.id === planejamento.disciplinaId);

  const statusCores = {
    pendente: 'red',
    em_andamento: 'yellow',
    concluído: 'green',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-700">{planejamento.titulo}</h1>
              <Badge variant={statusCores[planejamento.status]}>
                {planejamento.status === 'pendente' ? 'Pendente' :
                 planejamento.status === 'em_andamento' ? 'Em Andamento' :
                 'Concluído'}
              </Badge>
            </div>
            <p className="text-gray-600">{planejamento.descricao}</p>
          </div>
          <Button onClick={() => navigate(-1)} variant="ghost" className="shrink-0">
            ← Voltar
          </Button>
        </div>

        {/* Informações Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-gray-600 text-sm mb-1">Professor</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center font-semibold text-primary-700 text-xs">{professor?.avatar}</div>
              <ProfessorName professor={professor} />
            </div>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm mb-1">Turma</p>
            <p className="font-semibold text-slate-700">{turma?.nome}</p>
            <p className="text-xs text-gray-500 mt-1">👥 {turma?.quantidadeAlunos} alunos</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm mb-1">Disciplina</p>
            <p className="font-semibold text-slate-700">{disciplina?.nome}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm mb-1">Período</p>
            <p className="font-semibold text-slate-700">{planejamento.dataInicio}</p>
            <p className="text-xs text-gray-500 mt-1">até {planejamento.dataFim}</p>
          </Card>
        </div>

        {/* Conteúdo Detalhado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-3">Objetivos</h2>
            <p className="text-gray-700 leading-relaxed">{planejamento.objetivos}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-3">Conteúdos</h2>
            <p className="text-gray-700 leading-relaxed">{planejamento.conteudos}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-3">Metodologia</h2>
            <p className="text-gray-700 leading-relaxed">{planejamento.metodologia}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-3">Avaliação</h2>
            <p className="text-gray-700 leading-relaxed">{planejamento.avaliacao}</p>
          </Card>
        </div>

        {/* Informações Administrativas */}
        <Card>
          <h2 className="text-lg font-bold text-slate-700 mb-4">Informações Administrativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-600 text-sm">Status</p>
              <Badge variant={statusCores[planejamento.status]} className="mt-1">
                {planejamento.status === 'pendente' ? 'Pendente' : 
                 planejamento.status === 'em_andamento' ? 'Em Andamento' : 
                 'Concluído'}
              </Badge>
            </div>
            {planejamento.dataPreenchimento && (
              <div>
                <p className="text-gray-600 text-sm">Data de Preenchimento</p>
                <p className="font-semibold text-slate-700 mt-1">{planejamento.dataPreenchimento}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

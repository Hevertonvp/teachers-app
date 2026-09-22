import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { BackButton, Card, Badge, Button } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { planejamentos, professores, turmas, disciplinas } from '../data/mockData';
import { getUserEscolaIds } from '../utils/escolas';
import { isGestor, isProfessor } from '../utils/roles';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

export const ListaPlanejamentos = () => {
  const { user } = useAuth();
  const { vinculosEscolares } = useData();
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const accessibleSchoolIds = isGestor(user) ? getUserEscolaIds(user, vinculosEscolares) : [];

  if (!isProfessor(user) && !isGestor(user)) return <Navigate to="/dashboard" replace />;

  // Filtrar planejamentos baseado no tipo de usuário
  let planejamentosFiltrados = planejamentos;
  
  if (isProfessor(user)) {
    planejamentosFiltrados = planejamentos.filter(p => p.professorId === user?.id);
  } else {
    planejamentosFiltrados = planejamentos.filter(p => accessibleSchoolIds.includes(turmas.find(turma => turma.id === p.turmaId)?.escolaId));
  }

  // Aplicar filtro de status
  if (filtroStatus !== 'todos') {
    planejamentosFiltrados = planejamentosFiltrados.filter(p => p.status === filtroStatus);
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <BackButton />
            <h1 className="mt-3 text-3xl font-bold text-slate-700">Planejamentos</h1>
            <p className="text-gray-600 mt-2">
              {isProfessor(user) ? 'Seus planejamentos pedagógicos' : 'Planejamentos da escola'}
            </p>
          </div>
          {isProfessor(user) && (
            <Link to="/novo-planejamento">
              <Button variant="primary">Novo Planejamento</Button>
            </Link>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtroStatus === 'todos'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroStatus('concluído')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtroStatus === 'concluído'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300'
            }`}
          >
            Concluídos
          </button>
          <button
            onClick={() => setFiltroStatus('em_andamento')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtroStatus === 'em_andamento'
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-yellow-300'
            }`}
          >
            Em Andamento
          </button>
          <button
            onClick={() => setFiltroStatus('pendente')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtroStatus === 'pendente'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-red-300'
            }`}
          >
            Pendentes
          </button>
        </div>

        {/* Lista de Planejamentos */}
        <div className="space-y-3">
          {planejamentosFiltrados.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-600">Nenhum planejamento encontrado</p>
            </Card>
          ) : (
            planejamentosFiltrados.map(planejamento => {
              const professor = professores.find(p => p.id === planejamento.professorId);
              const turma = turmas.find(t => t.id === planejamento.turmaId);
              const disciplina = disciplinas.find(d => d.id === planejamento.disciplinaId);

              const statusCores = {
                pendente: 'red',
                em_andamento: 'yellow',
                concluído: 'green',
              };

              return (
                <Link key={planejamento.id} to={`/planejamento/${planejamento.id}`}>
                  <Card className="hover:shadow-md transition cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-700">{planejamento.titulo}</h3>
                          <Badge variant={statusCores[planejamento.status]}>
                              {planejamento.status === 'pendente' ? 'Pendente' :
                               planejamento.status === 'em_andamento' ? 'Em Andamento' :
                               'Concluído'}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{planejamento.descricao}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500">Professor(a)</p>
                            <ProfessorName professor={professor} />
                          </div>
                          <div>
                            <p className="text-gray-500">Turma</p>
                            <p className="font-medium text-slate-700">{turma?.nome}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Disciplina</p>
                            <p className="font-medium text-slate-700">{disciplina?.nome}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Período</p>
                            <p className="font-medium text-slate-700">
                              {planejamento.dataInicio} a {planejamento.dataFim}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-4xl text-gray-300">□</div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
};

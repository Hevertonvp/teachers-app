import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { Card, Badge } from '../components/Common';
import { ProfessorName } from '../components/ProfessorName';
import { planejamentos, professores, turmas, disciplinas } from '../data/mockData';
import { useState } from 'react';

export const ListaPlanejamentosGestor = () => {
  const [filtroStatus, setFiltroStatus] = useState('todos');

  let planejamentosFiltrados = planejamentos;

  if (filtroStatus !== 'todos') {
    planejamentosFiltrados = planejamentosFiltrados.filter(p => p.status === filtroStatus);
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-slate-700">Planejamentos da Escola</h1>
          <p className="text-gray-600 mt-2">Acompanhe os planejamentos pedagógicos de todos os professores</p>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-gray-600 text-sm">Total</p>
            <p className="text-3xl font-bold text-slate-700">{planejamentos.length}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Concluídos</p>
            <p className="text-3xl font-bold text-green-600">
              {planejamentos.filter(p => p.status === 'concluído').length}
            </p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Em Andamento</p>
            <p className="text-3xl font-bold text-yellow-600">
              {planejamentos.filter(p => p.status === 'em_andamento').length}
            </p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Pendentes</p>
            <p className="text-3xl font-bold text-red-600">
              {planejamentos.filter(p => p.status === 'pendente').length}
            </p>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {['todos', 'concluído', 'em_andamento', 'pendente'].map(status => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtroStatus === status
                  ? status === 'todos' ? 'bg-primary-600 text-white' :
                    status === 'concluído' ? 'bg-green-600 text-white' :
                    status === 'em_andamento' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {status === 'todos' ? 'Todos' : 
               status === 'concluído' ? 'Concluídos' :
               status === 'em_andamento' ? 'Em Andamento' :
               'Pendentes'}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {planejamentosFiltrados.map(planejamento => {
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-700">{planejamento.titulo}</h3>
                        <Badge variant={statusCores[planejamento.status]}>
                          {planejamento.status === 'pendente' ? 'Pendente' : 
                           planejamento.status === 'em_andamento' ? 'Em Andamento' : 
                           'Concluído'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Professor</p>
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
                          <p className="font-medium text-slate-700">{planejamento.dataInicio}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Alunos</p>
                          <p className="font-medium text-slate-700">{turma?.quantidadeAlunos}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-3xl ml-4 text-gray-300">□</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { Card, Button } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { disciplinas, turmas } from '../data/mockData';

export const NovoPlanejamento = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);

  const minhasTurmas = turmas.filter(t => t.professores.includes(user?.id));

  const [formData, setFormData] = useState({
    turmaId: minhasTurmas[0]?.id || '',
    disciplinaId: '1',
    titulo: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    objetivos: '',
    conteudos: '',
    metodologia: '',
    avaliacao: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCarregando(true);

    // Simular envio
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simular sucesso
    alert('Planejamento criado com sucesso!');
    navigate('/planejamentos');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-slate-700">Novo Planejamento</h1>
          <p className="text-gray-600 mt-2">Preencha os campos para criar um novo planejamento pedagógico</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Turma</label>
                <select
                  name="turmaId"
                  value={formData.turmaId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  {minhasTurmas.map(turma => (
                    <option key={turma.id} value={turma.id}>{turma.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Disciplina</label>
                <select
                  name="disciplinaId"
                  value={formData.disciplinaId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  {disciplinas.map(disc => (
                    <option key={disc.id} value={disc.id}>{disc.nome}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Título do Planejamento</label>
                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  placeholder="Ex: Interpretação de Textos"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Descreva brevemente o tema do planejamento"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Início</label>
                <input
                  type="date"
                  name="dataInicio"
                  value={formData.dataInicio}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Término</label>
                <input
                  type="date"
                  name="dataFim"
                  value={formData.dataFim}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Conteúdo Pedagógico */}
          <Card>
            <h2 className="text-lg font-bold text-slate-700 mb-4">Conteúdo Pedagógico</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Objetivos</label>
                <textarea
                  name="objetivos"
                  value={formData.objetivos}
                  onChange={handleChange}
                  placeholder="Quais são os objetivos educacionais desta aula/unidade?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conteúdos</label>
                <textarea
                  name="conteudos"
                  value={formData.conteudos}
                  onChange={handleChange}
                  placeholder="Quais conteúdos serão abordados?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metodologia</label>
                <textarea
                  name="metodologia"
                  value={formData.metodologia}
                  onChange={handleChange}
                  placeholder="Como as aulas serão conduzidas?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Avaliação</label>
                <textarea
                  name="avaliacao"
                  value={formData.avaliacao}
                  onChange={handleChange}
                  placeholder="Como os alunos serão avaliados?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Botões */}
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              disabled={carregando}
            >
              {carregando ? 'Salvando...' : 'Criar Planejamento'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              disabled={carregando}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

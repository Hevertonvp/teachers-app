import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, StatCard } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { MainLayout } from '../layouts/Layouts';

export const DashboardProfessor = () => {
  const { user } = useAuth();
  const { escolas, meusPdisReais, meusPdisReaisLoading, loadMeusPdisReais } = useData();
  const { userEscolas } = useEscola();

  // Vínculo real Turma+Disciplina do professor (nunca o mock turmaProfessores/turmasDoProfessor
  // — ficou pra trás da migração pro backend real: qualquer professor cadastrado de verdade,
  // fora da leva original seedada, aparecia aqui com "nenhuma turma", mesmo tendo vínculo real).
  const [meusVinculos, setMeusVinculos] = useState([]);
  const [meusVinculosLoading, setMeusVinculosLoading] = useState(true);

  useEffect(() => {
    loadMeusPdisReais();
    listarVinculosProfessorTurmaDisciplina()
      .then((vinculos) => setMeusVinculos(vinculos.filter((v) => v.status === 'ATIVO')))
      .catch(() => setMeusVinculos([]))
      .finally(() => setMeusVinculosLoading(false));
  }, [loadMeusPdisReais]);

  if (userEscolas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a Secretaria de Educação." />
      </MainLayout>
    );
  }

  // Professor vê tudo que é seu em todas as suas escolas, sempre junto — nunca preso ao
  // seletor de escola do topo (removido para este perfil; ver feedback salvo em memória).
  const totalTurmasUnicas = new Set(meusVinculos.map(v => v.turmaId)).size;
  // Resumo real do PDI por disciplina (Fichas) — fonte: GET /api/pdi-fichas/meus-pdis, a mesma
  // usada por "Meus PDIs" (nunca recalculado aqui com regra própria).
  const resumoFichasPdi = {
    naoIniciados: meusPdisReais.filter(item => item.statusVisual === 'nao_iniciado').length,
    emAndamento: meusPdisReais.filter(item => item.statusVisual === 'em_andamento').length,
    concluidos: meusPdisReais.filter(item => item.statusVisual === 'concluido').length,
    prazoEncerrado: meusPdisReais.filter(item => item.statusVisual === 'prazo_encerrado').length,
  };

  return (
    <MainLayout>
      <div className="space-y-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Minha rotina pedagógica</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Bem-vindo, {user?.nome}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Esta primeira entrega disponibiliza só o módulo PDI — os demais indicadores serão liberados nas próximas etapas.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Minhas turmas" value={totalTurmasUnicas} description="turmas vinculadas" />
            </div>
          </div>
        </section>

        <section>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-950">Formulário PDI</h2>
              <Link to="/pdi/meus-pdis"><Button size="sm" variant="outline">Meus PDIs</Button></Link>
            </div>
            <p className="mb-3 text-xs text-slate-500">Fichas das disciplinas que você leciona, em todas as suas escolas e turmas.</p>
            {meusPdisReaisLoading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Não iniciados</p><p className="text-2xl font-bold text-slate-900">{resumoFichasPdi.naoIniciados}</p></div>
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">Em preenchimento</p><p className="text-2xl font-bold text-blue-800">{resumoFichasPdi.emAndamento}</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">Concluídos</p><p className="text-2xl font-bold text-emerald-800">{resumoFichasPdi.concluidos}</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-700">Prazo encerrado</p><p className="text-2xl font-bold text-amber-800">{resumoFichasPdi.prazoEncerrado}</p></div>
              </div>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <h2 className="text-xl font-bold text-slate-950">Atalhos</h2>
            <div className="mt-4 grid gap-3">
              <Link to="/pdi"><Button className="w-full" variant="primary">Acessar PDI</Button></Link>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-slate-950">Minhas turmas</h2>
            <div className="mt-4 space-y-3">
              {meusVinculosLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : meusVinculos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma turma/disciplina vinculada no momento.</p>
              ) : (
                meusVinculos.map(vinculo => (
                  <div key={vinculo.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{vinculo.turmaNome} · {vinculo.disciplinaNome}</p>
                    <p className="mt-1 text-sm text-slate-600">{escolas.find(e => e.id === vinculo.escolaId)?.nome}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-dashed bg-slate-50 text-center">
            <p className="font-semibold text-slate-800">Em construção</p>
            <p className="mt-1 text-sm text-slate-500">Formulário 1/3, Correções de simulados, pendências, eventos e notícias serão liberados nas próximas entregas.</p>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

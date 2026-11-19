import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, StatCard } from '../components/Common';
import { DetalheDaFolha, tituloDaFolha } from '../components/ComposicaoCargo';
import { listarMeusFormulariosUmTerco } from '../services/formularioUmTerco';
import { resumoFolhaProfessor } from '../utils/umTerco';
import { FeedbackSistemaBanner } from '../components/FeedbackSistemaBanner';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { listarVinculosProfessorTurmaAtuacao } from '../services/professorTurmaAtuacao';
import { MainLayout } from '../layouts/Layouts';
import { AVISO_PDI_DESENVOLVIMENTO, useModoPdi } from '../config/modulos';
import { SeloDesenvolvimento } from '../components/PdiDesenvolvimento';

export const DashboardProfessor = () => {
  const { PDI_ATIVO, PDI_EM_DESENVOLVIMENTO, PDI_VISIVEL } = useModoPdi(); // 19/11/2026: modo do PDI por perfil
  const { user } = useAuth();
  const { escolas, meusPdisReais, meusPdisReaisLoading, loadMeusPdisReais } = useData();
  const { userEscolas } = useEscola();

  // Vínculo real Turma+Disciplina do professor (nunca o mock turmaProfessores/turmasDoProfessor
  // — ficou pra trás da migração pro backend real: qualquer professor cadastrado de verdade,
  // fora da leva original seedada, aparecia aqui com "nenhuma turma", mesmo tendo vínculo real).
  const [meusVinculos, setMeusVinculos] = useState([]);
  const [meusVinculosLoading, setMeusVinculosLoading] = useState(true);
  // 16/11/2026: o Formulário 1/3 pendente aparece logo no início (antes só o PDI aparecia; o 1/3 ficava no menu).
  const navigate = useNavigate();
  const [folhas, setFolhas] = useState(null);
  useEffect(() => { listarMeusFormulariosUmTerco().then(setFolhas).catch(() => setFolhas([])); }, []);

  useEffect(() => {
    if (PDI_ATIVO) loadMeusPdisReais();
    // 16/11/2026: turmas por disciplina e por atuação (ex.: "1M1 · Professor Regente"), numa lista só.
    Promise.all([listarVinculosProfessorTurmaDisciplina(), listarVinculosProfessorTurmaAtuacao().catch(() => [])])
      .then(([porDisciplina, porAtuacao]) => setMeusVinculos([
        ...porDisciplina.filter((v) => v.status === 'ATIVO').map((v) => ({ ...v, chave: `d${v.id}`, funcao: v.disciplinaNome })),
        ...porAtuacao.filter((v) => v.status === 'ATIVO').map((v) => ({ ...v, chave: `a${v.id}`, funcao: v.atuacaoNome })),
      ].sort((a, b) => (a.turmaNome || '').localeCompare(b.turmaNome || '', 'pt-BR', { numeric: true }))))
      .catch(() => setMeusVinculos([]))
      .finally(() => setMeusVinculosLoading(false));
  }, [loadMeusPdisReais]);

  if (userEscolas.length === 0) {
    return (
      <MainLayout>
        <EmptyState title="Nenhuma escola vinculada" description="Você não possui vínculo ativo com nenhuma escola no momento. Procure a administração do sistema." />
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
    agendados: meusPdisReais.filter(item => item.statusVisual === 'agendado').length,
    emAndamento: meusPdisReais.filter(item => item.statusVisual === 'em_andamento').length,
    concluidos: meusPdisReais.filter(item => item.statusVisual === 'concluido').length,
    prazoEncerrado: meusPdisReais.filter(item => item.statusVisual === 'prazo_encerrado').length,
  };

  return (
    <MainLayout>
      <div className="space-y-7">
        <FeedbackSistemaBanner />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Minha rotina pedagógica</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Bem-vindo, {user?.nome}</h1>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Minhas turmas" value={totalTurmasUnicas} description="turmas vinculadas" />
            </div>
          </div>
        </section>

        <section>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-950">Formulário 1/3</h2>
              <Link to="/formulario-um-terco"><Button size="sm" variant="outline">Ver todos</Button></Link>
            </div>
            {folhas === null ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (() => {
              const pendentes = folhas.filter(item => item.correcaoSolicitada || (item.editavelAgora && item.esperada && item.status !== 'concluida'));
              if (pendentes.length === 0) return <p className="text-sm text-slate-600">{folhas.length ? 'Nenhum formulário pendente.' : 'Nenhum formulário aberto agora.'}</p>;
              return (
                <div className="space-y-3">
                  {pendentes.map(item => {
                    const resumo = resumoFolhaProfessor(item);
                    return (
                      <div key={`${item.ciclo.id}-${item.cargoId}`} data-folha-inicio className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${resumo.corrigindo ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={resumo.selo.variant}>{resumo.selo.label}</Badge>
                            <span className="text-xs font-semibold text-slate-500">{item.rotulo}</span>
                          </div>
                          <p className="mt-1 font-semibold text-slate-900">{tituloDaFolha(item.composicao)}</p>
                          <DetalheDaFolha composicao={item.composicao} />
                          <p className="text-sm text-slate-600">{item.semanasPreenchidas}/{item.totalSemanas} semanas · {resumo.prazo}</p>
                        </div>
                        <Button className="w-full sm:w-auto" onClick={() => navigate(`/formulario-um-terco/${item.ciclo.id}/cargo/${item.cargoId}`)}>{resumo.acao}</Button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </section>

        {PDI_ATIVO && <section>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-950">Formulário PDI</h2>
              <Link to="/pdi/meus-pdis"><Button size="sm" variant="outline">Meus PDIs</Button></Link>
            </div>
            {meusPdisReaisLoading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Não iniciados</p><p className="text-2xl font-bold text-slate-900">{resumoFichasPdi.naoIniciados}</p></div>
                <div className="rounded-lg bg-yellow-50 p-3"><p className="text-yellow-700">Agendados</p><p className="text-2xl font-bold text-yellow-800">{resumoFichasPdi.agendados}</p></div>
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-blue-700">Em preenchimento</p><p className="text-2xl font-bold text-blue-800">{resumoFichasPdi.emAndamento}</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-emerald-700">Concluídos</p><p className="text-2xl font-bold text-emerald-800">{resumoFichasPdi.concluidos}</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-amber-700">Prazo encerrado</p><p className="text-2xl font-bold text-amber-800">{resumoFichasPdi.prazoEncerrado}</p></div>
              </div>
            )}
          </Card>
        </section>}

        {PDI_EM_DESENVOLVIMENTO && <section>
          <Card className="bg-slate-50">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-500">Formulário PDI</h2>
                <SeloDesenvolvimento />
              </div>
              <Button size="sm" variant="outline" disabled>Meus PDIs</Button>
            </div>
            <p className="mb-4 text-sm text-slate-600">{AVISO_PDI_DESENVOLVIMENTO}</p>
            <div className="grid grid-cols-2 gap-3 text-sm opacity-50 sm:grid-cols-5" aria-hidden="true">
              {['Não iniciados', 'Agendados', 'Em preenchimento', 'Concluídos', 'Prazo encerrado'].map((rotulo) => (
                <div key={rotulo} className="rounded-lg bg-white p-3"><p className="text-slate-500">{rotulo}</p><p className="text-2xl font-bold text-slate-400">—</p></div>
              ))}
            </div>
          </Card>
        </section>}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <h2 className="text-xl font-bold text-slate-950">Atalhos</h2>
            <div className="mt-4 grid gap-3">
              <Link to="/formulario-um-terco"><Button className="w-full" variant="primary">Abrir Formulário 1/3</Button></Link>
              {PDI_ATIVO && <Link to="/pdi"><Button className="w-full" variant="outline">Acessar PDI</Button></Link>}
              {PDI_EM_DESENVOLVIMENTO && <Button className="w-full" variant="outline" disabled title={AVISO_PDI_DESENVOLVIMENTO}>Acessar PDI (em desenvolvimento)</Button>}
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
                // 16/11/2026: uma linha por turma, com as disciplinas/funções juntas (antes repetia a turma).
                [...meusVinculos.reduce((mapa, v) => {
                  const g = mapa.get(v.turmaId) ?? { ...v, chave: `t${v.turmaId}`, funcoes: [] };
                  if (!g.funcoes.includes(v.funcao)) g.funcoes.push(v.funcao);
                  return mapa.set(v.turmaId, g);
                }, new Map()).values()].map(vinculo => (
                  <div key={vinculo.chave} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{vinculo.turmaNome} · {vinculo.funcoes.join(', ')}</p>
                    <p className="mt-1 text-sm text-slate-600">{escolas.find(e => e.id === vinculo.escolaId)?.nome}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
};

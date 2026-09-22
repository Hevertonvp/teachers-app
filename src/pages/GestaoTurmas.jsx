import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, EmptyState, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { escolaName, inputClass } from '../utils/display';
import { canManageTurmas } from '../utils/roles';
import {
  ANOS_FUNDAMENTAL, ETAPAS, SEGMENTOS_INFANTIL, TURNOS,
  descricaoTurma, niveisDoSegmento, vinculosDaTurma,
} from '../utils/turmas';

const ANO_LETIVO_PADRAO = 2026;

const blankTurma = (escolaId) => ({
  escolaId: escolaId ?? '',
  anoLetivo: ANO_LETIVO_PADRAO,
  etapa: 'fundamental',
  anoSerie: 1,
  segmento: 'creche',
  nivel: SEGMENTOS_INFANTIL[0].niveis[0].value,
  turno: 'manha',
  identificador: 1,
});

export const GestaoTurmas = () => {
  const { user } = useAuth();
  const {
    escolas, turmas, turmaProfessores, pdiAlunos, pdiAuxiliaresVinculos,
    createTurma, updateTurma, inativarTurma, reativarTurma,
  } = useData();

  const [filtroEscolaId, setFiltroEscolaId] = useState('todas');
  const [filtroAnoLetivo, setFiltroAnoLetivo] = useState('todos');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('ativa');
  const [turmaForm, setTurmaForm] = useState(null);
  const [editingTurma, setEditingTurma] = useState(null);
  const [turmaError, setTurmaError] = useState('');
  const [inativandoTurma, setInativandoTurma] = useState(null);
  const [reativandoTurma, setReativandoTurma] = useState(null);
  const [message, setMessage] = useState('');

  if (!canManageTurmas(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const escolasOrdenadas = [...escolas].sort((a, b) => a.nome.localeCompare(b.nome));
  const anosLetivos = [...new Set(turmas.map(turma => turma.anoLetivo).filter(Boolean))].sort((a, b) => b - a);

  const turmasFiltradas = turmas
    .filter(turma => filtroEscolaId === 'todas' || turma.escolaId === Number(filtroEscolaId))
    .filter(turma => filtroAnoLetivo === 'todos' || Number(turma.anoLetivo) === Number(filtroAnoLetivo))
    .filter(turma => filtroEtapa === 'todas' || turma.etapa === filtroEtapa)
    .filter(turma => filtroStatus === 'todas' || turma.status === filtroStatus)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const abrirNovaTurma = () => { setEditingTurma(null); setTurmaError(''); setTurmaForm(blankTurma(escolasOrdenadas[0]?.id)); };
  // Turmas legadas sem turno/identificador definidos (ver mockData.js) recebem aqui um valor de
  // partida editável — só passam a valer de fato quando a Secretaria confirmar "Salvar".
  const abrirEdicao = (turma) => {
    setEditingTurma(turma);
    setTurmaError('');
    setTurmaForm({
      ...blankTurma(turma.escolaId),
      ...turma,
      turno: turma.turno || 'manha',
      identificador: turma.identificador || 1,
      anoSerie: turma.anoSerie || ANOS_FUNDAMENTAL[0].value,
    });
  };
  const fecharModal = () => { setTurmaForm(null); setEditingTurma(null); setTurmaError(''); };

  const mudarEtapa = (etapa) => {
    setTurmaForm(prev => ({
      ...prev,
      etapa,
      anoSerie: ANOS_FUNDAMENTAL[0].value,
      segmento: SEGMENTOS_INFANTIL[0].value,
      nivel: SEGMENTOS_INFANTIL[0].niveis[0].value,
    }));
  };

  const mudarSegmento = (segmento) => {
    setTurmaForm(prev => ({ ...prev, segmento, nivel: niveisDoSegmento(segmento)[0]?.value }));
  };

  const salvarTurma = (event) => {
    event.preventDefault();
    setTurmaError('');
    const base = {
      escolaId: Number(turmaForm.escolaId),
      anoLetivo: Number(turmaForm.anoLetivo),
      etapa: turmaForm.etapa,
      turno: turmaForm.turno,
      identificador: Number(turmaForm.identificador),
    };
    const payload = turmaForm.etapa === 'fundamental'
      ? { ...base, anoSerie: Number(turmaForm.anoSerie), segmento: null, nivel: null }
      : { ...base, anoSerie: null, segmento: turmaForm.segmento, nivel: turmaForm.nivel };
    if (!editingTurma) payload.quantidadeAlunos = 0;

    const resultado = editingTurma ? updateTurma(editingTurma.id, payload) : createTurma(payload);
    if (!resultado.ok) {
      setTurmaError(resultado.error);
      return;
    }
    setMessage(editingTurma ? `Turma "${resultado.turma.nome}" atualizada com sucesso.` : `Turma "${resultado.turma.nome}" criada com sucesso.`);
    fecharModal();
  };

  const vinculosDaTurmaEmEdicao = editingTurma ? vinculosDaTurma(editingTurma.id, { turmaProfessores, pdiAlunos, pdiAuxiliaresVinculos }) : null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Turmas</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Educação Infantil e Ensino Fundamental, período regular (manhã/tarde).</p>
            <p className="mt-1 text-xs text-slate-500">Turmas de período integral ainda não fazem parte do módulo PDI.</p>
          </div>
          <Button onClick={abrirNovaTurma} disabled={escolasOrdenadas.length === 0}>+ Nova turma</Button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Escola">
              <select className={inputClass} value={filtroEscolaId} onChange={event => setFiltroEscolaId(event.target.value)}>
                <option value="todas">Todas as escolas</option>
                {escolasOrdenadas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Ano letivo">
              <select className={inputClass} value={filtroAnoLetivo} onChange={event => setFiltroAnoLetivo(event.target.value)}>
                <option value="todos">Todos</option>
                {anosLetivos.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </FormField>
            <FormField label="Etapa">
              <select className={inputClass} value={filtroEtapa} onChange={event => setFiltroEtapa(event.target.value)}>
                <option value="todas">Todas</option>
                {ETAPAS.map(etapa => <option key={etapa.value} value={etapa.value}>{etapa.label}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select className={inputClass} value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)}>
                <option value="ativa">Ativas</option>
                <option value="inativa">Inativas</option>
                <option value="todas">Todas</option>
              </select>
            </FormField>
          </div>
        </Card>

        {turmasFiltradas.length === 0 ? (
          turmas.length === 0 ? (
            <EmptyState title="Nenhuma turma cadastrada" description="Crie a primeira turma escolhendo uma escola.">
              <Button onClick={abrirNovaTurma}>+ Nova turma</Button>
            </EmptyState>
          ) : (
            <EmptyState title="Nenhuma turma para os filtros escolhidos" description="Ajuste os filtros acima para ver outras turmas." />
          )
        ) : (
          <Card className="p-0">
            <div className="divide-y divide-slate-200">
              {turmasFiltradas.map(turma => {
                const vinculos = vinculosDaTurma(turma.id, { turmaProfessores, pdiAlunos, pdiAuxiliaresVinculos });
                return (
                  <div key={turma.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{turma.nome}</p>
                        <Badge variant={turma.status === 'ativa' ? 'green' : 'gray'}>{turma.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{descricaoTurma(turma)}</p>
                      <p className="mt-1 text-xs text-slate-500">{escolaName(escolas, turma.escolaId)} • {turma.anoLetivo}{vinculos.total > 0 ? ` • ${vinculos.total} vínculo${vinculos.total > 1 ? 's' : ''} ativo${vinculos.total > 1 ? 's' : ''}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(turma)}>Editar</Button>
                      <ActionMenu items={[
                        turma.status === 'ativa'
                          ? { label: 'Inativar turma', variant: 'danger', onClick: () => setInativandoTurma(turma) }
                          : { label: 'Reativar turma', onClick: () => setReativandoTurma(turma) },
                      ]} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {turmaForm && (
          <Modal title={editingTurma ? `Editar turma — ${editingTurma.nome}` : 'Nova turma'} onClose={fecharModal}>
            <form onSubmit={salvarTurma} className="space-y-4">
              {turmaError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{turmaError}</div>}
              {vinculosDaTurmaEmEdicao && vinculosDaTurmaEmEdicao.total > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Esta turma tem {vinculosDaTurmaEmEdicao.total} vínculo(s) ativo(s) ({vinculosDaTurmaEmEdicao.professores} professor(es), {vinculosDaTurmaEmEdicao.alunos} aluno(s) PDI{vinculosDaTurmaEmEdicao.auxiliar ? ', 1 auxiliar' : ''}). Alterar série/segmento, turno ou identificador muda o nome de exibição desta turma, mas todos os vínculos continuam preservados (eles apontam para o mesmo registro).
                </div>
              )}

              <FormField label="Escola">
                <select className={inputClass} value={turmaForm.escolaId} onChange={event => setTurmaForm(prev => ({ ...prev, escolaId: event.target.value }))} required>
                  <option value="" disabled>Selecione</option>
                  {escolasOrdenadas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Ano letivo">
                  <input className={inputClass} type="number" value={turmaForm.anoLetivo} onChange={event => setTurmaForm(prev => ({ ...prev, anoLetivo: event.target.value }))} required />
                </FormField>
                <FormField label="Etapa">
                  <select className={inputClass} value={turmaForm.etapa} onChange={event => mudarEtapa(event.target.value)}>
                    {ETAPAS.map(etapa => <option key={etapa.value} value={etapa.value}>{etapa.label}</option>)}
                  </select>
                </FormField>
              </div>

              {turmaForm.etapa === 'fundamental' ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Ano/série">
                    <select className={inputClass} value={turmaForm.anoSerie} onChange={event => setTurmaForm(prev => ({ ...prev, anoSerie: event.target.value }))}>
                      {ANOS_FUNDAMENTAL.map(ano => <option key={ano.value} value={ano.value}>{ano.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turno">
                    <select className={inputClass} value={turmaForm.turno} onChange={event => setTurmaForm(prev => ({ ...prev, turno: event.target.value }))}>
                      {TURNOS.map(turno => <option key={turno.value} value={turno.value}>{turno.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Identificador da turma">
                    <input className={inputClass} type="number" min="1" value={turmaForm.identificador} onChange={event => setTurmaForm(prev => ({ ...prev, identificador: event.target.value }))} required />
                  </FormField>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Segmento">
                    <select className={inputClass} value={turmaForm.segmento} onChange={event => mudarSegmento(event.target.value)}>
                      {SEGMENTOS_INFANTIL.map(segmento => <option key={segmento.value} value={segmento.value}>{segmento.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Nível">
                    <select className={inputClass} value={turmaForm.nivel} onChange={event => setTurmaForm(prev => ({ ...prev, nivel: event.target.value }))}>
                      {niveisDoSegmento(turmaForm.segmento).map(nivel => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Turno">
                    <select className={inputClass} value={turmaForm.turno} onChange={event => setTurmaForm(prev => ({ ...prev, turno: event.target.value }))}>
                      {TURNOS.map(turno => <option key={turno.value} value={turno.value}>{turno.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Identificador da turma">
                    <input className={inputClass} type="number" min="1" value={turmaForm.identificador} onChange={event => setTurmaForm(prev => ({ ...prev, identificador: event.target.value }))} required />
                  </FormField>
                </div>
              )}

              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={fecharModal}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {inativandoTurma && (
          <ConfirmDialog
            title="Inativar turma"
            message={(() => {
              const vinculos = vinculosDaTurma(inativandoTurma.id, { turmaProfessores, pdiAlunos, pdiAuxiliaresVinculos });
              return `Deseja inativar a turma "${inativandoTurma.nome}"? Ela deixa de aparecer como opção para novos vínculos, mas continua existindo para consulta histórica.${vinculos.total > 0 ? ` Os ${vinculos.total} vínculo(s) ativo(s) hoje (professores, alunos PDI, auxiliar) NÃO são removidos.` : ''}`;
            })()}
            confirmLabel="Inativar"
            onCancel={() => setInativandoTurma(null)}
            onConfirm={() => { inativarTurma(inativandoTurma.id); setInativandoTurma(null); setMessage(`Turma "${inativandoTurma.nome}" inativada com sucesso.`); }}
          />
        )}

        {reativandoTurma && (
          <ConfirmDialog
            title="Reativar turma"
            message={`Deseja reativar a turma "${reativandoTurma.nome}"? Ela volta a aparecer como opção normal para novos vínculos.`}
            confirmLabel="Reativar"
            onCancel={() => setReativandoTurma(null)}
            onConfirm={() => {
              const resultado = reativarTurma(reativandoTurma.id);
              setReativandoTurma(null);
              if (!resultado.ok) { setMessage(resultado.error); return; }
              setMessage(`Turma "${reativandoTurma.nome}" reativada com sucesso.`);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};

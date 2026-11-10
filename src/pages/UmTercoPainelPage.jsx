import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton, Badge, Button, Card, EmptyState, LoadingBlock, Modal, StatCard } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { BotaoExportarExcel } from '../components/BotaoExportarExcel';
import { useAuth } from '../context/AuthContext';
import { exportarUmTerco } from '../utils/exportarUmTerco';
import { obterEntregaUmTerco, obterPainelUmTerco } from '../services/formularioUmTerco';
import { inputClass } from '../utils/display';
import { agruparPorEscola, formatarDataHora, formatarPeriodo, STATUS_ENTREGA } from '../utils/umTerco';

const EVENTO_ROTULO = {
  INICIADA: 'Começou a preencher', SALVA: 'Salvou', CONCLUIDA: 'Concluiu',
  COBERTURA_ADICIONADA: 'Passou a valer para uma turma', COBERTURA_ENCERRADA: 'Deixou de valer para uma turma',
};

const DetalheEntregaModal = ({ cicloId, linha, onClose }) => {
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    obterEntregaUmTerco(cicloId, linha.professorId, linha.anoSerie, linha.disciplinaId).then(setDetalhe).catch(e => setErro(e.message));
  }, [cicloId, linha]);

  return (
    <Modal title={`${linha.professorNome} — ${linha.anoSerie}º ano ${linha.disciplinaNome}`} onClose={onClose}>
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</p>}
      {!detalhe && !erro && <LoadingBlock text="Carregando..." className="py-4" />}
      {detalhe && (
        <div className="space-y-5">
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Válido para:</p>
            {agruparPorEscola(detalhe.validoPara).map(e => <p key={e.escolaId}><span className="font-semibold">{e.escolaNome}</span> — {e.turmas.join(', ')}</p>)}
            {detalhe.validoPara.length === 0 && <p className="text-slate-500">Nenhuma turma ativa no momento.</p>}
          </div>
          <div className="space-y-3">
            {detalhe.semanas.map(s => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-900">{s.rotulo} <span className="font-normal text-slate-500">· {formatarPeriodo(s.dataInicio, s.dataFim)}</span></p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.texto || <span className="text-slate-400">Sem registro.</span>}</p>
              </div>
            ))}
          </div>
          {detalhe.coberturaHistorica.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-800">Vínculos cobertos (histórico)</p>
              <ul className="space-y-0.5 text-xs text-slate-600">
                {detalhe.coberturaHistorica.map((c, i) => <li key={i}>{c.escolaNome} — {c.turmaNome}: desde {formatarDataHora(c.desde)}{c.ate ? ` até ${formatarDataHora(c.ate)}` : ' (vigente)'}</li>)}
              </ul>
            </div>
          )}
          {detalhe.historico.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-800">Histórico</p>
              <ul className="space-y-0.5 text-xs text-slate-600">
                {detalhe.historico.map(h => <li key={h.id}>{formatarDataHora(h.quando)} — {EVENTO_ROTULO[h.tipo] ?? h.tipo}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export const UmTercoPainelPage = () => {
  const { cicloId } = useParams();
  const { user } = useAuth();
  const [filtros, setFiltros] = useState({ escolaId: '', anoSerie: '', disciplinaId: '', professorId: '', status: '' });
  const [painel, setPainel] = useState(null);
  const [opcoes, setOpcoes] = useState(null); // visão sem filtros, só para preencher os selects
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    obterPainelUmTerco(cicloId).then(setOpcoes).catch(e => setErro(e.message));
  }, [cicloId]);

  useEffect(() => {
    let ativo = true;
    setErro('');
    obterPainelUmTerco(cicloId, filtros).then(r => { if (ativo) setPainel(r); }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [cicloId, filtros]);

  const selects = useMemo(() => {
    const linhas = opcoes?.linhas ?? [];
    const unicos = (chaveId, chaveNome) => [...new Map(linhas.map(l => [l[chaveId], l[chaveNome]])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    return {
      escolas: (opcoes?.porEscola ?? []).map(e => [e.escolaId, e.escolaNome]),
      series: [...new Set(linhas.map(l => l.anoSerie))].sort((a, b) => a - b),
      disciplinas: unicos('disciplinaId', 'disciplinaNome'),
      professores: unicos('professorId', 'professorNome'),
    };
  }, [opcoes]);

  const definir = (campo) => (event) => setFiltros(prev => ({ ...prev, [campo]: event.target.value }));
  const resumo = painel?.resumo;
  // Exporta com os MESMOS filtros da tela (o backend aplica os mesmos filtros do painel).
  const nomeDe = (lista, id) => lista.find(([v]) => String(v) === String(id))?.[1];
  const exportar = () => exportarUmTerco({
    cicloId, filtros, usuario: user?.nome,
    rotulos: [
      ['Escola', filtros.escolaId ? nomeDe(selects.escolas, filtros.escolaId) : 'Todas as escolas'],
      ['Ano/série', filtros.anoSerie ? `${filtros.anoSerie}º ano` : 'Todos os anos'],
      ['Disciplina', filtros.disciplinaId ? nomeDe(selects.disciplinas, filtros.disciplinaId) : 'Todas as disciplinas'],
      ['Professor', filtros.professorId ? nomeDe(selects.professores, filtros.professorId) : 'Todos os professores'],
      ['Status', filtros.status ? STATUS_ENTREGA[filtros.status]?.label : 'Todos os status'],
    ],
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <BackButton />
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Painel de entregas</h1>
          {painel && <p className="mt-2 text-slate-600">{painel.ciclo.titulo} — {painel.ciclo.trimestre}º trimestre de {painel.ciclo.anoLetivo} · prazo {formatarDataHora(painel.ciclo.prazoEm)}</p>}
          <p className="mt-1 text-xs text-slate-500">Cada entrega é única por Professor + ano/série + disciplina, mesmo que valha para várias turmas e escolas.</p>
        </div>
        <BotaoExportarExcel gerar={exportar} disabled={!painel} />
        </div>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {!painel && !erro && <LoadingBlock text="Carregando painel..." />}

        {resumo && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Esperadas" value={resumo.esperado} />
              <StatCard label="Concluídas" value={resumo.concluidas} />
              <StatCard label="Em andamento" value={resumo.emAndamento} />
              <StatCard label="Não iniciadas" value={resumo.naoIniciadas} />
              <StatCard label="Entrega" value={`${resumo.percentualEntrega}%`} />
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={resumo.percentualEntrega} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${resumo.percentualEntrega}%` }} />
            </div>
          </>
        )}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select aria-label="Escola" className={inputClass} value={filtros.escolaId} onChange={definir('escolaId')}>
              <option value="">Todas as escolas</option>
              {selects.escolas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select aria-label="Ano/série" className={inputClass} value={filtros.anoSerie} onChange={definir('anoSerie')}>
              <option value="">Todos os anos</option>
              {selects.series.map(s => <option key={s} value={s}>{s}º ano</option>)}
            </select>
            <select aria-label="Disciplina" className={inputClass} value={filtros.disciplinaId} onChange={definir('disciplinaId')}>
              <option value="">Todas as disciplinas</option>
              {selects.disciplinas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select aria-label="Professor" className={inputClass} value={filtros.professorId} onChange={definir('professorId')}>
              <option value="">Todos os professores</option>
              {selects.professores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select aria-label="Status" className={inputClass} value={filtros.status} onChange={definir('status')}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_ENTREGA).map(([valor, { label }]) => <option key={valor} value={valor}>{label}</option>)}
            </select>
          </div>
        </Card>

        {painel && painel.porEscola.length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-slate-800">Cobertura por escola</p>
            <p className="text-xs text-slate-500">Uma entrega aparece em cada escola que ela atinge; não soma ao total acima.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {painel.porEscola.map(e => (
                <span key={e.escolaId} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{e.escolaNome}: {e.concluidas}/{e.esperado}</span>
              ))}
            </div>
          </Card>
        )}

        {painel && painel.linhas.length === 0 && <EmptyState title="Nenhuma entrega encontrada" description="Ajuste os filtros ou confira se há turmas do Fundamental com professor vinculado." />}

        <div className="space-y-3">
          {(painel?.linhas ?? []).map(linha => {
            const status = STATUS_ENTREGA[linha.status];
            const escolas = agruparPorEscola(linha.turmas);
            return (
              <Card key={`${linha.professorId}-${linha.anoSerie}-${linha.disciplinaId}`}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{linha.professorNome}</p>
                    <p className="text-sm text-slate-600">{linha.anoSerie}º ano — {linha.disciplinaNome}</p>
                    <p className="mt-1 text-xs text-slate-500">{escolas.map(e => `${e.escolaNome} (${e.turmas.join(', ')})`).join(' · ') || 'Sem turma ativa'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600">{linha.semanasPreenchidas}/{linha.totalSemanas}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Button size="sm" variant="outline" disabled={!linha.entregaId} onClick={() => setDetalhe(linha)}>Ver</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      {detalhe && <DetalheEntregaModal cicloId={cicloId} linha={detalhe} onClose={() => setDetalhe(null)} />}
    </MainLayout>
  );
};

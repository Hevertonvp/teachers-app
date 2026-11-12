import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton, Badge, Button, Card, EmptyState, LoadingBlock, Modal, StatCard } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { BotaoExportarExcel } from '../components/BotaoExportarExcel';
import { useAuth } from '../context/AuthContext';
import { useFiltroEscolaDoTopo } from '../context/EscolaContext';
import { exportarUmTerco } from '../utils/exportarUmTerco';
import { aceitarCorrecaoUmTerco, devolverEntregaUmTerco, obterEntregaUmTerco, obterPainelUmTerco } from '../services/formularioUmTerco';
import { FormEnviarParaCorrecao, HistoricoCorrecoes, SeloCorrecao, correcaoPendente } from '../components/Correcoes';
import { inputClass } from '../utils/display';
import { formatarDataHora, formatarPeriodo, STATUS_ENTREGA } from '../utils/umTerco';
import { AvisoFolhaCompartilhada, ComposicaoCargo } from '../components/ComposicaoCargo';
import { descreverParteCargo } from '../services/cargos';

const EVENTO_ROTULO = {
  INICIADA: 'Começou a preencher', SALVA: 'Salvou', CONCLUIDA: 'Concluiu',
  COBERTURA_ADICIONADA: 'Passou a valer para uma turma (modelo antigo)', COBERTURA_ENCERRADA: 'Deixou de valer para uma turma (modelo antigo)',
};

const DetalheEntregaModal = ({ cicloId, linha, onClose, onAlterado }) => {
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [devolvendo, setDevolvendo] = useState(false);
  const recarregar = () => obterEntregaUmTerco(cicloId, linha.professorId, linha.cargoId).then(setDetalhe).catch(e => setErro(e.message));
  useEffect(() => { recarregar(); }, [cicloId, linha]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fluxo de correções (10/11/2026): enviar para correção (orientações + confirmação) e aceitar.
  const devolver = async (texto) => {
    const r = await devolverEntregaUmTerco(detalhe.entregaId, texto);
    setDevolvendo(false);
    setAviso(r.mensagensEnviadas ? 'Correção enviada. O professor recebeu a mensagem com as orientações e o prazo.' : 'Correção registrada.');
    await recarregar(); onAlterado?.();
  };
  const aceitar = async () => {
    setErro(''); setAviso('');
    try { await aceitarCorrecaoUmTerco(detalhe.entregaId); setAviso('Correção aceita.'); await recarregar(); onAlterado?.(); } catch (e) { setErro(e.message); }
  };
  const ultima = detalhe?.correcao ?? null;

  return (
    <Modal title={`${linha.professorNome} — ${linha.rotulo}`} onClose={onClose}>
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</p>}
      {!detalhe && !erro && <LoadingBlock text="Carregando..." className="py-4" />}
      {detalhe && (
        <div className="space-y-5">
          {aviso && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
          {devolvendo ? (
            <FormEnviarParaCorrecao descricao="Só este formulário (este cargo) é liberado para o professor corrigir." onConfirmar={devolver} onFechar={() => setDevolvendo(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {detalhe.status === 'concluida' && !correcaoPendente(ultima) && <Button size="sm" variant="outline" onClick={() => setDevolvendo(true)}>Enviar para correção</Button>}
              {ultima?.situacao === 'recebida' && <Button size="sm" variant="outline" onClick={aceitar}>Aceitar correção</Button>}
              {ultima && <SeloCorrecao situacao={ultima.situacao} />}
              {ultima?.situacao === 'recebida' && ultima.enviadaForaDoPrazo && <span className="text-xs text-slate-500">enviada fora do prazo</span>}
            </div>
          )}
          <ComposicaoCargo composicao={detalhe.composicao} />
          <AvisoFolhaCompartilhada texto={detalhe.avisoCompartilhada} />
          {!detalhe.esperada && <p className="text-sm text-slate-500">Cargo encerrado durante o ciclo: este registro fica guardado, fora do esperado e dos percentuais.</p>}
          <div className="space-y-3">
            {detalhe.semanas.map(s => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-900">{s.rotulo} <span className="font-normal text-slate-500">· {formatarPeriodo(s.dataInicio, s.dataFim)}</span></p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.texto || <span className="text-slate-400">Sem registro.</span>}</p>
              </div>
            ))}
          </div>
          <HistoricoCorrecoes correcoes={detalhe.correcoes} />
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
  const [filtros, setFiltros] = useState({ escolaId: '', disciplinaId: '', professorId: '', status: '', correcao: '' });
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

  // Filtro de escola segue o seletor do topo (só no sentido topo → filtro), se a escola fizer parte do ciclo.
  const [escolaDoTopo] = useFiltroEscolaDoTopo('', opcoes ? (opcoes.porEscola ?? []).map(e => e.escolaId) : []);
  useEffect(() => {
    setFiltros(prev => (prev.escolaId === escolaDoTopo ? prev : { ...prev, escolaId: escolaDoTopo }));
  }, [escolaDoTopo]);

  const selects = useMemo(() => {
    const linhas = opcoes?.linhas ?? [];
    const ordenar = (mapa) => [...mapa.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
    return {
      escolas: (opcoes?.porEscola ?? []).map(e => [e.escolaId, e.escolaNome]),
      disciplinas: ordenar(new Map(linhas.flatMap(l => l.disciplinas.map(d => [d.id, d.nome])))),
      professores: ordenar(new Map(linhas.map(l => [l.professorId, l.professorNome]))),
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
          <p className="mt-1 text-xs text-slate-500">Cada entrega é um formulário por cargo do Professor, mesmo que o cargo tenha várias escolas e disciplinas.</p>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select aria-label="Escola" className={inputClass} value={filtros.escolaId} onChange={definir('escolaId')}>
              <option value="">Todas as escolas</option>
              {selects.escolas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
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
            <select aria-label="Correção" className={inputClass} value={filtros.correcao} onChange={definir('correcao')}>
              <option value="">Todas (correção)</option>
              <option value="em_andamento">Com correção em andamento</option>
            </select>
          </div>
        </Card>

        {painel && painel.porEscola.length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-slate-800">Cobertura por escola</p>
            <p className="text-xs text-slate-500">Um formulário que cobre duas escolas aparece nas duas; no total acima ele conta uma vez só.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {painel.porEscola.map(e => (
                <span key={e.escolaId} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{e.escolaNome}: {e.concluidas}/{e.esperado}</span>
              ))}
            </div>
          </Card>
        )}

        {painel && painel.linhas.length === 0 && <EmptyState title="Nenhuma entrega encontrada" description="Ajuste os filtros ou confira se os professores têm cargos cadastrados nas escolas deste ciclo." />}

        <div className="space-y-3">
          {(painel?.linhas ?? []).map(linha => {
            const status = STATUS_ENTREGA[linha.status];
            return (
              <Card key={`${linha.professorId}-${linha.cargoId}`}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{linha.professorNome}</p>
                    <p className="text-sm text-slate-600">{linha.rotulo}{linha.compartilhada ? ' (mesma configuração nos dois cargos)' : ''}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">{linha.composicao.map(descreverParteCargo).join(' · ')}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-slate-600">{linha.semanasPreenchidas}/{linha.totalSemanas}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {linha.correcao && <SeloCorrecao situacao={linha.correcao} />}
                    <Button size="sm" variant="outline" disabled={!linha.entregaId} onClick={() => setDetalhe(linha)}>Ver</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {(painel?.foraDoEsperado ?? []).length > 0 && (
          <Card>
            <p className="text-sm font-semibold text-slate-800">Fora do esperado ({painel.foraDoEsperado.length})</p>
            <p className="text-xs text-slate-500">Cargos encerrados durante o ciclo que já tinham registro. O conteúdo fica guardado, mas não entra no total nem nos percentuais.</p>
            <ul className="mt-3 space-y-2">
              {painel.foraDoEsperado.map(linha => (
                <li key={`${linha.professorId}-${linha.cargoId}`} className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center">
                  <span className="min-w-0 break-words text-sm text-slate-700"><span className="font-semibold">{linha.professorNome}</span> · {linha.composicao.map(descreverParteCargo).join(' · ')}</span>
                  <Button size="sm" variant="outline" onClick={() => setDetalhe(linha)}>Ver</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {detalhe && <DetalheEntregaModal cicloId={cicloId} linha={detalhe} onClose={() => setDetalhe(null)} onAlterado={() => setFiltros(prev => ({ ...prev }))} />}
    </MainLayout>
  );
};

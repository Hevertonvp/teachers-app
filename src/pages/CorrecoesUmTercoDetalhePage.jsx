import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, LoadingBlock } from '../components/Common';
import { HistoricoCorrecoes, ModalEnviarParaCorrecao, SeloCorrecao, SITUACAO_CORRECAO_UM_TERCO, formatarPrazoCorrecao } from '../components/Correcoes';
import { AvisoFolhaCompartilhada, ComposicaoCargo } from '../components/ComposicaoCargo';
import { MainLayout } from '../layouts/Layouts';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { apagarDraft, lerDraft, salvarDraft } from '../offline/db';
import { corrigirUmTercoDiretamente, obterCorrecaoUmTerco } from '../services/correcoesUmTerco';
import { aceitarCorrecaoUmTerco, devolverEntregaUmTerco } from '../services/formularioUmTerco';
import { inputClass } from '../utils/display';
import { formatarPeriodo } from '../utils/umTerco';

const ORIGEM = { SECRETARIA_DIRETA: 'Correção direta da Secretaria', PROFESSOR_POS_DEVOLUCAO: 'Professor, durante a correção' };

// Folha em Correções → Formulário 1/3 (12/11/2026): conteúdo, histórico e as duas ações da Secretaria —
// "Corrigir diretamente" (salva, registra valor anterior/novo e avisa o Professor; não abre prazo) e
// "Enviar para correção" (orientações obrigatórias, 3 dias só para esta folha). Folha de cargo encerrado:
// só consulta. Conflito (409) nunca sobrescreve: mostra a versão atual e mantém o texto da Secretaria.
export const CorrecoesUmTercoDetalhePage = () => {
  const { entregaId } = useParams();
  const { user } = useAuth();
  const { online } = useNetworkStatus();
  const draftKey = `${user?.email?.toLowerCase()}::correcao-um-terco::${entregaId}`;
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [editando, setEditando] = useState(false);
  const [textos, setTextos] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState(false);
  const [devolver, setDevolver] = useState(false);

  const carregar = async () => {
    setErro('');
    try {
      const d = await obterCorrecaoUmTerco(entregaId);
      setDados(d);
      const rascunho = await lerDraft(draftKey);
      if (rascunho?.textos && d.podeCorrigir) { setTextos(rascunho.textos); setEditando(true); setMensagem('Recuperamos a correção que você estava fazendo neste aparelho (ainda não salva).'); }
      return d;
    } catch (e) { setErro(e.message); return null; }
  };
  useEffect(() => { carregar(); }, [entregaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editando) return undefined;
    const t = setTimeout(() => salvarDraft(draftKey, { textos, savedAt: Date.now() }), 400);
    return () => clearTimeout(t);
  }, [textos, editando, draftKey]);

  const comecarCorrecao = () => { setMensagem(''); setConflito(false); setTextos(Object.fromEntries(dados.semanas.map((s) => [s.id, s.texto]))); setEditando(true); };
  const cancelar = () => { apagarDraft(draftKey); setEditando(false); setTextos({}); setConflito(false); };

  const salvar = async () => {
    setErro(''); setMensagem('');
    if (!online) { setMensagem('Sem conexão: a correção ficou guardada neste aparelho. Salve quando a internet voltar.'); return; }
    const respostas = dados.semanas.filter((s) => (textos[s.id] ?? '') !== s.texto).map((s) => ({ semanaId: s.id, texto: textos[s.id] ?? '' }));
    if (respostas.length === 0) { setMensagem('Nenhuma alteração para salvar.'); return; }
    setSalvando(true);
    try {
      const r = await corrigirUmTercoDiretamente(entregaId, respostas, dados.updatedAt);
      apagarDraft(draftKey);
      setDados(r); setEditando(false); setTextos({});
      setMensagem(r.mensagensEnviadas ? 'Correção salva. O professor recebeu uma mensagem avisando da alteração.' : 'Correção salva.');
    } catch (e) {
      if (e.codigo === 'CONFLITO_VERSAO') {
        setConflito(true);
        if (e.dadosAtuais) setDados(e.dadosAtuais);
      } else if (!e.codigo && /conectar ao servidor/.test(e.message || '')) {
        setMensagem('Sem conexão: a correção ficou guardada neste aparelho. Salve quando a internet voltar.');
      } else setErro(e.message);
    } finally { setSalvando(false); }
  };

  const confirmarDevolucao = async (texto) => {
    const r = await devolverEntregaUmTerco(entregaId, texto);
    setDevolver(false);
    setMensagem(r.mensagensEnviadas ? 'Correção enviada. O professor recebeu a mensagem com as orientações e o prazo de 3 dias.' : 'Correção registrada.');
    await carregar();
  };
  const considerarResolvida = async () => {
    setErro('');
    try { await aceitarCorrecaoUmTerco(entregaId); setMensagem('Correção considerada resolvida.'); await carregar(); } catch (e) { setErro(e.message); }
  };

  if (!dados) return <MainLayout>{erro ? <Card className="py-10 text-center"><p className="font-semibold text-slate-800">{erro}</p><Link to="/correcoes/um-terco" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">← Voltar</Link></Card> : <LoadingBlock text="Carregando folha..." />}</MainLayout>;

  const ultima = dados.correcoes[0] ?? null;
  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-5 pb-16">
        <div>
          <Link to="/correcoes/um-terco" className="text-sm font-semibold text-teal-700 hover:underline">← Correções &gt; Formulário 1/3</Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-teal-700">{dados.ciclo.titulo} · {dados.ciclo.trimestre}º trimestre de {dados.ciclo.anoLetivo}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">{dados.professor.nome} — {dados.rotulo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <SeloCorrecao situacao={dados.situacao} mapa={SITUACAO_CORRECAO_UM_TERCO} />
            <span>Concluída em {formatarPrazoCorrecao(dados.concluidaEm)}</span>
            {ultima && ['solicitada', 'expirada'].includes(ultima.situacao) && <span>· prazo da correção: {formatarPrazoCorrecao(ultima.prazoAte)}</span>}
          </div>
        </div>

        <Card>
          <ComposicaoCargo composicao={dados.composicao} />
        </Card>
        <AvisoFolhaCompartilhada texto={dados.avisoCompartilhada} />
        {dados.somenteConsulta && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{dados.motivoSomenteConsulta}</div>}
        {!dados.professor.ativo && !dados.somenteConsulta && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">O professor está inativo: dá para corrigir diretamente, mas não para enviar para correção.</div>}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {conflito && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Esta folha foi alterada enquanto você corrigia (pelo professor ou por outra pessoa). Nada foi sobrescrito.</p>
            <p className="mt-1">Abaixo está a versão atual. O seu texto continua nos campos: confira e salve de novo, ou descarte.</p>
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setConflito(false)}>Entendi</Button><Button size="sm" variant="secondary" onClick={cancelar}>Descartar minha correção</Button></div>
          </div>
        )}

        {!editando && (
          <div className="flex flex-wrap gap-2">
            {dados.podeCorrigir && <Button onClick={comecarCorrecao}>Corrigir diretamente</Button>}
            {dados.podeDevolver && <Button variant="outline" onClick={() => setDevolver(true)}>Enviar para correção</Button>}
            {dados.podeConsiderarResolvida && <Button variant="outline" onClick={considerarResolvida}>Considerar resolvida</Button>}
            {!dados.podeDevolver && dados.podeCorrigir && ultima?.situacao === 'solicitada' && <span className="self-center text-xs text-slate-500">Já há uma correção aguardando o professor.</span>}
          </div>
        )}

        <div className="space-y-3">
          {dados.semanas.map((s) => (
            <Card key={s.id}>
              <p className="text-sm font-bold text-slate-900">{s.rotulo} <span className="font-normal text-slate-500">· {formatarPeriodo(s.dataInicio, s.dataFim)}</span></p>
              {editando ? (
                <>
                  {conflito && (textos[s.id] ?? '') !== s.texto && <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-600"><span className="font-semibold">Versão atual:</span> {s.texto}</p>}
                  <textarea className={`${inputClass} mt-2 min-h-28`} aria-label={`Conteúdo da ${s.rotulo}`} value={textos[s.id] ?? ''} onChange={(e) => setTextos((prev) => ({ ...prev, [s.id]: e.target.value }))} />
                </>
              ) : <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.texto || <span className="text-slate-400">Sem registro.</span>}</p>}
            </Card>
          ))}
        </div>

        {editando && (
          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 sm:mx-0 sm:rounded-lg sm:border">
            <span className="mr-auto self-center text-xs text-slate-500">O professor recebe uma mensagem avisando da correção. Não abre prazo para ele.</span>
            <Button variant="secondary" onClick={cancelar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} loading={salvando}>Salvar correção</Button>
          </div>
        )}

        <HistoricoCorrecoes correcoes={dados.correcoes} />

        {dados.historicoValores.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Alterações de texto</p>
            <ul className="mt-3 space-y-3">
              {dados.historicoValores.map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="text-xs text-slate-500">Semana {h.semanaNumero} · {ORIGEM[h.origem] ?? h.origem}{h.alteradoPorNome ? ` (${h.alteradoPorNome})` : ''} · {formatarPrazoCorrecao(h.alteradoEm)}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Antes</p>
                  <p className="whitespace-pre-wrap text-slate-600">{h.valorAnterior || '—'}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Depois</p>
                  <p className="whitespace-pre-wrap text-slate-800">{h.valorNovo}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Linha do tempo</p>
          <ul className="mt-3 space-y-2 text-sm">
            {dados.linhaDoTempo.map((ev, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3">
                <p className="text-xs text-slate-500">{formatarPrazoCorrecao(ev.quando)}</p>
                <p className="text-slate-800">{ev.texto.replace(/prazo até (\S+)$/, (_, d) => `prazo até ${formatarPrazoCorrecao(d)}`)}</p>
                {ev.detalhe && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{ev.detalhe}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {devolver && <ModalEnviarParaCorrecao descricao="A folha inteira fica liberada para o professor por 3 dias, só ela (o ciclo não é reaberto)." onConfirmar={confirmarDevolucao} onFechar={() => setDevolver(false)} />}
    </MainLayout>
  );
};

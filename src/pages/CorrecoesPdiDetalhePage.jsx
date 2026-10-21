import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField, Modal } from '../components/Common';
import { HabilidadesCrmgSelecao } from '../components/HabilidadesCrmgSelecao';
import { inputClass } from '../utils/display';
import { obterCorrecaoPdiReal, corrigirDiretamenteReal, devolverFichaPdiReal, corrigirDiretamentePadraoReal, devolverPadraoReal } from '../services/correcoesPdi';
import { MainLayout } from '../layouts/Layouts';
import { useAuth } from '../context/AuthContext';
import { lerDraft, salvarDraft, apagarDraft } from '../offline/db';
import { enfileirar } from '../offline/syncQueue';
import { SavingIndicator } from '../components/SavingIndicator';

const STATUS_CORRECAO_LABEL = { ABERTA: 'Aberta', RESOLVIDA: 'Resolvida', EXPIRADA: 'Expirada' };
const STATUS_CORRECAO_VARIANT = { ABERTA: 'yellow', RESOLVIDA: 'blue', EXPIRADA: 'gray' };
const ORIGEM_LABEL = { SECRETARIA_DIRETA: 'Secretaria (direta)', PROFESSOR_POS_DEVOLUCAO: 'Professor (pós-devolução)' };

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const formatarValor = (valor) => (valor && typeof valor === 'object' ? (valor.resposta ?? '—') : (valor ?? '—'));

// Detalhe de Correções > PDI (seção 17/26/28-31 do pedido): corrigir diretamente (mesmo fora do
// prazo da Aplicação, sem reabri-la) ou devolver ao Professor atual por 3 dias. Nunca mexe em
// ReaberturaPdi/Aplicação — a Ficha reabre sozinha, individualmente (ver backend).
export const CorrecoesPdiDetalhePage = () => {
  const { fichaId } = useParams();
  const { user } = useAuth();
  const userId = user?.email?.toLowerCase();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [conflito, setConflito] = useState('');
  const [edicoes, setEdicoes] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [statusLocal, setStatusLocal] = useState('idle');
  const [devolverAberto, setDevolverAberto] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [devolvendo, setDevolvendo] = useState(false);
  // Fluxo SEPARADO para o bloco comum de perguntas padrão (nunca misturar com o específico acima
  // — ver backend correcoesPdi.ts): identidade por aplicacaoPerguntaPadraoId, não aplicacaoPerguntaId.
  const [edicoesPadrao, setEdicoesPadrao] = useState({});
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [devolverPadraoAberto, setDevolverPadraoAberto] = useState(false);
  const [observacaoPadrao, setObservacaoPadrao] = useState('');
  const [devolvendoPadrao, setDevolvendoPadrao] = useState(false);

  const draftKeyEspecifica = `${userId}::correcao-resposta::${fichaId}`;
  const draftKeyPadrao = `${userId}::correcao-bloco::${fichaId}`;

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await obterCorrecaoPdiReal(fichaId);
      setDados(resultado);
      // Restaura rascunho local de correção ainda não enviada (sobrevive a reload/fechamento).
      const [draftEspecifica, draftPadrao] = await Promise.all([lerDraft(draftKeyEspecifica), lerDraft(draftKeyPadrao)]);
      setEdicoes(draftEspecifica?.edicoes || {});
      setEdicoesPadrao(draftPadrao?.edicoes || {});
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [fichaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salvamento local com debounce leve — mesma infra de FormularioPdiProfessor.jsx.
  useEffect(() => {
    if (Object.keys(edicoes).length === 0) return undefined;
    const t = setTimeout(() => salvarDraft(draftKeyEspecifica, { userId, edicoes, savedAt: Date.now() }), 500);
    return () => clearTimeout(t);
  }, [edicoes, draftKeyEspecifica, userId]);
  useEffect(() => {
    if (Object.keys(edicoesPadrao).length === 0) return undefined;
    const t = setTimeout(() => salvarDraft(draftKeyPadrao, { userId, edicoes: edicoesPadrao, savedAt: Date.now() }), 500);
    return () => clearTimeout(t);
  }, [edicoesPadrao, draftKeyPadrao, userId]);

  const respostaAtual = (perguntaId) => dados?.respostas.find((r) => r.aplicacaoPerguntaId === perguntaId)?.valor ?? {};

  const salvarCorrecao = async () => {
    const respostas = Object.entries(edicoes).map(([aplicacaoPerguntaId, valor]) => ({
      aplicacaoPerguntaId: Number(aplicacaoPerguntaId),
      valor: { resposta: valor, complementarTexto: respostaAtual(Number(aplicacaoPerguntaId)).complementarTexto || '' },
    }));
    if (respostas.length === 0) return;
    setSalvando(true);
    setStatusLocal('saving');
    setMensagem('');
    setConflito('');
    try {
      await corrigirDiretamenteReal(fichaId, respostas, dados.ficha.updatedAt);
      apagarDraft(draftKeyEspecifica);
      setStatusLocal('saved');
      setMensagem('Correção salva com sucesso.');
      await carregar();
    } catch (error) {
      if (error.codigo === 'CONFLITO_VERSAO') {
        setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.');
      } else if (!error.codigo && /conectar ao servidor/.test(error.message || '')) {
        await enfileirar({
          userId, resourceType: 'correcao-resposta', resourceId: fichaId, operation: 'respostas',
          endpoint: `/api/correcoes-pdi/${fichaId}/respostas`, method: 'PUT',
          payload: { respostas }, baseTokenField: 'baseUpdatedAt', baseToken: dados.ficha.updatedAt,
        });
        setStatusLocal('saved');
        setMensagem('Sem conexão — a correção foi protegida e será enviada automaticamente quando a conexão voltar.');
      } else {
        setStatusLocal('idle');
        setErro(error.message);
      }
    } finally {
      setSalvando(false);
    }
  };

  const confirmarDevolucao = async () => {
    if (!observacao.trim()) return;
    setDevolvendo(true);
    try {
      await devolverFichaPdiReal(fichaId, observacao.trim());
      setDevolverAberto(false);
      setObservacao('');
      setMensagem('Ficha devolvida ao Professor responsável atual — janela de 3 dias aberta.');
      await carregar();
    } catch (error) {
      setErro(error.message);
    } finally {
      setDevolvendo(false);
    }
  };

  const respostaPadraoAtual = (aplicacaoPerguntaPadraoId) => dados?.blocoPadrao?.respostas.find((r) => r.aplicacaoPerguntaPadraoId === aplicacaoPerguntaPadraoId)?.valor ?? {};

  const salvarCorrecaoPadrao = async () => {
    const respostas = Object.entries(edicoesPadrao).map(([aplicacaoPerguntaPadraoId, valor]) => ({
      aplicacaoPerguntaPadraoId: Number(aplicacaoPerguntaPadraoId),
      valor: { resposta: valor, complementarTexto: respostaPadraoAtual(Number(aplicacaoPerguntaPadraoId)).complementarTexto || '' },
    }));
    if (respostas.length === 0) return;
    setSalvandoPadrao(true);
    setMensagem('');
    setConflito('');
    try {
      await corrigirDiretamentePadraoReal(fichaId, respostas, dados.blocoPadrao.version);
      apagarDraft(draftKeyPadrao);
      setMensagem('Correção da pergunta padrão salva com sucesso — vale para todas as disciplinas deste Professor.');
      await carregar();
    } catch (error) {
      if (error.codigo === 'CONFLITO_VERSAO') {
        setConflito('Este registro foi alterado enquanto você estava sem conexão. Suas alterações continuam protegidas e precisam ser revisadas antes da sincronização.');
      } else if (!error.codigo && /conectar ao servidor/.test(error.message || '')) {
        await enfileirar({
          userId, resourceType: 'correcao-bloco', resourceId: fichaId, operation: 'respostas-padrao',
          endpoint: `/api/correcoes-pdi/${fichaId}/respostas-padrao`, method: 'PUT',
          payload: { respostas }, baseTokenField: 'version', baseToken: dados.blocoPadrao.version,
        });
        setMensagem('Sem conexão — a correção foi protegida e será enviada automaticamente quando a conexão voltar.');
      } else {
        setErro(error.message);
      }
    } finally {
      setSalvandoPadrao(false);
    }
  };

  const confirmarDevolucaoPadrao = async () => {
    if (!observacaoPadrao.trim()) return;
    setDevolvendoPadrao(true);
    try {
      await devolverPadraoReal(fichaId, observacaoPadrao.trim());
      setDevolverPadraoAberto(false);
      setObservacaoPadrao('');
      setMensagem('Pergunta padrão devolvida ao Professor responsável atual — vale para todas as disciplinas deste Professor, janela de 3 dias aberta.');
      await carregar();
    } catch (error) {
      setErro(error.message);
    } finally {
      setDevolvendoPadrao(false);
    }
  };

  if (carregando) return <MainLayout><p className="text-center text-slate-500">Carregando...</p></MainLayout>;
  if (erro && !dados) return (
    <MainLayout>
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>
    </MainLayout>
  );
  if (!dados) return null;

  const { ficha, perguntas } = dados;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/correcoes/pdi" className="text-sm font-semibold text-teal-700 hover:underline">← Correções &gt; PDI</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{ficha.alunoNome}</h1>
          <p className="mt-1 text-slate-600">{ficha.escolaNome} · {ficha.turmaNome} · {ficha.disciplinaNome}</p>
        </div>

        {conflito && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <span>{conflito}</span>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        )}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <p><strong>Professor (no momento da conclusão):</strong> {ficha.professorNome}</p>
            {dados.professorResponsavelAtual && dados.professorResponsavelAtual.nome !== ficha.professorNome && (
              <p><strong>Professor responsável atual:</strong> {dados.professorResponsavelAtual.nome}</p>
            )}
            {!dados.professorResponsavelAtual && <p className="text-amber-700"><strong>Professor responsável atual:</strong> nenhum vínculo ativo</p>}
            <p><strong>Aplicação:</strong> {new Date(ficha.aplicacaoDataInicio).toLocaleDateString('pt-BR')} a {new Date(ficha.aplicacaoDataFim).toLocaleDateString('pt-BR')}</p>
            <p><strong>Concluída em:</strong> {formatarDataHora(ficha.concluidaEm)}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button onClick={salvarCorrecao} disabled={Object.keys(edicoes).length === 0 || salvando}>{salvando ? 'Salvando...' : 'Salvar correção direta'}</Button>
            <Button variant="outline" onClick={() => setDevolverAberto(true)}>Devolver ao Professor</Button>
            <SavingIndicator estado={statusLocal} />
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Respostas</p>
          <div className="mt-3 divide-y divide-slate-100">
            {perguntas.filter((p) => p.tipoResposta !== 'ORIENTACAO').map((pergunta) => {
              const valorAtual = respostaAtual(pergunta.id);
              const valorEditado = edicoes[pergunta.id];
              const valorExibido = valorEditado !== undefined ? valorEditado : valorAtual.resposta;
              return (
                <div key={pergunta.id} className="py-3">
                  <p className="text-sm font-semibold text-slate-800">{pergunta.texto}</p>
                  {pergunta.tipoResposta === 'HABILIDADE_CRMG' ? (
                    // Só leitura: habilidades marcadas, com código/descrição congelados na resposta.
                    // Para alterar, a Secretaria devolve a Ficha ao Professor (fluxo de sempre).
                    <div className="mt-2">
                      <HabilidadesCrmgSelecao value={valorAtual} readOnly />
                    </div>
                  ) : (
                  <div className="mt-2 max-w-md">
                    {pergunta.tipoResposta === 'SELECAO' ? (
                      <select className={inputClass} value={valorExibido ?? ''} onChange={(event) => setEdicoes((prev) => ({ ...prev, [pergunta.id]: event.target.value }))}>
                        <option value="">—</option>
                        {(pergunta.opcoes || []).map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                      </select>
                    ) : pergunta.tipoResposta === 'MARCACAO' ? (
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input type="checkbox" checked={!!valorExibido} onChange={(event) => setEdicoes((prev) => ({ ...prev, [pergunta.id]: event.target.checked }))} />
                        Marcado
                      </label>
                    ) : pergunta.tipoResposta === 'NUMERO' ? (
                      <input type="number" className={inputClass} value={valorExibido ?? ''} onChange={(event) => setEdicoes((prev) => ({ ...prev, [pergunta.id]: event.target.value === '' ? null : Number(event.target.value) }))} />
                    ) : (
                      <textarea className={inputClass} rows="3" value={valorExibido ?? ''} onChange={(event) => setEdicoes((prev) => ({ ...prev, [pergunta.id]: event.target.value }))} />
                    )}
                  </div>
                  )}
                  {valorEditado !== undefined && <p className="mt-1 text-xs text-amber-700">Valor anterior: {formatarValor(valorAtual)}</p>}
                </div>
              );
            })}
          </div>
        </Card>

        {dados.blocoPadrao && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Perguntas padrão (bloco comum)</p>
            </div>
            {dados.blocoPadrao.compartilhadoCom.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Compartilhada com: {dados.blocoPadrao.compartilhadoCom.map((f) => f.disciplinaNome).join(', ')}. Corrigir ou devolver aqui vale para todas de uma vez — nunca uma correção duplicada por disciplina.
              </p>
            )}
            <div className="mt-3 divide-y divide-slate-100">
              {dados.blocoPadrao.perguntas.filter((p) => p.tipoResposta !== 'ORIENTACAO').map((pergunta) => {
                const valorAtual = respostaPadraoAtual(pergunta.id);
                const valorEditado = edicoesPadrao[pergunta.id];
                const valorExibido = valorEditado !== undefined ? valorEditado : valorAtual.resposta;
                return (
                  <div key={pergunta.id} className="py-3">
                    <p className="text-sm font-semibold text-slate-800">{pergunta.texto}</p>
                    <div className="mt-2 max-w-md">
                      {pergunta.tipoResposta === 'SELECAO' ? (
                        <select className={inputClass} value={valorExibido ?? ''} onChange={(event) => setEdicoesPadrao((prev) => ({ ...prev, [pergunta.id]: event.target.value }))}>
                          <option value="">—</option>
                          {(pergunta.opcoes || []).map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                        </select>
                      ) : pergunta.tipoResposta === 'MARCACAO' ? (
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input type="checkbox" checked={!!valorExibido} onChange={(event) => setEdicoesPadrao((prev) => ({ ...prev, [pergunta.id]: event.target.checked }))} />
                          Marcado
                        </label>
                      ) : pergunta.tipoResposta === 'NUMERO' ? (
                        <input type="number" className={inputClass} value={valorExibido ?? ''} onChange={(event) => setEdicoesPadrao((prev) => ({ ...prev, [pergunta.id]: event.target.value === '' ? null : Number(event.target.value) }))} />
                      ) : (
                        <textarea className={inputClass} rows="3" value={valorExibido ?? ''} onChange={(event) => setEdicoesPadrao((prev) => ({ ...prev, [pergunta.id]: event.target.value }))} />
                      )}
                    </div>
                    {valorEditado !== undefined && <p className="mt-1 text-xs text-amber-700">Valor anterior: {formatarValor(valorAtual)}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button onClick={salvarCorrecaoPadrao} disabled={Object.keys(edicoesPadrao).length === 0 || salvandoPadrao}>{salvandoPadrao ? 'Salvando...' : 'Salvar correção da pergunta padrão'}</Button>
              <Button variant="outline" onClick={() => setDevolverPadraoAberto(true)}>Devolver pergunta padrão</Button>
            </div>
          </Card>
        )}

        {dados.correcoesBloco?.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Histórico de devoluções — pergunta padrão</p>
            <ul className="mt-3 space-y-3">
              {dados.correcoesBloco.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={STATUS_CORRECAO_VARIANT[c.status]}>{STATUS_CORRECAO_LABEL[c.status]}</Badge>
                    <span className="text-xs text-slate-500">Prazo até {formatarDataHora(c.prazoAte)}</span>
                  </div>
                  <p className="mt-2 text-slate-700">{c.observacao}</p>
                  <p className="mt-1 text-xs text-slate-500">Devolvida em {formatarDataHora(c.criadaEm)}{c.concluidaEm ? ` · Resolvida em ${formatarDataHora(c.concluidaEm)}` : ''}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {dados.historicoBloco?.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Histórico de alterações — pergunta padrão</p>
            <ul className="mt-3 space-y-2">
              {dados.historicoBloco.map((h) => (
                <li key={h.id} className="text-sm text-slate-700">
                  <strong>{ORIGEM_LABEL[h.origem]}</strong> em {formatarDataHora(h.alteradoEm)}: {formatarValor(h.valorAnterior)} → {formatarValor(h.valorNovo)}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {devolverPadraoAberto && (
          <Modal title="Devolver pergunta padrão" onClose={() => setDevolverPadraoAberto(false)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Abre uma janela de 3 dias pra o Professor responsável atual corrigir a pergunta padrão — vale para TODAS as disciplinas deste agrupamento de uma vez, nunca uma devolução por disciplina.
              </p>
              <FormField label="Observação para o Professor">
                <textarea className={inputClass} rows="3" value={observacaoPadrao} onChange={(event) => setObservacaoPadrao(event.target.value)} placeholder="Ex.: Rever resposta da pergunta padrão X." required />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDevolverPadraoAberto(false)}>Cancelar</Button>
                <Button onClick={confirmarDevolucaoPadrao} disabled={!observacaoPadrao.trim() || devolvendoPadrao}>{devolvendoPadrao ? 'Devolvendo...' : 'Devolver'}</Button>
              </div>
            </div>
          </Modal>
        )}

        {dados.correcoes.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Histórico de devoluções</p>
            <ul className="mt-3 space-y-3">
              {dados.correcoes.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={STATUS_CORRECAO_VARIANT[c.status]}>{STATUS_CORRECAO_LABEL[c.status]}</Badge>
                    <span className="text-xs text-slate-500">Prazo até {formatarDataHora(c.prazoAte)}</span>
                  </div>
                  <p className="mt-2 text-slate-700">{c.observacao}</p>
                  <p className="mt-1 text-xs text-slate-500">Devolvida em {formatarDataHora(c.criadaEm)}{c.concluidaEm ? ` · Resolvida em ${formatarDataHora(c.concluidaEm)}` : ''}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {dados.historico.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Histórico de alterações de resposta</p>
            <ul className="mt-3 space-y-2">
              {dados.historico.map((h) => (
                <li key={h.id} className="text-sm text-slate-700">
                  <strong>{ORIGEM_LABEL[h.origem]}</strong> em {formatarDataHora(h.alteradoEm)}: {formatarValor(h.valorAnterior)} → {formatarValor(h.valorNovo)}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {devolverAberto && (
          <Modal title="Devolver ao Professor" onClose={() => setDevolverAberto(false)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Abre uma janela de 3 dias pra o Professor responsável atual corrigir esta Ficha, mesmo que a Aplicação já tenha encerrado. Nenhuma outra Ficha é afetada.
              </p>
              <FormField label="Observação para o Professor">
                <textarea className={inputClass} rows="3" value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Ex.: Rever resposta da seção X." required />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDevolverAberto(false)}>Cancelar</Button>
                <Button onClick={confirmarDevolucao} disabled={!observacao.trim() || devolvendo}>{devolvendo ? 'Devolvendo...' : 'Devolver'}</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};

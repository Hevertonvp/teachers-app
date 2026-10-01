import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, FormField, Modal, OrderButtons } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';
import { isSecretaria } from '../utils/roles';

const TIPO_RESPOSTA_OPTIONS = [
  { value: 'texto', label: 'Texto' },
  { value: 'selecao', label: 'Seleção (única)' },
  { value: 'marcacao', label: 'Marcação' },
  { value: 'numero', label: 'Número' },
  { value: 'selecao_multipla', label: 'Seleção múltipla' },
  { value: 'orientacao', label: 'Informativa (sem resposta)' },
];
const tipoLabel = (value) => TIPO_RESPOSTA_OPTIONS.find(option => option.value === value)?.label || value;

const blankPergunta = (ordem) => ({ secao: '', subsecao: '', pergunta: '', explicacao: '', tipoResposta: 'texto', opcoes: [], complementar: null, ordem });

const calcularReordenacao = (perguntasOrdenadas, perguntaId, direction) => {
  const index = perguntasOrdenadas.findIndex(item => item.id === perguntaId);
  const vizinha = perguntasOrdenadas[index + direction];
  if (!vizinha) return [];
  const atual = perguntasOrdenadas[index];
  return [{ id: atual.id, ordem: vizinha.ordem }, { id: vizinha.id, ordem: atual.ordem }];
};

// Agrupa perguntas por seção, preservando a ordem em que aparecem.
const agruparPorSecao = (perguntas) => {
  const secoes = [];
  perguntas.forEach(pergunta => {
    const nome = pergunta.secao || 'Sem seção';
    let secao = secoes.find(item => item.nome === nome);
    if (!secao) { secao = { nome, perguntas: [] }; secoes.push(secao); }
    secao.perguntas.push(pergunta);
  });
  return secoes;
};

// Administração do Modelo de Anamnese pela Secretaria — mesmo padrão visual do construtor de
// Modelos PDI (FormularioPdiPage.jsx), mas entidade própria (ModeloAnamnese/PerguntaAnamnese,
// nunca ModeloPdi/PerguntaPdi). Editar uma versão já usada por alguma Anamnese gera uma nova
// versão automaticamente no backend (copy-on-write) — o frontend não decide isso, só reflete o
// resultado (ver domain/anamnese.ts).
export const AnamneseModeloPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    anamneseModelosReais, anamneseModelosReaisLoading, anamneseModelosReaisError, loadAnamneseModelosReais,
    obterAnamneseModeloAtivo, criarAnamnesePergunta, editarAnamnesePergunta,
    inativarAnamnesePergunta, reativarAnamnesePergunta, reordenarAnamnesePerguntas,
  } = useData();

  const [modeloAtivo, setModeloAtivo] = useState(null);
  const [carregandoAtivo, setCarregandoAtivo] = useState(true);
  const [erroAtivo, setErroAtivo] = useState('');
  const [perguntaForm, setPerguntaForm] = useState(null);
  const [salvandoPergunta, setSalvandoPergunta] = useState(false);
  const [inativandoPergunta, setInativandoPergunta] = useState(null);
  const [message, setMessage] = useState('');

  const carregarAtivo = async () => {
    setCarregandoAtivo(true);
    setErroAtivo('');
    const resultado = await obterAnamneseModeloAtivo();
    setCarregandoAtivo(false);
    if (!resultado.ok) { setErroAtivo(resultado.error); return; }
    setModeloAtivo(resultado.modelo);
  };

  useEffect(() => { if (isSecretaria(user)) { carregarAtivo(); loadAnamneseModelosReais(); } }, [user]);

  if (!isSecretaria(user)) return <Navigate to="/dashboard" replace />;

  const perguntasOrdenadas = modeloAtivo ? [...modeloAtivo.perguntas].sort((a, b) => Number(a.ordem) - Number(b.ordem)) : [];
  const secoes = agruparPorSecao(perguntasOrdenadas);
  const versoesAnteriores = anamneseModelosReais.filter(m => modeloAtivo && m.id !== modeloAtivo.id);

  const changeTipoResposta = (tipoResposta) => {
    setPerguntaForm(prev => ({
      ...prev,
      tipoResposta,
      opcoes: (tipoResposta === 'selecao' || tipoResposta === 'selecao_multipla') ? (prev.opcoes?.length ? prev.opcoes : ['', '']) : [],
      complementar: (tipoResposta === 'texto' || tipoResposta === 'numero' || tipoResposta === 'orientacao') ? null : prev.complementar,
    }));
  };

  const toggleComplementar = (habilitado) => {
    setPerguntaForm(prev => ({
      ...prev,
      complementar: habilitado ? { gatilho: prev.opcoes?.[0] || 'sempre', label: prev.complementar?.label || 'Observação' } : null,
    }));
  };

  const salvarPergunta = async (event) => {
    event.preventDefault();
    const precisaOpcoes = perguntaForm.tipoResposta === 'selecao' || perguntaForm.tipoResposta === 'selecao_multipla';
    const opcoes = precisaOpcoes ? perguntaForm.opcoes.map(o => o.trim()).filter(Boolean) : [];
    if (precisaOpcoes && opcoes.length < 2) {
      setMessage('Cadastre ao menos duas opções.');
      return;
    }
    const payload = { ...perguntaForm, opcoes };
    setSalvandoPergunta(true);
    const resultado = perguntaForm.id
      ? await editarAnamnesePergunta(perguntaForm.id, payload)
      : await criarAnamnesePergunta(payload);
    setSalvandoPergunta(false);
    if (!resultado.ok) { setMessage(resultado.error); return; }
    setMessage(perguntaForm.id ? 'Pergunta atualizada com sucesso.' : 'Pergunta criada com sucesso.');
    setPerguntaForm(null);
    await carregarAtivo();
    await loadAnamneseModelosReais();
  };

  const abrirNovaPergunta = () => setPerguntaForm(blankPergunta(perguntasOrdenadas.length + 1));

  const reordenar = async (perguntaId, direction) => {
    const ordens = calcularReordenacao(perguntasOrdenadas, perguntaId, direction);
    if (ordens.length === 0) return;
    const resultado = await reordenarAnamnesePerguntas(ordens);
    if (!resultado.ok) { setMessage(resultado.error); return; }
    await carregarAtivo();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Modelo de Anamnese</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Define as perguntas configuráveis da Anamnese (aspectos comportamentais/psicomotores/cognitivos, comunicação, escrita, leitura). Identificação, responsáveis e medicação continuam fixos, fora daqui.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/pdi')}>Concluir</Button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
        {erroAtivo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar o Modelo: {erroAtivo}</span>
            <Button size="sm" variant="outline" onClick={carregarAtivo}>Tentar novamente</Button>
          </div>
        )}

        {carregandoAtivo ? (
          <Card className="py-12 text-center"><p className="text-slate-500">Carregando...</p></Card>
        ) : modeloAtivo && (
          <Card>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{modeloAtivo.nome}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Versão {modeloAtivo.versao} <Badge variant="green">Ativa</Badge></h2>
                <p className="mt-1 text-sm text-slate-600">Editar uma pergunta já usada em alguma Anamnese cria uma nova versão automaticamente — o histórico de quem já preencheu nunca muda.</p>
              </div>
              <Button size="sm" onClick={abrirNovaPergunta}>+ Nova pergunta</Button>
            </div>

            <div className="mt-4 space-y-6">
              {secoes.map(secao => (
                <div key={secao.nome}>
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{secao.nome}</p>
                  <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {secao.perguntas.map((pergunta, index) => (
                      <div key={pergunta.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{pergunta.pergunta}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {tipoLabel(pergunta.tipoResposta)}
                            {(pergunta.tipoResposta === 'selecao' || pergunta.tipoResposta === 'selecao_multipla') && pergunta.opcoes?.length > 0 && ` • ${pergunta.opcoes.length} opções`}
                            {pergunta.status !== 'ativa' && ' · Inativa'}
                          </p>
                        </div>
                        <OrderButtons
                          onUp={() => reordenar(pergunta.id, -1)}
                          onDown={() => reordenar(pergunta.id, 1)}
                          upDisabled={index === 0}
                          downDisabled={index === secao.perguntas.length - 1}
                        />
                        <ActionMenu items={[
                          { label: 'Editar', onClick: () => setPerguntaForm({ ...pergunta, opcoes: pergunta.opcoes || [] }) },
                          pergunta.status === 'ativa'
                            ? { label: 'Inativar', variant: 'danger', onClick: () => setInativandoPergunta({ pergunta, ativar: false }) }
                            : { label: 'Reativar', onClick: () => setInativandoPergunta({ pergunta, ativar: true }) },
                        ]} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {versoesAnteriores.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Versões anteriores (histórico, imutáveis)</p>
            <div className="mt-3 divide-y divide-slate-200">
              {versoesAnteriores.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 text-sm text-slate-700">
                  <span>{m.nome} — versão {m.versao}</span>
                  <Badge variant="gray">Substituída</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {perguntaForm && (
          <Modal title={perguntaForm.id ? 'Editar pergunta' : 'Nova pergunta'} onClose={() => setPerguntaForm(null)}>
            <form onSubmit={salvarPergunta} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Seção"><input className={inputClass} value={perguntaForm.secao} onChange={event => setPerguntaForm(prev => ({ ...prev, secao: event.target.value }))} required /></FormField>
                <FormField label="Subseção (opcional)"><input className={inputClass} value={perguntaForm.subsecao || ''} onChange={event => setPerguntaForm(prev => ({ ...prev, subsecao: event.target.value }))} /></FormField>
              </div>

              <FormField label="Tipo">
                <select className={inputClass} value={perguntaForm.tipoResposta} onChange={event => changeTipoResposta(event.target.value)}>
                  {TIPO_RESPOSTA_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </FormField>

              <FormField label={perguntaForm.tipoResposta === 'orientacao' ? 'Conteúdo / orientação' : 'Pergunta / texto'}>
                <textarea className={inputClass} rows="3" spellCheck lang="pt-BR" value={perguntaForm.pergunta} onChange={event => setPerguntaForm(prev => ({ ...prev, pergunta: event.target.value }))} onBlur={() => setPerguntaForm(prev => ({ ...prev, pergunta: aplicarAutoCorrecao(prev.pergunta) }))} required />
              </FormField>

              <FormField label="Explicação / tooltip (opcional)"><textarea className={inputClass} rows="2" value={perguntaForm.explicacao || ''} onChange={event => setPerguntaForm(prev => ({ ...prev, explicacao: event.target.value }))} /></FormField>

              {(perguntaForm.tipoResposta === 'selecao' || perguntaForm.tipoResposta === 'selecao_multipla') && (
                <FormField label="Opções">
                  <div className="space-y-2">
                    {perguntaForm.opcoes.map((opcao, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          className={inputClass}
                          value={opcao}
                          onChange={event => setPerguntaForm(prev => ({ ...prev, opcoes: prev.opcoes.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) }))}
                          placeholder={`Opção ${index + 1}`}
                          required
                        />
                        <Button type="button" variant="outline" size="sm" disabled={perguntaForm.opcoes.length <= 2} onClick={() => setPerguntaForm(prev => ({ ...prev, opcoes: prev.opcoes.filter((_, itemIndex) => itemIndex !== index) }))}>Remover</Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setPerguntaForm(prev => ({ ...prev, opcoes: [...prev.opcoes, ''] }))}>+ Adicionar opção</Button>
                  </div>
                </FormField>
              )}

              {perguntaForm.tipoResposta === 'selecao' && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={!!perguntaForm.complementar} onChange={event => toggleComplementar(event.target.checked)} />
                    Habilitar observação complementar
                  </label>
                  {perguntaForm.complementar && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <FormField label="Quando aparece">
                        <select className={inputClass} value={perguntaForm.complementar.gatilho} onChange={event => setPerguntaForm(prev => ({ ...prev, complementar: { ...prev.complementar, gatilho: event.target.value } }))}>
                          <option value="sempre">Sempre disponível</option>
                          {perguntaForm.opcoes.filter(Boolean).map(opcao => <option key={opcao} value={opcao}>Só quando a resposta for "{opcao}"</option>)}
                        </select>
                      </FormField>
                      <FormField label="Texto do campo"><input className={inputClass} value={perguntaForm.complementar.label} onChange={event => setPerguntaForm(prev => ({ ...prev, complementar: { ...prev.complementar, label: event.target.value } }))} required /></FormField>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setPerguntaForm(null)} disabled={salvandoPergunta}>Cancelar</Button><Button type="submit" disabled={salvandoPergunta}>{salvandoPergunta ? 'Salvando...' : 'Salvar'}</Button></div>
            </form>
          </Modal>
        )}

        {inativandoPergunta && (
          <ConfirmDialog
            title={inativandoPergunta.ativar ? 'Reativar pergunta' : 'Inativar pergunta'}
            message={inativandoPergunta.ativar
              ? 'Deseja reativar esta pergunta? Ela volta a aparecer em novas Anamneses.'
              : 'Deseja inativar esta pergunta? Anamneses já iniciadas continuam com a versão que tinham. O histórico é preservado.'}
            confirmLabel={inativandoPergunta.ativar ? 'Reativar' : 'Inativar'}
            onCancel={() => setInativandoPergunta(null)}
            onConfirm={async () => {
              const { pergunta, ativar } = inativandoPergunta;
              setInativandoPergunta(null);
              const resultado = ativar ? await reativarAnamnesePergunta(pergunta.id) : await inativarAnamnesePergunta(pergunta.id);
              setMessage(resultado.ok ? `Pergunta ${ativar ? 'reativada' : 'inativada'} com sucesso.` : resultado.error);
              await carregarAtivo();
              await loadAnamneseModelosReais();
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};

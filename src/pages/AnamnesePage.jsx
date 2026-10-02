import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, FormField } from '../components/Common';
import { AccordionSection, AspectoItem, CheckboxGroup, ObservacaoField, SegmentedToggle } from '../components/AnamneseFields';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { isSecretaria } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em preenchimento', concluida: 'Concluída' };
const STATUS_VARIANT = { pendente: 'gray', em_andamento: 'blue', concluida: 'green' };
const LAUDO_OPCOES = [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }, { value: 'em_investigacao', label: 'Em investigação' }];
const SIM_NAO_OPCOES = [{ value: true, label: 'Sim' }, { value: false, label: 'Não' }];

const respostaVazia = (pergunta) => (
  pergunta.tipoResposta === 'selecao_multipla' ? { respostas: [], complementarTexto: '' } : { resposta: null, complementarTexto: '', observacao: '' }
);

// Deriva o "shape" de exibição a partir do valor salvo (formato do backend) — cada pergunta lê a
// sua própria resposta (ou vazio, se ainda não respondida).
const respostaAtual = (pergunta, respostas) => {
  const salva = respostas.find(r => r.perguntaAnamneseId === pergunta.id);
  if (!salva) return respostaVazia(pergunta);
  if (pergunta.tipoResposta === 'selecao_multipla') return { respostas: salva.valor.respostas || [], complementarTexto: salva.valor.complementarTexto || '' };
  return { resposta: salva.valor.resposta ?? null, complementarTexto: salva.valor.complementarTexto || '', observacao: salva.valor.complementarTexto || '' };
};

// Agrupa perguntas por seção, preservando ordem.
const agruparPorSecao = (perguntas) => {
  const secoes = [];
  perguntas.forEach(pergunta => {
    const nome = pergunta.secao || 'Perguntas';
    let secao = secoes.find(s => s.nome === nome);
    if (!secao) { secao = { nome, perguntas: [] }; secoes.push(secao); }
    secao.perguntas.push(pergunta);
  });
  return secoes;
};

export const AnamnesePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    obterPdiAlunoReal, obterHistoricoAnamnese, obterAnamnese, iniciarAnamnese, salvarAnamnese, concluirAnamnese,
  } = useData();

  const souSecretaria = isSecretaria(user);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aluno, setAluno] = useState(null);
  const [detalheAtual, setDetalheAtual] = useState(null); // { anamnese, perguntas, respostas, versaoAtual, editavel }
  const [historico, setHistorico] = useState([]);
  const [answers, setAnswers] = useState({});
  const [estrutural, setEstrutural] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [visualizandoVersaoId, setVisualizandoVersaoId] = useState(null);
  const [versaoVisualizada, setVersaoVisualizada] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  const carregarTudo = async () => {
    setCarregando(true);
    setErro('');
    const [resultadoAluno, resultadoHistorico] = await Promise.all([obterPdiAlunoReal(id), obterHistoricoAnamnese(id)]);
    setCarregando(false);
    if (!resultadoAluno.ok) { setErro(resultadoAluno.error); return; }
    if (!resultadoHistorico.ok) { setErro(resultadoHistorico.error); return; }
    setAluno(resultadoAluno.aluno);
    setHistorico(resultadoHistorico.historico);
    if (resultadoHistorico.atual) {
      setDetalheAtual(resultadoHistorico.atual);
      setEstrutural(resultadoHistorico.atual.anamnese);
      setAnswers(Object.fromEntries(resultadoHistorico.atual.perguntas.map(p => [p.id, respostaAtual(p, resultadoHistorico.atual.respostas)])));
    } else {
      setDetalheAtual(null);
    }
  };

  useEffect(() => { carregarTudo(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando) return <MainLayout><Card className="py-12 text-center"><p className="text-slate-500">Carregando...</p></Card></MainLayout>;

  if (erro || !aluno) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">{erro || 'Aluno não encontrado'}</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
        </Card>
      </MainLayout>
    );
  }

  const iniciar = async () => {
    setIniciando(true);
    const resultado = await iniciarAnamnese(aluno.id);
    setIniciando(false);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setMensagem('Anamnese iniciada com sucesso.');
    await carregarTudo();
  };

  const updateEstrutural = (payload) => setEstrutural(prev => ({ ...prev, ...payload }));
  const updateAnswer = (perguntaId, payload) => setAnswers(prev => ({ ...prev, [perguntaId]: { ...prev[perguntaId], ...payload } }));

  const salvarEstrutural = async (payload) => {
    if (!detalheAtual) return;
    setSalvando(true);
    setMensagemErro('');
    const resultado = await salvarAnamnese(detalheAtual.anamnese.id, { estrutural: payload });
    setSalvando(false);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setDetalheAtual(resultado);
  };

  const salvarResposta = async (pergunta, valor) => {
    if (!detalheAtual) return;
    setSalvando(true);
    setMensagemErro('');
    const resultado = await salvarAnamnese(detalheAtual.anamnese.id, { respostas: [{ perguntaAnamneseId: pergunta.id, valor }] });
    setSalvando(false);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setDetalheAtual(prev => ({ ...prev, anamnese: resultado.anamnese, respostas: resultado.respostas }));
  };

  const concluir = async () => {
    if (!detalheAtual) return;
    setConcluindo(true);
    const resultado = await concluirAnamnese(detalheAtual.anamnese.id);
    setConcluindo(false);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setMensagem('Anamnese concluída com sucesso.');
    setDetalheAtual(resultado);
  };

  const criarNovaVersao = async () => {
    setIniciando(true);
    const resultado = await iniciarAnamnese(aluno.id);
    setIniciando(false);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setMensagem('Nova versão da Anamnese criada com sucesso.');
    await carregarTudo();
  };

  const verVersaoHistorica = async (anamneseId) => {
    if (visualizandoVersaoId === anamneseId) { setVisualizandoVersaoId(null); setVersaoVisualizada(null); return; }
    const resultado = await obterAnamnese(anamneseId);
    if (!resultado.ok) { setMensagemErro(resultado.error); return; }
    setVisualizandoVersaoId(anamneseId);
    setVersaoVisualizada(resultado);
  };

  const podeEditar = souSecretaria && !!detalheAtual?.editavel;

  const renderPergunta = (pergunta, respostasFonte, editavelAqui, onSalvar) => {
    const current = respostaAtual(pergunta, respostasFonte);

    if (pergunta.tipoResposta === 'orientacao') {
      return <div key={pergunta.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{pergunta.pergunta}</div>;
    }

    if (pergunta.tipoResposta === 'selecao' && pergunta.complementar?.gatilho === 'sempre') {
      return (
        <AspectoItem
          key={pergunta.id}
          item={{ label: pergunta.pergunta, explicacao: pergunta.explicacao }}
          opcoes={pergunta.opcoes.map(o => ({ value: o, label: o }))}
          value={{ resposta: current.resposta, observacao: current.complementarTexto }}
          onChangeResposta={value => { updateAnswer(pergunta.id, { resposta: value }); if (onSalvar) onSalvar(pergunta, { resposta: value, complementarTexto: current.complementarTexto }); }}
          onChangeObservacao={value => { updateAnswer(pergunta.id, { complementarTexto: value }); if (onSalvar) onSalvar(pergunta, { resposta: current.resposta, complementarTexto: value }); }}
          disabled={!editavelAqui}
        />
      );
    }

    if (pergunta.tipoResposta === 'selecao') {
      const complementarVisivel = pergunta.complementar && current.resposta === pergunta.complementar.gatilho;
      return (
        <div key={pergunta.id} className="border-b border-slate-100 py-3 last:border-0">
          <p className="text-sm font-semibold text-slate-800">{pergunta.pergunta}</p>
          <div className="mt-2"><SegmentedToggle value={current.resposta} onChange={value => { updateAnswer(pergunta.id, { resposta: value }); if (onSalvar) onSalvar(pergunta, { resposta: value, complementarTexto: current.complementarTexto }); }} options={pergunta.opcoes.map(o => ({ value: o, label: o }))} disabled={!editavelAqui} /></div>
          {complementarVisivel && (
            <div className="mt-2"><FormField label={pergunta.complementar.label}><input className={inputClass} value={current.complementarTexto} onChange={event => updateAnswer(pergunta.id, { complementarTexto: event.target.value })} onBlur={() => onSalvar && onSalvar(pergunta, { resposta: current.resposta, complementarTexto: current.complementarTexto })} readOnly={!editavelAqui} /></FormField></div>
          )}
        </div>
      );
    }

    if (pergunta.tipoResposta === 'marcacao') {
      return (
        <div key={pergunta.id} className="border-b border-slate-100 py-3 last:border-0">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={!!current.resposta} onChange={event => { updateAnswer(pergunta.id, { resposta: event.target.checked }); if (onSalvar) onSalvar(pergunta, { resposta: event.target.checked, complementarTexto: current.complementarTexto }); }} disabled={!editavelAqui} />
            {pergunta.pergunta}
          </label>
        </div>
      );
    }

    if (pergunta.tipoResposta === 'numero') {
      return (
        <div key={pergunta.id} className="border-b border-slate-100 py-3 last:border-0">
          <FormField label={pergunta.pergunta}><input type="number" className={`${inputClass} max-w-40`} value={current.resposta ?? ''} onChange={event => updateAnswer(pergunta.id, { resposta: event.target.value })} onBlur={() => onSalvar && onSalvar(pergunta, { resposta: current.resposta === '' ? null : Number(current.resposta), complementarTexto: '' })} readOnly={!editavelAqui} /></FormField>
        </div>
      );
    }

    if (pergunta.tipoResposta === 'selecao_multipla') {
      return (
        <div key={pergunta.id} className="border-b border-slate-100 py-3 last:border-0">
          <p className="mb-1.5 text-sm font-semibold text-slate-800">{pergunta.pergunta}</p>
          <CheckboxGroup value={current.respostas} onChange={value => { updateAnswer(pergunta.id, { respostas: value }); if (onSalvar) onSalvar(pergunta, { respostas: value, complementarTexto: '' }); }} options={pergunta.opcoes.map(o => ({ key: o, label: o }))} disabled={!editavelAqui} />
        </div>
      );
    }

    // texto
    return (
      <div key={pergunta.id} className="border-b border-slate-100 py-3 last:border-0">
        <FormField label={pergunta.pergunta}><textarea className={inputClass} rows="3" value={current.resposta || ''} onChange={event => updateAnswer(pergunta.id, { resposta: event.target.value })} onBlur={() => onSalvar && onSalvar(pergunta, { resposta: current.resposta, complementarTexto: '' })} readOnly={!editavelAqui} /></FormField>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={`/pdi/alunos/${aluno.id}`} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para aluno</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Anamnese</h1>
          <p className="mt-2 text-slate-600">{aluno.nome} · {aluno.turmaNome} · {aluno.escolaNome}</p>
        </div>

        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {mensagemErro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{mensagemErro}</div>}

        {!detalheAtual ? (
          <Card>
            <EmptyState
              title={souSecretaria ? 'Anamnese ainda não preenchida' : 'Anamnese ainda não disponível'}
              description={souSecretaria ? 'Inicie a Anamnese deste aluno usando o Modelo ativo no momento.' : 'A Secretaria ainda não iniciou a Anamnese deste aluno.'}
            >
              {souSecretaria && <Button onClick={iniciar} disabled={iniciando}>{iniciando ? 'Iniciando...' : 'Iniciar Anamnese'}</Button>}
            </EmptyState>
          </Card>
        ) : (
          <>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Versão {detalheAtual.anamnese.numeroVersao} — atual</p>
                <p className="mt-1 text-xs text-slate-500">Ano de escolaridade: {detalheAtual.anamnese.anoEscolaridade || 'não informado'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[detalheAtual.anamnese.status]}>{STATUS_LABEL[detalheAtual.anamnese.status]}</Badge>
                {!souSecretaria && <Badge variant="gray">Somente consulta</Badge>}
              </div>
            </Card>

            <form onSubmit={event => event.preventDefault()} className="space-y-4">
              <AccordionSection title="1. Identificação e laudo" defaultOpen>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Nome completo"><input className={inputClass} value={aluno.nome} disabled /></FormField>
                  <FormField label="Data de nascimento"><input className={inputClass} value={aluno.dataNascimento || 'Não informada'} disabled /></FormField>
                  <FormField label="Turma"><input className={inputClass} value={aluno.turmaNome} disabled /></FormField>
                  <FormField label="Ano de escolaridade"><input className={inputClass} value={estrutural.anoEscolaridade || ''} onChange={event => updateEstrutural({ anoEscolaridade: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ anoEscolaridade: estrutural.anoEscolaridade })} readOnly={!podeEditar} /></FormField>
                  <FormField label="Responsável"><input className={inputClass} value={aluno.responsavelNome || 'Não informado'} disabled /></FormField>
                  <FormField label="Telefone"><input className={inputClass} value={aluno.responsavelTelefone || 'Não informado'} disabled /></FormField>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">Possui laudo?</p>
                  <SegmentedToggle value={estrutural.possuiLaudo} onChange={value => { updateEstrutural({ possuiLaudo: value }); podeEditar && salvarEstrutural({ possuiLaudo: value }); }} options={LAUDO_OPCOES} disabled={!podeEditar} />
                </div>
                {estrutural.possuiLaudo === 'sim' && (
                  <FormField label="CID"><input className={inputClass} value={estrutural.cid || ''} onChange={event => updateEstrutural({ cid: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ cid: estrutural.cid })} readOnly={!podeEditar} /></FormField>
                )}
              </AccordionSection>

              <AccordionSection title="2. Responsáveis pela elaboração/atualização do PDI">
                <div className="space-y-3">
                  {(estrutural.responsaveisPdi || []).map((item, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                      <FormField label="Cargo"><input className={inputClass} value={item.cargo} onChange={event => { const lista = [...estrutural.responsaveisPdi]; lista[index] = { ...item, cargo: event.target.value }; updateEstrutural({ responsaveisPdi: lista }); }} onBlur={() => podeEditar && salvarEstrutural({ responsaveisPdi: estrutural.responsaveisPdi })} readOnly={!podeEditar} /></FormField>
                      <FormField label="Nome"><input className={inputClass} value={item.nome} onChange={event => { const lista = [...estrutural.responsaveisPdi]; lista[index] = { ...item, nome: event.target.value }; updateEstrutural({ responsaveisPdi: lista }); }} onBlur={() => podeEditar && salvarEstrutural({ responsaveisPdi: estrutural.responsaveisPdi })} readOnly={!podeEditar} /></FormField>
                    </div>
                  ))}
                  {podeEditar && <Button type="button" variant="outline" size="sm" onClick={() => { const lista = [...(estrutural.responsaveisPdi || []), { cargo: '', nome: '' }]; updateEstrutural({ responsaveisPdi: lista }); salvarEstrutural({ responsaveisPdi: lista }); }}>+ Adicionar responsável</Button>}
                </div>
              </AccordionSection>

              <AccordionSection title="3. Informações gerais e acompanhamento">
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">É acompanhado por profissional fora da escola?</p>
                  <SegmentedToggle value={estrutural.acompanhadoForaDaEscola} onChange={value => { updateEstrutural({ acompanhadoForaDaEscola: value }); podeEditar && salvarEstrutural({ acompanhadoForaDaEscola: value }); }} options={SIM_NAO_OPCOES} disabled={!podeEditar} />
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">Faz uso contínuo de medicamento?</p>
                  <SegmentedToggle value={estrutural.usoContinuoMedicamento} onChange={value => { updateEstrutural({ usoContinuoMedicamento: value }); podeEditar && salvarEstrutural({ usoContinuoMedicamento: value }); }} options={SIM_NAO_OPCOES} disabled={!podeEditar} />
                  {estrutural.usoContinuoMedicamento && (
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <FormField label="Qual medicamento?"><input className={inputClass} value={estrutural.medicamentoQual || ''} onChange={event => updateEstrutural({ medicamentoQual: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ medicamentoQual: estrutural.medicamentoQual })} readOnly={!podeEditar} /></FormField>
                      <FormField label="Quem prescreveu?"><input className={inputClass} value={estrutural.medicamentoPrescritoPor || ''} onChange={event => updateEstrutural({ medicamentoPrescritoPor: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ medicamentoPrescritoPor: estrutural.medicamentoPrescritoPor })} readOnly={!podeEditar} /></FormField>
                      <FormField label="Quando?"><input className={inputClass} value={estrutural.medicamentoQuando || ''} onChange={event => updateEstrutural({ medicamentoQuando: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ medicamentoQuando: estrutural.medicamentoQuando })} readOnly={!podeEditar} /></FormField>
                      <FormField label="Para quê?"><input className={inputClass} value={estrutural.medicamentoParaQue || ''} onChange={event => updateEstrutural({ medicamentoParaQue: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ medicamentoParaQue: estrutural.medicamentoParaQue })} readOnly={!podeEditar} /></FormField>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Como gosta de se divertir?"><input className={inputClass} value={estrutural.comoGostaDeSeDivertir || ''} onChange={event => updateEstrutural({ comoGostaDeSeDivertir: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ comoGostaDeSeDivertir: estrutural.comoGostaDeSeDivertir })} readOnly={!podeEditar} /></FormField>
                  <FormField label="Com que idade começou a frequentar a escola?"><input className={inputClass} value={estrutural.idadeInicioEscola || ''} onChange={event => updateEstrutural({ idadeInicioEscola: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ idadeInicioEscola: estrutural.idadeInicioEscola })} readOnly={!podeEditar} /></FormField>
                </div>
                <FormField label="Como foi o percurso escolar?"><textarea className={inputClass} rows="3" value={estrutural.percursoEscolar || ''} onChange={event => updateEstrutural({ percursoEscolar: event.target.value })} onBlur={() => podeEditar && salvarEstrutural({ percursoEscolar: estrutural.percursoEscolar })} readOnly={!podeEditar} /></FormField>
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700">Frequenta sala de recursos?</p>
                  <SegmentedToggle value={estrutural.frequentaSalaRecursos} onChange={value => { updateEstrutural({ frequentaSalaRecursos: value }); podeEditar && salvarEstrutural({ frequentaSalaRecursos: value }); }} options={SIM_NAO_OPCOES} disabled={!podeEditar} />
                </div>
              </AccordionSection>

              {agruparPorSecao(detalheAtual.perguntas).map(secao => (
                <AccordionSection key={secao.nome} title={secao.nome}>
                  <div>{secao.perguntas.map(pergunta => renderPergunta(pergunta, detalheAtual.respostas, podeEditar, salvarResposta))}</div>
                </AccordionSection>
              ))}

              {souSecretaria && (
                <div className="flex flex-wrap justify-end gap-3">
                  {/* Só faz sentido depois de concluída — o backend agora é idempotente e devolve a
                      mesma versão em vez de criar outra enquanto ela não estiver concluída. */}
                  {detalheAtual.anamnese.status === 'concluida' && (
                    <Button type="button" variant="outline" onClick={criarNovaVersao} disabled={iniciando}>{iniciando ? 'Criando...' : 'Criar nova versão'}</Button>
                  )}
                  {podeEditar && <Button type="button" onClick={concluir} disabled={concluindo || detalheAtual.anamnese.status === 'concluida'}>{detalheAtual.anamnese.status === 'concluida' ? 'Concluída' : concluindo ? 'Concluindo...' : 'Concluir Anamnese'}</Button>}
                </div>
              )}
            </form>
          </>
        )}

        {historico.length > 0 && (
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de versões</p>
            <div className="mt-3 divide-y divide-slate-200">
              {historico.map(item => (
                <div key={item.id}>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-slate-900">Versão {item.numeroVersao}</p>
                      <p className="text-xs text-slate-500">Modelo usado: v{item.modeloAnamneseId} · Status: {STATUS_LABEL[item.status]}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => verVersaoHistorica(item.id)}>{visualizandoVersaoId === item.id ? 'Ocultar' : 'Ver'}</Button>
                  </div>
                  {visualizandoVersaoId === item.id && versaoVisualizada && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      {agruparPorSecao(versaoVisualizada.perguntas).map(secao => (
                        <div key={secao.nome}>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{secao.nome}</p>
                          <div className="mt-1">{secao.perguntas.map(pergunta => renderPergunta(pergunta, versaoVisualizada.respostas, false, null))}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

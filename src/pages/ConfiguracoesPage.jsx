import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../layouts/Layouts';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, FormField, OrderButtons, StatusBadge } from '../components/Common';
import { blankPerguntaPdi, PerguntaPdiFormModal, tipoRespostaLabel, trimestreLabel } from '../components/PerguntaPdiFormModal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { isSecretaria } from '../utils/roles';
import { trimestres } from '../utils/trimestres';

const ANO_ATUAL = new Date().getFullYear();

// Formulário local de UM ano: sempre os 3 trimestres, com o que já está salvo (ou vazio).
const formularioDoAno = (trimestrePeriods, ano) => trimestres.map(rotulo => {
  const salvo = trimestrePeriods.find(item => item.ano === ano && item.trimestre === rotulo);
  return { trimestre: rotulo, startDate: salvo?.startDate || '', endDate: salvo?.endDate || '' };
});

// Troca a `ordem` entre a pergunta e a vizinha (-1 sobe, +1 desce) — mesmo padrão de
// FormularioPdiPage.jsx, mas sobre a lista de perguntas padrão (ATIVAS, sem escopo de modelo).
const calcularReordenacao = (perguntasOrdenadas, perguntaId, direction) => {
  const index = perguntasOrdenadas.findIndex(item => item.id === perguntaId);
  const vizinha = perguntasOrdenadas[index + direction];
  if (!vizinha) return [];
  const atual = perguntasOrdenadas[index];
  return [{ id: atual.id, ordem: vizinha.ordem }, { id: vizinha.id, ordem: atual.ordem }];
};

export const ConfiguracoesPage = () => {
  const { user } = useAuth();
  const {
    trimestrePeriods, salvarCalendarioTrimestresDoAno,
    pdiPerguntasPadraoReais, pdiPerguntasPadraoReaisLoading, pdiPerguntasPadraoReaisError, loadPdiPerguntasPadraoReais,
    criarPdiPerguntaPadrao, editarPdiPerguntaPadrao, inativarPdiPerguntaPadrao, reativarPdiPerguntaPadrao,
    excluirPdiPerguntaPadrao, reordenarPdiPerguntasPadrao,
  } = useData();
  const [message, setMessage] = useState('');
  const podeConfigurar = isSecretaria(user);

  const [perguntaPadraoForm, setPerguntaPadraoForm] = useState(null);
  const [salvandoPerguntaPadrao, setSalvandoPerguntaPadrao] = useState(false);
  const [mudandoStatusPerguntaPadrao, setMudandoStatusPerguntaPadrao] = useState(null);
  const [excluindoPerguntaPadrao, setExcluindoPerguntaPadrao] = useState(null);

  useEffect(() => { if (podeConfigurar) loadPdiPerguntasPadraoReais(); }, [podeConfigurar]); // eslint-disable-line react-hooks/exhaustive-deps

  const perguntasPadraoAtivas = [...pdiPerguntasPadraoReais].filter(p => p.status === 'ativa').sort((a, b) => a.ordem - b.ordem);
  const perguntasPadraoInativas = pdiPerguntasPadraoReais.filter(p => p.status === 'inativa');

  // --- Calendário de trimestres (por ano letivo) ---------------------------------------------
  const location = useLocation();
  const trimestresRef = useRef(null);
  const [anoCalendario, setAnoCalendario] = useState(ANO_ATUAL);
  const [calendarioForm, setCalendarioForm] = useState(() => formularioDoAno(trimestrePeriods, ANO_ATUAL));
  const [salvandoCalendario, setSalvandoCalendario] = useState(false);
  const [calendarioMensagem, setCalendarioMensagem] = useState(null); // { tipo: 'ok' | 'erro', texto }

  // Recarrega o formulário quando muda o ano escolhido ou chega o calendário do backend.
  useEffect(() => { setCalendarioForm(formularioDoAno(trimestrePeriods, anoCalendario)); }, [trimestrePeriods, anoCalendario]);

  // Atalho "Ir para Configurações > Trimestres" (ver FormularioPdiPage.jsx) chega com #trimestres.
  useEffect(() => {
    if (location.hash === '#trimestres') trimestresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const anosDisponiveis = [...new Set([ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1, ...trimestrePeriods.map(item => item.ano)])].sort((a, b) => a - b);
  const trimestresFaltando = trimestres.filter(rotulo => !trimestrePeriods.some(item => item.ano === anoCalendario && item.trimestre === rotulo));

  const salvarCalendario = async (event) => {
    event.preventDefault();
    // Trimestre com os dois campos vazios = ainda não configurado (não vai no envio); com só um
    // preenchido vai assim mesmo — o backend recusa dizendo qual data falta.
    const preenchidos = calendarioForm.filter(item => item.startDate || item.endDate);
    if (preenchidos.length === 0) {
      setCalendarioMensagem({ tipo: 'erro', texto: 'Preencha as datas de ao menos um trimestre.' });
      return;
    }
    setSalvandoCalendario(true);
    setCalendarioMensagem(null);
    const resultado = await salvarCalendarioTrimestresDoAno(anoCalendario, preenchidos);
    setSalvandoCalendario(false);
    setCalendarioMensagem(resultado.ok
      ? { tipo: 'ok', texto: `Calendário de ${anoCalendario} salvo com sucesso.` }
      : { tipo: 'erro', texto: resultado.error });
  };

  const salvarPerguntaPadrao = async (event) => {
    event.preventDefault();
    const opcoes = perguntaPadraoForm.tipoResposta === 'selecao' ? perguntaPadraoForm.opcoes.map(o => o.trim()).filter(Boolean) : [];
    if (perguntaPadraoForm.tipoResposta === 'selecao' && opcoes.length < 2) {
      setMessage('Cadastre ao menos duas opções para um item de seleção.');
      return;
    }
    if (perguntaPadraoForm.complementar && perguntaPadraoForm.tipoResposta === 'selecao' && !opcoes.includes(perguntaPadraoForm.complementar.gatilho)) {
      setMessage('Escolha qual opção ativa o campo complementar.');
      return;
    }
    if (perguntaPadraoForm.complementar && !perguntaPadraoForm.complementar.label.trim()) {
      setMessage('Informe o texto exibido no campo complementar.');
      return;
    }

    const payload = { ...perguntaPadraoForm, opcoes };
    setSalvandoPerguntaPadrao(true);
    const resultado = perguntaPadraoForm.id
      ? await editarPdiPerguntaPadrao(perguntaPadraoForm.id, payload)
      : await criarPdiPerguntaPadrao(payload);
    setSalvandoPerguntaPadrao(false);
    if (!resultado.ok) {
      setMessage(resultado.error);
      return;
    }
    setMessage(perguntaPadraoForm.id ? 'Pergunta padrão atualizada com sucesso.' : 'Pergunta padrão adicionada com sucesso.');
    setPerguntaPadraoForm(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Configurações</h1>
          <p className="mt-2 text-slate-600">Tela visual para demonstração. Nenhuma integração externa foi implementada.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <h2 className="font-bold text-slate-950">Ano letivo</h2>
            <p className="mt-2 text-sm text-slate-600">2026</p>
            <div className="mt-4"><StatusBadge status="em_andamento" /></div>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Instrumentos ativos</h2>
            <p className="mt-2 text-sm text-slate-600">Formulário 1/3, PDI e Correções dos simulados.</p>
          </Card>
          <Card>
            <h2 className="font-bold text-slate-950">Persistência</h2>
            <p className="mt-2 text-sm text-slate-600">Dados mantidos apenas em estado React durante a sessão.</p>
          </Card>
        </div>

        <div ref={trimestresRef} id="trimestres" className="scroll-mt-24">
        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Calendário letivo</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Trimestres</h2>
            </div>
            <FormField label="Ano letivo">
              <select className={inputClass} value={anoCalendario} onChange={event => { setAnoCalendario(Number(event.target.value)); setCalendarioMensagem(null); }}>
                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </FormField>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {podeConfigurar
              ? 'Defina o início e o encerramento de cada trimestre do ano letivo. Uma Aplicação PDI só pode ser criada quando o 1º, 2º e 3º trimestre do ano dela estão configurados — e recebe automaticamente o trimestre em que começa.'
              : 'Período de cada trimestre do ano letivo, definido pela Secretaria de Educação. Cada Aplicação PDI recebe automaticamente o trimestre em que começa.'}
          </p>

          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${trimestresFaltando.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {trimestresFaltando.length === 0
              ? `Calendário de ${anoCalendario} completo.`
              : `Calendário de ${anoCalendario} incompleto — falta configurar: ${trimestresFaltando.join(', ')}.`}
          </div>

          {calendarioMensagem && (
            <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-semibold ${calendarioMensagem.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {calendarioMensagem.texto}
            </div>
          )}

          {podeConfigurar ? (
            <form onSubmit={salvarCalendario}>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {calendarioForm.map((periodo, index) => (
                  <div key={periodo.trimestre} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{periodo.trimestre}</p>
                    <div className="mt-3 space-y-3">
                      <FormField label="Início">
                        <input className={inputClass} type="date" min={`${anoCalendario}-01-01`} max={`${anoCalendario}-12-31`} value={periodo.startDate} onChange={event => setCalendarioForm(prev => prev.map((item, i) => (i === index ? { ...item, startDate: event.target.value } : item)))} />
                      </FormField>
                      <FormField label="Encerramento">
                        <input className={inputClass} type="date" min={`${anoCalendario}-01-01`} max={`${anoCalendario}-12-31`} value={periodo.endDate} onChange={event => setCalendarioForm(prev => prev.map((item, i) => (i === index ? { ...item, endDate: event.target.value } : item)))} />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={salvandoCalendario}>{salvandoCalendario ? 'Salvando...' : `Salvar calendário de ${anoCalendario}`}</Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {calendarioForm.map(periodo => (
                <div key={periodo.trimestre} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{periodo.trimestre}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {periodo.startDate && periodo.endDate ? `${formatDate(periodo.startDate)} a ${formatDate(periodo.endDate)}` : 'Não configurado'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {podeConfigurar && (
          <Card>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Perguntas padrão</h2>
                <p className="mt-1 text-sm text-slate-600">
                  As perguntas criadas aqui entram automaticamente em cada novo Modelo PDI. <strong>Compartilhada</strong>: o Professor responde uma única vez para todas as disciplinas que leciona ao aluno. <strong>Por disciplina</strong>: cada disciplina tem a sua resposta (ex.: nota, Habilidades do CRMG, pergunta do trimestre). A escolha vale a partir da próxima Aplicação criada.
                </p>
              </div>
              <Button size="sm" onClick={() => setPerguntaPadraoForm(blankPerguntaPdi())}>+ Adicionar pergunta padrão</Button>
            </div>

            {pdiPerguntasPadraoReaisError && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                <span>Não foi possível carregar: {pdiPerguntasPadraoReaisError}</span>
                <Button size="sm" variant="outline" onClick={loadPdiPerguntasPadraoReais}>Tentar novamente</Button>
              </div>
            )}

            {pdiPerguntasPadraoReaisLoading ? (
              <p className="mt-4 text-center text-slate-500">Carregando...</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {perguntasPadraoAtivas.map((pergunta, index) => (
                  <div key={pergunta.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{pergunta.pergunta}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {tipoRespostaLabel(pergunta.tipoResposta)}
                        {pergunta.tipoResposta === 'selecao' && pergunta.opcoes?.length > 0 && ` • ${pergunta.opcoes.length} opções`}
                        {pergunta.secao && ` · ${pergunta.secao}`}
                        {pergunta.trimestre && ` · ${trimestreLabel(pergunta.trimestre)}`}
                      </p>
                    </div>
                    <Badge variant={pergunta.compartilhada === false ? 'gray' : 'blue'}>{pergunta.compartilhada === false ? 'Por disciplina' : 'Compartilhada'}</Badge>
                    <OrderButtons
                      onUp={() => reordenarPdiPerguntasPadrao(calcularReordenacao(perguntasPadraoAtivas, pergunta.id, -1))}
                      onDown={() => reordenarPdiPerguntasPadrao(calcularReordenacao(perguntasPadraoAtivas, pergunta.id, 1))}
                      upDisabled={index === 0}
                      downDisabled={index === perguntasPadraoAtivas.length - 1}
                    />
                    <ActionMenu items={[
                      { label: 'Editar', onClick: () => setPerguntaPadraoForm({ ...pergunta, opcoes: pergunta.opcoes || [] }) },
                      { label: 'Inativar', onClick: () => setMudandoStatusPerguntaPadrao({ pergunta, ativar: false }) },
                      { label: 'Excluir', variant: 'danger', onClick: () => setExcluindoPerguntaPadrao(pergunta) },
                    ]} />
                  </div>
                ))}
                {perguntasPadraoAtivas.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma pergunta padrão ativa — novos modelos nascerão vazios mesmo com "Carregar perguntas padrão" marcado.</p>}
              </div>
            )}

            {perguntasPadraoInativas.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inativas (não entram em novos modelos)</p>
                <div className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 opacity-75">
                  {perguntasPadraoInativas.map(pergunta => (
                    <div key={pergunta.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{pergunta.pergunta}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{tipoRespostaLabel(pergunta.tipoResposta)}{pergunta.secao && ` · ${pergunta.secao}`}</p>
                      </div>
                      <ActionMenu items={[
                        { label: 'Reativar', onClick: () => setMudandoStatusPerguntaPadrao({ pergunta, ativar: true }) },
                        { label: 'Excluir', variant: 'danger', onClick: () => setExcluindoPerguntaPadrao(pergunta) },
                      ]} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {perguntaPadraoForm && (
        <PerguntaPdiFormModal
          title={perguntaPadraoForm.id ? 'Editar pergunta padrão' : 'Adicionar pergunta padrão'}
          value={perguntaPadraoForm}
          onChange={setPerguntaPadraoForm}
          onSubmit={salvarPerguntaPadrao}
          onClose={() => setPerguntaPadraoForm(null)}
          saving={salvandoPerguntaPadrao}
          mostrarCompartilhada
        />
      )}

      {mudandoStatusPerguntaPadrao && (
        <ConfirmDialog
          title={mudandoStatusPerguntaPadrao.ativar ? 'Reativar pergunta padrão' : 'Inativar pergunta padrão'}
          message={mudandoStatusPerguntaPadrao.ativar
            ? 'Deseja reativar esta pergunta padrão? Ela volta a entrar em novos modelos criados com "Carregar perguntas padrão" marcado.'
            : 'Deseja inativar esta pergunta padrão? Ela deixa de entrar em novos modelos, mas continua aqui (pode reativar depois). Modelos já criados não são afetados.'}
          confirmLabel={mudandoStatusPerguntaPadrao.ativar ? 'Reativar' : 'Inativar'}
          onCancel={() => setMudandoStatusPerguntaPadrao(null)}
          onConfirm={async () => {
            const { pergunta, ativar } = mudandoStatusPerguntaPadrao;
            setMudandoStatusPerguntaPadrao(null);
            const resultado = ativar ? await reativarPdiPerguntaPadrao(pergunta.id) : await inativarPdiPerguntaPadrao(pergunta.id);
            setMessage(resultado.ok ? `Pergunta padrão ${ativar ? 'reativada' : 'inativada'} com sucesso.` : resultado.error);
          }}
        />
      )}

      {excluindoPerguntaPadrao && (
        <ConfirmDialog
          title="Excluir pergunta padrão"
          message={`Tem certeza que deseja excluir definitivamente "${excluindoPerguntaPadrao.pergunta}"? Isso não afeta nenhum Modelo PDI já criado — só deixa de estar disponível para os próximos.`}
          confirmLabel="Excluir"
          onCancel={() => setExcluindoPerguntaPadrao(null)}
          onConfirm={async () => {
            const pergunta = excluindoPerguntaPadrao;
            setExcluindoPerguntaPadrao(null);
            const resultado = await excluirPdiPerguntaPadrao(pergunta.id);
            setMessage(resultado.ok ? 'Pergunta padrão excluída definitivamente.' : resultado.error);
          }}
        />
      )}
    </MainLayout>
  );
};

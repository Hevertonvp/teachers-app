import { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/Layouts';
import { ActionMenu, Button, Card, ConfirmDialog, FormField, OrderButtons, StatusBadge } from '../components/Common';
import { blankPerguntaPdi, PerguntaPdiFormModal, tipoRespostaLabel } from '../components/PerguntaPdiFormModal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { isSecretaria } from '../utils/roles';

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
    trimestrePeriods, updateTrimestrePeriod,
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

  const salvarPeriodo = (trimestre, payload) => {
    updateTrimestrePeriod(trimestre, payload);
    setMessage('Período do trimestre atualizado com sucesso.');
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

        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Calendário letivo</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Trimestres</h2>
          <p className="mt-1 text-sm text-slate-600">
            {podeConfigurar
              ? 'Defina o período de início e encerramento de cada trimestre do ano letivo. Esse calendário é compartilhado entre os módulos do sistema — hoje, o PDI usa automaticamente o trimestre vigente na data atual.'
              : 'Período de cada trimestre do ano letivo, definido pela Secretaria de Educação. O PDI, por exemplo, usa automaticamente o trimestre vigente na data atual.'}
          </p>

          {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {trimestrePeriods.map(periodo => (
              <div key={periodo.trimestre} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{periodo.trimestre}</p>
                {podeConfigurar ? (
                  <div className="mt-3 space-y-3">
                    <FormField label="Início">
                      <input className={inputClass} type="date" value={periodo.startDate} onChange={event => salvarPeriodo(periodo.trimestre, { startDate: event.target.value })} />
                    </FormField>
                    <FormField label="Encerramento">
                      <input className={inputClass} type="date" value={periodo.endDate} onChange={event => salvarPeriodo(periodo.trimestre, { endDate: event.target.value })} />
                    </FormField>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{formatDate(periodo.startDate)} a {formatDate(periodo.endDate)}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {podeConfigurar && (
          <Card>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Perguntas padrão</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Template usado (opcionalmente) ao criar um novo Modelo PDI, em qualquer disciplina. Editar aqui não altera modelos já criados — só vale para os próximos.
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
                      </p>
                    </div>
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

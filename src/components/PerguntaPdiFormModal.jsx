import { Button, FormField, Modal } from './Common';
import { inputClass } from '../utils/display';
import { aplicarAutoCorrecao } from '../utils/autoCorrecao';

// Formulário de UMA pergunta de PDI — mesmo shape usada tanto pelas perguntas de um Modelo
// específico (FormularioPdiPage.jsx) quanto pelo template global de perguntas padrão
// (ConfiguracoesPage.jsx). Extraído pra um componente só pra não duplicar a lógica de
// opções/campo complementar nos dois lugares.
export const TIPO_RESPOSTA_OPTIONS = [
  { value: 'texto', label: 'Texto' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'marcacao', label: 'Marcação' },
  { value: 'numero', label: 'Número' },
  { value: 'orientacao', label: 'Informativa (sem resposta)' },
  // Pergunta escrita normalmente; o Professor responde marcando habilidades do CRMG da disciplina.
  { value: 'habilidade_crmg', label: 'Habilidades do CRMG' },
];

export const tipoRespostaLabel = (value) => TIPO_RESPOSTA_OPTIONS.find(option => option.value === value)?.label || value;

// null/'' = a pergunta aparece em qualquer trimestre (comportamento de sempre).
export const trimestreLabel = (trimestre) => (trimestre ? `Só no ${trimestre}º trimestre` : '');

export const blankPerguntaPdi = (overrides = {}) => ({ secao: 'Registro pedagógico', pergunta: '', tipoResposta: 'texto', opcoes: [], complementar: null, status: 'ativa', trimestre: null, ...overrides });

// `mostrarCompartilhada`: só para perguntas padrão (Configurações) — "entra em todo Modelo" e
// "resposta única entre as disciplinas" são escolhas separadas. CRMG nunca é compartilhada.
export const PerguntaPdiFormModal = ({ title, value, onChange, onSubmit, onClose, saving, ocultarTrimestre = false, trimestreInfo, mostrarCompartilhada = false }) => {
  const changeTipoResposta = (tipoResposta) => {
    onChange({
      ...value,
      tipoResposta,
      ...(tipoResposta === 'habilidade_crmg' ? { compartilhada: false } : {}),
      opcoes: tipoResposta === 'selecao' ? (value.opcoes?.length ? value.opcoes : ['', '']) : [],
      complementar: (tipoResposta === 'texto' || tipoResposta === 'numero' || tipoResposta === 'orientacao' || tipoResposta === 'habilidade_crmg') ? null : value.complementar,
    });
  };

  const toggleComplementar = (habilitado) => {
    onChange({
      ...value,
      complementar: habilitado
        ? { gatilho: value.tipoResposta === 'marcacao' ? true : (value.opcoes.find(opcao => opcao.trim()) || ''), label: value.complementar?.label || '' }
        : null,
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Tipo">
          <select className={inputClass} value={value.tipoResposta} onChange={event => changeTipoResposta(event.target.value)}>
            {TIPO_RESPOSTA_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>

        <FormField label={value.tipoResposta === 'orientacao' ? 'Conteúdo / orientação' : 'Pergunta / texto'}>
          <textarea className={inputClass} rows="4" spellCheck lang="pt-BR" value={value.pergunta} onChange={event => onChange({ ...value, pergunta: event.target.value })} onBlur={() => onChange({ ...value, pergunta: aplicarAutoCorrecao(value.pergunta) })} required />
        </FormField>

        {value.tipoResposta === 'habilidade_crmg' && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Na Ficha, o Professor responde marcando uma ou várias habilidades do CRMG da disciplina (de qualquer ano), ou "Todas as habilidades".
          </p>
        )}

        {value.tipoResposta === 'selecao' && (
          <FormField label="Opções">
            <div className="space-y-2">
              {value.opcoes.map((opcao, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={opcao}
                    onChange={event => onChange({ ...value, opcoes: value.opcoes.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) })}
                    placeholder={`Opção ${index + 1}`}
                    required
                  />
                  <Button type="button" variant="outline" size="sm" disabled={value.opcoes.length <= 2} onClick={() => onChange({ ...value, opcoes: value.opcoes.filter((_, itemIndex) => itemIndex !== index) })}>Remover</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, opcoes: [...value.opcoes, ''] })}>+ Adicionar opção</Button>
            </div>
          </FormField>
        )}

        {(value.tipoResposta === 'selecao' || value.tipoResposta === 'marcacao') && (
          <div className="rounded-lg border border-slate-200 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={!!value.complementar} onChange={event => toggleComplementar(event.target.checked)} />
              Habilitar campo complementar de texto
            </label>
            {value.complementar && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {value.tipoResposta === 'selecao' && (
                  <FormField label="Quando a resposta for">
                    <select className={inputClass} value={value.complementar.gatilho} onChange={event => onChange({ ...value, complementar: { ...value.complementar, gatilho: event.target.value } })}>
                      {value.opcoes.filter(Boolean).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                    </select>
                  </FormField>
                )}
                {value.tipoResposta === 'marcacao' && <p className="text-sm text-slate-600 md:col-span-1">Exibido quando a marcação estiver marcada.</p>}
                <FormField label="Texto exibido (ex.: Como?)"><input className={inputClass} value={value.complementar.label} onChange={event => onChange({ ...value, complementar: { ...value.complementar, label: event.target.value } })} required /></FormField>
              </div>
            )}
          </div>
        )}

        <FormField label="Seção (agrupamento no formulário)"><input className={inputClass} value={value.secao || ''} onChange={event => onChange({ ...value, secao: event.target.value })} placeholder="Ex.: Registro pedagógico" /></FormField>

        {ocultarTrimestre ? (
          trimestreInfo && <p className="text-sm text-slate-500">{trimestreInfo}</p>
        ) : (
          <FormField label="Exibir em">
            <select className={inputClass} value={value.trimestre ?? ''} onChange={event => onChange({ ...value, trimestre: event.target.value ? Number(event.target.value) : null })}>
              <option value="">Todos os trimestres</option>
              <option value="1">Só no 1º trimestre</option>
              <option value="2">Só no 2º trimestre</option>
              <option value="3">Só no 3º trimestre</option>
            </select>
          </FormField>
        )}

        {mostrarCompartilhada && (
          <div className="rounded-lg border border-slate-200 p-4">
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={value.compartilhada !== false} disabled={value.tipoResposta === 'habilidade_crmg'} onChange={event => onChange({ ...value, compartilhada: event.target.checked })} />
              <span>
                Resposta compartilhada entre as disciplinas
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {value.tipoResposta === 'habilidade_crmg'
                    ? 'CRMG é sempre por disciplina.'
                    : value.compartilhada !== false
                      ? 'Uma resposta para todas as disciplinas.'
                      : 'Cada disciplina responde.'}
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button></div>
      </form>
    </Modal>
  );
};

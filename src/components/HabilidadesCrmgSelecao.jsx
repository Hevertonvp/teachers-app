import { useEffect, useId, useState } from 'react';
import { inputClass } from '../utils/display';
import { buscarHabilidadesCurriculares } from '../services/habilidadesCurriculares';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const MIN_CARACTERES = 2;
const DEBOUNCE_MS = 300;

// Resposta de uma pergunta "Habilidades do CRMG": o Professor marca uma ou várias habilidades da
// disciplina da Ficha (qualquer ano) ou "Todas as habilidades". A busca vai ao backend (até 20
// sugestões por vez, sempre filtradas pelo componente da disciplina) — o catálogo nunca vem inteiro.
// `value` = { todas: boolean, habilidades: [{ id, codigo, descricaoOficial }] }.
export const HabilidadesCrmgSelecao = ({ disciplinaId, value, onChange, readOnly = false, disabled = false }) => {
  // Seleção já feita (`value`, vindo do rascunho local protegido do formulário pai) nunca é
  // afetada por isto — preservada localmente mesmo offline (seção "PDI"/"CRMG" do pedido de
  // resiliência). Só a BUSCA de novas habilidades exige conexão — o catálogo inteiro nunca é
  // baixado pra funcionar offline (seção "CRMG" do pedido).
  const { online } = useNetworkStatus();
  const atual = { todas: !!value?.todas, habilidades: value?.habilidades || [] };
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const inputId = useId();
  const listaId = useId();
  const selecionadosIds = new Set(atual.habilidades.map(h => h.id));

  useEffect(() => {
    const termo = busca.trim();
    if (readOnly || !disciplinaId || termo.length < MIN_CARACTERES || !online) {
      setResultados([]);
      setCarregando(false);
      setErro('');
      return undefined;
    }
    const controller = new AbortController();
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const resposta = await buscarHabilidadesCurriculares(disciplinaId, termo, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResultados(resposta.resultados || []);
        setAviso(resposta.componente ? '' : (resposta.mensagem || 'Nenhum componente CRMG configurado para esta disciplina.'));
        setErro('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setErro(error.message);
        setResultados([]);
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, disciplinaId, readOnly]);

  const adicionar = (habilidade) => {
    if (selecionadosIds.has(habilidade.id)) return;
    onChange({ todas: false, habilidades: [...atual.habilidades, { id: habilidade.id, codigo: habilidade.codigo, descricaoOficial: habilidade.descricaoOficial }] });
  };
  const remover = (id) => onChange({ todas: false, habilidades: atual.habilidades.filter(h => h.id !== id) });

  const listaSelecionadas = atual.habilidades.length > 0 && (
    <ul className="space-y-2">
      {atual.habilidades.map(h => (
        <li key={h.id} className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 text-slate-800">
            <span className="mr-1.5 font-mono text-xs font-bold text-teal-700">{h.codigo}</span>
            {h.descricaoOficial}
          </span>
          {!readOnly && (
            <button type="button" onClick={() => remover(h.id)} disabled={disabled} className="shrink-0 rounded px-1.5 text-lg leading-none text-slate-500 hover:bg-white hover:text-red-700 disabled:opacity-50" aria-label={`Remover ${h.codigo}`}>×</button>
          )}
        </li>
      ))}
    </ul>
  );

  if (readOnly) {
    if (atual.todas) return <p className="text-sm font-semibold text-slate-700">Todas as habilidades{value?.componenteNome ? ` de ${value.componenteNome}` : ''}</p>;
    return listaSelecionadas || <p className="text-sm text-slate-500">Nenhuma habilidade marcada.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={atual.todas} disabled={disabled} onChange={event => onChange({ todas: event.target.checked, habilidades: event.target.checked ? [] : atual.habilidades })} />
        Todas as habilidades
      </label>

      {!atual.todas && (
        <>
          {listaSelecionadas}
          <div>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700">Buscar habilidade do CRMG</label>
            <input
              id={inputId}
              className={inputClass}
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Código (ex.: EF06MA) ou palavras da descrição"
              disabled={disabled}
              autoComplete="off"
              aria-controls={listaId}
            />
            {!online && busca.trim().length >= MIN_CARACTERES && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                A busca de habilidades precisa de conexão com a internet. Suas alterações já realizadas continuam protegidas.
              </p>
            )}
            {aviso && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>}
            {online && busca.trim().length >= MIN_CARACTERES && !aviso && (
              <ul id={listaId} role="listbox" aria-label="Sugestões de habilidades" className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {carregando && <li className="px-3 py-2 text-sm text-slate-500">Buscando...</li>}
                {!carregando && erro && <li className="px-3 py-2 text-sm text-red-700">{erro}</li>}
                {!carregando && !erro && resultados.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nenhuma habilidade encontrada.</li>}
                {!carregando && !erro && resultados.map(h => {
                  const jaMarcada = selecionadosIds.has(h.id);
                  return (
                    <li key={h.id} role="option" aria-selected={jaMarcada}>
                      <button type="button" disabled={jaMarcada || disabled} onClick={() => adicionar(h)} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 disabled:cursor-default disabled:bg-teal-50">
                        <span className="font-mono font-bold text-slate-900">{h.codigo}</span>
                        <span className="text-slate-700"> — {h.descricaoOficial}</span>
                        {jaMarcada && <span className="ml-1 text-xs font-semibold text-teal-700">(marcada)</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

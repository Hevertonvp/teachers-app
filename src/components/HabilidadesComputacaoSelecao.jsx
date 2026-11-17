import { useEffect, useState } from 'react';
import { listarHabilidadesComputacao } from '../services/habilidadesCurriculares';

// Resposta de uma pergunta "Habilidades de Computação" (17/11/2026): o Professor marca, numa lista
// curta, habilidades da BNCC Computação do ANO do aluno (congelado na Ficha). Mesmo formato de valor
// do CRMG: { todas: false, habilidades: [{ id, codigo, descricaoOficial }] }.
export const HabilidadesComputacaoSelecao = ({ ano, value, onChange, readOnly = false, disabled = false }) => {
  const marcadas = value?.habilidades || [];
  const marcadasIds = new Set(marcadas.map(h => h.id));
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (readOnly || !ano) return undefined;
    const controller = new AbortController();
    listarHabilidadesComputacao(ano, { signal: controller.signal })
      .then(itens => { setLista(itens); setErro(''); })
      .catch(e => { if (!controller.signal.aborted) setErro(e.message); });
    return () => controller.abort();
  }, [ano, readOnly]);

  const nenhuma = !!value?.nenhuma;
  if (readOnly) {
    if (nenhuma) return <p className="text-sm font-semibold text-slate-700">Nenhuma</p>;
    if (marcadas.length === 0) return <p className="text-sm text-slate-500">Nenhuma habilidade marcada.</p>;
    return (
      <ul className="space-y-2">
        {marcadas.map(h => (
          <li key={h.id} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-slate-800">
            <span className="mr-1.5 font-mono text-xs font-bold text-teal-700">{h.codigo}</span>{h.descricaoOficial}
          </li>
        ))}
      </ul>
    );
  }
  if (!ano) return <p className="text-sm text-slate-500">Sem ano do Fundamental.</p>;

  // Marcadas que não estão na lista (lista ainda carregando ou sem internet) continuam visíveis.
  const itens = [...lista, ...marcadas.filter(h => !lista.some(item => item.id === h.id))];
  const alternar = (h) => {
    const novas = marcadasIds.has(h.id)
      ? marcadas.filter(item => item.id !== h.id)
      : [...marcadas, { id: h.id, codigo: h.codigo, descricaoOficial: h.descricaoOficial }];
    onChange({ todas: false, nenhuma: false, habilidades: novas });
  };
  return (
    <div className="space-y-2">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <input type="checkbox" checked={nenhuma} disabled={disabled} onChange={() => onChange(nenhuma ? { todas: false, nenhuma: false, habilidades: [] } : { todas: false, nenhuma: true, habilidades: [] })} />
        Nenhuma
      </label>
      {erro && !nenhuma && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Não foi possível carregar as habilidades.</p>}
      {!nenhuma && itens.map(h => (
        <label key={h.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${marcadasIds.has(h.id) ? 'border-teal-300 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
          <input type="checkbox" className="mt-0.5" checked={marcadasIds.has(h.id)} disabled={disabled} onChange={() => alternar(h)} />
          <span className="min-w-0 text-slate-800"><span className="mr-1.5 font-mono text-xs font-bold text-teal-700">{h.codigo}</span>{h.descricaoOficial}</span>
        </label>
      ))}
    </div>
  );
};

// Estrutura da escola no cadastro (16/11/2026): "Etapas oferecidas" com três botões grandes; cada etapa marcada abre
// um quadro pequeno com os anos (Fundamental) ou níveis (Educação Infantil) em botões. Os anos do Fundamental vêm
// todos marcados ao ligar a etapa (desmarca o que não houver); os níveis da Infantil começam desmarcados (nunca
// inventa nível). Valor: { etapas: [...], anos: [1..9], niveis: [ids] }.

export const ETAPAS_OFERECIDAS = [
  { value: 'EDUCACAO_INFANTIL', label: 'Educação Infantil', curto: 'Infantil' },
  { value: 'FUNDAMENTAL_I', label: 'Fundamental I', curto: 'Fund. I', anos: [1, 2, 3, 4, 5] },
  { value: 'FUNDAMENTAL_II', label: 'Fundamental II', curto: 'Fund. II', anos: [6, 7, 8, 9] },
];

export const estruturaDaEscola = (escola) => ({
  etapas: escola?.etapasOferecidas ?? [],
  anos: escola?.anosFundamental ?? [],
  niveis: escola?.niveisInfantilIds ?? [],
});

// "Infantil · Fund. I · Fund. II" (ou null se não informada).
export const rotuloEtapas = (escola) => {
  const etapas = escola?.etapasOferecidas ?? [];
  return etapas.length ? ETAPAS_OFERECIDAS.filter(e => etapas.includes(e.value)).map(e => e.curto).join(' · ') : null;
};

// Sugestão a partir das turmas ativas (só marca na tela; a Secretaria confere e salva). Turmas antigas da Infantil
// (Pré I/Pré II) só sugerem a ETAPA — o nível delas não é convertido.
export const sugerirPelasTurmas = (turmasDaEscola) => {
  const ativas = turmasDaEscola.filter(t => t.status === 'ativa');
  const anos = [...new Set(ativas.filter(t => t.etapa === 'fundamental' && t.anoSerie).map(t => Number(t.anoSerie)))].sort((a, b) => a - b);
  const niveis = [...new Set(ativas.map(t => t.nivelLocalId).filter(Boolean))];
  const etapas = [];
  if (ativas.some(t => t.etapa === 'educacao_infantil')) etapas.push('EDUCACAO_INFANTIL');
  if (anos.some(a => a <= 5)) etapas.push('FUNDAMENTAL_I');
  if (anos.some(a => a >= 6)) etapas.push('FUNDAMENTAL_II');
  return { etapas, anos, niveis };
};

const faixaAnos = (anos) => {
  if (!anos.length) return '';
  const partes = [];
  let ini = anos[0], ant = anos[0];
  for (const a of [...anos.slice(1), null]) {
    if (a === ant + 1) { ant = a; continue; }
    partes.push(ini === ant ? `${ini}º` : ant === ini + 1 ? `${ini}º, ${ant}º` : `${ini}º ao ${ant}º`);
    ini = ant = a;
  }
  return `${partes.join(', ')} ano`;
};

export const resumoEstrutura = (valor, niveisCatalogo) => ETAPAS_OFERECIDAS.filter(e => valor.etapas.includes(e.value)).map(e => {
  if (e.anos) return `${e.curto}: ${faixaAnos(valor.anos.filter(a => e.anos.includes(a))) || 'nenhum ano'}`;
  const nomes = niveisCatalogo.filter(n => valor.niveis.includes(n.id)).map(n => n.nome);
  return `${e.curto}: ${nomes.length ? nomes.join(', ') : 'nenhum nível'}`;
}).join(' · ');

const Chip = ({ marcado, onClick, children, rotulo }) => (
  <button type="button" aria-pressed={marcado} aria-label={rotulo} onClick={onClick}
    className={`min-h-10 rounded-lg border px-3 text-sm font-semibold transition ${marcado ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}>
    {marcado ? `✓ ${children}` : children}
  </button>
);

export const EstruturaEscola = ({ valor, onChange, niveisCatalogo, erro = '', acaoExtra = null }) => {
  const alternarEtapa = (etapa) => {
    const ligada = valor.etapas.includes(etapa.value);
    const etapas = ligada ? valor.etapas.filter(e => e !== etapa.value) : [...valor.etapas, etapa.value];
    let { anos, niveis } = valor;
    if (etapa.anos) anos = ligada ? anos.filter(a => !etapa.anos.includes(a)) : [...new Set([...anos, ...etapa.anos])].sort((a, b) => a - b);
    if (etapa.value === 'EDUCACAO_INFANTIL' && ligada) niveis = [];
    onChange({ etapas, anos, niveis });
  };
  const alternar = (lista, item) => (lista.includes(item) ? lista.filter(x => x !== item) : [...lista, item]);
  const ativos = niveisCatalogo.filter(n => n.status !== 'inativa' || valor.niveis.includes(n.id));

  return (
    <div className="space-y-3" data-estrutura-escola>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">Etapas oferecidas</p>
        {acaoExtra}
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Etapas oferecidas">
        {ETAPAS_OFERECIDAS.map(e => {
          const marcada = valor.etapas.includes(e.value);
          return (
            <button key={e.value} type="button" aria-pressed={marcada} onClick={() => alternarEtapa(e)}
              className={`min-h-12 rounded-xl border-2 px-3 text-sm font-bold transition ${marcada ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}>
              {marcada ? `✓ ${e.label}` : e.label}
            </button>
          );
        })}
      </div>

      {ETAPAS_OFERECIDAS.filter(e => valor.etapas.includes(e.value)).map(e => (
        <div key={e.value} className="space-y-2 rounded-lg bg-slate-50 p-3" data-etapa={e.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{e.label}</p>
          {e.anos ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Anos do ${e.label}`}>
              {e.anos.map(a => <Chip key={a} marcado={valor.anos.includes(a)} rotulo={`${a}º ano`} onClick={() => onChange({ ...valor, anos: alternar(valor.anos, a).sort((x, y) => x - y) })}>{`${a}º`}</Chip>)}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600">Marque os níveis que a escola tem:</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Níveis da Educação Infantil">
                {ativos.map(n => <Chip key={n.id} marcado={valor.niveis.includes(n.id)} rotulo={n.nome} onClick={() => onChange({ ...valor, niveis: alternar(valor.niveis, n.id) })}>{n.nome}</Chip>)}
              </div>
            </>
          )}
        </div>
      ))}

      {valor.etapas.length > 0 && <p className="text-sm text-slate-600" data-resumo-estrutura>{resumoEstrutura(valor, niveisCatalogo)}</p>}
      {erro && <p className="text-xs font-semibold text-red-700">{erro}</p>}
    </div>
  );
};

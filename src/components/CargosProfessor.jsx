import { useEffect, useState } from 'react';
import { Badge, Button, LoadingBlock, Modal } from './Common';
import { ComposicaoCargo } from './ComposicaoCargo';
import { alterarCargo, criarCargo, encerrarCargo, listarCargos, previaSaidasCargo } from '../services/cargos';
import { criarVinculoProfessorTurmaDisciplina, encerrarVinculoProfessorTurmaDisciplina, listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { criarVinculoProfessorTurmaAtuacao, encerrarVinculoProfessorTurmaAtuacao, listarVinculosProfessorTurmaAtuacao } from '../services/professorTurmaAtuacao';
import { inputClass } from '../utils/display';
import { nivelLabel } from '../utils/turmas';
import { listarNiveisInfantil } from '../services/niveisInfantil';
import { hojeSpServidor } from '../utils/horaServidor';

// Cargos do Professor (decisão do usuário, 12/11/2026): Professor → Cargo(s) → Escola(s) → Disciplina(s).
// Tela simples e progressiva: "Cargo 1" aberto; cada bloco é Escola + Disciplina(s) e/ou Atuação(ões)
// pedagógica(s) (12/11/2026: Professor Regente, Oficina do Brincar…), com "+ Adicionar disciplina",
// "+ Adicionar atuação" e "+ Adicionar escola". Turmas no cadastro e em "Cargos e escolas" (15/11/2026); sem séries, sem IDs. Cada escola precisa de ao
// menos uma disciplina ou uma atuação. "Cargo 1/2" é só rótulo; quem guarda a identidade é o banco.

let seq = 0;
const novaChave = () => `k${++seq}`;
// Hoje em São Paulo pela hora do SERVIDOR (o relógio do computador pode estar errado).
export const hojeSp = () => hojeSpServidor();
const formatarData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export const novoRascunhoCargo = (escolaId = '') => ({
  chave: novaChave(), dataInicio: hojeSp(),
  partes: [{ chave: novaChave(), escolaId: escolaId ? String(escolaId) : '', disciplinaIds: [''], atuacaoIds: [] }],
});

// `vinculos` = turmas ATIVAS do professor (15/11/2026): cada disciplina do cargo já vem com as turmas que ele tem.
// `vinculosAtuacao` (16/11/2026): idem para as atuações com turma (ex.: Professor Regente).
const rascunhoDoCargo = (cargo, vinculos = [], vinculosAtuacao = []) => ({
  chave: novaChave(), dataInicio: cargo.dataInicio,
  partes: cargo.composicao.map(p => ({
    chave: novaChave(), escolaId: String(p.escolaId), disciplinaIds: p.disciplinas.map(d => String(d.id)), atuacaoIds: (p.atuacoes ?? []).map(a => String(a.id)),
    turmas: Object.fromEntries(p.disciplinas.map(d => [String(d.id), vinculos.filter(v => v.escolaId === p.escolaId && v.disciplinaId === d.id).map(v => String(v.turmaId))])),
    turmasAtuacao: Object.fromEntries((p.atuacoes ?? []).map(a => [String(a.id), vinculosAtuacao.filter(v => v.escolaId === p.escolaId && v.atuacaoId === a.id).map(v => String(v.turmaId))])),
  })),
});

// Validação perto do campo. Devolve { ok, erros: { inicio?, partes: { [chave]: texto } }, dados }.
export function validarRascunhoCargo(r) {
  const erros = { partes: {} };
  if (!r.dataInicio) erros.inicio = 'Informe a data de início.';
  if (r.partes.length === 0) erros.geral = 'Adicione ao menos uma escola.';
  // Seleções vazias ("Selecione…") são ignoradas (decisão do usuário, 12/11/2026): escola só com atuação
  // passa mesmo com o select de disciplina em branco. Erro só quando a escola fica sem nada.
  const preenchidas = (ids) => (ids ?? []).filter(Boolean);
  for (const p of r.partes) {
    if (!p.escolaId) erros.partes[p.chave] = 'Escolha a escola.';
    else if (preenchidas(p.disciplinaIds).length === 0 && preenchidas(p.atuacaoIds).length === 0) erros.partes[p.chave] = 'Escolha ao menos uma disciplina ou uma atuação pedagógica.';
  }
  const ok = !erros.inicio && !erros.geral && Object.keys(erros.partes).length === 0;
  // Turmas marcadas no cadastro (15/11/2026): pares turma+disciplina, só das disciplinas que ficaram no cargo.
  const vinculos = r.partes.flatMap(p => preenchidas(p.disciplinaIds).flatMap(d => ((p.turmas ?? {})[d] ?? []).map(t => ({ turmaId: Number(t), disciplinaId: Number(d) }))));
  // 16/11/2026: turmas por atuação (só das atuações que ficaram no cargo).
  const vinculosAtuacao = r.partes.flatMap(p => preenchidas(p.atuacaoIds).flatMap(a => ((p.turmasAtuacao ?? {})[a] ?? []).map(t => ({ turmaId: Number(t), atuacaoId: Number(a) }))));
  return {
    ok, erros, vinculos, vinculosAtuacao,
    dados: { dataInicio: r.dataInicio, composicao: r.partes.map(p => ({ escolaId: Number(p.escolaId), disciplinaIds: preenchidas(p.disciplinaIds).map(Number), atuacaoIds: preenchidas(p.atuacaoIds).map(Number) })) },
  };
}

const botaoTexto = 'text-sm font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline';
const botaoRemover = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-red-50 hover:text-red-600';

// Editor de UM cargo (controlado). `escolas`/`disciplinas` = [{ id, nome }]; `atuacoes` = [{ id, nome, status }]
// (oferece as ativas; uma inativa que o cargo já tem continua aparecendo).
// `turmas` (15/11/2026, só no cadastro do professor): com ela, cada disciplina escolhida mostra as turmas da escola
// para marcar ali mesmo; `ocupantes` = Map("turmaId-disciplinaId" → nome do professor atual) avisa a substituição.
export const EditorCargo = ({ rotulo, valor, onChange, escolas, disciplinas, atuacoes = [], erros = { partes: {} }, mostrarInicio = true, acoes = null, turmas = null, ocupantes = null }) => {
  const mudarParte = (chave, mudanca) => onChange({ ...valor, partes: valor.partes.map(p => (p.chave === chave ? { ...p, ...mudanca } : p)) });
  const escolasUsadas = (exceto) => new Set(valor.partes.filter(p => p.chave !== exceto).map(p => p.escolaId));
  const todasUsadas = valor.partes.length >= escolas.length;
  // 16/11/2026: disciplinas e atuações COM turma da escola (Biblioteca, Intervenção e Eventual ficam em semTurma).
  const itensComTurma = (parte) => {
    const itens = [];
    for (const d of (parte.disciplinaIds ?? []).filter(Boolean)) {
      const x = disciplinas.find(y => String(y.id) === d);
      if (x) itens.push({ chave: `d${x.id}`, tipo: 'd', id: x.id, nome: x.nome });
    }
    const semTurma = [];
    for (const a of (parte.atuacaoIds ?? []).filter(Boolean)) {
      const x = atuacoes.find(y => String(y.id) === a);
      if (!x) continue;
      if (x.temTurmas === false) semTurma.push(x.nome);
      else itens.push({ chave: `a${x.id}`, tipo: 'a', id: x.id, nome: x.nome });
    }
    return { itens, semTurma };
  };
  // Na lista única, a disciplina/atuação escolhida agora herda as turmas já marcadas na escola.
  const herdar = (parte, tipo, novoId) => {
    if (!novoId) return {};
    const { itens } = itensComTurma(parte);
    const listas = itens.map(it => ((it.tipo === 'd' ? parte.turmas : parte.turmasAtuacao) ?? {})[String(it.id)] ?? []);
    if (parte.separar ?? !listasIguais(listas)) return {};
    const atual = uniao(listas);
    if (!atual.length) return {};
    if (tipo === 'a' && atuacoes.find(y => String(y.id) === novoId)?.temTurmas === false) return {};
    return tipo === 'd' ? { turmas: { ...(parte.turmas ?? {}), [novoId]: atual } } : { turmasAtuacao: { ...(parte.turmasAtuacao ?? {}), [novoId]: atual } };
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{rotulo}</h3>
        {acoes}
      </div>
      {mostrarInicio && (
        <label className="block text-sm font-semibold text-slate-700">
          Data de início
          <input type="date" className={`${inputClass} mt-1 sm:max-w-48`} value={valor.dataInicio} onChange={e => onChange({ ...valor, dataInicio: e.target.value })} />
          {erros.inicio && <span className="mt-1 block text-xs font-semibold text-red-700">{erros.inicio}</span>}
        </label>
      )}
      {valor.partes.map((parte, i) => {
        const usadasNaEscola = (exceto) => new Set(parte.disciplinaIds.filter((_, j) => j !== exceto));
        const linhaVazia = parte.disciplinaIds.some(d => !d);
        const atuacoesDaParte = parte.atuacaoIds ?? [];
        const atuacoesUsadas = (exceto) => new Set(atuacoesDaParte.filter((_, j) => j !== exceto));
        const opcoesAtuacao = (j) => atuacoes.filter(a => (a.status !== 'inativa' || String(a.id) === atuacoesDaParte[j]) && !atuacoesUsadas(j).has(String(a.id)));
        const atuacaoVazia = atuacoesDaParte.some(a => !a);
        const ativas = atuacoes.filter(a => a.status !== 'inativa');
        return (
          <div key={parte.chave} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                Escola
                <select className={`${inputClass} mt-1`} value={parte.escolaId} onChange={e => mudarParte(parte.chave, { escolaId: e.target.value, turmas: {}, turmasAtuacao: {}, separar: undefined, abertoTurmas: undefined })} aria-label={`Escola ${i + 1}`}>
                  <option value="">Selecione a escola</option>
                  {escolas.filter(e => !escolasUsadas(parte.chave).has(String(e.id))).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </label>
              {valor.partes.length > 1 && (
                <button type="button" className={botaoRemover} aria-label="Remover esta escola do cargo" title="Remover escola" onClick={() => onChange({ ...valor, partes: valor.partes.filter(p => p.chave !== parte.chave) })}>×</button>
              )}
            </div>
            <div className="space-y-2 sm:pl-3">
              <p className="text-sm font-semibold text-slate-700">Disciplinas</p>
              {parte.disciplinaIds.map((d, j) => (
                <div key={j} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select className={`${inputClass} min-w-0 flex-1`} value={d} aria-label={`Disciplina ${j + 1}`} onChange={e => mudarParte(parte.chave, { disciplinaIds: parte.disciplinaIds.map((x, k) => (k === j ? e.target.value : x)), ...herdar(parte, 'd', e.target.value) })}>
                      <option value="">Selecione a disciplina</option>
                      {disciplinas.filter(x => !usadasNaEscola(j).has(String(x.id))).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>
                    <button type="button" className={botaoRemover} aria-label="Remover disciplina" title="Remover disciplina" onClick={() => mudarParte(parte.chave, { disciplinaIds: parte.disciplinaIds.filter((_, k) => k !== j) })}>×</button>
                  </div>
                </div>
              ))}
              {/* 15/11/2026: com uma linha vazia o botão some (antes ficava cinza e parecia quebrado). */}
              {!linhaVazia && parte.disciplinaIds.length < disciplinas.length && <button type="button" className={botaoTexto} onClick={() => mudarParte(parte.chave, { disciplinaIds: [...parte.disciplinaIds, ''] })}>+ Adicionar disciplina</button>}
            </div>
            <div className="space-y-2 sm:pl-3">
              <p className="text-sm font-semibold text-slate-700">Atuações pedagógicas</p>
              {atuacoesDaParte.map((a, j) => {
                return (
                  <div key={j} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select className={`${inputClass} min-w-0 flex-1`} value={a} aria-label={`Atuação ${j + 1}`} onChange={e => mudarParte(parte.chave, { atuacaoIds: atuacoesDaParte.map((x, k) => (k === j ? e.target.value : x)), ...herdar(parte, 'a', e.target.value) })}>
                        <option value="">Selecione a atuação</option>
                        {opcoesAtuacao(j).map(x => <option key={x.id} value={x.id}>{x.nome}{x.status === 'inativa' ? ' (inativa)' : ''}</option>)}
                      </select>
                      <button type="button" className={botaoRemover} aria-label="Remover atuação" title="Remover atuação" onClick={() => mudarParte(parte.chave, { atuacaoIds: atuacoesDaParte.filter((_, k) => k !== j) })}>×</button>
                    </div>
                  </div>
                );
              })}
              {!atuacaoVazia && atuacoesDaParte.length < ativas.length && <button type="button" className={botaoTexto} onClick={() => mudarParte(parte.chave, { atuacaoIds: [...atuacoesDaParte, ''] })}>+ Adicionar atuação</button>}
            </div>
            {turmas && parte.escolaId && (() => {
              const { itens, semTurma } = itensComTurma(parte);
              return (
                <div className="sm:pl-3">
                  <TurmasDaParte parte={parte} itens={itens} semTurma={semTurma} ocupantes={ocupantes} todasTurmas={turmas}
                    turmasEscola={turmas.filter(t => t.status === 'ativa' && String(t.escolaId) === parte.escolaId)}
                    onMudar={mudanca => mudarParte(parte.chave, mudanca)} />
                </div>
              );
            })()}
            {erros.partes?.[parte.chave] && <p className="text-xs font-semibold text-red-700">{erros.partes[parte.chave]}</p>}
          </div>
        );
      })}
      {erros.geral && <p className="text-xs font-semibold text-red-700">{erros.geral}</p>}
      <button type="button" className={botaoTexto} disabled={todasUsadas} onClick={() => onChange({ ...valor, partes: [...valor.partes, { chave: novaChave(), escolaId: '', disciplinaIds: [''], atuacaoIds: [] }] })}>+ Adicionar escola</button>
    </div>
  );
};

// ===== Turmas do cargo, por escola (decisão do usuário, 16/11/2026) =====
// Uma área "Turmas" por escola do cargo: fechada vira uma linha de resumo + "Escolher"; aberta mostra abas por etapa
// (Infantil / Fund. I / Fund. II — só as que têm turma; "Outras" para turma marcada que não está na lista) e, dentro
// da aba, uma linha por ano ou nível. Por padrão as turmas valem para TODAS as disciplinas e atuações com turma da
// escola ("lista única"); "Separar por disciplina" dá uma linha de resumo + "Escolher" para cada item. O que é gravado
// não muda: turma × disciplina e turma × atuação. Cargo existente com turmas diferentes por item abre separado.

let catalogoNiveis = null; // cache do catálogo de níveis da Infantil
const useNiveisInfantil = () => {
  const [niveis, setNiveis] = useState([]);
  useEffect(() => {
    let vivo = true;
    catalogoNiveis ??= listarNiveisInfantil().catch(() => []);
    catalogoNiveis.then(l => { if (vivo) setNiveis(l); });
    return () => { vivo = false; };
  }, []);
  return niveis;
};

const GRUPOS = [
  { chave: 'INF', rotulo: 'Infantil' },
  { chave: 'F1', rotulo: 'Fund. I' },
  { chave: 'F2', rotulo: 'Fund. II' },
];
const grupoDaTurma = (t) => (t.etapa === 'educacao_infantil' ? 'INF' : Number(t.anoSerie) <= 5 ? 'F1' : 'F2');
const listasIguais = (listas) => listas.every(l => [...l].sort().join() === [...(listas[0] ?? [])].sort().join());
const uniao = (listas) => [...new Set(listas.flat())];
const ordenarPorNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true });

// Linha (ano ou nível) de uma turma. Nível da Infantil vem do catálogo (nivelLocalId) ou do nível antigo — nunca do nome.
const linhaDaTurma = (t, niveis) => {
  if (t.etapa !== 'educacao_infantil') return { chave: `ano-${t.anoSerie}`, rotulo: `${t.anoSerie}º ano`, ordem: Number(t.anoSerie) };
  const local = niveis.find(n => n.id === t.nivelLocalId);
  if (local) return { chave: `niv-${local.id}`, rotulo: local.nome, ordem: local.ordem };
  return { chave: `ant-${t.nivel}`, rotulo: nivelLabel(t.segmento, t.nivel), ordem: 50 };
};
// Texto do botão: dentro da linha do nível, sem repetir o nível ("Maternal 3 B — Manhã" → "B — Manhã"). Só exibição.
const textoDoBotao = (t, rotuloLinha) => (t.etapa === 'educacao_infantil' && rotuloLinha && t.nome?.startsWith(rotuloLinha) ? t.nome.slice(rotuloLinha.length).replace(/^\s*—\s*/, '').trim() || t.nome : t.nome);

const SeletorTurmas = ({ turmas, extras, marcadas, onChange, rotuloBotao, grupo, preferirFundamental }) => {
  const niveis = useNiveisInfantil();
  const abas = [
    ...GRUPOS.filter(g => turmas.some(t => grupoDaTurma(t) === g.chave)),
    ...(extras.length ? [{ chave: 'OUT', rotulo: 'Outras' }] : []),
  ];
  const daAba = (chave) => (chave === 'OUT' ? extras : turmas.filter(t => grupoDaTurma(t) === chave));
  const contagem = (chave) => daAba(chave).filter(t => marcadas.includes(String(t.id))).length;
  const inicial = abas.find(a => contagem(a.chave) > 0)?.chave
    ?? (preferirFundamental ? abas.find(a => a.chave !== 'INF')?.chave : null) ?? abas[0]?.chave;
  const [aba, setAba] = useState(inicial);
  const atual = abas.some(a => a.chave === aba) ? aba : inicial;
  if (abas.length === 0) return <p className="text-xs text-slate-500">Nenhuma turma nesta escola.</p>;
  const linhas = new Map();
  for (const t of [...daAba(atual)].sort(ordenarPorNome)) {
    const l = atual === 'OUT' ? { chave: 'out', rotulo: '', ordem: 0 } : linhaDaTurma(t, niveis);
    if (!linhas.has(l.chave)) linhas.set(l.chave, { ...l, turmas: [] });
    linhas.get(l.chave).turmas.push(t);
  }
  const alternar = (t) => onChange(marcadas.includes(String(t.id)) ? marcadas.filter(x => x !== String(t.id)) : [...marcadas, String(t.id)]);
  return (
    <div className="space-y-2" role="group" aria-label={grupo}>
      {abas.length > 1 && (
        <div className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Etapas">
          {abas.map(a => {
            const n = contagem(a.chave);
            return (
              <button key={a.chave} type="button" role="tab" aria-selected={a.chave === atual} onClick={() => setAba(a.chave)}
                className={`min-h-9 truncate rounded-md px-2 text-sm font-semibold transition ${a.chave === atual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {a.rotulo}{n ? ` (${n})` : ''}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        {[...linhas.values()].sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, 'pt-BR')).map(l => (
          <div key={l.chave} className="sm:flex sm:items-start sm:gap-3">
            {l.rotulo && <p className="pb-1 text-xs font-semibold text-slate-500 sm:w-24 sm:shrink-0 sm:pb-0 sm:pt-2">{l.rotulo}</p>}
            <div className="flex min-w-0 flex-wrap gap-2">
              {l.turmas.map(t => {
                const marcada = marcadas.includes(String(t.id));
                return (
                  <button key={t.id} type="button" aria-pressed={marcada} aria-label={rotuloBotao(t)} onClick={() => alternar(t)}
                    className={`min-h-9 rounded-lg border px-3 text-sm font-semibold transition ${marcada ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}>
                    {marcada ? `✓ ${textoDoBotao(t, l.rotulo)}` : textoDoBotao(t, l.rotulo)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const resumoDeTurmas = (ids, todas) => {
  const nomes = ids.map(id => todas.find(t => String(t.id) === id)?.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  if (!nomes.length) return 'Nenhuma';
  return nomes.length > 5 ? `${nomes.slice(0, 5).join(', ')} +${nomes.length - 5}` : nomes.join(', ');
};

// Área "Turmas" de UMA escola do cargo. `itens` = disciplinas e atuações com turma: [{ chave, tipo: 'd'|'a', id, nome }].
const TurmasDaParte = ({ parte, itens, semTurma, turmasEscola, todasTurmas, ocupantes, onMudar }) => {
  if (!itens.length) {
    return semTurma.length ? <p className="text-xs text-slate-500" data-sem-turma>Sem turmas para {semTurma.join(', ')}.</p> : null;
  }
  const listaDe = (item) => ((item.tipo === 'd' ? parte.turmas : parte.turmasAtuacao) ?? {})[String(item.id)] ?? [];
  const separar = parte.separar ?? !listasIguais(itens.map(listaDe));
  const unicaMarcadas = uniao(itens.map(listaDe));
  const aberto = parte.abertoTurmas !== undefined ? parte.abertoTurmas : (!separar && unicaMarcadas.length === 0 ? 'unica' : null);
  const gravar = (itensAlvo, lista, extra = {}) => {
    const turmas = { ...(parte.turmas ?? {}) };
    const turmasAtuacao = { ...(parte.turmasAtuacao ?? {}) };
    for (const it of itensAlvo) (it.tipo === 'd' ? turmas : turmasAtuacao)[String(it.id)] = lista;
    // Marcar mantém a área aberta (senão ela fecharia sozinha assim que houvesse turma marcada).
    onMudar({ turmas, turmasAtuacao, abertoTurmas: aberto, ...extra });
  };
  const idsEscola = new Set(turmasEscola.map(t => String(t.id)));
  const extrasDe = (ids) => ids.filter(id => !idsEscola.has(id)).map(id => todasTurmas.find(t => String(t.id) === id)).filter(Boolean);
  const temDisciplina = itens.some(i => i.tipo === 'd');
  const substituicoes = (ids, alvo) => ids.flatMap(id => alvo.filter(i => i.tipo === 'd' && ocupantes?.get(`${id}-${i.id}`)).map(i => ({ id, item: i, nome: ocupantes.get(`${id}-${i.id}`), turma: todasTurmas.find(t => String(t.id) === id)?.nome })));
  const avisos = (lista) => lista.map(s => <p key={`${s.id}-${s.item.id}`} className="text-xs text-amber-800">Substitui {s.nome} na {s.turma}{itens.length > 1 ? ` (${s.item.nome})` : ''}.</p>);
  const linhaResumo = (chave, titulo, ids, rotulo) => (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 text-sm text-slate-700"><span className="font-semibold">{titulo}</span> <span data-resumo-turmas>{resumoDeTurmas(ids, todasTurmas)}</span></p>
      <button type="button" className={botaoTexto} aria-label={rotulo} aria-expanded={aberto === chave} onClick={() => onMudar({ abertoTurmas: aberto === chave ? null : chave })}>{aberto === chave ? 'Pronto ▴' : 'Escolher ▸'}</button>
    </div>
  );

  if (!separar) {
    const titulo = itens.length === 1 ? `Turmas de ${itens[0].nome}:` : 'Turmas:';
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3" data-turmas-escola>
        {linhaResumo('unica', titulo, unicaMarcadas, itens.length === 1 ? `Escolher turmas de ${itens[0].nome}` : 'Escolher turmas')}
        {itens.length > 1 && <p className="text-xs text-slate-500">Valem para {itens.map(i => i.nome).join(', ')}.</p>}
        {aberto === 'unica' && (
          <>
            <SeletorTurmas turmas={turmasEscola} extras={extrasDe(unicaMarcadas)} marcadas={unicaMarcadas} preferirFundamental={temDisciplina}
              grupo={itens.length === 1 ? `Turmas de ${itens[0].nome}` : 'Turmas de todas as disciplinas'}
              rotuloBotao={t => (itens.length === 1 ? `${itens[0].nome} — ${t.nome}` : `Turma ${t.nome}`)}
              onChange={lista => gravar(itens, lista)} />
            {itens.length > 1 && <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={() => onMudar({ separar: true, abertoTurmas: null })}>Separar por disciplina</button>}
          </>
        )}
        {avisos(substituicoes(unicaMarcadas, itens))}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3" data-turmas-escola>
      <p className="text-sm font-semibold text-slate-700">Turmas</p>
      {itens.map(item => {
        const ids = listaDe(item);
        return (
          <div key={item.chave} className="space-y-2 border-t border-slate-100 pt-2">
            {linhaResumo(item.chave, `${item.nome}:`, ids, `Escolher turmas de ${item.nome}`)}
            {aberto === item.chave && (
              <SeletorTurmas turmas={turmasEscola} extras={extrasDe(ids)} marcadas={ids} preferirFundamental={item.tipo === 'd'}
                grupo={`Turmas de ${item.nome}`} rotuloBotao={t => `${item.nome} — ${t.nome}`} onChange={lista => gravar([item], lista)} />
            )}
            {avisos(substituicoes(ids, [item]))}
          </div>
        );
      })}
      <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={() => gravar(itens, unicaMarcadas, { separar: false, abertoTurmas: 'unica' })}>Mesmas turmas para todas</button>
    </div>
  );
};

// "Número de cargos: 1 ou 2" — botões grandes, bons no celular.
export const NumeroDeCargos = ({ valor, onChange, desabilitado = false }) => (
  <div className="inline-flex rounded-lg border border-slate-300 p-1" role="radiogroup" aria-label="Número de cargos">
    {[1, 2].map(n => (
      <button key={n} type="button" role="radio" aria-checked={valor === n} disabled={desabilitado}
        className={`min-w-14 rounded-md px-4 py-2 text-sm font-semibold transition ${valor === n ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
        onClick={() => onChange(n)}>{n}</button>
    ))}
  </div>
);

// Janela "Cargos" de um Professor já cadastrado. Secretaria cadastra, altera e encerra; a Diretora só vê.
// `iniciar` ({ escolaId, cargoId: id | 'novo' }) vem da janela "Escolas": abre o editor já com a escola nova
// (cargo novo ou bloco a mais no cargo escolhido). Nada é salvo sem a Secretaria confirmar.
// Aviso de saída em cascata (decisão do usuário, 13/11/2026): a escola do professor vem do cargo, então tirar a
// escola do cargo ou encerrar o cargo tira o professor da escola e das turmas lá. A tela diz ANTES o que sai.
const AvisoSaidas = ({ nome, saidas }) => (
  <div className="space-y-1 text-sm text-red-900">
    <p className="font-semibold">{nome} também sai de:</p>
    <ul className="list-disc space-y-1 pl-5">
      {saidas.map(s => (
        <li key={s.escolaId}>
          <strong>{s.escolaNome}</strong>
          {s.turmas.length > 0
            ? <> e {s.turmas.length === 1 ? 'da turma' : `das ${s.turmas.length} turmas`} lá: {s.turmas.map(t => `${t.turma} (${t.disciplina})`).join(', ')}</>
            : ' (sem turmas lá)'}
        </li>
      ))}
    </ul>
  </div>
);

export const CargosModal = ({ professor, podeEditar, escolas, disciplinas, atuacoes = [], turmas = [], onClose, onAlterado, iniciar = null }) => {
  const [vinculos, setVinculos] = useState([]); // turmas ATIVAS do professor
  const [vinculosAtuacao, setVinculosAtuacao] = useState([]); // 16/11/2026: turmas ATIVAS por atuação (Regente…)
  const recarregarAtuacao = async () => setVinculosAtuacao((await listarVinculosProfessorTurmaAtuacao({ professorId: professor.id }).catch(() => [])).filter(x => x.status === 'ATIVO'));
  const [ocupantes, setOcupantes] = useState(null); // "turmaId-disciplinaId" → outro professor que dá a disciplina lá
  const [saidasAlterar, setSaidasAlterar] = useState(null); // { lista, dados } — aviso antes de salvar a alteração
  const [cargos, setCargos] = useState(null);
  const [encerrados, setEncerrados] = useState(null);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [editando, setEditando] = useState(null); // { id | 'novo', rascunho, base }
  const [erros, setErros] = useState({ partes: {} });
  const [encerrando, setEncerrando] = useState(null); // { cargo, dataFim }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    setErro('');
    try {
      const [lista, meus, todos, meusAtuacao] = await Promise.all([
        listarCargos(professor.id),
        podeEditar ? listarVinculosProfessorTurmaDisciplina({ professorId: professor.id }) : [],
        podeEditar ? listarVinculosProfessorTurmaDisciplina().catch(() => []) : [],
        podeEditar ? listarVinculosProfessorTurmaAtuacao({ professorId: professor.id }).catch(() => []) : [],
      ]);
      const ativosDele = meus.filter(v => v.status === 'ATIVO');
      const ativosAtuacao = meusAtuacao.filter(v => v.status === 'ATIVO');
      setVinculos(ativosDele);
      setVinculosAtuacao(ativosAtuacao);
      setOcupantes(new Map(todos.filter(v => v.status === 'ATIVO' && v.professorId !== professor.id).map(v => [`${v.turmaId}-${v.disciplinaId}`, v.professorNome])));
      setCargos(lista);
      const alvo = podeEditar && iniciar && iniciar.cargoId !== 'novo' ? lista.find(c => c.id === iniciar.cargoId) : null;
      if (alvo) {
        const rascunho = rascunhoDoCargo(alvo, ativosDele, ativosAtuacao);
        if (!rascunho.partes.some(p => p.escolaId === String(iniciar.escolaId))) {
          rascunho.partes.push({ chave: novaChave(), escolaId: String(iniciar.escolaId), disciplinaIds: [''], atuacaoIds: [] });
        }
        setEditando(prev => prev ?? { id: alvo.id, rascunho, base: alvo.updatedAt });
      } else if (podeEditar && iniciar?.cargoId === 'novo' && lista.length < 2) {
        setEditando(prev => prev ?? { id: 'novo', rascunho: novoRascunhoCargo(iniciar.escolaId) });
      }
      if (podeEditar && lista.length === 0) setEditando(prev => prev ?? { id: 'novo', rascunho: novoRascunhoCargo() });
      if (verEncerrados) setEncerrados((await listarCargos(professor.id, { incluirEncerrados: true })).filter(c => c.status === 'encerrado'));
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEncerrados = async () => {
    setVerEncerrados(v => !v);
    if (!verEncerrados) {
      try { setEncerrados((await listarCargos(professor.id, { incluirEncerrados: true })).filter(c => c.status === 'encerrado')); } catch (e) { setErro(e.message); }
    }
  };

  const quantidade = (cargos?.length ?? 0) + (editando?.id === 'novo' ? 1 : 0);
  // 16/11/2026: durante "Alterar" o número de cargos não muda (cada cargo salva sozinho); em vez de botão apagado
  // sem explicação, tocar nele diz o que fazer.
  const [avisoNumero, setAvisoNumero] = useState(false);
  const alterandoExistente = !!editando && editando.id !== 'novo';
  const mudarQuantidade = (n) => {
    if (alterandoExistente) { if (n !== Math.max(1, quantidade)) setAvisoNumero(true); return; }
    setMensagem('');
    if (n === 2 && quantidade < 2) { setErros({ partes: {} }); setEditando({ id: 'novo', rascunho: novoRascunhoCargo() }); }
    if (n === 1 && editando?.id === 'novo' && cargos?.length === 1) setEditando(null);
    if (n === 1 && cargos?.length === 2) setMensagem('Para ficar com um cargo, encerre um deles abaixo.');
  };

  // Turmas (15/11/2026): só as das escolas+disciplinas deste cargo; marcadas que faltam são criadas, desmarcadas
  // são encerradas. Disciplina tirada do cargo não mexe nas turmas dela (continuam no botão "Turmas").
  const aplicarTurmas = async (v, anterior = null) => {
    const cobertas = new Set(v.dados.composicao.flatMap(p => p.disciplinaIds.map(d => `${p.escolaId}-${d}`)));
    const desejadas = new Map(v.vinculos.map(p => [`${p.turmaId}-${p.disciplinaId}`, p]));
    const atuais = (await listarVinculosProfessorTurmaDisciplina({ professorId: professor.id })).filter(x => x.status === 'ATIVO');
    const falhas = [];
    const nome = (turmaId, disciplinaId) => `${turmas.find(t => t.id === turmaId)?.nome ?? 'turma'} (${disciplinas.find(d => d.id === disciplinaId)?.nome ?? 'disciplina'})`;
    for (const x of atuais) {
      if (!cobertas.has(`${x.escolaId}-${x.disciplinaId}`) || desejadas.has(`${x.turmaId}-${x.disciplinaId}`)) continue;
      try { await encerrarVinculoProfessorTurmaDisciplina(x.id); } catch { falhas.push(nome(x.turmaId, x.disciplinaId)); }
    }
    for (const [chave, p] of desejadas) {
      if (atuais.some(x => `${x.turmaId}-${x.disciplinaId}` === chave)) continue;
      try { await criarVinculoProfessorTurmaDisciplina({ ...p, professorId: professor.id }); } catch { falhas.push(nome(p.turmaId, p.disciplinaId)); }
    }
    setVinculos((await listarVinculosProfessorTurmaDisciplina({ professorId: professor.id })).filter(x => x.status === 'ATIVO'));
    await aplicarTurmasAtuacao(v, anterior, falhas);
    return falhas;
  };

  // Turmas por atuação (16/11/2026): nas escolas deste cargo (antes e depois da alteração), cria as marcadas e
  // encerra as desmarcadas — inclusive as de atuação tirada do cargo (não há outro lugar para tirá-las). Não mexe no
  // que pertence ao OUTRO cargo ativo do professor (mesma escola e mesma atuação).
  const aplicarTurmasAtuacao = async (v, anterior, falhas) => {
    const escolasDoCargo = new Set([...v.dados.composicao.map(p => p.escolaId), ...(anterior?.composicao ?? []).map(p => p.escolaId)]);
    const doOutroCargo = new Set((cargos ?? []).filter(c => c.id !== anterior?.id).flatMap(c => c.composicao.flatMap(p => (p.atuacoes ?? []).map(a => `${p.escolaId}-${a.id}`))));
    const desejadas = new Map(v.vinculosAtuacao.map(p => [`${p.turmaId}-${p.atuacaoId}`, p]));
    const atuais = (await listarVinculosProfessorTurmaAtuacao({ professorId: professor.id })).filter(x => x.status === 'ATIVO');
    const nome = (turmaId, atuacaoId) => `${turmas.find(t => t.id === turmaId)?.nome ?? 'turma'} (${atuacoes.find(a => a.id === atuacaoId)?.nome ?? 'atuação'})`;
    for (const x of atuais) {
      if (!escolasDoCargo.has(x.escolaId) || desejadas.has(`${x.turmaId}-${x.atuacaoId}`) || doOutroCargo.has(`${x.escolaId}-${x.atuacaoId}`)) continue;
      try { await encerrarVinculoProfessorTurmaAtuacao(x.id); } catch { falhas.push(nome(x.turmaId, x.atuacaoId)); }
    }
    for (const [chave, p] of desejadas) {
      if (atuais.some(x => `${x.turmaId}-${x.atuacaoId}` === chave)) continue;
      try { await criarVinculoProfessorTurmaAtuacao({ ...p, professorId: professor.id }); } catch { falhas.push(nome(p.turmaId, p.atuacaoId)); }
    }
    await recarregarAtuacao();
  };

  const salvar = async (confirmarSaida = false) => {
    const v = validarRascunhoCargo(editando.rascunho);
    setErros(v.erros);
    if (!v.ok) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      if (editando.id !== 'novo' && !confirmarSaida) {
        const lista = await previaSaidasCargo(professor.id, editando.id, { composicao: v.dados.composicao });
        if (lista.length > 0) { setSaidasAlterar({ lista }); return; }
      }
      const anterior = editando.id === 'novo' ? null : (cargos ?? []).find(c => c.id === editando.id) ?? null;
      const lista = editando.id === 'novo'
        ? await criarCargo(professor.id, v.dados)
        : await alterarCargo(professor.id, editando.id, { ...v.dados, baseUpdatedAt: editando.base, confirmarSaida });
      setCargos(lista); setEditando(null); setErros({ partes: {} }); setSaidasAlterar(null);
      const falhas = await aplicarTurmas(v, anterior);
      if (falhas.length) setErro(`Não foi possível acertar: ${falhas.join(', ')}. Use o botão "Turmas".`);
      setMensagem(editando.id === 'novo' ? 'Cargo cadastrado.' : 'Cargo alterado.');
      onAlterado?.();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  const abrirEncerramento = async (cargo) => {
    setMensagem(''); setErro('');
    setEncerrando({ cargo, dataFim: hojeSp(), saidas: null });
    try {
      const saidas = await previaSaidasCargo(professor.id, cargo.id, { encerrar: true });
      setEncerrando(prev => (prev?.cargo.id === cargo.id ? { ...prev, saidas } : prev));
    } catch (e) { setErro(e.message); setEncerrando(null); }
  };

  const confirmarEncerramento = async () => {
    setSalvando(true); setErro(''); setMensagem('');
    try {
      setCargos(await encerrarCargo(professor.id, encerrando.cargo.id, encerrando.dataFim, encerrando.saidas.length > 0));
      setMensagem('Cargo encerrado.');
      setVinculos((await listarVinculosProfessorTurmaDisciplina({ professorId: professor.id })).filter(x => x.status === 'ATIVO'));
      await recarregarAtuacao();
      setEncerrando(null);
      if (verEncerrados) setEncerrados((await listarCargos(professor.id, { incluirEncerrados: true })).filter(c => c.status === 'encerrado'));
      onAlterado?.();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <Modal title={`Cargos e escolas — ${professor.nome}`} onClose={onClose}>
      <div className="space-y-4">
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {!cargos && !erro && <LoadingBlock text="Carregando cargos..." className="py-4" />}
        {cargos && (
          <>
            {cargos.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Este professor está sem cargo. {podeEditar ? 'Cadastre o cargo para ele receber o Formulário 1/3.' : 'Peça à Secretaria para cadastrar.'}
              </div>
            )}
            {podeEditar && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">Número de cargos</span>
                <NumeroDeCargos valor={Math.max(1, quantidade)} onChange={mudarQuantidade} desabilitado={salvando} />
                {avisoNumero && alterandoExistente && (
                  <p className="text-sm font-semibold text-amber-800" role="status">Salve ou cancele o {cargos.find(c => c.id === editando.id)?.rotulo ?? 'cargo'} primeiro.</p>
                )}
              </div>
            )}

            {cargos.map(cargo => (editando?.id === cargo.id ? (
              <div key={cargo.id} className="space-y-2">
                <EditorCargo rotulo={cargo.rotulo} valor={editando.rascunho} onChange={r => { setSaidasAlterar(null); setEditando(prev => ({ ...prev, rascunho: r })); }} escolas={escolas} disciplinas={disciplinas} atuacoes={atuacoes} erros={erros} turmas={podeEditar ? turmas : null} ocupantes={ocupantes} />
                {saidasAlterar ? (
                  <div className="space-y-3 rounded-lg border-2 border-red-200 bg-red-50 p-3" role="alert">
                    <AvisoSaidas nome={professor.nome} saidas={saidasAlterar.lista} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setSaidasAlterar(null)} disabled={salvando}>Voltar</Button>
                      <Button variant="danger" size="sm" onClick={() => salvar(true)} loading={salvando}>Salvar e tirar da escola</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setEditando(null); setErros({ partes: {} }); }} disabled={salvando}>Cancelar</Button>
                    <Button size="sm" onClick={() => salvar()} loading={salvando}>Salvar cargo</Button>
                  </div>
                )}
              </div>
            ) : (
              <div key={cargo.id} className="space-y-2 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{cargo.rotulo}</h3>
                    <p className="text-xs text-slate-500">Desde {formatarData(cargo.dataInicio)}</p>
                  </div>
                  {podeEditar && !editando && !encerrando && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setAvisoNumero(false); setMensagem(''); setErros({ partes: {} }); setSaidasAlterar(null); setEditando({ id: cargo.id, rascunho: rascunhoDoCargo(cargo, vinculos, vinculosAtuacao), base: cargo.updatedAt }); }}>Alterar</Button>
                      <Button size="sm" variant="outline" onClick={() => abrirEncerramento(cargo)}>Encerrar cargo</Button>
                    </div>
                  )}
                </div>
                <ComposicaoCargo composicao={cargo.composicao} />
                {encerrando?.cargo.id === cargo.id && (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-900">Encerrar o <strong>{cargo.rotulo}</strong>?</p>
                    {!encerrando.saidas && <LoadingBlock text="Conferindo escolas e turmas..." className="py-2" />}
                    {encerrando.saidas?.length > 0 && (
                      <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3" role="alert">
                        <AvisoSaidas nome={professor.nome} saidas={encerrando.saidas} />
                      </div>
                    )}
                    <label className="block text-sm font-semibold text-slate-700">
                      Data de encerramento
                      <input type="date" className={`${inputClass} mt-1 sm:max-w-48`} value={encerrando.dataFim} max={hojeSp()} onChange={e => setEncerrando(prev => ({ ...prev, dataFim: e.target.value }))} />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEncerrando(null)} disabled={salvando}>Cancelar</Button>
                      <Button size="sm" variant="danger" onClick={confirmarEncerramento} loading={salvando} disabled={!encerrando.dataFim || !encerrando.saidas}>{encerrando.saidas?.length > 0 ? 'Encerrar e tirar da escola' : 'Encerrar cargo'}</Button>
                    </div>
                  </div>
                )}
              </div>
            )))}

            {editando?.id === 'novo' && (
              <div className="space-y-2">
                <EditorCargo rotulo={`Cargo ${cargos.length + 1}`} valor={editando.rascunho} onChange={r => setEditando(prev => ({ ...prev, rascunho: r }))} escolas={escolas} disciplinas={disciplinas} atuacoes={atuacoes} erros={erros} turmas={podeEditar ? turmas : null} ocupantes={ocupantes} />
                <div className="flex justify-end gap-2">
                  {cargos.length > 0 && <Button variant="secondary" size="sm" onClick={() => { setEditando(null); setErros({ partes: {} }); }} disabled={salvando}>Cancelar</Button>}
                  <Button size="sm" onClick={() => salvar()} loading={salvando}>Cadastrar cargo</Button>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3">
              <button type="button" className={botaoTexto} onClick={abrirEncerrados}>{verEncerrados ? 'Esconder cargos encerrados' : 'Ver cargos encerrados'}</button>
              {verEncerrados && encerrados && (
                encerrados.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum cargo encerrado.</p> : (
                  <ul className="mt-2 space-y-2">
                    {encerrados.map(c => (
                      <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2"><Badge variant="gray">Encerrado</Badge><span className="text-xs text-slate-500">{formatarData(c.dataInicio)} a {formatarData(c.dataFim)}</span></div>
                        <ComposicaoCargo composicao={c.composicao} className="mt-1" />
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </>
        )}
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
      </div>
    </Modal>
  );
};

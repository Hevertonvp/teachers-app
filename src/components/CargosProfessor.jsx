import { useEffect, useState } from 'react';
import { Badge, Button, LoadingBlock, Modal } from './Common';
import { ComposicaoCargo } from './ComposicaoCargo';
import { alterarCargo, criarCargo, encerrarCargo, listarCargos } from '../services/cargos';
import { inputClass } from '../utils/display';

// Cargos do Professor (decisão do usuário, 12/11/2026): Professor → Cargo(s) → Escola(s) → Disciplina(s).
// Tela simples e progressiva: "Cargo 1" aberto; cada bloco é Escola + Disciplina(s), com
// "+ Adicionar disciplina" e "+ Adicionar escola". Sem turmas, sem séries, sem IDs. Disciplina é
// opcional por escola (Educação Infantil). "Cargo 1/2" é só rótulo; quem guarda a identidade é o banco.

let seq = 0;
const novaChave = () => `k${++seq}`;
export const hojeSp = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const formatarData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export const novoRascunhoCargo = (escolaId = '') => ({
  chave: novaChave(), dataInicio: hojeSp(),
  partes: [{ chave: novaChave(), escolaId: escolaId ? String(escolaId) : '', disciplinaIds: [''] }],
});

const rascunhoDoCargo = (cargo) => ({
  chave: novaChave(), dataInicio: cargo.dataInicio,
  partes: cargo.composicao.map(p => ({ chave: novaChave(), escolaId: String(p.escolaId), disciplinaIds: p.disciplinas.map(d => String(d.id)) })),
});

// Validação perto do campo. Devolve { ok, erros: { inicio?, partes: { [chave]: texto } }, dados }.
export function validarRascunhoCargo(r) {
  const erros = { partes: {} };
  if (!r.dataInicio) erros.inicio = 'Informe a data de início.';
  if (r.partes.length === 0) erros.geral = 'Adicione ao menos uma escola.';
  for (const p of r.partes) {
    if (!p.escolaId) erros.partes[p.chave] = 'Escolha a escola.';
    else if (p.disciplinaIds.some(d => !d)) erros.partes[p.chave] = 'Escolha a disciplina ou remova a linha vazia.';
  }
  const ok = !erros.inicio && !erros.geral && Object.keys(erros.partes).length === 0;
  return {
    ok, erros,
    dados: { dataInicio: r.dataInicio, composicao: r.partes.map(p => ({ escolaId: Number(p.escolaId), disciplinaIds: p.disciplinaIds.map(Number) })) },
  };
}

const botaoTexto = 'text-sm font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline';
const botaoRemover = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-red-50 hover:text-red-600';

// Editor de UM cargo (controlado). `escolas`/`disciplinas` = [{ id, nome }].
export const EditorCargo = ({ rotulo, valor, onChange, escolas, disciplinas, erros = { partes: {} }, mostrarInicio = true, acoes = null }) => {
  const mudarParte = (chave, mudanca) => onChange({ ...valor, partes: valor.partes.map(p => (p.chave === chave ? { ...p, ...mudanca } : p)) });
  const escolasUsadas = (exceto) => new Set(valor.partes.filter(p => p.chave !== exceto).map(p => p.escolaId));
  const todasUsadas = valor.partes.length >= escolas.length;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{rotulo}</h3>
        {acoes}
      </div>
      {mostrarInicio && (
        <label className="block text-sm font-semibold text-slate-700">
          Início do cargo
          <input type="date" className={`${inputClass} mt-1 sm:max-w-48`} value={valor.dataInicio} onChange={e => onChange({ ...valor, dataInicio: e.target.value })} />
          {erros.inicio && <span className="mt-1 block text-xs font-semibold text-red-700">{erros.inicio}</span>}
        </label>
      )}
      {valor.partes.map((parte, i) => {
        const usadasNaEscola = (exceto) => new Set(parte.disciplinaIds.filter((_, j) => j !== exceto));
        const linhaVazia = parte.disciplinaIds.some(d => !d);
        return (
          <div key={parte.chave} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                Escola
                <select className={`${inputClass} mt-1`} value={parte.escolaId} onChange={e => mudarParte(parte.chave, { escolaId: e.target.value })} aria-label={`Escola ${i + 1}`}>
                  <option value="">Selecione a escola</option>
                  {escolas.filter(e => !escolasUsadas(parte.chave).has(String(e.id))).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </label>
              {valor.partes.length > 1 && (
                <button type="button" className={botaoRemover} aria-label="Remover esta escola do cargo" title="Remover escola" onClick={() => onChange({ ...valor, partes: valor.partes.filter(p => p.chave !== parte.chave) })}>×</button>
              )}
            </div>
            <div className="space-y-2 sm:pl-3">
              <p className="text-sm font-semibold text-slate-700">Disciplina</p>
              {parte.disciplinaIds.map((d, j) => (
                <div key={j} className="flex items-center gap-2">
                  <select className={`${inputClass} min-w-0 flex-1`} value={d} aria-label={`Disciplina ${j + 1}`} onChange={e => mudarParte(parte.chave, { disciplinaIds: parte.disciplinaIds.map((x, k) => (k === j ? e.target.value : x)) })}>
                    <option value="">Selecione a disciplina</option>
                    {disciplinas.filter(x => !usadasNaEscola(j).has(String(x.id))).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                  <button type="button" className={botaoRemover} aria-label="Remover disciplina" title="Remover disciplina" onClick={() => mudarParte(parte.chave, { disciplinaIds: parte.disciplinaIds.filter((_, k) => k !== j) })}>×</button>
                </div>
              ))}
              {parte.disciplinaIds.length === 0 && <p className="text-xs text-slate-500">Sem disciplina específica (por exemplo, Educação Infantil).</p>}
              <button type="button" className={botaoTexto} disabled={linhaVazia || parte.disciplinaIds.length >= disciplinas.length} onClick={() => mudarParte(parte.chave, { disciplinaIds: [...parte.disciplinaIds, ''] })}>+ Adicionar disciplina</button>
            </div>
            {erros.partes?.[parte.chave] && <p className="text-xs font-semibold text-red-700">{erros.partes[parte.chave]}</p>}
          </div>
        );
      })}
      {erros.geral && <p className="text-xs font-semibold text-red-700">{erros.geral}</p>}
      <button type="button" className={botaoTexto} disabled={todasUsadas} onClick={() => onChange({ ...valor, partes: [...valor.partes, { chave: novaChave(), escolaId: '', disciplinaIds: [''] }] })}>+ Adicionar escola</button>
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
export const CargosModal = ({ professor, podeEditar, escolas, disciplinas, onClose, onAlterado }) => {
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
      const lista = await listarCargos(professor.id);
      setCargos(lista);
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
  const mudarQuantidade = (n) => {
    setMensagem('');
    if (n === 2 && quantidade < 2) { setErros({ partes: {} }); setEditando({ id: 'novo', rascunho: novoRascunhoCargo() }); }
    if (n === 1 && editando?.id === 'novo' && cargos?.length === 1) setEditando(null);
    if (n === 1 && cargos?.length === 2) setMensagem('Para ficar com um cargo, encerre um deles abaixo.');
  };

  const salvar = async () => {
    const v = validarRascunhoCargo(editando.rascunho);
    setErros(v.erros);
    if (!v.ok) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      const lista = editando.id === 'novo'
        ? await criarCargo(professor.id, v.dados)
        : await alterarCargo(professor.id, editando.id, { ...v.dados, baseUpdatedAt: editando.base });
      setCargos(lista); setEditando(null); setErros({ partes: {} });
      setMensagem(editando.id === 'novo' ? 'Cargo cadastrado.' : 'Cargo alterado. A mudança vale a partir do próximo Formulário 1/3 que abrir.');
      onAlterado?.();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  const confirmarEncerramento = async () => {
    setSalvando(true); setErro(''); setMensagem('');
    try {
      setCargos(await encerrarCargo(professor.id, encerrando.cargo.id, encerrando.dataFim));
      setMensagem('Cargo encerrado. Ele fica guardado no histórico e deixa de gerar Formulário 1/3.');
      setEncerrando(null);
      if (verEncerrados) setEncerrados((await listarCargos(professor.id, { incluirEncerrados: true })).filter(c => c.status === 'encerrado'));
      onAlterado?.();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <Modal title={`Cargos — ${professor.nome}`} onClose={onClose}>
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
                <NumeroDeCargos valor={Math.max(1, quantidade)} onChange={mudarQuantidade} desabilitado={salvando || (editando && editando.id !== 'novo')} />
              </div>
            )}

            {cargos.map(cargo => (editando?.id === cargo.id ? (
              <div key={cargo.id} className="space-y-2">
                <EditorCargo rotulo={cargo.rotulo} valor={editando.rascunho} onChange={r => setEditando(prev => ({ ...prev, rascunho: r }))} escolas={escolas} disciplinas={disciplinas} erros={erros} />
                <p className="text-xs text-slate-500">A mudança vale a partir do próximo Formulário 1/3 que abrir. O que já está aberto continua como estava.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setEditando(null); setErros({ partes: {} }); }} disabled={salvando}>Cancelar</Button>
                  <Button size="sm" onClick={salvar} loading={salvando}>Salvar cargo</Button>
                </div>
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
                      <Button size="sm" variant="outline" onClick={() => { setMensagem(''); setErros({ partes: {} }); setEditando({ id: cargo.id, rascunho: rascunhoDoCargo(cargo), base: cargo.updatedAt }); }}>Alterar</Button>
                      <Button size="sm" variant="outline" onClick={() => { setMensagem(''); setEncerrando({ cargo, dataFim: hojeSp() }); }}>Encerrar cargo</Button>
                    </div>
                  )}
                </div>
                <ComposicaoCargo composicao={cargo.composicao} />
                {encerrando?.cargo.id === cargo.id && (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-900">Encerrar o <strong>{cargo.rotulo}</strong>? Ele não é apagado: fica no histórico e deixa de gerar Formulário 1/3. O que o professor já escreveu fica guardado.</p>
                    <label className="block text-sm font-semibold text-slate-700">
                      Data de encerramento
                      <input type="date" className={`${inputClass} mt-1 sm:max-w-48`} value={encerrando.dataFim} max={hojeSp()} onChange={e => setEncerrando(prev => ({ ...prev, dataFim: e.target.value }))} />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEncerrando(null)} disabled={salvando}>Cancelar</Button>
                      <Button size="sm" variant="danger" onClick={confirmarEncerramento} loading={salvando} disabled={!encerrando.dataFim}>Encerrar cargo</Button>
                    </div>
                  </div>
                )}
              </div>
            )))}

            {editando?.id === 'novo' && (
              <div className="space-y-2">
                <EditorCargo rotulo={`Cargo ${cargos.length + 1}`} valor={editando.rascunho} onChange={r => setEditando(prev => ({ ...prev, rascunho: r }))} escolas={escolas} disciplinas={disciplinas} erros={erros} />
                <div className="flex justify-end gap-2">
                  {cargos.length > 0 && <Button variant="secondary" size="sm" onClick={() => { setEditando(null); setErros({ partes: {} }); }} disabled={salvando}>Cancelar</Button>}
                  <Button size="sm" onClick={salvar} loading={salvando}>Cadastrar cargo</Button>
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

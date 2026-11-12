import { useEffect, useState } from 'react';
import { Badge, Button, Card } from './Common';
import { alterarAtuacao, criarAtuacao, listarAtuacoes } from '../services/cargos';
import { inputClass } from '../utils/display';

// Configurações › Atuações pedagógicas (decisão do usuário, 12/11/2026): a Secretaria mantém a lista usada nos
// cargos (Professor Regente, Oficina do Brincar, Professor de Intervenção…). Nunca apaga: desativar tira a
// atuação das listas de escolha, mas ela continua nos cargos e folhas que já a usam. Não são disciplinas.
export const AtuacoesPedagogicasConfig = () => {
  const [lista, setLista] = useState(null);
  const [nova, setNova] = useState('');
  const [editando, setEditando] = useState(null); // { id, nome }
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = () => listarAtuacoes().then(setLista).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const executar = async (fn, ok) => {
    setErro(''); setMensagem(''); setSalvando(true);
    try { await fn(); setMensagem(ok); await carregar(); return true; } catch (e) { setErro(e.message); return false; } finally { setSalvando(false); }
  };
  const adicionar = async (e) => {
    e.preventDefault();
    if (!nova.trim()) return;
    if (await executar(() => criarAtuacao(nova.trim()), `Atuação "${nova.trim()}" cadastrada.`)) setNova('');
  };
  const renomear = async () => {
    if (await executar(() => alterarAtuacao(editando.id, { nome: editando.nome.trim() }), 'Nome alterado.')) setEditando(null);
  };

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Cargos dos professores</p>
      <h2 className="mt-1 text-xl font-bold text-slate-950">Atuações pedagógicas</h2>
      <p className="mt-1 text-sm text-slate-600">Funções como Professor Regente ou Oficina do Brincar, escolhidas no cargo do professor junto com (ou no lugar de) as disciplinas. Desativar tira da lista de escolha, mas não muda cargos nem folhas que já usam a atuação.</p>
      {erro && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">{erro}</p>}
      {mensagem && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{mensagem}</p>}
      <form onSubmit={adicionar} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input className={`${inputClass} flex-1`} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova atuação (ex.: Professor de Apoio)" aria-label="Nova atuação pedagógica" maxLength={100} />
        <Button type="submit" disabled={!nova.trim() || salvando}>Adicionar</Button>
      </form>
      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {(lista ?? []).map((a) => (
          <li key={a.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            {editando?.id === a.id ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <input className={`${inputClass} flex-1`} value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} aria-label={`Novo nome de ${a.nome}`} maxLength={100} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={renomear} disabled={!editando.nome.trim() || salvando}>Salvar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${a.status === 'ativa' ? 'text-slate-900' : 'text-slate-500'}`}>{a.nome}</span>
                  {a.status !== 'ativa' && <Badge variant="gray">Inativa</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setMensagem(''); setEditando({ id: a.id, nome: a.nome }); }}>Renomear</Button>
                  <Button size="sm" variant="outline" disabled={salvando} onClick={() => executar(() => alterarAtuacao(a.id, { status: a.status === 'ativa' ? 'inativa' : 'ativa' }), a.status === 'ativa' ? `"${a.nome}" desativada.` : `"${a.nome}" reativada.`)}>{a.status === 'ativa' ? 'Desativar' : 'Reativar'}</Button>
                </div>
              </>
            )}
          </li>
        ))}
        {lista && lista.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nenhuma atuação cadastrada.</li>}
      </ul>
    </Card>
  );
};

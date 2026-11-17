import { useEffect, useState } from 'react';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, FormField, Modal, OrderButtons } from './Common';
import { inputClass } from '../utils/display';
import { listarHabilidadesComputacao } from '../services/habilidadesCurriculares';
import {
  criarPerguntaComputacao, editarPerguntaComputacao, excluirPerguntaComputacao, listarPerguntasComputacao,
  mudarStatusPerguntaComputacao, reordenarPerguntasComputacao,
} from '../services/pdiPerguntasComputacao';

// Configurações › Perguntas de Computação do PDI (17/11/2026). Só a Secretaria. Entram nas Aplicações
// criadas depois, só para alunos do ano marcado. Base sempre do catálogo oficial da BNCC Computação.
const ANOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const OPCOES_PADRAO = ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'];
const TIPOS = [
  { value: 'selecao', label: 'Seleção' },
  { value: 'texto', label: 'Texto' },
  { value: 'marcacao', label: 'Marcação' },
  { value: 'numero', label: 'Número' },
  { value: 'orientacao', label: 'Informativa (sem resposta)' },
];
const rotuloTipo = (t) => (t === 'habilidade_computacao' ? 'Marcar habilidades do ano' : TIPOS.find(x => x.value === t)?.label || t);
const rotuloAnos = (anos) => (anos.length === 1 ? `${anos[0]}º ano` : `${anos.map(a => `${a}º`).join(', ')} anos`);
const vazia = () => ({ modo: 'habilidade', ano: '', habilidadeId: '', anos: [], secao: '', texto: '', observacao: '', tipoResposta: 'selecao', opcoes: [...OPCOES_PADRAO], complementar: null });

export const PerguntasComputacaoConfig = () => {
  const [perguntas, setPerguntas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [catalogo, setCatalogo] = useState([]);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [excluindo, setExcluindo] = useState(null);

  const carregar = async () => {
    try { setPerguntas(await listarPerguntasComputacao()); } catch (e) { setMensagem(e.message); }
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (form && catalogo.length === 0) listarHabilidadesComputacao().then(setCatalogo).catch(() => {}); }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const ativas = perguntas.filter(p => p.status === 'ativa');
  const inativas = perguntas.filter(p => p.status === 'inativa');
  const doAno = catalogo.filter(h => form?.ano && h.anos.includes(Number(form.ano)));

  const abrirEdicao = (p) => {
    setErroForm('');
    setForm({
      id: p.id, modo: p.tipoResposta === 'habilidade_computacao' ? 'marcar' : 'habilidade',
      ano: p.habilidadeId ? String(p.anos[0] || '') : '', habilidadeId: p.habilidadeId ? String(p.habilidadeId) : '', anos: p.anos,
      secao: p.secao, texto: p.texto, observacao: p.observacao || '', tipoResposta: p.tipoResposta,
      opcoes: p.opcoes?.length ? p.opcoes : [...OPCOES_PADRAO], complementar: p.complementar,
    });
  };

  const escolherHabilidade = (id) => {
    const h = catalogo.find(item => String(item.id) === id);
    const anterior = catalogo.find(item => String(item.id) === form.habilidadeId);
    // Texto da pergunta acompanha a habilidade enquanto a Secretaria não escreveu outro.
    const texto = !form.texto || form.texto === anterior?.descricaoOficial ? (h?.descricaoOficial || '') : form.texto;
    setForm({ ...form, habilidadeId: id, texto });
  };

  const salvar = async (event) => {
    event.preventDefault();
    const tipoResposta = form.modo === 'marcar' ? 'habilidade_computacao' : form.tipoResposta;
    const opcoes = tipoResposta === 'selecao' ? form.opcoes.map(o => o.trim()).filter(Boolean) : [];
    if (form.modo === 'habilidade' && !form.habilidadeId) return setErroForm('Escolha a habilidade.');
    if (form.modo === 'marcar' && form.anos.length === 0) return setErroForm('Marque ao menos um ano.');
    if (tipoResposta === 'selecao' && opcoes.length < 2) return setErroForm('Cadastre ao menos duas opções.');
    setSalvando(true);
    try {
      const dados = { ...form, tipoResposta, opcoes, complementar: tipoResposta === 'selecao' || tipoResposta === 'marcacao' ? form.complementar : null };
      if (form.id) await editarPerguntaComputacao(form.id, dados); else await criarPerguntaComputacao(dados);
      setForm(null);
      setMensagem(form.id ? 'Pergunta atualizada.' : 'Pergunta adicionada.');
      await carregar();
    } catch (e) { setErroForm(e.message); }
    setSalvando(false);
  };

  const mudarStatus = async (p, ativar) => {
    try { await mudarStatusPerguntaComputacao(p.id, ativar); setMensagem(ativar ? 'Pergunta reativada.' : 'Pergunta inativada.'); await carregar(); } catch (e) { setMensagem(e.message); }
  };
  const mover = async (index, direcao) => {
    const atual = ativas[index]; const vizinha = ativas[index + direcao];
    if (!vizinha) return;
    try { setPerguntas(await reordenarPerguntasComputacao([{ id: atual.id, ordem: vizinha.ordem }, { id: vizinha.id, ordem: atual.ordem }])); } catch (e) { setMensagem(e.message); }
  };

  const linha = (p, index, ativa) => (
    <div key={p.id} className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{p.codigo && <span className="mr-1.5 font-mono text-xs font-bold text-teal-700">{p.codigo}</span>}{p.texto}</p>
        <p className="mt-1 text-xs text-slate-500">{rotuloTipo(p.tipoResposta)} · {rotuloAnos(p.anos)}</p>
      </div>
      {!ativa && <Badge>Inativa</Badge>}
      {ativa && <OrderButtons onUp={() => mover(index, -1)} onDown={() => mover(index, 1)} upDisabled={index === 0} downDisabled={index === ativas.length - 1} />}
      <ActionMenu items={ativa
        ? [{ label: 'Editar', onClick: () => abrirEdicao(p) }, { label: 'Inativar', onClick: () => mudarStatus(p, false) }, { label: 'Excluir', variant: 'danger', onClick: () => setExcluindo(p) }]
        : [{ label: 'Reativar', onClick: () => mudarStatus(p, true) }, { label: 'Excluir', variant: 'danger', onClick: () => setExcluindo(p) }]} />
    </div>
  );

  return (
    <Card>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">PDI</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">Perguntas de Computação</h2>
          <p className="mt-1 text-sm text-slate-600">BNCC Computação. Entram nas próximas Aplicações, só para o ano do aluno.</p>
        </div>
        <Button size="sm" onClick={() => { setErroForm(''); setForm(vazia()); }}>+ Adicionar pergunta</Button>
      </div>
      {mensagem && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</p>}
      {carregando ? <p className="mt-4 text-center text-slate-500">Carregando...</p> : (
        <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {ativas.map((p, i) => linha(p, i, true))}
          {ativas.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhuma pergunta de Computação.</p>}
          {inativas.map((p, i) => linha(p, i, false))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? 'Editar pergunta de Computação' : 'Adicionar pergunta de Computação'} onClose={() => setForm(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <FormField label="Como o professor responde">
              <select className={inputClass} value={form.modo} onChange={e => setForm({ ...form, modo: e.target.value })}>
                <option value="habilidade">Sobre uma habilidade</option>
                <option value="marcar">Marcando habilidades do ano do aluno</option>
              </select>
            </FormField>

            {form.modo === 'habilidade' ? (
              <>
                <FormField label="Ano">
                  <select className={inputClass} value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value, habilidadeId: '' })}>
                    <option value="">Escolha</option>
                    {ANOS.map(a => <option key={a} value={a}>{a}º ano</option>)}
                  </select>
                </FormField>
                {form.ano && (
                  <FormField label="Habilidade">
                    <select className={inputClass} value={form.habilidadeId} onChange={e => escolherHabilidade(e.target.value)}>
                      <option value="">Escolha</option>
                      {doAno.map(h => <option key={h.id} value={h.id}>{h.codigo} — {h.descricaoOficial.length > 90 ? `${h.descricaoOficial.slice(0, 90)}…` : h.descricaoOficial}</option>)}
                    </select>
                  </FormField>
                )}
                <FormField label="Tipo de resposta">
                  <select className={inputClass} value={form.tipoResposta === 'habilidade_computacao' ? 'selecao' : form.tipoResposta} onChange={e => setForm({ ...form, tipoResposta: e.target.value })}>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FormField>
              </>
            ) : (
              <FormField label="Anos">
                <div className="flex flex-wrap gap-2">
                  {ANOS.map(a => (
                    <label key={a} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${form.anos.includes(a) ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-700'}`}>
                      <input type="checkbox" checked={form.anos.includes(a)} onChange={e => setForm({ ...form, anos: e.target.checked ? [...form.anos, a].sort((x, y) => x - y) : form.anos.filter(x => x !== a) })} />
                      {a}º
                    </label>
                  ))}
                </div>
              </FormField>
            )}

            <FormField label="Pergunta / texto">
              <textarea className={inputClass} rows="3" spellCheck lang="pt-BR" value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} required />
            </FormField>

            {form.modo === 'habilidade' && form.tipoResposta === 'selecao' && (
              <FormField label="Opções">
                <div className="space-y-2">
                  {form.opcoes.map((opcao, i) => (
                    <div key={i} className="flex gap-2">
                      <input className={inputClass} value={opcao} placeholder={`Opção ${i + 1}`} onChange={e => setForm({ ...form, opcoes: form.opcoes.map((o, j) => (j === i ? e.target.value : o)) })} />
                      <Button type="button" variant="outline" size="sm" disabled={form.opcoes.length <= 2} onClick={() => setForm({ ...form, opcoes: form.opcoes.filter((_, j) => j !== i) })}>Remover</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, opcoes: [...form.opcoes, ''] })}>+ Adicionar opção</Button>
                </div>
              </FormField>
            )}

            {form.modo === 'habilidade' && (form.tipoResposta === 'selecao' || form.tipoResposta === 'marcacao') && (
              <div className="rounded-lg border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={!!form.complementar} onChange={e => setForm({ ...form, complementar: e.target.checked ? { gatilho: form.tipoResposta === 'marcacao' ? true : (form.opcoes.find(o => o.trim()) || ''), label: '' } : null })} />
                  Campo complementar de texto
                </label>
                {form.complementar && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {form.tipoResposta === 'selecao' && (
                      <FormField label="Quando a resposta for">
                        <select className={inputClass} value={form.complementar.gatilho} onChange={e => setForm({ ...form, complementar: { ...form.complementar, gatilho: e.target.value } })}>
                          {form.opcoes.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormField>
                    )}
                    <FormField label="Texto exibido (ex.: Como?)"><input className={inputClass} value={form.complementar.label} onChange={e => setForm({ ...form, complementar: { ...form.complementar, label: e.target.value } })} required /></FormField>
                  </div>
                )}
              </div>
            )}

            <FormField label="Observação (opcional)">
              <textarea className={inputClass} rows="2" spellCheck lang="pt-BR" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
            </FormField>
            <FormField label="Seção">
              <input className={inputClass} value={form.secao} onChange={e => setForm({ ...form, secao: e.target.value })} placeholder="Computação (BNCC)" />
            </FormField>

            {erroForm && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erroForm}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" loading={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {excluindo && (
        <ConfirmDialog
          title="Excluir pergunta"
          message={`Excluir "${excluindo.texto.length > 80 ? `${excluindo.texto.slice(0, 80)}…` : excluindo.texto}"?`}
          confirmLabel="Excluir"
          onCancel={() => setExcluindo(null)}
          onConfirm={async () => {
            const p = excluindo; setExcluindo(null);
            try { await excluirPerguntaComputacao(p.id); setMensagem('Pergunta excluída.'); await carregar(); } catch (e) { setMensagem(e.message); }
          }}
        />
      )}
    </Card>
  );
};

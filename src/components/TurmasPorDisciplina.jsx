import { useCallback, useEffect, useState } from 'react';
import { Button, ConfirmDialog, LoadingBlock } from './Common';
import { listarCargos } from '../services/cargos';
import { criarVinculoProfessorTurmaDisciplina, encerrarVinculoProfessorTurmaDisciplina, listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';

// Turmas do professor por DISCIPLINA DO CARGO (decisão do usuário, 15/11/2026): a disciplina não é escolhida de
// novo — vem do cargo (escola → disciplinas). Para cada escola, uma linha por disciplina com as turmas para marcar.
// Marcar cria o vínculo; desmarcar encerra. Se outro professor já dá aquela disciplina na turma, pergunta antes
// de substituir. Escola só com atuação (sem disciplina) não tem turmas aqui. Vínculos antigos com disciplina fora
// do cargo continuam visíveis, com "Encerrar".
export const TurmasPorDisciplina = ({ professor, escolas, turmas }) => {
  const [cargos, setCargos] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(null); // chave turma-disciplina em andamento
  const [substituir, setSubstituir] = useState(null); // { turma, disciplina, ocupante }

  const carregarVinculos = useCallback(async () => {
    setVinculos(await listarVinculosProfessorTurmaDisciplina({ professorId: professor.id }));
  }, [professor.id]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [c] = await Promise.all([listarCargos(professor.id), carregarVinculos()]);
        if (ativo) setCargos(c);
      } catch (e) { if (ativo) { setErro(e.message); setCargos([]); } }
    })();
    return () => { ativo = false; };
  }, [professor.id, carregarVinculos]);

  if (!cargos) return <LoadingBlock text="Carregando..." className="py-3" />;

  const ativos = vinculos.filter(v => v.status === 'ATIVO');
  const vinculoDe = (turmaId, disciplinaId) => ativos.find(v => v.turmaId === turmaId && v.disciplinaId === disciplinaId);
  // Disciplinas do cargo (todos os cargos ativos) em cada escola.
  const disciplinasDaEscola = (escolaId) => {
    const mapa = new Map();
    for (const cargo of cargos.filter(c => c.status !== 'encerrado')) {
      for (const parte of cargo.composicao ?? []) {
        if (parte.escolaId !== escolaId) continue;
        for (const d of parte.disciplinas ?? []) mapa.set(d.id, d.nome);
      }
    }
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  const criar = async (turma, disciplina) => {
    setSalvando(`${turma.id}-${disciplina.id}`);
    try { await criarVinculoProfessorTurmaDisciplina({ turmaId: turma.id, professorId: professor.id, disciplinaId: disciplina.id }); await carregarVinculos(); } catch (e) { setErro(e.message); } finally { setSalvando(null); }
  };
  const alternar = async (turma, disciplina) => {
    setErro('');
    const atual = vinculoDe(turma.id, disciplina.id);
    if (atual) {
      setSalvando(`${turma.id}-${disciplina.id}`);
      try { await encerrarVinculoProfessorTurmaDisciplina(atual.id); await carregarVinculos(); } catch (e) { setErro(e.message); } finally { setSalvando(null); }
      return;
    }
    // Outro professor já dá esta disciplina nesta turma? Pergunta antes de substituir.
    const daTurma = await listarVinculosProfessorTurmaDisciplina({ turmaId: turma.id }).catch(() => []);
    const ocupante = daTurma.find(v => v.status === 'ATIVO' && v.disciplinaId === disciplina.id && v.professorId !== professor.id);
    if (ocupante) { setSubstituir({ turma, disciplina, ocupante }); return; }
    await criar(turma, disciplina);
  };
  const encerrar = async (vinculo) => {
    setErro('');
    try { await encerrarVinculoProfessorTurmaDisciplina(vinculo.id); await carregarVinculos(); } catch (e) { setErro(e.message); }
  };

  return (
    <div className="space-y-5">
      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
      {escolas.map(escola => {
        const disciplinas = disciplinasDaEscola(escola.id);
        const turmasDaEscola = turmas.filter(t => t.status === 'ativa' && t.escolaId === escola.id).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { numeric: true }));
        const foraDoCargo = ativos.filter(v => v.escolaId === escola.id && !disciplinas.some(d => d.id === v.disciplinaId));
        return (
          <section key={escola.id} className="space-y-3" data-escola={escola.nome}>
            {escolas.length > 1 && <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{escola.nome}</p>}
            {disciplinas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">Sem disciplina no cargo nesta escola.</p>
            ) : turmasDaEscola.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Esta escola não tem turmas cadastradas.</p>
            ) : disciplinas.map(disciplina => (
              <div key={disciplina.id} className="rounded-lg border border-slate-200 p-3" data-disciplina={disciplina.nome}>
                <p className="mb-2 text-sm font-semibold text-slate-900">{disciplina.nome}</p>
                <div className="flex flex-wrap gap-2">
                  {turmasDaEscola.map(turma => {
                    const marcada = !!vinculoDe(turma.id, disciplina.id);
                    const ocupado = salvando === `${turma.id}-${disciplina.id}`;
                    return (
                      <button
                        key={turma.id}
                        type="button"
                        aria-pressed={marcada}
                        aria-label={`${disciplina.nome} — ${turma.nome}`}
                        disabled={!!salvando}
                        onClick={() => alternar(turma, disciplina)}
                        className={`min-h-9 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-60 ${marcada ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400'}`}
                      >
                        {ocupado ? '…' : marcada ? `✓ ${turma.nome}` : turma.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {foraDoCargo.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">Fora do cargo</p>
                {foraDoCargo.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2 text-sm">
                    <span>{v.turmaNome} — {v.disciplinaNome}</span>
                    <Button size="sm" variant="outline" className="text-red-700" onClick={() => encerrar(v)}>Encerrar</Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {substituir && (
        <ConfirmDialog
          title="Substituir professor"
          message={`${substituir.ocupante.professorNome ?? 'Outro professor'} já dá ${substituir.disciplina.nome} na ${substituir.turma.nome}. Colocar ${professor.nome} no lugar?`}
          confirmLabel="Substituir"
          onCancel={() => setSubstituir(null)}
          onConfirm={() => { const s = substituir; setSubstituir(null); criar(s.turma, s.disciplina); }}
        />
      )}
    </div>
  );
};

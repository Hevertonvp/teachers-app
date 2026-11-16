import { useEffect, useState } from 'react';
import { listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { listarVinculosProfessorTurmaAtuacao } from '../services/professorTurmaAtuacao';

// Bloco somente leitura "Professores da turma": vínculo real Professor↔Turma↔Disciplina
// (GET /api/professor-turma-disciplina, o mesmo usado em GestaoPessoas.jsx) — só derivado,
// professores do aluno nunca são salvos aqui (ver seção 19 do pedido de Aluno PDI).
export const ProfessoresDaTurmaPreview = ({ turmaId }) => {
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!turmaId) { setVinculos([]); return; }
    let cancelado = false;
    setCarregando(true);
    // 16/11/2026: inclui quem está na turma por atuação (ex.: "Maria — Professor Regente").
    Promise.all([listarVinculosProfessorTurmaDisciplina({ turmaId: Number(turmaId) }), listarVinculosProfessorTurmaAtuacao({ turmaId: Number(turmaId) }).catch(() => [])])
      .then(([porDisciplina, porAtuacao]) => { if (!cancelado) setVinculos([
        ...porDisciplina.filter(item => item.status === 'ATIVO').map(v => ({ ...v, chave: `d${v.id}`, funcao: v.disciplinaNome })),
        ...porAtuacao.filter(item => item.status === 'ATIVO').map(v => ({ ...v, chave: `a${v.id}`, funcao: v.atuacaoNome })),
      ]); })
      .catch(() => { if (!cancelado) setVinculos([]); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [turmaId]);

  return (
    <div className="md:col-span-2">
      <p className="mb-1.5 text-sm font-semibold text-slate-700">Professores(as) da turma</p>
      {!turmaId ? (
        <p className="text-sm text-slate-500">Selecione uma turma para ver os professores(as) vinculados(as).</p>
      ) : carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : vinculos.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum professor com vínculo ativo nesta turma ainda.</p>
      ) : (
        <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {vinculos.map(vinculo => (
            <li key={vinculo.chave}>{vinculo.professorNome} — {vinculo.funcao}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

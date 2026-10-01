import { useEffect, useState } from 'react';
import { listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';

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
    listarVinculosProfessorTurmaDisciplina({ turmaId: Number(turmaId) })
      .then(lista => { if (!cancelado) setVinculos(lista.filter(item => item.status === 'ATIVO')); })
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
            <li key={`${vinculo.professorId}-${vinculo.disciplinaId}`}>{vinculo.professorNome} — {vinculo.disciplinaNome}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

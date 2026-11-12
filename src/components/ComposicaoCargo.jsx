// Composição de um cargo no Formulário 1/3 (decisão do usuário, 12/11/2026): escola → disciplinas,
// sempre associadas ("Prudenciana — Inglês, Geografia"). Sem turmas, sem séries, sem IDs.
export const ComposicaoCargo = ({ composicao = [], className = '' }) => (
  <ul className={`space-y-0.5 text-sm text-slate-700 ${className}`}>
    {composicao.map(parte => (
      <li key={parte.escolaId} className="break-words">
        <span className="font-semibold text-slate-800">{parte.escolaNome}</span>
        {parte.disciplinas?.length ? <> — {parte.disciplinas.map(d => d.nome).join(', ')}</> : null}
      </li>
    ))}
  </ul>
);

export const AvisoFolhaCompartilhada = ({ texto }) => (texto ? (
  <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{texto}</div>
) : null);

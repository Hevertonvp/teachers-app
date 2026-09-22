import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Button, FormField, Modal, PersonName } from '../components/Common';
import { InstrumentManager } from '../components/InstrumentManager';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { escolaName, inputClass, turmaName } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { CURRENT_DATE } from '../utils/formAvailability';
import { canManagePessoas } from '../utils/roles';

const statusOptions = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

const StatusBadgePessoa = ({ status }) => <Badge variant={status === 'ativo' ? 'green' : 'gray'}>{status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>;

const VinculosPessoaModal = ({ pessoa, usuarioTipo, escolas, vinculosEscolares, createVinculoEscolar, desvincularEscola, onClose }) => {
  const isVinculado = (escolaId) => vinculosEscolares.some(vinculo => vinculo.usuarioTipo === usuarioTipo && vinculo.usuarioId === pessoa.id && vinculo.escolaId === escolaId && vinculo.status === 'ativo');

  const toggle = (escolaId) => {
    const vinculoAtivo = vinculosEscolares.find(vinculo => vinculo.usuarioTipo === usuarioTipo && vinculo.usuarioId === pessoa.id && vinculo.escolaId === escolaId && vinculo.status === 'ativo');
    if (vinculoAtivo) desvincularEscola(vinculoAtivo.id);
    else createVinculoEscolar({ escolaId, usuarioTipo, usuarioId: pessoa.id, status: 'ativo' });
  };

  return (
    <Modal title={`Vínculos - ${pessoa.nome}`} onClose={onClose}>
      <div className="grid gap-2 sm:grid-cols-2">
        {escolas.map(escola => (
          <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isVinculado(escola.id)} onChange={() => toggle(escola.id)} />
            {escola.nome}{escola.status !== 'ativa' ? ' (inativa)' : ''}
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </Modal>
  );
};

// Turmas/disciplinas de um professor (turmaProfessores) — com histórico, mesmo padrão do
// vínculo Auxiliar<->Turma: no máximo um vínculo ATIVO por (turma, disciplina); trocar de
// professor numa turma/disciplina encerra o vínculo antigo (dataFim preenchida) em vez de
// apagar. O professor perde acesso às fichas PDI daquela turma/disciplina imediatamente ao ser
// encerrado, mas o que ele já respondeu antes continua no histórico (ver pdiFichaRespostas).
const VinculosTurmaProfessorModal = ({ professor, professores, turmas, disciplinas, escolas, turmaProfessores, vincularProfessorTurma, encerrarVinculoProfessorTurma, onClose }) => {
  const [novoVinculo, setNovoVinculo] = useState({ turmaId: turmas[0]?.id ?? '', disciplinaId: disciplinas[0]?.id ?? '', dataInicio: CURRENT_DATE });
  const [message, setMessage] = useState('');

  const vinculosAtivos = turmaProfessores
    .filter(item => item.professorId === professor.id && item.status === 'ativo')
    .sort((left, right) => turmaName(turmas, left.turmaId).localeCompare(turmaName(turmas, right.turmaId)));

  const historico = turmaProfessores
    .filter(item => item.professorId === professor.id && item.status === 'encerrado')
    .sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio));

  const ocupanteAtual = (turmaId, disciplinaId) => turmaProfessores.find(item => (
    item.turmaId === Number(turmaId) && item.disciplinaId === Number(disciplinaId) && item.status === 'ativo'
  ));
  const conflito = novoVinculo.turmaId && novoVinculo.disciplinaId ? ocupanteAtual(novoVinculo.turmaId, novoVinculo.disciplinaId) : null;
  const conflitoComOutro = conflito && conflito.professorId !== professor.id ? conflito : null;

  const salvar = (event) => {
    event.preventDefault();
    if (!novoVinculo.turmaId || !novoVinculo.disciplinaId || !novoVinculo.dataInicio) {
      setMessage('Escolha a turma, a disciplina e a data de início.');
      return;
    }
    vincularProfessorTurma(novoVinculo.turmaId, professor.id, novoVinculo.disciplinaId, novoVinculo.dataInicio);
    setMessage('Vínculo criado com sucesso.');
  };

  return (
    <Modal title={`Turmas e disciplinas - ${professor.nome}`} onClose={onClose}>
      <div className="space-y-5">
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Vínculos ativos</p>
          {vinculosAtivos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma turma vinculada no momento.</p>
          ) : (
            <div className="space-y-2">
              {vinculosAtivos.map(vinculo => {
                const turma = turmas.find(item => item.id === vinculo.turmaId);
                return (
                  <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{turma?.nome} — {disciplinas.find(item => item.id === vinculo.disciplinaId)?.nome}</p>
                      <p className="text-xs text-slate-500">{escolaName(escolas, turma?.escolaId)} · desde {formatDate(vinculo.dataInicio)}</p>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => { encerrarVinculoProfessorTurma(vinculo.id, CURRENT_DATE); setMessage('Vínculo encerrado com sucesso.'); }}>Encerrar</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={salvar} className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">Vincular a uma turma/disciplina</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Turma">
              <select className={inputClass} value={novoVinculo.turmaId} onChange={event => setNovoVinculo(prev => ({ ...prev, turmaId: Number(event.target.value) }))}>
                {turmas.map(turma => <option key={turma.id} value={turma.id}>{turma.nome} — {escolaName(escolas, turma.escolaId)}</option>)}
              </select>
            </FormField>
            <FormField label="Disciplina">
              <select className={inputClass} value={novoVinculo.disciplinaId} onChange={event => setNovoVinculo(prev => ({ ...prev, disciplinaId: Number(event.target.value) }))}>
                {disciplinas.map(disciplina => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Data de início"><input className={inputClass} type="date" value={novoVinculo.dataInicio} onChange={event => setNovoVinculo(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
          {conflitoComOutro && (
            <p className="text-xs font-semibold text-amber-700">
              Atualmente, {professores.find(item => item.id === conflitoComOutro.professorId)?.nome || 'outro professor'} leciona esta disciplina nesta turma — vincular aqui encerra o vínculo dele automaticamente.
            </p>
          )}
          <div className="flex justify-end"><Button type="submit" size="sm">Vincular</Button></div>
        </form>

        {historico.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Histórico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Turma</th><th className="pb-2 pr-4">Disciplina</th><th className="pb-2 pr-4">Início</th><th className="pb-2">Fim</th></tr></thead>
                <tbody>
                  {historico.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{turmaName(turmas, item.turmaId)}</td>
                      <td className="py-2 pr-4">{disciplinas.find(d => d.id === item.disciplinaId)?.nome || 'Não encontrada'}</td>
                      <td className="py-2 pr-4">{formatDate(item.dataInicio)}</td>
                      <td className="py-2">{item.dataFim ? formatDate(item.dataFim) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
      </div>
    </Modal>
  );
};

const PessoasManager = ({ title, description, usuarioTipo, records, fields, columns, onCreate, onUpdate, escolas, vinculosEscolares, createVinculoEscolar, desvincularEscola, emptyDescription }) => {
  const [managingPessoa, setManagingPessoa] = useState(null);
  const [managingTurmas, setManagingTurmas] = useState(null);
  const { professores, turmas, disciplinas, turmaProfessores, vincularProfessorTurma, encerrarVinculoProfessorTurma } = useData();

  const allColumns = [
    ...columns,
    { key: 'vinculos', header: 'Vínculos', render: row => (
      <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => setManagingPessoa(row)}>Gerenciar vínculos</Button>
        {usuarioTipo === 'professor' && <Button size="sm" variant="outline" onClick={() => setManagingTurmas(row)}>Turmas e disciplinas</Button>}
      </div>
    ) },
  ];

  return (
    <>
      <InstrumentManager
        title={title}
        description={description}
        records={records}
        fields={fields}
        columns={allColumns}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={() => {}}
        canDelete={false}
        detailTitle="Detalhes"
        searchFields={[row => row.nome, row => row.email]}
        emptyDescription={emptyDescription}
      />

      {managingPessoa && (
        <VinculosPessoaModal
          pessoa={managingPessoa}
          usuarioTipo={usuarioTipo}
          escolas={escolas}
          vinculosEscolares={vinculosEscolares}
          createVinculoEscolar={createVinculoEscolar}
          desvincularEscola={desvincularEscola}
          onClose={() => setManagingPessoa(null)}
        />
      )}

      {managingTurmas && (
        <VinculosTurmaProfessorModal
          professor={managingTurmas}
          professores={professores}
          turmas={turmas}
          disciplinas={disciplinas}
          escolas={escolas}
          turmaProfessores={turmaProfessores}
          vincularProfessorTurma={vincularProfessorTurma}
          encerrarVinculoProfessorTurma={encerrarVinculoProfessorTurma}
          onClose={() => setManagingTurmas(null)}
        />
      )}
    </>
  );
};

export const GestaoPessoas = () => {
  const { user, registrarUsuario } = useAuth();
  const {
    professores,
    gestores,
    diretores,
    escolas,
    vinculosEscolares,
    createProfessor,
    updateProfessor,
    disciplinas,
    createGestor,
    updateGestor,
    createDiretor,
    updateDiretor,
    createVinculoEscolar,
    desvincularEscola,
  } = useData();
  const [tab, setTab] = useState('professores');

  if (!canManagePessoas(user)) return <Navigate to="/dashboard" replace />;

  const professorFields = [
    { name: 'nome', label: 'Nome completo', required: true },
    { name: 'disciplinas', label: 'Matéria(s) que leciona', required: true, kind: 'multi-select', options: disciplinas.map(disciplina => ({ value: disciplina.id, label: disciplina.nome })), defaultValue: [] },
    { name: 'escolaIds', label: 'Escolas de vínculo', required: true, kind: 'multi-select', options: escolas.map(escola => ({ value: escola.id, label: `${escola.nome}${escola.status !== 'ativa' ? ' (inativa)' : ''}` })), defaultValue: [] },
    { name: 'email', label: 'E-mail', required: true },
    { name: 'status', label: 'Status', required: true, options: statusOptions, defaultValue: 'ativo' },
  ];
  const professorColumns = [
    { key: 'nome', header: 'Nome', render: row => <ProfessorName professor={row} /> },
    { key: 'disciplinas', header: 'Matérias', render: row => row.disciplinas.map(id => disciplinas.find(disciplina => disciplina.id === id)?.nome).filter(Boolean).join(', ') || 'Não informadas' },
    { key: 'email', header: 'E-mail' },
    { key: 'status', header: 'Status', render: row => <StatusBadgePessoa status={row.status} /> },
  ];

  const createProfessorWithLinks = (payload) => {
    const { escolaIds = [], ...professorPayload } = payload;
    const created = createProfessor(professorPayload);
    escolaIds.forEach(escolaId => createVinculoEscolar({ escolaId, usuarioTipo: 'professor', usuarioId: created.id, status: 'ativo' }));
    // Sem isso, o professor ficava cadastrado mas sem nenhuma conta pra entrar no sistema.
    registrarUsuario({ email: created.email, tipo: 'professor', perfilId: created.id });
  };

  const updateProfessorWithLinks = (id, payload) => {
    const { escolaIds = [], ...professorPayload } = payload;
    updateProfessor(id, professorPayload);
    const activeLinks = vinculosEscolares.filter(vinculo => vinculo.usuarioTipo === 'professor' && vinculo.usuarioId === Number(id) && vinculo.status === 'ativo');
    activeLinks.filter(vinculo => !escolaIds.includes(vinculo.escolaId)).forEach(vinculo => desvincularEscola(vinculo.id));
    escolaIds.filter(escolaId => !activeLinks.some(vinculo => vinculo.escolaId === escolaId)).forEach(escolaId => createVinculoEscolar({ escolaId, usuarioTipo: 'professor', usuarioId: Number(id), status: 'ativo' }));
  };
  const professoresComEscolas = professores.map(professor => ({
    ...professor,
    escolaIds: vinculosEscolares
      .filter(vinculo => vinculo.usuarioTipo === 'professor' && vinculo.usuarioId === professor.id && vinculo.status === 'ativo')
      .map(vinculo => vinculo.escolaId),
  }));

  // Mesma lógica do professor: criar a pessoa sem criar a conta a deixaria sem forma de entrar.
  const createGestorWithLogin = (payload) => {
    const created = createGestor(payload);
    registrarUsuario({ email: created.email, tipo: 'gestor', perfilId: created.id });
  };

  const createDiretorWithLogin = (payload) => {
    const created = createDiretor(payload);
    registrarUsuario({ email: created.email, tipo: 'diretora', perfilId: created.id });
  };

  const cargoFields = [
    { name: 'nome', label: 'Nome completo', required: true },
    { name: 'email', label: 'E-mail', required: true },
    { name: 'cargo', label: 'Cargo', required: true },
    { name: 'status', label: 'Status', required: true, options: statusOptions, defaultValue: 'ativo' },
  ];
  const cargoColumns = [
    { key: 'nome', header: 'Nome', render: row => <PersonName nome={row.nome} cargo={row.cargo} /> },
    { key: 'email', header: 'E-mail' },
    { key: 'status', header: 'Status', render: row => <StatusBadgePessoa status={row.status} /> },
  ];

  const tabs = [
    { key: 'professores', label: 'Professores' },
    { key: 'supervisores', label: 'Supervisores' },
    { key: 'diretores', label: 'Diretores' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Gestão de Pessoas</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Cadastre, edite e gerencie os vínculos de professores, supervisores e diretores com as escolas da rede.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'professores' && (
          <PessoasManager
            title="Professores"
            description="Cadastro dos professores da rede."
            usuarioTipo="professor"
            records={professoresComEscolas}
            fields={professorFields}
            columns={professorColumns}
            onCreate={createProfessorWithLinks}
            onUpdate={updateProfessorWithLinks}
            escolas={escolas}
            vinculosEscolares={vinculosEscolares}
            createVinculoEscolar={createVinculoEscolar}
            desvincularEscola={desvincularEscola}
            emptyDescription="Cadastre o primeiro professor da rede."
          />
        )}

        {tab === 'supervisores' && (
          <PessoasManager
            title="Supervisores"
            description="Cadastro dos supervisores responsáveis pela gestão operacional das escolas vinculadas."
            usuarioTipo="gestor"
            records={gestores}
            fields={cargoFields}
            columns={cargoColumns}
            onCreate={createGestorWithLogin}
            onUpdate={updateGestor}
            escolas={escolas}
            vinculosEscolares={vinculosEscolares}
            createVinculoEscolar={createVinculoEscolar}
            desvincularEscola={desvincularEscola}
            emptyDescription="Cadastre o primeiro supervisor da rede."
          />
        )}

        {tab === 'diretores' && (
          <PessoasManager
            title="Diretores"
            description="Cadastro dos diretores responsáveis por cada escola."
            usuarioTipo="diretora"
            records={diretores}
            fields={cargoFields}
            columns={cargoColumns}
            onCreate={createDiretorWithLogin}
            onUpdate={updateDiretor}
            escolas={escolas}
            vinculosEscolares={vinculosEscolares}
            createVinculoEscolar={createVinculoEscolar}
            desvincularEscola={desvincularEscola}
            emptyDescription="Cadastre o primeiro diretor da rede."
          />
        )}
      </div>
    </MainLayout>
  );
};

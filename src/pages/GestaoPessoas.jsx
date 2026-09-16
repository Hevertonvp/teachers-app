import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Button, Modal, PersonName } from '../components/Common';
import { InstrumentManager } from '../components/InstrumentManager';
import { ProfessorName } from '../components/ProfessorName';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
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

const PessoasManager = ({ title, description, usuarioTipo, records, fields, columns, onCreate, onUpdate, escolas, vinculosEscolares, createVinculoEscolar, desvincularEscola, emptyDescription }) => {
  const [managingPessoa, setManagingPessoa] = useState(null);

  const allColumns = [
    ...columns,
    { key: 'vinculos', header: 'Vínculos', render: row => (
      <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); setManagingPessoa(row); }}>Gerenciar vínculos</Button>
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
    </>
  );
};

export const GestaoPessoas = () => {
  const { user } = useAuth();
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
            onCreate={createGestor}
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
            onCreate={createDiretor}
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

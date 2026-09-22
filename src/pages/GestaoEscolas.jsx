import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, Button, Modal } from '../components/Common';
import { InstrumentManager } from '../components/InstrumentManager';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { canManageEscolas } from '../utils/roles';

const escolaStatusOptions = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
];

const VinculosModal = ({ escola, professores, gestores, vinculosEscolares, createVinculoEscolar, desvincularEscola, onClose }) => {
  const isVinculado = (usuarioTipo, usuarioId) => vinculosEscolares.some(vinculo => vinculo.escolaId === escola.id && vinculo.usuarioTipo === usuarioTipo && vinculo.usuarioId === usuarioId && vinculo.status === 'ativo');

  const toggle = (usuarioTipo, usuarioId) => {
    const vinculoAtivo = vinculosEscolares.find(vinculo => vinculo.escolaId === escola.id && vinculo.usuarioTipo === usuarioTipo && vinculo.usuarioId === usuarioId && vinculo.status === 'ativo');
    if (vinculoAtivo) desvincularEscola(vinculoAtivo.id);
    else createVinculoEscolar({ escolaId: escola.id, usuarioTipo, usuarioId, status: 'ativo' });
  };

  return (
    <Modal title={`Vínculos - ${escola.nome}`} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Supervisores(as)</p>
          <div className="space-y-2">
            {gestores.map(gestor => (
              <label key={gestor.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isVinculado('gestor', gestor.id)} onChange={() => toggle('gestor', gestor.id)} />
                {gestor.nome}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Professores(as)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {professores.map(professor => (
              <label key={professor.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isVinculado('professor', professor.id)} onChange={() => toggle('professor', professor.id)} />
                {professor.nome}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </Modal>
  );
};

export const GestaoEscolas = () => {
  const { user } = useAuth();
  const { escolas, professores, gestores, vinculosEscolares, createEscola, updateEscola, createVinculoEscolar, desvincularEscola } = useData();
  const [managingEscola, setManagingEscola] = useState(null);

  if (!canManageEscolas(user)) return <Navigate to="/dashboard" replace />;

  const fields = [
    { name: 'nome', label: 'Nome da escola', required: true },
    { name: 'status', label: 'Status', required: true, options: escolaStatusOptions, defaultValue: 'ativa' },
  ];

  const columns = [
    { key: 'nome', header: 'Escola' },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.status === 'ativa' ? 'green' : 'gray'}>{row.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge> },
    { key: 'vinculos', header: 'Vínculos', render: row => (
      <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); setManagingEscola(row); }}>Gerenciar vínculos</Button>
    ) },
  ];

  return (
    <MainLayout>
      <InstrumentManager
        title="Escolas"
        description="Cadastre, edite e desative escolas da rede. Desativar bloqueia o acesso operacional, mas preserva o histórico. Vínculos de professores e supervisores são gerenciados por escola."
        records={escolas}
        fields={fields}
        columns={columns}
        onCreate={createEscola}
        onUpdate={updateEscola}
        onDelete={() => {}}
        canDelete={false}
        detailTitle="Detalhes da escola"
        searchFields={[row => row.nome]}
        emptyDescription="Cadastre a primeira escola da rede para começar."
      />

      {managingEscola && (
        <VinculosModal
          escola={managingEscola}
          professores={professores}
          gestores={gestores}
          vinculosEscolares={vinculosEscolares}
          createVinculoEscolar={createVinculoEscolar}
          desvincularEscola={desvincularEscola}
          onClose={() => setManagingEscola(null)}
        />
      )}
    </MainLayout>
  );
};

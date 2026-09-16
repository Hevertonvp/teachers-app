import { MainLayout } from '../layouts/Layouts';
import { InstrumentManager } from '../components/InstrumentManager';
import { Badge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { canManagePedagogico } from '../utils/roles';

const tipoOptions = [
  { value: 'Reunião', label: 'Reunião' },
  { value: 'Sábado letivo', label: 'Sábado letivo' },
  { value: 'Formação', label: 'Formação' },
  { value: 'Conselho', label: 'Conselho' },
  { value: 'Simulado', label: 'Simulado' },
  { value: 'Outro', label: 'Outro' },
];

// O formulário usa '' para representar "rede inteira" (não há id de escola 0); normalizeEscolaId
// converte isso para null antes de salvar, que é o valor que o restante do app espera.
const normalizeEscolaId = (payload) => ({ ...payload, escolaId: payload.escolaId ? Number(payload.escolaId) : null });

export const EventosPage = () => {
  const { user } = useAuth();
  const { eventos, createEvento, updateEvento, deleteEvento } = useData();
  const { userEscolas } = useEscola();
  const podeGerenciar = canManagePedagogico(user);

  const escolaOptions = [
    { value: '', label: 'Rede inteira (todas as escolas)' },
    ...userEscolas.map(escola => ({ value: String(escola.id), label: escola.nome })),
  ];

  const fields = [
    { name: 'titulo', label: 'Título', required: true },
    { name: 'descricao', label: 'Descrição básica', type: 'textarea', required: true },
    { name: 'data', label: 'Data', type: 'date', required: true },
    { name: 'tipo', label: 'Tipo', required: true, options: tipoOptions, defaultValue: 'Reunião' },
    { name: 'escolaId', label: 'Abrangência', required: false, options: escolaOptions, defaultValue: '' },
    { name: 'local', label: 'Local', required: true, defaultValue: 'Escola Municipal Modelo' },
  ];

  const columns = [
    { key: 'titulo', header: 'Título' },
    { key: 'descricao', header: 'Descrição' },
    { key: 'data', header: 'Data' },
    { key: 'tipo', header: 'Tipo', render: row => <Badge variant="blue">{row.tipo}</Badge> },
    { key: 'local', header: 'Local' },
  ];

  return (
    <MainLayout>
      <InstrumentManager
        title="Eventos"
        description="Gerencie reuniões, sábados letivos, formações, conselhos e outros eventos pedagógicos da rede."
        records={eventos}
        fields={fields}
        columns={columns}
        onCreate={payload => createEvento(normalizeEscolaId(payload))}
        onUpdate={(id, payload) => updateEvento(id, normalizeEscolaId(payload))}
        onDelete={deleteEvento}
        canCreate={podeGerenciar}
        canEdit={podeGerenciar}
        canDelete={podeGerenciar}
        detailTitle="Detalhes do evento"
        searchFields={[row => row.titulo, row => row.descricao, row => row.tipo, row => row.local]}
        filters={[
          { name: 'tipo', label: 'Tipo', options: tipoOptions, getValue: row => row.tipo },
        ]}
      />
    </MainLayout>
  );
};
import { MainLayout } from '../layouts/Layouts';
import { InstrumentManager } from '../components/InstrumentManager';
import { Badge } from '../components/Common';
import { useData } from '../context/DataContext';

const tipoOptions = [
  { value: 'Reunião', label: 'Reunião' },
  { value: 'Sábado letivo', label: 'Sábado letivo' },
  { value: 'Formação', label: 'Formação' },
  { value: 'Conselho', label: 'Conselho' },
  { value: 'Simulado', label: 'Simulado' },
  { value: 'Outro', label: 'Outro' },
];

export const EventosPage = () => {
  const { eventos, createEvento, updateEvento, deleteEvento } = useData();

  const fields = [
    { name: 'titulo', label: 'Título', required: true },
    { name: 'descricao', label: 'Descrição básica', type: 'textarea', required: true },
    { name: 'data', label: 'Data', type: 'date', required: true },
    { name: 'tipo', label: 'Tipo', required: true, options: tipoOptions, defaultValue: 'Reunião' },
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
        onCreate={createEvento}
        onUpdate={updateEvento}
        onDelete={deleteEvento}
        detailTitle="Detalhes do evento"
        searchFields={[row => row.titulo, row => row.descricao, row => row.tipo, row => row.local]}
        filters={[
          { name: 'tipo', label: 'Tipo', options: tipoOptions, getValue: row => row.tipo },
        ]}
      />
    </MainLayout>
  );
};
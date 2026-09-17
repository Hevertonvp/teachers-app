import { MainLayout } from '../layouts/Layouts';
import { InstrumentManager } from '../components/InstrumentManager';
import { Badge } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { isSecretaria } from '../utils/roles';

const categoriaOptions = [
  { value: 'Geral', label: 'Geral' },
  { value: 'PDI', label: 'PDI' },
  { value: 'Planejamento', label: 'Planejamento' },
  { value: 'Formulário 1/3', label: 'Formulário 1/3' },
  { value: 'Correções', label: 'Correções dos simulados' },
  { value: 'Eventos', label: 'Eventos' },
];

export const NoticiasPage = () => {
  const { user } = useAuth();
  const { noticias, createNoticia, updateNoticia, deleteNoticia } = useData();
  const podeGerenciar = isSecretaria(user);

  const fields = [
    { name: 'titulo', label: 'Título', required: true },
    { name: 'resumo', label: 'Resumo', type: 'textarea', required: true },
    { name: 'categoria', label: 'Categoria', required: true, options: categoriaOptions, defaultValue: 'Geral' },
    { name: 'data', label: 'Data', type: 'date', required: true },
  ];

  const columns = [
    { key: 'titulo', header: 'Título' },
    { key: 'categoria', header: 'Categoria', render: row => <Badge variant="blue">{row.categoria}</Badge> },
    { key: 'data', header: 'Data' },
    { key: 'resumo', header: 'Resumo' },
  ];

  return (
    <MainLayout>
      <InstrumentManager
        title="Notícias"
        description="Novidades e comunicados da rede municipal de ensino, publicados pela Secretaria de Educação."
        records={noticias}
        fields={fields}
        columns={columns}
        onCreate={createNoticia}
        onUpdate={updateNoticia}
        onDelete={deleteNoticia}
        canCreate={podeGerenciar}
        canEdit={podeGerenciar}
        canDelete={podeGerenciar}
        detailTitle="Detalhes da notícia"
        searchFields={[row => row.titulo, row => row.resumo, row => row.categoria]}
        filters={[
          { name: 'categoria', label: 'Categoria', options: categoriaOptions, getValue: row => row.categoria },
        ]}
        emptyTitle="Nenhuma notícia"
        emptyDescription={podeGerenciar ? 'Publique a primeira notícia da rede.' : 'Nenhuma notícia publicada pela Secretaria até o momento.'}
      />
    </MainLayout>
  );
};

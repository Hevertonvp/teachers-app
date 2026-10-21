import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, DataTable, EmptyState, FormField } from '../components/Common';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { CATEGORIA_OPTIONS, STATUS_LABEL, STATUS_OPTIONS, STATUS_VARIANT, categoriaLabel, listarFeedbacksSistemaReais } from '../services/feedbackSistema';
import { MainLayout } from '../layouts/Layouts';

const PERFIL_OPTIONS = [
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'GESTOR', label: 'Gestor/Supervisor' },
  { value: 'DIRETORA', label: 'Diretora' },
  { value: 'SECRETARIA', label: 'Secretaria' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
];

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

// Caixa do Suporte — Feedbacks do sistema (seção 9 do pedido), exclusiva de SUPORTE_SISTEMA.
export const FeedbacksSistemaListaPage = () => {
  const navigate = useNavigate();
  const { escolas } = useData();
  const [filtros, setFiltros] = useState({ status: '', categoria: '', autorPerfil: '', escolaId: '', busca: '' });
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      setItens(await listarFeedbacksSistemaReais(filtros));
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aplicarFiltros = (event) => {
    event.preventDefault();
    carregar();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Feedbacks do sistema</h1>
          <p className="mt-2 text-slate-600">Relatos e sugestões enviados por qualquer perfil, de todas as escolas.</p>
        </div>

        <Card>
          <button type="button" onClick={() => setMostrarFiltros((prev) => !prev)} className="text-sm font-semibold text-teal-700 hover:underline">
            {mostrarFiltros ? 'Ocultar filtros' : 'Filtros e pesquisa'}
          </button>
          {mostrarFiltros && (
            <form onSubmit={aplicarFiltros} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Status">
                <select className={inputClass} value={filtros.status} onChange={(event) => setFiltros((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {STATUS_OPTIONS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                </select>
              </FormField>
              <FormField label="Categoria">
                <select className={inputClass} value={filtros.categoria} onChange={(event) => setFiltros((prev) => ({ ...prev, categoria: event.target.value }))}>
                  <option value="">Todas</option>
                  {CATEGORIA_OPTIONS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                </select>
              </FormField>
              <FormField label="Perfil do autor">
                <select className={inputClass} value={filtros.autorPerfil} onChange={(event) => setFiltros((prev) => ({ ...prev, autorPerfil: event.target.value }))}>
                  <option value="">Todos</option>
                  {PERFIL_OPTIONS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                </select>
              </FormField>
              <FormField label="Escola">
                <select className={inputClass} value={filtros.escolaId} onChange={(event) => setFiltros((prev) => ({ ...prev, escolaId: event.target.value }))}>
                  <option value="">Todas</option>
                  {escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Buscar assunto ou usuário">
                <input className={inputClass} value={filtros.busca} onChange={(event) => setFiltros((prev) => ({ ...prev, busca: event.target.value }))} placeholder="Nome..." />
              </FormField>
              <button type="submit" className="col-span-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:col-span-1">Aplicar filtros</button>
            </form>
          )}
        </Card>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        {carregando ? (
          <p className="text-center text-slate-500">Carregando...</p>
        ) : itens.length === 0 ? (
          <EmptyState title="Nenhum feedback encontrado" description="Ajuste os filtros ou aguarde novos envios." />
        ) : (
          <DataTable
            columns={[
              { key: 'assunto', header: 'Assunto' },
              { key: 'autorNome', header: 'Autor', render: (item) => `${item.autorNome} (${PERFIL_OPTIONS.find((p) => p.value === item.autorPerfil)?.label || item.autorPerfil})` },
              { key: 'escolaNome', header: 'Escola', render: (item) => item.escolaNome || '—' },
              { key: 'categoria', header: 'Categoria', render: (item) => categoriaLabel(item.categoria) },
              { key: 'status', header: 'Status', render: (item) => <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge> },
              { key: 'updatedAt', header: 'Última atualização', render: (item) => formatarDataHora(item.updatedAt ?? item.createdAt) },
            ]}
            rows={itens}
            onRowClick={(item) => navigate(`/feedback-sistema/${item.id}`)}
          />
        )}
      </div>
    </MainLayout>
  );
};

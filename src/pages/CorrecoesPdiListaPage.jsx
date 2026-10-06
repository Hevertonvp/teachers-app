import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card, DataTable, EmptyState, FormField } from '../components/Common';
import { useData } from '../context/DataContext';
import { inputClass } from '../utils/display';
import { listarCorrecoesPdiReais } from '../services/correcoesPdi';
import { MainLayout } from '../layouts/Layouts';

const INDICADOR_LABEL = { nenhuma: '—', solicitada: 'Correção solicitada', resolvida: 'Corrigida' };
const INDICADOR_VARIANT = { nenhuma: 'gray', solicitada: 'yellow', resolvida: 'blue' };

const formatarDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

// Correções > PDI (seção 22-27 do pedido de Ficha Anual/Correções): lista as Fichas PDI
// CONCLUIDA mais recentes por padrão, com filtros — exclusivo da Secretaria (backend garante,
// isto é só a tela). Nunca lista Aplicação inteira nem aluno sem Ficha concluída.
export const CorrecoesPdiListaPage = () => {
  const navigate = useNavigate();
  const { escolas, turmas, disciplinasReais } = useData();
  const [filtros, setFiltros] = useState({ escolaId: '', turmaId: '', disciplinaId: '', busca: '' });
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const resultado = await listarCorrecoesPdiReais(filtros);
      setItens(resultado);
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

  const turmasDaEscola = filtros.escolaId ? turmas.filter((t) => t.escolaId === Number(filtros.escolaId)) : turmas;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/correcoes" className="text-sm font-semibold text-teal-700 hover:underline">← Correções</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Correções &gt; PDI</h1>
          <p className="mt-2 text-slate-600">10 últimas Fichas PDI concluídas, mais recentes primeiro. Use os filtros para localizar outra.</p>
        </div>

        <Card>
          <button type="button" onClick={() => setMostrarFiltros((prev) => !prev)} className="text-sm font-semibold text-teal-700 hover:underline">
            {mostrarFiltros ? 'Ocultar filtros' : 'Filtros e pesquisa'}
          </button>
          {mostrarFiltros && (
            <form onSubmit={aplicarFiltros} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Escola">
                <select className={inputClass} value={filtros.escolaId} onChange={(event) => setFiltros((prev) => ({ ...prev, escolaId: event.target.value, turmaId: '' }))}>
                  <option value="">Todas</option>
                  {escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Turma">
                <select className={inputClass} value={filtros.turmaId} onChange={(event) => setFiltros((prev) => ({ ...prev, turmaId: event.target.value }))}>
                  <option value="">Todas</option>
                  {turmasDaEscola.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Disciplina">
                <select className={inputClass} value={filtros.disciplinaId} onChange={(event) => setFiltros((prev) => ({ ...prev, disciplinaId: event.target.value }))}>
                  <option value="">Todas</option>
                  {disciplinasReais.map((disciplina) => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Buscar aluno ou professor">
                <input className={inputClass} value={filtros.busca} onChange={(event) => setFiltros((prev) => ({ ...prev, busca: event.target.value }))} placeholder="Nome..." />
              </FormField>
              <button type="submit" className="col-span-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Aplicar filtros</button>
            </form>
          )}
        </Card>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        {carregando ? (
          <p className="text-center text-slate-500">Carregando...</p>
        ) : itens.length === 0 ? (
          <EmptyState title="Nenhuma Ficha PDI concluída encontrada" description="Ajuste os filtros ou aguarde Fichas serem concluídas." />
        ) : (
          <DataTable
            columns={[
              { key: 'alunoNome', header: 'Aluno' },
              { key: 'escolaNome', header: 'Escola' },
              { key: 'turmaNome', header: 'Turma' },
              { key: 'disciplinaNome', header: 'Disciplina' },
              { key: 'professorNome', header: 'Professor' },
              { key: 'concluidaEm', header: 'Concluída em', render: (item) => formatarDataHora(item.concluidaEm) },
              { key: 'indicadorCorrecao', header: 'Correção', render: (item) => <Badge variant={INDICADOR_VARIANT[item.indicadorCorrecao]}>{INDICADOR_LABEL[item.indicadorCorrecao]}</Badge> },
            ]}
            rows={itens}
            onRowClick={(item) => navigate(`/correcoes/pdi/${item.id}`)}
          />
        )}
      </div>
    </MainLayout>
  );
};

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, EmptyState, FormField } from '../components/Common';
import { SeloCorrecao, SITUACAO_CORRECAO_UM_TERCO } from '../components/Correcoes';
import { MainLayout } from '../layouts/Layouts';
import { useFiltroEscolaDoTopo } from '../context/EscolaContext';
import { listarCorrecoesUmTerco } from '../services/correcoesUmTerco';
import { descreverParteCargo } from '../services/cargos';
import { inputClass } from '../utils/display';
import { formatarDataHora } from '../utils/umTerco';

// Correções → Formulário 1/3 (12/11/2026), no padrão de Correções → PDI: folhas CONCLUÍDAS, filtros por
// escola (qualquer escola da folha), Professor, ciclo e situação, busca. Cada folha aparece uma vez.
// Em cartões (não tabela): fica legível no celular.
export const CorrecoesUmTercoListaPage = () => {
  const navigate = useNavigate();
  const [escolaDoTopo] = useFiltroEscolaDoTopo('');
  const [filtros, setFiltros] = useState({ escolaId: escolaDoTopo, professorId: '', cicloId: '', situacao: '', busca: '' });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { setFiltros((prev) => (prev.escolaId === escolaDoTopo ? prev : { ...prev, escolaId: escolaDoTopo })); }, [escolaDoTopo]);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro('');
    const t = setTimeout(() => {
      listarCorrecoesUmTerco(filtros).then((r) => { if (ativo) setDados(r); }).catch((e) => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    }, filtros.busca ? 300 : 0);
    return () => { ativo = false; clearTimeout(t); };
  }, [filtros]);

  const definir = (campo) => (e) => setFiltros((prev) => ({ ...prev, [campo]: e.target.value }));
  const opcoes = dados?.opcoes ?? { escolas: [], professores: [], ciclos: [] };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to="/correcoes" className="text-sm font-semibold text-teal-700 hover:underline">← Correções</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Correções &gt; Formulário 1/3</h1>
          <p className="mt-2 text-slate-600">Folhas concluídas, da movimentação mais recente para a mais antiga. Abra uma folha para corrigir diretamente ou enviar para correção.</p>
        </div>

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Buscar">
              <input className={inputClass} value={filtros.busca} onChange={definir('busca')} placeholder="Professor, escola ou disciplina" aria-label="Buscar" />
            </FormField>
            <FormField label="Escola">
              <select className={inputClass} value={filtros.escolaId} onChange={definir('escolaId')} aria-label="Escola">
                <option value="">Todas</option>
                {opcoes.escolas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Professor">
              <select className={inputClass} value={filtros.professorId} onChange={definir('professorId')} aria-label="Professor">
                <option value="">Todos</option>
                {opcoes.professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Ciclo">
              <select className={inputClass} value={filtros.cicloId} onChange={definir('cicloId')} aria-label="Ciclo">
                <option value="">Todos</option>
                {opcoes.ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FormField>
            <FormField label="Situação">
              <select className={inputClass} value={filtros.situacao} onChange={definir('situacao')} aria-label="Situação">
                <option value="">Todas</option>
                <option value="em_andamento">Correção em andamento</option>
                {Object.entries(SITUACAO_CORRECAO_UM_TERCO).map(([valor, { rotulo }]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </FormField>
          </div>
        </Card>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {dados && <p className="text-sm text-slate-600">{dados.total} {dados.total === 1 ? 'folha' : 'folhas'}{dados.total > dados.itens.length ? ` (mostrando ${dados.itens.length})` : ''}</p>}

        {carregando && !dados ? (
          <p className="text-center text-slate-500">Carregando...</p>
        ) : dados && dados.itens.length === 0 ? (
          <EmptyState title="Nenhuma folha concluída encontrada" description="Ajuste os filtros ou aguarde os professores concluírem." />
        ) : (
          <ul className="space-y-3">
            {(dados?.itens ?? []).map((item) => (
              <li key={item.entregaId}>
                <button type="button" onClick={() => navigate(`/correcoes/um-terco/${item.entregaId}`)} className="w-full text-left">
                  <Card className="transition hover:border-teal-300 hover:shadow-md">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{item.professorNome}</p>
                        <p className="text-sm text-slate-600">{item.rotulo}{item.compartilhada ? ' (os dois cargos)' : ''} · {item.ciclo.titulo} · {item.ciclo.trimestre}º tri</p>
                        <p className="mt-1 break-words text-xs text-slate-500">{item.composicao.map(descreverParteCargo).join(' · ')}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <SeloCorrecao situacao={item.situacao} mapa={SITUACAO_CORRECAO_UM_TERCO} />
                        {item.somenteConsulta && <span className="text-xs font-semibold text-slate-500">Cargo encerrado · só consulta</span>}
                        <span className="text-xs text-slate-500">Última movimentação: {formatarDataHora(item.ultimaMovimentacao)}</span>
                      </div>
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MainLayout>
  );
};

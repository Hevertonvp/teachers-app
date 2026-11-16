import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ActionMenu, Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { canManageEscolas } from '../utils/roles';
import { CabecalhoDesativados, ListaDesativados } from '../components/ListaDesativados';
import { listarDesativados } from '../services/desativados';
import { listarNiveisInfantil } from '../services/niveisInfantil';
import { EstruturaEscola, estruturaDaEscola, rotuloEtapas, sugerirPelasTurmas } from '../components/EstruturaEscola';

// Desativadas em tela própria (pedido do usuário, 15/11/2026): lista paginada, mais recentes primeiro.
const carregarDesativadas = (pagina, porPagina) => listarDesativados('escolas', { pagina, porPagina });

// 16/11/2026: a janela "Gerenciar vínculos" (dados de demonstração do protótipo) foi removida. Professor ganha escola
// pelo cargo ("Cargos e escolas"); supervisores e diretoras, em Gestão de Pessoas.

export const GestaoEscolas = () => {
  const { user } = useAuth();
  const {
    escolas, escolasLoading, escolasError, loadEscolas, turmas,
    createEscola, updateEscola, inativarEscola, reativarEscola,
  } = useData();

  const [escolaForm, setEscolaForm] = useState(null);
  const [editingEscola, setEditingEscola] = useState(null);
  const [escolaFormError, setEscolaFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [inativandoEscola, setInativandoEscola] = useState(null);
  const [reativandoEscola, setReativandoEscola] = useState(null);
  const [message, setMessage] = useState('');
  const [busca, setBusca] = useState('');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verDesativadas = params.get('ver') === 'desativadas';
  const [recarregar, setRecarregar] = useState(0);
  // 16/11/2026: estrutura da escola (etapas, anos do Fundamental, níveis da Infantil).
  const [niveisCatalogo, setNiveisCatalogo] = useState([]);
  const [erroEstrutura, setErroEstrutura] = useState('');
  useEffect(() => { listarNiveisInfantil().then(setNiveisCatalogo).catch(() => setNiveisCatalogo([])); }, []);

  if (!canManageEscolas(user)) return <Navigate to="/dashboard" replace />;

  const abrirNovaEscola = () => { setEditingEscola(null); setEscolaFormError(''); setErroEstrutura(''); setEscolaForm({ nome: '', estrutura: { etapas: [], anos: [], niveis: [] } }); };
  const abrirEdicao = (escola) => { setEditingEscola(escola); setEscolaFormError(''); setErroEstrutura(''); setEscolaForm({ nome: escola.nome, estrutura: estruturaDaEscola(escola) }); };
  const turmasDaEscolaEditada = editingEscola ? (turmas ?? []).filter(t => t.escolaId === editingEscola.id) : [];
  const podeSugerir = !!editingEscola && (editingEscola.etapasOferecidas ?? []).length === 0 && turmasDaEscolaEditada.some(t => t.status === 'ativa') && escolaForm?.estrutura.etapas.length === 0;
  const fecharModal = () => { setEscolaForm(null); setEditingEscola(null); setEscolaFormError(''); };

  const salvarEscola = async (event) => {
    event.preventDefault();
    setEscolaFormError('');
    setErroEstrutura('');
    const e = escolaForm.estrutura;
    // Escola nova sempre informa as etapas; escola antiga pode continuar "não informada" (só o nome muda).
    const jaInformada = (editingEscola?.etapasOferecidas ?? []).length > 0;
    if (e.etapas.length === 0 && (!editingEscola || jaInformada)) { setErroEstrutura('Marque ao menos uma etapa.'); return; }
    if (e.etapas.includes('FUNDAMENTAL_I') && !e.anos.some(a => a <= 5)) { setErroEstrutura('Marque ao menos um ano do Fundamental I.'); return; }
    if (e.etapas.includes('FUNDAMENTAL_II') && !e.anos.some(a => a >= 6)) { setErroEstrutura('Marque ao menos um ano do Fundamental II.'); return; }
    const estrutura = e.etapas.length ? { etapasOferecidas: e.etapas, anosFundamental: e.anos, niveisInfantilIds: e.niveis } : {};
    setSalvando(true);
    const resultado = editingEscola
      ? await updateEscola(editingEscola.id, { nome: escolaForm.nome, ...estrutura })
      : await createEscola({ nome: escolaForm.nome, ...estrutura });
    setSalvando(false);
    if (!resultado.ok) {
      setEscolaFormError(resultado.error);
      return;
    }
    // 16/11/2026: escola NOVA vai direto para "Nova turma" com ela escolhida (editar continua aqui).
    if (!editingEscola) {
      fecharModal();
      navigate('/turmas', { state: { novaTurmaEscolaId: resultado.escola.id, mensagem: 'Escola criada. Cadastre as turmas.' } });
      return;
    }
    setMessage(`Escola "${resultado.escola.nome}" atualizada com sucesso.`);
    fecharModal();
  };

  const confirmarInativar = async () => {
    const alvo = inativandoEscola;
    const resultado = await inativarEscola(alvo.id);
    setInativandoEscola(null);
    setMessage(resultado.ok ? `Escola "${alvo.nome}" inativada com sucesso.` : resultado.error);
  };

  const confirmarReativar = async () => {
    const alvo = reativandoEscola;
    const resultado = await reativarEscola(alvo.id);
    setReativandoEscola(null);
    setRecarregar(n => n + 1);
    setMessage(resultado.ok ? `Escola "${alvo.nome}" reativada com sucesso. Ela voltou para a lista de escolas.` : resultado.error);
  };

  const columns = [
    { key: 'nome', header: 'Escola' },
    { key: 'etapas', header: 'Etapas', render: row => (rotuloEtapas(row)
      ? <span className="text-sm text-slate-700">{rotuloEtapas(row)}</span>
      : <span className="text-xs text-slate-400">Não informadas</span>) },
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => abrirEdicao(row)}>Editar</Button>
        <ActionMenu items={[{ label: 'Inativar escola', variant: 'danger', onClick: () => setInativandoEscola(row) }]} />
      </div>
    ) },
  ];

  return (
    <MainLayout>
      {verDesativadas ? (
      <div className="space-y-6">
        <CabecalhoDesativados titulo="Escolas desativadas" voltarPara="/escolas" voltarTexto="← Voltar para Escolas" descricao="Escolas inativadas não aparecem nas listas nem como opção para novos vínculos. O histórico continua guardado. Reativar devolve a escola à lista." />
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
        <ListaDesativados carregar={carregarDesativadas} recarregarChave={recarregar} vazio="Nenhuma escola desativada." acoes={item => <Button size="sm" variant="outline" onClick={() => setReativandoEscola({ id: item.id, nome: item.titulo })}>Reativar</Button>} />
      </div>
      ) : (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Escolas</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Cadastre, edite e desative escolas da rede. Desativar bloqueia o acesso operacional, mas preserva o histórico.</p>
            <Link to="/escolas?ver=desativadas" className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver escolas desativadas ({escolas.filter(e => e.status !== 'ativa').length}) →</Link>
          </div>
          <Button onClick={abrirNovaEscola} disabled={escolasLoading}>+ Nova escola</Button>
        </div>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {escolasError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar as escolas: {escolasError}</span>
            <Button size="sm" variant="outline" onClick={loadEscolas}>Tentar novamente</Button>
          </div>
        )}

        {escolasLoading ? (
          <Card><p className="text-center text-slate-500">Carregando escolas...</p></Card>
        ) : escolas.length === 0 ? (
          !escolasError && (
            <EmptyState title="Nenhuma escola cadastrada" description="Cadastre a primeira escola da rede para começar.">
              <Button onClick={abrirNovaEscola}>+ Nova escola</Button>
            </EmptyState>
          )
        ) : (
          <>
            <Card><FormField label="Buscar escola"><input className={inputClass} value={busca} onChange={event => setBusca(event.target.value)} placeholder="Digite o nome da escola" /></FormField></Card>
            <DataTable columns={columns} rows={escolas.filter(escola => escola.status === 'ativa' && escola.nome.toLowerCase().includes(busca.toLowerCase()))} emptyMessage="Nenhuma escola encontrada com esse nome" />
          </>
        )}
      </div>
      )}

      {escolaForm && (
        <Modal title={editingEscola ? `Editar escola — ${editingEscola.nome}` : 'Nova escola'} onClose={fecharModal}>
          <form onSubmit={salvarEscola} className="space-y-4">
            {escolaFormError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{escolaFormError}</div>}
            <FormField label="Nome da escola">
              <input className={inputClass} value={escolaForm.nome} onChange={event => setEscolaForm(prev => ({ ...prev, nome: event.target.value }))} required />
            </FormField>
            <EstruturaEscola
              valor={escolaForm.estrutura}
              onChange={estrutura => { setErroEstrutura(''); setEscolaForm(prev => ({ ...prev, estrutura })); }}
              niveisCatalogo={niveisCatalogo}
              erro={erroEstrutura}
              acaoExtra={podeSugerir ? <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={() => setEscolaForm(prev => ({ ...prev, estrutura: sugerirPelasTurmas(turmasDaEscolaEditada) }))}>Sugerir pelas turmas</button> : null}
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharModal} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {inativandoEscola && (
        <ConfirmDialog
          title="Inativar escola"
          message={`Deseja inativar a escola "${inativandoEscola.nome}"? Ela deixa de aparecer como opção para novos vínculos, mas continua existindo para consulta histórica.`}
          confirmLabel="Inativar"
          onCancel={() => setInativandoEscola(null)}
          onConfirm={confirmarInativar}
        />
      )}

      {reativandoEscola && (
        <ConfirmDialog
          title="Reativar escola"
          message={`Deseja reativar a escola "${reativandoEscola.nome}"? Ela volta a aparecer como opção normal para novos vínculos.`}
          confirmLabel="Reativar"
          onCancel={() => setReativandoEscola(null)}
          onConfirm={confirmarReativar}
        />
      )}

    </MainLayout>
  );
};

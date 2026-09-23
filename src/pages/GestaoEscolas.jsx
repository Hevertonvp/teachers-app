import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, FormField, Modal } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { canManageEscolas } from '../utils/roles';

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
  const {
    escolas, escolasLoading, escolasError, loadEscolas,
    professores, gestores, vinculosEscolares,
    createEscola, updateEscola, inativarEscola, reativarEscola,
    createVinculoEscolar, desvincularEscola,
  } = useData();

  const [managingEscola, setManagingEscola] = useState(null);
  const [escolaForm, setEscolaForm] = useState(null);
  const [editingEscola, setEditingEscola] = useState(null);
  const [escolaFormError, setEscolaFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [inativandoEscola, setInativandoEscola] = useState(null);
  const [reativandoEscola, setReativandoEscola] = useState(null);
  const [message, setMessage] = useState('');

  if (!canManageEscolas(user)) return <Navigate to="/dashboard" replace />;

  const abrirNovaEscola = () => { setEditingEscola(null); setEscolaFormError(''); setEscolaForm({ nome: '' }); };
  const abrirEdicao = (escola) => { setEditingEscola(escola); setEscolaFormError(''); setEscolaForm({ nome: escola.nome }); };
  const fecharModal = () => { setEscolaForm(null); setEditingEscola(null); setEscolaFormError(''); };

  const salvarEscola = async (event) => {
    event.preventDefault();
    setEscolaFormError('');
    setSalvando(true);
    const resultado = editingEscola
      ? await updateEscola(editingEscola.id, { nome: escolaForm.nome })
      : await createEscola({ nome: escolaForm.nome });
    setSalvando(false);
    if (!resultado.ok) {
      setEscolaFormError(resultado.error);
      return;
    }
    setMessage(editingEscola ? `Escola "${resultado.escola.nome}" atualizada com sucesso.` : `Escola "${resultado.escola.nome}" criada com sucesso.`);
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
    setMessage(resultado.ok ? `Escola "${alvo.nome}" reativada com sucesso.` : resultado.error);
  };

  const columns = [
    { key: 'nome', header: 'Escola' },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.status === 'ativa' ? 'green' : 'gray'}>{row.status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge> },
    { key: 'vinculos', header: 'Vínculos', render: row => (
      <Button size="sm" variant="outline" onClick={() => setManagingEscola(row)}>Gerenciar vínculos</Button>
    ) },
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => abrirEdicao(row)}>Editar</Button>
        <ActionMenu items={[
          row.status === 'ativa'
            ? { label: 'Inativar escola', variant: 'danger', onClick: () => setInativandoEscola(row) }
            : { label: 'Reativar escola', onClick: () => setReativandoEscola(row) },
        ]} />
      </div>
    ) },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Escolas</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Cadastre, edite e desative escolas da rede. Desativar bloqueia o acesso operacional, mas preserva o histórico. Vínculos de professores e supervisores são gerenciados por escola.</p>
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
          <DataTable columns={columns} rows={escolas} />
        )}
      </div>

      {escolaForm && (
        <Modal title={editingEscola ? `Editar escola — ${editingEscola.nome}` : 'Nova escola'} onClose={fecharModal}>
          <form onSubmit={salvarEscola} className="space-y-4">
            {escolaFormError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{escolaFormError}</div>}
            <FormField label="Nome da escola">
              <input className={inputClass} value={escolaForm.nome} onChange={event => setEscolaForm(prev => ({ ...prev, nome: event.target.value }))} required />
            </FormField>
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

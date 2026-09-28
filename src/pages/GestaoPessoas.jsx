import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, DataTable, FormField, Modal, PersonName } from '../components/Common';
import { InstrumentManager } from '../components/InstrumentManager';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { apiFetch } from '../services/api';
import { MainLayout } from '../layouts/Layouts';
import { escolaName, inputClass, turmaName } from '../utils/display';
import { formatDate } from '../utils/pdi';
import { CURRENT_DATE } from '../utils/formAvailability';
import { canManagePessoas, canManageProfessores, isSecretaria } from '../utils/roles';

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

// Turmas/disciplinas de um professor (turmaProfessores) — com histórico, mesmo padrão do
// vínculo Auxiliar<->Turma: no máximo um vínculo ATIVO por (turma, disciplina); trocar de
// professor numa turma/disciplina encerra o vínculo antigo (dataFim preenchida) em vez de
// apagar. O professor perde acesso às fichas PDI daquela turma/disciplina imediatamente ao ser
// encerrado, mas o que ele já respondeu antes continua no histórico (ver pdiFichaRespostas).
const VinculosTurmaProfessorModal = ({ professor, professores, turmas, disciplinas, escolas, turmaProfessores, vincularProfessorTurma, encerrarVinculoProfessorTurma, onClose }) => {
  const [novoVinculo, setNovoVinculo] = useState({ turmaId: turmas[0]?.id ?? '', disciplinaId: disciplinas[0]?.id ?? '', dataInicio: CURRENT_DATE });
  const [message, setMessage] = useState('');

  const vinculosAtivos = turmaProfessores
    .filter(item => item.professorId === professor.id && item.status === 'ativo')
    .sort((left, right) => turmaName(turmas, left.turmaId).localeCompare(turmaName(turmas, right.turmaId)));

  const historico = turmaProfessores
    .filter(item => item.professorId === professor.id && item.status === 'encerrado')
    .sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio));

  const ocupanteAtual = (turmaId, disciplinaId) => turmaProfessores.find(item => (
    item.turmaId === Number(turmaId) && item.disciplinaId === Number(disciplinaId) && item.status === 'ativo'
  ));
  const conflito = novoVinculo.turmaId && novoVinculo.disciplinaId ? ocupanteAtual(novoVinculo.turmaId, novoVinculo.disciplinaId) : null;
  const conflitoComOutro = conflito && conflito.professorId !== professor.id ? conflito : null;

  const salvar = (event) => {
    event.preventDefault();
    if (!novoVinculo.turmaId || !novoVinculo.disciplinaId || !novoVinculo.dataInicio) {
      setMessage('Escolha a turma, a disciplina e a data de início.');
      return;
    }
    vincularProfessorTurma(novoVinculo.turmaId, professor.id, novoVinculo.disciplinaId, novoVinculo.dataInicio);
    setMessage('Vínculo criado com sucesso.');
  };

  return (
    <Modal title={`Turmas e disciplinas - ${professor.nome}`} onClose={onClose}>
      <div className="space-y-5">
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Vínculos ativos</p>
          {vinculosAtivos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma turma vinculada no momento.</p>
          ) : (
            <div className="space-y-2">
              {vinculosAtivos.map(vinculo => {
                const turma = turmas.find(item => item.id === vinculo.turmaId);
                return (
                  <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{turma?.nome} — {disciplinas.find(item => item.id === vinculo.disciplinaId)?.nome}</p>
                      <p className="text-xs text-slate-500">{escolaName(escolas, turma?.escolaId)} · desde {formatDate(vinculo.dataInicio)}</p>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => { encerrarVinculoProfessorTurma(vinculo.id, CURRENT_DATE); setMessage('Vínculo encerrado com sucesso.'); }}>Encerrar</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={salvar} className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700">Vincular a uma turma/disciplina</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Turma">
              <select className={inputClass} value={novoVinculo.turmaId} onChange={event => setNovoVinculo(prev => ({ ...prev, turmaId: Number(event.target.value) }))}>
                {turmas.map(turma => <option key={turma.id} value={turma.id}>{turma.nome} — {escolaName(escolas, turma.escolaId)}</option>)}
              </select>
            </FormField>
            <FormField label="Disciplina">
              <select className={inputClass} value={novoVinculo.disciplinaId} onChange={event => setNovoVinculo(prev => ({ ...prev, disciplinaId: Number(event.target.value) }))}>
                {disciplinas.map(disciplina => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Data de início"><input className={inputClass} type="date" value={novoVinculo.dataInicio} onChange={event => setNovoVinculo(prev => ({ ...prev, dataInicio: event.target.value }))} required /></FormField>
          {conflitoComOutro && (
            <p className="text-xs font-semibold text-amber-700">
              Atualmente, {professores.find(item => item.id === conflitoComOutro.professorId)?.nome || 'outro professor'} leciona esta disciplina nesta turma — vincular aqui encerra o vínculo dele automaticamente.
            </p>
          )}
          <div className="flex justify-end"><Button type="submit" size="sm">Vincular</Button></div>
        </form>

        {historico.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Histórico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Turma</th><th className="pb-2 pr-4">Disciplina</th><th className="pb-2 pr-4">Início</th><th className="pb-2">Fim</th></tr></thead>
                <tbody>
                  {historico.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{turmaName(turmas, item.turmaId)}</td>
                      <td className="py-2 pr-4">{disciplinas.find(d => d.id === item.disciplinaId)?.nome || 'Não encontrada'}</td>
                      <td className="py-2 pr-4">{formatDate(item.dataInicio)}</td>
                      <td className="py-2">{item.dataFim ? formatDate(item.dataFim) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
      </div>
    </Modal>
  );
};

// --- Professores (conta real, backend) ------------------------------------------------------
// Único ponto do app onde uma nova PESSOA real (com login/JWT de verdade) é criada — Secretaria
// em qualquer escola, Diretora só nas suas (checado de novo no backend, nunca só aqui). Ver
// backend/src/api/routes/pessoas.ts para as regras completas.
const SenhaTemporariaModal = ({ pessoa, senha, mensagem, onClose }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Modal title="Professor cadastrado com sucesso" onClose={onClose}>
      {senha ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Login</p>
            <p className="mt-1 font-mono text-sm text-slate-900">{pessoa.email}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Senha temporária</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900">{senha}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta senha será exibida somente agora — anote ou copie antes de fechar. O professor deverá alterá-la no primeiro acesso. Repasse pessoalmente ou por WhatsApp.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar senha'}</Button>
            <Button onClick={onClose}>Concluir</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-600">{mensagem || 'Professor vinculado com sucesso.'}</p>
          <div className="flex justify-end"><Button onClick={onClose}>Concluir</Button></div>
        </div>
      )}
    </Modal>
  );
};

const ProfessoresReaisManager = ({ user }) => {
  const { turmas: turmasMock, disciplinas, professores: professoresMock, turmaProfessores, vincularProfessorTurma, encerrarVinculoProfessorTurma } = useData();

  const [professores, setProfessores] = useState([]);
  const [minhasEscolas, setMinhasEscolas] = useState([]);
  // "Turmas e disciplinas" (mock, sem checagem possível no backend) só oferece turmas das
  // escolas que o usuário logado administra — sem isso, a Diretora poderia vincular um professor
  // a uma turma de outra escola por esse modal, mesmo não podendo cadastrá-lo lá diretamente.
  const escolaIdsPermitidos = new Set(minhasEscolas.map(escola => escola.id));
  const turmasPermitidas = turmasMock.filter(turma => escolaIdsPermitidos.has(turma.escolaId));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultadoCriacao, setResultadoCriacao] = useState(null);
  const [resetando, setResetando] = useState(null);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  const [managingTurmas, setManagingTurmas] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaProfessores, listaEscolas] = await Promise.all([
        apiFetch('/api/pessoas/professores'),
        apiFetch('/api/pessoas/minhas-escolas'),
      ]);
      setProfessores(listaProfessores);
      setMinhasEscolas(listaEscolas);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirCadastro = () => { setFormError(''); setForm({ nome: '', email: '', escolaIds: [] }); };
  const fecharCadastro = () => { setForm(null); setFormError(''); };

  const toggleEscola = (escolaId) => {
    setForm(prev => ({
      ...prev,
      escolaIds: prev.escolaIds.includes(escolaId) ? prev.escolaIds.filter(id => id !== escolaId) : [...prev.escolaIds, escolaId],
    }));
  };

  const salvarCadastro = async (event) => {
    event.preventDefault();
    setFormError('');
    if (form.escolaIds.length === 0) {
      setFormError('Selecione ao menos uma escola.');
      return;
    }
    setSalvando(true);
    try {
      const resultado = await apiFetch('/api/pessoas/professores', {
        method: 'POST',
        body: { nome: form.nome || undefined, email: form.email, escolaIds: form.escolaIds },
      });
      fecharCadastro();
      setResultadoCriacao(resultado);
      await carregar();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarResetarSenha = async () => {
    const alvo = resetando;
    try {
      const resultado = await apiFetch(`/api/pessoas/professores/${alvo.id}/resetar-senha`, { method: 'POST' });
      setResetando(null);
      setResultadoCriacao({ pessoa: alvo, senhaTemporaria: resultado.senhaTemporaria });
    } catch (error) {
      setResetando(null);
      setMensagem(error.message);
    }
  };

  const confirmarMudarStatus = async () => {
    const { professor, novoStatus } = mudandoStatus;
    try {
      await apiFetch(`/api/pessoas/professores/${professor.id}/${novoStatus === 'ATIVO' ? 'reativar' : 'inativar'}`, { method: 'POST' });
      setMudandoStatus(null);
      setMensagem(novoStatus === 'ATIVO' ? `${professor.nome} reativado(a) com sucesso.` : `${professor.nome} inativado(a) com sucesso.`);
      await carregar();
    } catch (error) {
      setMudandoStatus(null);
      setMensagem(error.message);
    }
  };

  const columns = [
    { key: 'nome', header: 'Nome', render: row => <PersonName nome={row.nome} /> },
    { key: 'email', header: 'E-mail' },
    { key: 'escolas', header: 'Escolas', render: row => (
      row.escolas.length === 0
        ? <span className="text-xs text-slate-400">Nenhuma nesta visão</span>
        : <div className="flex flex-wrap gap-1">{row.escolas.map(escola => <Badge key={escola.id} variant="blue">{escola.nome}</Badge>)}</div>
    ) },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.status === 'ATIVO' ? 'green' : 'gray'}>{row.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setManagingTurmas(row)}>Turmas e disciplinas</Button>
        <ActionMenu items={[
          { label: 'Gerar nova senha temporária', onClick: () => setResetando(row) },
          row.status === 'ATIVO'
            ? { label: 'Inativar', variant: 'danger', onClick: () => setMudandoStatus({ professor: row, novoStatus: 'INATIVO' }) }
            : { label: 'Reativar', onClick: () => setMudandoStatus({ professor: row, novoStatus: 'ATIVO' }) },
        ]} />
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <p className="max-w-2xl text-sm text-slate-600">
          {isSecretaria(user)
            ? 'Cadastro de contas reais de Professor(a), com login e senha próprios.'
            : 'Professores(as) vinculados às escolas que você administra.'}
        </p>
        <Button onClick={abrirCadastro} disabled={carregando}>+ Cadastrar professor</Button>
      </div>

      {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar os professores: {erro}</span>
          <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
        </div>
      )}

      {carregando ? (
        <Card><p className="text-center text-slate-500">Carregando professores...</p></Card>
      ) : professores.length === 0 ? (
        !erro && <Card className="py-12 text-center"><p className="font-semibold text-slate-800">Nenhum professor nesta visão</p><p className="mt-1 text-sm text-slate-500">Cadastre o primeiro professor com uma conta real.</p></Card>
      ) : (
        <DataTable columns={columns} rows={professores} />
      )}

      {form && (
        <Modal title="Cadastrar professor" onClose={fecharCadastro}>
          <form onSubmit={salvarCadastro} className="space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</div>}
            <FormField label="E-mail">
              <input className={inputClass} type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} required />
            </FormField>
            <FormField label="Nome completo">
              <input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} />
              <p className="mt-1 text-xs text-slate-500">Se já existir uma conta com esse e-mail, o nome informado é ignorado — o professor só será vinculado à(s) escola(s) selecionada(s).</p>
            </FormField>
            <FormField label="Escolas de vínculo">
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {minhasEscolas.map(escola => (
                  <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.escolaIds.includes(escola.id)} onChange={() => toggleEscola(escola.id)} />
                    {escola.nome}
                  </label>
                ))}
              </div>
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharCadastro} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {resultadoCriacao && (
        <SenhaTemporariaModal
          pessoa={resultadoCriacao.pessoa}
          senha={resultadoCriacao.senhaTemporaria}
          mensagem={resultadoCriacao.mensagem}
          onClose={() => setResultadoCriacao(null)}
        />
      )}

      {resetando && (
        <ConfirmDialog
          title="Gerar nova senha temporária"
          message={`Isso invalida a senha atual de ${resetando.nome} imediatamente (qualquer sessão aberta também é encerrada). Deseja continuar?`}
          confirmLabel="Gerar nova senha"
          onCancel={() => setResetando(null)}
          onConfirm={confirmarResetarSenha}
        />
      )}

      {mudandoStatus && (
        <ConfirmDialog
          title={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar professor' : 'Inativar professor'}
          message={mudandoStatus.novoStatus === 'ATIVO'
            ? `Deseja reativar ${mudandoStatus.professor.nome}? O login volta a funcionar normalmente.`
            : `Deseja inativar ${mudandoStatus.professor.nome}? O login é bloqueado e qualquer sessão aberta é encerrada na hora. O histórico é preservado.`}
          confirmLabel={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar' : 'Inativar'}
          onCancel={() => setMudandoStatus(null)}
          onConfirm={confirmarMudarStatus}
        />
      )}

      {managingTurmas && (
        <VinculosTurmaProfessorModal
          professor={managingTurmas}
          professores={professoresMock}
          turmas={turmasPermitidas}
          disciplinas={disciplinas}
          escolas={minhasEscolas}
          turmaProfessores={turmaProfessores}
          vincularProfessorTurma={vincularProfessorTurma}
          encerrarVinculoProfessorTurma={encerrarVinculoProfessorTurma}
          onClose={() => setManagingTurmas(null)}
        />
      )}
    </div>
  );
};

const PessoasManager = ({ title, description, usuarioTipo, records, fields, columns, onCreate, onUpdate, escolas, vinculosEscolares, createVinculoEscolar, desvincularEscola, emptyDescription }) => {
  const [managingPessoa, setManagingPessoa] = useState(null);
  const [managingTurmas, setManagingTurmas] = useState(null);
  const { professores, turmas, disciplinas, turmaProfessores, vincularProfessorTurma, encerrarVinculoProfessorTurma } = useData();

  const allColumns = [
    ...columns,
    { key: 'vinculos', header: 'Vínculos', render: row => (
      <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => setManagingPessoa(row)}>Gerenciar vínculos</Button>
        {usuarioTipo === 'professor' && <Button size="sm" variant="outline" onClick={() => setManagingTurmas(row)}>Turmas e disciplinas</Button>}
      </div>
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

      {managingTurmas && (
        <VinculosTurmaProfessorModal
          professor={managingTurmas}
          professores={professores}
          turmas={turmas}
          disciplinas={disciplinas}
          escolas={escolas}
          turmaProfessores={turmaProfessores}
          vincularProfessorTurma={vincularProfessorTurma}
          encerrarVinculoProfessorTurma={encerrarVinculoProfessorTurma}
          onClose={() => setManagingTurmas(null)}
        />
      )}
    </>
  );
};

export const GestaoPessoas = () => {
  const { user, registrarUsuario } = useAuth();
  const {
    gestores,
    diretores,
    escolas,
    vinculosEscolares,
    createGestor,
    updateGestor,
    createDiretor,
    updateDiretor,
    createVinculoEscolar,
    desvincularEscola,
  } = useData();
  const [tab, setTab] = useState('professores');

  if (!canManageProfessores(user)) return <Navigate to="/dashboard" replace />;
  // Supervisores(as)/Diretores(as) continuam exclusivos da Secretaria — a Diretora só enxerga a
  // aba Professores(as), mesmo passando na checagem acima.
  const podeGerenciarPessoasAmplo = canManagePessoas(user);

  // Mesma lógica do professor mock antigo: criar a pessoa sem criar a conta a deixaria sem forma de entrar.
  const createGestorWithLogin = (payload) => {
    const created = createGestor(payload);
    registrarUsuario({ email: created.email, tipo: 'gestor', perfilId: created.id });
  };

  const createDiretorWithLogin = (payload) => {
    const created = createDiretor(payload);
    registrarUsuario({ email: created.email, tipo: 'diretora', perfilId: created.id });
  };

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

  const tabs = podeGerenciarPessoasAmplo
    ? [
      { key: 'professores', label: 'Professores(as)' },
      { key: 'supervisores', label: 'Supervisores(as)' },
      { key: 'diretores', label: 'Diretores(as)' },
    ]
    : [{ key: 'professores', label: 'Professores(as)' }];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Gestão de Pessoas</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Cadastre, edite e gerencie os vínculos de professores(as), supervisores(as) e diretores(as) com as escolas da rede.</p>
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

        {tab === 'professores' && <ProfessoresReaisManager user={user} />}

        {tab === 'supervisores' && podeGerenciarPessoasAmplo && (
          <PessoasManager
            title="Supervisores(as)"
            description="Cadastro dos supervisores(as) responsáveis pela gestão operacional das escolas vinculadas."
            usuarioTipo="gestor"
            records={gestores}
            fields={cargoFields}
            columns={cargoColumns}
            onCreate={createGestorWithLogin}
            onUpdate={updateGestor}
            escolas={escolas}
            vinculosEscolares={vinculosEscolares}
            createVinculoEscolar={createVinculoEscolar}
            desvincularEscola={desvincularEscola}
            emptyDescription="Cadastre o(a) primeiro(a) supervisor(a) da rede."
          />
        )}

        {tab === 'diretores' && podeGerenciarPessoasAmplo && (
          <PessoasManager
            title="Diretores(as)"
            description="Cadastro dos diretores(as) responsáveis por cada escola."
            usuarioTipo="diretora"
            records={diretores}
            fields={cargoFields}
            columns={cargoColumns}
            onCreate={createDiretorWithLogin}
            onUpdate={updateDiretor}
            escolas={escolas}
            vinculosEscolares={vinculosEscolares}
            createVinculoEscolar={createVinculoEscolar}
            desvincularEscola={desvincularEscola}
            emptyDescription="Cadastre o(a) primeiro(a) diretor(a) da rede."
          />
        )}
      </div>
    </MainLayout>
  );
};

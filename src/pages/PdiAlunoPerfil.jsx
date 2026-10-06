import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, FormField, Modal } from '../components/Common';
import { ProfessoresDaTurmaPreview } from '../components/ProfessoresDaTurmaPreview';
import { DesempenhoPdiChartMock } from '../components/DesempenhoPdiChartMock';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useEscola } from '../context/EscolaContext';
import { criarVinculoAuxiliarTurma, encerrarVinculoAuxiliarTurma, listarAuxiliaresReais, listarVinculosAuxiliarTurma } from '../services/auxiliaresTurma';
import { escolaName, inputClass, turmaName } from '../utils/display';
import { canAccessEscola, gestorVinculadoEscola } from '../utils/escolas';
import { parentescoOptions } from '../utils/pdi';
import { formatFullDate } from '../utils/formAvailability';
import { isAuxiliar, isDiretora, isGestor, isProfessor as isProfessorRole, isSecretaria, canManagePedagogico, canViewPdiAlunos } from '../utils/roles';
import { MainLayout } from '../layouts/Layouts';

// Vínculo real (AuxiliarTurma) guarda dataInicio/dataFim como DateTime ISO completo, diferente
// de formatDate (utils/pdi.js), que espera "AAAA-MM-DD" puro — mesmo formatador de GestaoPessoas.jsx.
const formatDataReal = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export const PdiAlunoPerfil = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    pdiAlunosReais,
    updatePdiAlunoReal,
    pdiAplicacoesReais,
    loadPdiAplicacoesReais,
    turmas,
    escolas,
    vinculosEscolares,
  } = useData();

  const aluno = pdiAlunosReais.find(item => item.id === Number(id));
  const isProfessor = isProfessorRole(user);
  const canManagePdi = canManagePedagogico(user);
  const canView = canViewPdiAlunos(user);
  const { activeEscolaId } = useEscola();
  // Supervisora: consulta permitida mesmo com a escola inativa (histórico), desde que
  // vinculada a ela — diferente de canAccessEscola, que bloqueia integralmente escola inativa.
  const hasEscolaAccess = isSecretaria(user)
    || (aluno && isGestor(user) && gestorVinculadoEscola(user, aluno.escolaId, { vinculosEscolares }))
    || (aluno && canAccessEscola(user, aluno.escolaId, { escolas, vinculosEscolares }));
  const escolaAtivaAluno = aluno ? escolas.find(item => item.id === aluno.escolaId)?.status === 'ativa' : false;
  // Escola inativa vinculada à Supervisora: consulta sempre permitida, edição nunca. Secretaria
  // não é afetada por esta regra (ver instrução do módulo PDI: escopo é "Gestor/Supervisora").
  const canEditPdi = canManagePdi && (!isGestor(user) || escolaAtivaAluno);
  const [alunoForm, setAlunoForm] = useState(null);
  // Mensagem de sucesso vinda do redirecionamento após enviar uma ficha PDI (Gestor/Supervisor
  // volta pra cá em vez de ficar parado na tela do formulário — ver FormularioPdiProfessor.jsx).
  const [message, setMessage] = useState(location.state?.pdiMensagemSucesso || '');
  const [auxiliarForm, setAuxiliarForm] = useState(null);
  const [encerrandoAuxiliar, setEncerrandoAuxiliar] = useState(false);
  // Vínculo real Auxiliar↔Turma (GET /api/auxiliar-turma, o mesmo usado em GestaoPessoas.jsx) —
  // substitui o antigo mock `pdiAuxiliaresVinculos` aqui, que nunca era o que de fato autorizava
  // o Auxiliar a acessar /meus-alunos.
  const [vinculoAuxiliarAtivo, setVinculoAuxiliarAtivo] = useState(null);
  const [historicoAuxiliares, setHistoricoAuxiliares] = useState([]);
  const [carregandoAuxiliar, setCarregandoAuxiliar] = useState(false);
  const [auxiliaresDisponiveis, setAuxiliaresDisponiveis] = useState([]);

  // Carrega Aplicações PDI reais só para o Gestor, que é quem usa essa lista para abrir o
  // Formulário PDI real a partir daqui (ver fichasGestor abaixo) — mesmo padrão de carregamento
  // condicional de pdiModelosReais em FormularioPdiPage.jsx.
  useEffect(() => { if (isGestor(user) || isDiretora(user)) loadPdiAplicacoesReais(); }, [user, loadPdiAplicacoesReais]);

  const carregarAuxiliar = async (turmaId) => {
    setCarregandoAuxiliar(true);
    try {
      const lista = await listarVinculosAuxiliarTurma({ turmaId });
      setVinculoAuxiliarAtivo(lista.find(item => item.status === 'ATIVO') || null);
      setHistoricoAuxiliares(lista.filter(item => item.status === 'ENCERRADO').sort((left, right) => new Date(right.dataInicio) - new Date(left.dataInicio)));
    } catch {
      setVinculoAuxiliarAtivo(null);
      setHistoricoAuxiliares([]);
    } finally {
      setCarregandoAuxiliar(false);
    }
  };

  useEffect(() => { if (aluno?.turmaId) carregarAuxiliar(aluno.turmaId); }, [aluno?.turmaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auxiliar tem sua própria tela de consulta em /meus-alunos/:id, fora deste módulo.
  if (isAuxiliar(user)) return <Navigate to="/dashboard" replace />;
  // Professor não usa mais este perfil para o PDI por disciplina — vai direto de "Meus PDIs"
  // para a ficha (aplicação + disciplina + aluno). O acesso não depende mais de
  // aluno.professorId (ver src/utils/pdiFichas.js).
  if (isProfessor) return <Navigate to="/pdi/meus-pdis" replace />;
  // Diretora ganhou consulta (nunca edição — canEditPdi abaixo já exclui ela) escopada às
  // próprias escolas, quando Aluno PDI virou real (ver PdiPage.jsx e canViewPdiAlunos).
  if (!canView) return <Navigate to="/dashboard" replace />;

  if (!aluno || !hasEscolaAccess) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">Aluno não encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/pdi')}>Voltar para alunos</Button>
        </Card>
      </MainLayout>
    );
  }

  // Fichas PDI por disciplina disponíveis para este aluno, do ponto de vista de quem consulta
  // (Gestor cria/preenche; Diretora só consulta, nunca cria — seção 22 do pedido de Meus PDIs):
  // uma por (Aplicação real × disciplina no snapshot) da escola atual do aluno — sem exigir
  // ProfessorTurmaDisciplina (quem abre decide o Professor responsável no backend, ver POST
  // /api/pdi-fichas/obter-ou-criar; a Diretora cai automaticamente no fallback de leitura de
  // FormularioPdiProfessor.jsx, que nunca cria nada pra ela).
  const fichasGestor = (isGestor(user) || isDiretora(user))
    ? pdiAplicacoesReais
      .filter(aplicacao => aplicacao.escolaId === aluno.escolaId)
      .flatMap(aplicacao => aplicacao.modelos.map(modelo => ({
        aplicacaoId: aplicacao.id,
        dataInicio: aplicacao.dataInicio,
        dataFim: aplicacao.dataFim,
        disciplinaId: modelo.disciplinaId,
        disciplinaNome: modelo.disciplinaNome,
      })))
    : [];

  const saveAluno = async (event) => {
    event.preventDefault();
    if (!canEditPdi) return;
    if (!alunoForm.nome?.trim() || !alunoForm.turmaId) {
      setMessage('Preencha nome e turma antes de salvar.');
      return;
    }
    if (!alunoForm.responsavelNome?.trim() || !alunoForm.responsavelParentesco || !alunoForm.responsavelTelefone?.trim()) {
      setMessage('Informe nome, parentesco e telefone do responsável legal.');
      return;
    }
    const resultado = await updatePdiAlunoReal(aluno.id, alunoForm);
    if (!resultado.ok) {
      setMessage(resultado.error);
      return;
    }
    setAlunoForm(null);
    setMessage('Dados do aluno atualizados com sucesso.');
  };

  // Gestão do vínculo Auxiliar <-> TURMA é exclusiva da Secretaria (ver guard nos botões). Vale
  // para todos os alunos PDI da turma do aluno, não só para este aluno. Vínculo real (mesma API
  // usada em GestaoPessoas.jsx) — dataInicio é sempre a data do servidor, nunca escolhida aqui.
  const saveAuxiliar = async (event) => {
    event.preventDefault();
    if (!auxiliarForm.auxiliarId) {
      setMessage('Selecione o Auxiliar.');
      return;
    }
    try {
      await criarVinculoAuxiliarTurma({ turmaId: aluno.turmaId, auxiliarId: Number(auxiliarForm.auxiliarId) });
      setAuxiliarForm(null);
      setMessage('Auxiliar de Aprendizagem vinculado à turma com sucesso.');
      await carregarAuxiliar(aluno.turmaId);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const confirmEncerrarAuxiliar = async () => {
    try {
      await encerrarVinculoAuxiliarTurma(vinculoAuxiliarAtivo.id);
      setEncerrandoAuxiliar(false);
      setMessage('Vínculo com o Auxiliar de Aprendizagem encerrado.');
      await carregarAuxiliar(aluno.turmaId);
    } catch (error) {
      setEncerrandoAuxiliar(false);
      setMessage(error.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <Link to="/pdi/alunos" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para alunos</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{aluno.nome}</h1>
            <p className="mt-2 text-slate-600">{turmaName(turmas, aluno.turmaId)} · {escolaName(escolas, aluno.escolaId)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={aluno.status === 'arquivado' ? 'gray' : 'green'}>{aluno.status === 'arquivado' ? 'Arquivado' : 'Ativo'}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <p><strong>Responsável legal:</strong> {aluno.responsavelNome || 'Não informado'}{aluno.responsavelParentesco ? ` (${parentescoOptions.find(item => item.value === aluno.responsavelParentesco)?.label || aluno.responsavelParentesco})` : ''}</p>
              <p><strong>Telefone do responsável:</strong> {aluno.responsavelTelefone || 'Não informado'}</p>
              <ProfessoresDaTurmaPreview turmaId={aluno.turmaId} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Anamnese real agora é consultável por todos os perfis com acesso a este perfil de
                aluno (Secretaria/Gestor/Diretora) — só a Secretaria edita, o backend garante
                (seção 33 do pedido de Anamnese). */}
            <Link to={`/pdi/alunos/${aluno.id}/anamnese`}><Button variant="outline">Anamnese</Button></Link>
            <Link to={`/pdi/alunos/${aluno.id}/ficha-anual`}><Button variant="outline">Ficha Anual PDI</Button></Link>
            {(isGestor(user) || isDiretora(user)) && fichasGestor.map(ficha => (
              <Link key={`${ficha.aplicacaoId}-${ficha.disciplinaId}`} to={`/pdi/fichas/${ficha.aplicacaoId}/${ficha.disciplinaId}/${aluno.id}`}>
                <Button variant="outline">Formulário PDI — {ficha.disciplinaNome} ({formatFullDate(ficha.dataInicio)}–{formatFullDate(ficha.dataFim)})</Button>
              </Link>
            ))}
            {canEditPdi && <Button variant="outline" onClick={() => setAlunoForm({ ...aluno })}>Editar aluno</Button>}
          </div>
        </div>

        {isGestor(user) && !escolaAtivaAluno && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Esta escola está inativa. Os registros estão disponíveis apenas para consulta histórica — preenchimento, edição e correção estão desabilitados.
          </div>
        )}

        {(isGestor(user) || isDiretora(user)) && fichasGestor.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Nenhum formulário PDI configurado para esta escola/disciplina no momento — nenhuma aplicação PDI aberta, ou nenhuma disciplina com modelo PDI cadastrado, para a turma deste aluno.
          </div>
        )}

        <Card>
          <DesempenhoPdiChartMock />
        </Card>

        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Auxiliar de Aprendizagem da turma</p>
              {carregandoAuxiliar ? (
                <p className="mt-1 text-sm text-slate-500">Carregando...</p>
              ) : vinculoAuxiliarAtivo ? (
                <>
                  <p className="mt-1 font-semibold text-slate-900">{vinculoAuxiliarAtivo.auxiliarNome}</p>
                  <p className="text-sm text-slate-600">Desde: {formatDataReal(vinculoAuxiliarAtivo.dataInicio)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Nenhum Auxiliar de Aprendizagem vinculado a esta turma no momento.</p>
              )}
              <p className="mt-1 text-xs text-slate-500">O vínculo é com a turma ({turmaName(turmas, aluno.turmaId)}) e vale para todos os alunos PDI dela, não só para este aluno.</p>
            </div>
            {isSecretaria(user) && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setAuxiliarForm({ auxiliarId: '' }); listarAuxiliaresReais().then(setAuxiliaresDisponiveis).catch(() => setAuxiliaresDisponiveis([])); }}>{vinculoAuxiliarAtivo ? 'Alterar auxiliar' : 'Vincular auxiliar'}</Button>
                {vinculoAuxiliarAtivo && <Button variant="outline" onClick={() => setEncerrandoAuxiliar(true)}>Encerrar vínculo</Button>}
              </div>
            )}
          </div>
          {isSecretaria(user) && historicoAuxiliares.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Histórico de Auxiliares da turma</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Auxiliar</th><th className="pb-2 pr-4">Início</th><th className="pb-2 pr-4">Fim</th><th className="pb-2">Status</th></tr></thead>
                  <tbody>
                    {historicoAuxiliares.map(item => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4">{item.auxiliarNome}</td>
                        <td className="py-2 pr-4">{formatDataReal(item.dataInicio)}</td>
                        <td className="py-2 pr-4">{item.dataFim ? formatDataReal(item.dataFim) : '—'}</td>
                        <td className="py-2"><Badge variant="gray">Encerrado</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        {alunoForm && (
          <Modal title="Editar aluno" onClose={() => setAlunoForm(null)}>
            <form onSubmit={saveAluno} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nome completo"><input className={inputClass} value={alunoForm.nome} onChange={event => setAlunoForm(prev => ({ ...prev, nome: event.target.value }))} required /></FormField>
                <FormField label="Escola"><select className={inputClass} value={alunoForm.escolaId} onChange={event => { const escolaId = Number(event.target.value); setAlunoForm(prev => ({ ...prev, escolaId, turmaId: turmas.some(item => item.id === prev.turmaId && item.escolaId === escolaId) ? prev.turmaId : '' })); }} required disabled={activeEscolaId !== null}>{(activeEscolaId !== null ? escolas.filter(item => item.id === activeEscolaId) : escolas).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
                <FormField label="Turma"><select className={inputClass} value={alunoForm.turmaId} onChange={event => setAlunoForm(prev => ({ ...prev, turmaId: Number(event.target.value) }))} required>
                  <option value="" disabled>{alunoForm.escolaId ? 'Selecione a turma' : 'Selecione a escola primeiro'}</option>
                  {turmas.filter(item => item.status === 'ativa' && item.escolaId === Number(alunoForm.escolaId)).map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select></FormField>
                <ProfessoresDaTurmaPreview turmaId={alunoForm.turmaId} />
                <div className="md:col-span-2 grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                  <p className="text-sm font-semibold text-slate-700 md:col-span-2">Responsável legal</p>
                  <FormField label="Nome do responsável"><input className={inputClass} value={alunoForm.responsavelNome || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelNome: event.target.value }))} required /></FormField>
                  <FormField label="Parentesco"><select className={inputClass} value={alunoForm.responsavelParentesco || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelParentesco: event.target.value }))} required><option value="" disabled>Selecione</option>{parentescoOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField>
                  <FormField label="Telefone principal"><input className={inputClass} value={alunoForm.responsavelTelefone || ''} onChange={event => setAlunoForm(prev => ({ ...prev, responsavelTelefone: event.target.value }))} required /></FormField>
                </div>
              </div>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAlunoForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {auxiliarForm && (
          <Modal title={vinculoAuxiliarAtivo ? 'Alterar Auxiliar de Aprendizagem da turma' : 'Vincular Auxiliar de Aprendizagem à turma'} onClose={() => setAuxiliarForm(null)}>
            <form onSubmit={saveAuxiliar} className="space-y-4">
              <p className="text-sm text-slate-600">Turma: <strong>{turmaName(turmas, aluno.turmaId)}</strong> — o vínculo passa a valer para todos os alunos PDI dela.</p>
              {vinculoAuxiliarAtivo && (
                <p className="text-sm text-slate-600">Auxiliar atual: <strong>{vinculoAuxiliarAtivo.auxiliarNome}</strong></p>
              )}
              <FormField label={vinculoAuxiliarAtivo ? 'Novo Auxiliar' : 'Auxiliar'}>
                <select className={inputClass} value={auxiliarForm.auxiliarId} onChange={event => setAuxiliarForm(prev => ({ ...prev, auxiliarId: event.target.value }))} required>
                  <option value="" disabled>Selecione um Auxiliar</option>
                  {auxiliaresDisponiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </FormField>
              <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setAuxiliarForm(null)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </Modal>
        )}

        {encerrandoAuxiliar && (
          <ConfirmDialog
            title="Encerrar vínculo"
            message="Todos os alunos PDI desta turma ficarão sem Auxiliar de Aprendizagem vinculado até que a Secretaria vincule um novo. O histórico deste vínculo é preservado."
            confirmLabel="Encerrar vínculo"
            onCancel={() => setEncerrandoAuxiliar(false)}
            onConfirm={confirmEncerrarAuxiliar}
          />
        )}
      </div>
    </MainLayout>
  );
};
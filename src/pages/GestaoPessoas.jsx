import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, DataTable, FormField, Modal, PersonName } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { apiFetch } from '../services/api';
import { criarVinculoProfessorTurmaDisciplina, encerrarVinculoProfessorTurmaDisciplina, listarVinculosProfessorTurmaDisciplina } from '../services/professorTurmaDisciplina';
import { criarVinculoAuxiliarTurma, encerrarVinculoAuxiliarTurma, listarAuxiliaresReais, listarVinculosAuxiliarTurma } from '../services/auxiliaresTurma';
import { criarVinculoEscolarReal, encerrarVinculoEscolarReal, listarVinculosEscolares, reativarVinculoEscolarReal } from '../services/vinculosEscolares';
import { MainLayout } from '../layouts/Layouts';
import { inputClass } from '../utils/display';
import { canManagePessoas, canManageProfessores, isSecretaria } from '../utils/roles';

// Vínculos reais (ProfessorTurmaDisciplina/AuxiliarTurma) guardam `dataInicio`/`dataFim` como
// DateTime ISO completo (ex.: "2026-09-28T14:30:00.000Z"), diferente do mock (`formatDate` acima,
// que espera "AAAA-MM-DD" puro) — por isso um formatador próprio aqui, em vez de reaproveitar.
const formatDataReal = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

// VinculoEscolar real — reutilizado por Professor e Auxiliar (ambos têm a mesma estrutura de
// vínculo com escola agora). Encerrar aqui também encerra, no backend e na mesma transação, os
// vínculos pedagógicos (ProfessorTurmaDisciplina/AuxiliarTurma) ativos daquela escola — a
// mensagem de sucesso avisa isso explicitamente pra não parecer mágica. Reativar NUNCA ressuscita
// esses vínculos operacionais (regra explícita do pedido); se precisar, cria-se de novo à parte.
const VinculosEscolaModal = ({ pessoa, minhasEscolas, onClose }) => {
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [escolaId, setEscolaId] = useState('');
  const [buscaEscola, setBuscaEscola] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroForm, setErroForm] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setVinculos(await listarVinculosEscolares(pessoa.id));
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const escolaIdsAtivos = new Set(vinculos.filter(v => v.status === 'ATIVO').map(v => v.escolaId));
  const escolasDisponiveis = minhasEscolas.filter(escola => !escolaIdsAtivos.has(escola.id));
  const escolasFiltradas = escolasDisponiveis.filter(escola => escola.nome.toLowerCase().includes(buscaEscola.toLowerCase()));

  useEffect(() => {
    if (!escolaId && escolasDisponiveis.length > 0) setEscolaId(escolasDisponiveis[0].id);
  }, [escolasDisponiveis.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se a busca esconder a escola selecionada, troca pra primeira que ainda aparece — nunca deixa
  // o select mostrando uma opção fora do filtro atual.
  useEffect(() => {
    if (escolaId && !escolasFiltradas.some(escola => escola.id === Number(escolaId))) {
      setEscolaId(escolasFiltradas[0]?.id ?? '');
    }
  }, [buscaEscola]); // eslint-disable-line react-hooks/exhaustive-deps

  const vinculosOrdenados = [...vinculos].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ATIVO' ? -1 : 1;
    return new Date(b.dataInicio) - new Date(a.dataInicio);
  });

  const vincular = async (event) => {
    event.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      await criarVinculoEscolarReal({ pessoaId: pessoa.id, escolaId: Number(escolaId) });
      setMensagem('Vínculo criado com sucesso.');
      setEscolaId('');
      await carregar();
    } catch (error) {
      setErroForm(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const encerrar = async (vinculo) => {
    try {
      await encerrarVinculoEscolarReal(vinculo.id);
      setMensagem('Vínculo encerrado com sucesso. Vínculos pedagógicos ativos nesta escola também foram encerrados.');
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  const reativar = async (vinculo) => {
    try {
      await reativarVinculoEscolarReal(vinculo.id);
      setMensagem('Vínculo reativado com sucesso. Vínculos pedagógicos anteriores NÃO voltam automaticamente — crie-os de novo se necessário.');
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  return (
    <Modal title={`Escolas — ${pessoa.nome}`} onClose={onClose}>
      <div className="space-y-5">
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar os vínculos: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Vínculos</p>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : vinculosOrdenados.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum vínculo escolar no momento.</p>
          ) : (
            <div className="space-y-2">
              {vinculosOrdenados.map(vinculo => (
                <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{vinculo.escolaNome}</p>
                      <Badge variant={vinculo.status === 'ATIVO' ? 'green' : 'gray'}>{vinculo.status === 'ATIVO' ? 'Ativo' : 'Encerrado'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      desde {formatDataReal(vinculo.dataInicio)}{vinculo.dataFim ? ` até ${formatDataReal(vinculo.dataFim)}` : ''}
                    </p>
                  </div>
                  {vinculo.status === 'ATIVO' ? (
                    <Button size="sm" variant="danger" onClick={() => encerrar(vinculo)}>Encerrar</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => reativar(vinculo)}>Reativar</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {escolasDisponiveis.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Não há outras escolas disponíveis para vincular (dentro das escolas que você administra).
          </p>
        ) : (
          <form onSubmit={vincular} className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700">Vincular a uma escola</p>
            {erroForm && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erroForm}</div>}
            {escolasDisponiveis.length > 6 && (
              <input className={inputClass} value={buscaEscola} onChange={event => setBuscaEscola(event.target.value)} placeholder="Buscar escola..." />
            )}
            <FormField label="Escola">
              {escolasFiltradas.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma escola encontrada.</p>
              ) : (
                <select className={inputClass} value={escolaId} onChange={event => setEscolaId(event.target.value)}>
                  {escolasFiltradas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              )}
            </FormField>
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={salvando || escolasFiltradas.length === 0}>{salvando ? 'Salvando...' : 'Vincular'}</Button></div>
          </form>
        )}

        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>
      </div>
    </Modal>
  );
};

// Turmas/disciplinas REAIS de um professor (ProfessorTurmaDisciplina, backend) — substitui, só
// dentro de ProfessoresReaisManager, o modal mock acima (que continua existindo só pra
// Supervisores(as)/Diretores(as) mock em PessoasManager, código antigo não tocado nesta etapa).
// `turmasDoProfessor` já vem restrita às escolas onde o professor tem VinculoEscolar ATIVO
// dentro do escopo de quem está gerenciando (professor.escolas, devolvido assim pelo backend em
// GET /api/pessoas/professores) — nunca a rede inteira.
const VinculosPedagogicosProfessorModal = ({ professor, turmasDoProfessor, disciplinasReais, onClose }) => {
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  // Escola escolhida primeiro, pra filtrar a lista de turmas — essencial quando o professor tem
  // vínculo com mais de uma escola: turmas de nomes iguais ("6M1" etc.) existem em quase todas,
  // então uma lista única misturando tudo (sem indicar a escola) deixava fácil vincular na turma
  // errada sem perceber.
  const escolaInicial = professor.escolas[0]?.id ?? '';
  const [novoVinculo, setNovoVinculo] = useState({
    escolaId: escolaInicial,
    turmaId: turmasDoProfessor.find(turma => turma.escolaId === escolaInicial)?.id ?? '',
    disciplinaId: disciplinasReais[0]?.id ?? '',
  });
  const turmasDaEscolaSelecionada = turmasDoProfessor.filter(turma => turma.escolaId === Number(novoVinculo.escolaId));
  const [ocupantesDaTurma, setOcupantesDaTurma] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroForm, setErroForm] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setVinculos(await listarVinculosProfessorTurmaDisciplina({ professorId: professor.id }));
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  // Só pra mostrar o aviso "fulano já leciona isso aqui" antes de confirmar — quem decide de
  // verdade (e faz a troca de forma atômica) é sempre o backend.
  useEffect(() => {
    if (!novoVinculo.turmaId) { setOcupantesDaTurma([]); return; }
    listarVinculosProfessorTurmaDisciplina({ turmaId: novoVinculo.turmaId }).then(setOcupantesDaTurma).catch(() => setOcupantesDaTurma([]));
  }, [novoVinculo.turmaId]);

  const vinculosAtivos = vinculos.filter(item => item.status === 'ATIVO').sort((a, b) => a.turmaNome.localeCompare(b.turmaNome));
  const historico = vinculos.filter(item => item.status === 'ENCERRADO').sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
  const ocupanteAtual = ocupantesDaTurma.find(item => item.status === 'ATIVO' && item.disciplinaId === Number(novoVinculo.disciplinaId));
  const conflitoComOutro = ocupanteAtual && ocupanteAtual.professorId !== professor.id ? ocupanteAtual : null;

  const vincular = async (event) => {
    event.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      await criarVinculoProfessorTurmaDisciplina({ turmaId: Number(novoVinculo.turmaId), professorId: professor.id, disciplinaId: Number(novoVinculo.disciplinaId) });
      setMensagem('Vínculo criado com sucesso.');
      await carregar();
    } catch (error) {
      setErroForm(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const encerrar = async (vinculo) => {
    try {
      await encerrarVinculoProfessorTurmaDisciplina(vinculo.id);
      setMensagem('Vínculo encerrado com sucesso.');
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  return (
    <Modal title={`Turmas e disciplinas — ${professor.nome}`} onClose={onClose}>
      <div className="space-y-5">
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar os vínculos: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Vínculos ativos</p>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : vinculosAtivos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma turma vinculada no momento.</p>
          ) : (
            <div className="space-y-2">
              {vinculosAtivos.map(vinculo => (
                <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{vinculo.turmaNome} — {vinculo.disciplinaNome}</p>
                    <p className="text-xs text-slate-500">desde {formatDataReal(vinculo.dataInicio)}</p>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => encerrar(vinculo)}>Encerrar</Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {turmasDoProfessor.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este professor não tem turmas disponíveis nas escolas onde você o administra. Verifique se há turmas ativas cadastradas.
          </p>
        ) : (
          <form onSubmit={vincular} className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700">Vincular a uma turma/disciplina</p>
            {erroForm && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erroForm}</div>}
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Escola">
                <select
                  className={inputClass}
                  value={novoVinculo.escolaId}
                  onChange={event => {
                    const escolaId = Number(event.target.value);
                    const primeiraTurma = turmasDoProfessor.find(turma => turma.escolaId === escolaId);
                    setNovoVinculo(prev => ({ ...prev, escolaId, turmaId: primeiraTurma?.id ?? '' }));
                  }}
                >
                  {professor.escolas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Turma">
                <select className={inputClass} value={novoVinculo.turmaId} onChange={event => setNovoVinculo(prev => ({ ...prev, turmaId: event.target.value }))}>
                  <option value="" disabled>{turmasDaEscolaSelecionada.length === 0 ? 'Nenhuma turma nesta escola' : 'Selecione'}</option>
                  {turmasDaEscolaSelecionada.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Disciplina">
                <select className={inputClass} value={novoVinculo.disciplinaId} onChange={event => setNovoVinculo(prev => ({ ...prev, disciplinaId: event.target.value }))}>
                  {disciplinasReais.map(disciplina => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
                </select>
              </FormField>
            </div>
            {conflitoComOutro && (
              <p className="text-xs font-semibold text-amber-700">
                Atualmente, outro professor (#{conflitoComOutro.professorId}) leciona esta disciplina nesta turma — vincular aqui encerra o vínculo dele automaticamente.
              </p>
            )}
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={salvando || !novoVinculo.turmaId}>{salvando ? 'Salvando...' : 'Vincular'}</Button></div>
          </form>
        )}

        {historico.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Histórico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Turma</th><th className="pb-2 pr-4">Disciplina</th><th className="pb-2 pr-4">Início</th><th className="pb-2">Fim</th></tr></thead>
                <tbody>
                  {historico.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{item.turmaNome}</td>
                      <td className="py-2 pr-4">{item.disciplinaNome}</td>
                      <td className="py-2 pr-4">{formatDataReal(item.dataInicio)}</td>
                      <td className="py-2">{formatDataReal(item.dataFim)}</td>
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

// Passo 2 do cadastro de professor: em vez de deixar turma/disciplina como ação solta e opcional
// (causa raiz do cadastro "incompleto" — Pessoa + VinculoEscolar criados, zero
// ProfessorTurmaDisciplina), o fluxo agora passa por cada escola selecionada, uma de cada vez,
// pedindo turma(s)/disciplina(s) ali mesmo. A escola do passo já vem fixa (não é um campo
// selecionável) — por construção é impossível escolher turma de uma escola diferente da do passo
// atual. "Concluir depois" fecha sem forçar nada: o professor e os VinculoEscolar já foram
// criados antes de abrir este wizard, então fechar cedo só adia o resto pro botão "Turmas e
// disciplinas" de sempre, nunca perde o que já foi cadastrado.
const VinculosWizardCriacaoProfessor = ({ professor, escolas, disciplinasReais, turmas, onFinish }) => {
  const [indice, setIndice] = useState(0);
  const [vinculosAdicionados, setVinculosAdicionados] = useState([]);
  const [novoVinculo, setNovoVinculo] = useState({ turmaId: '', disciplinaId: disciplinasReais[0]?.id ?? '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const escolaAtual = escolas[indice];
  const turmasDaEscola = turmas.filter(turma => turma.status === 'ativa' && turma.escolaId === escolaAtual.id);

  useEffect(() => {
    setNovoVinculo({ turmaId: turmasDaEscola[0]?.id ?? '', disciplinaId: disciplinasReais[0]?.id ?? '' });
    setVinculosAdicionados([]);
    setErro('');
  }, [indice]); // eslint-disable-line react-hooks/exhaustive-deps

  const adicionar = async (event) => {
    event.preventDefault();
    if (!novoVinculo.turmaId) return;
    setSalvando(true);
    setErro('');
    try {
      const criado = await criarVinculoProfessorTurmaDisciplina({ turmaId: Number(novoVinculo.turmaId), professorId: professor.id, disciplinaId: Number(novoVinculo.disciplinaId) });
      setVinculosAdicionados(prev => [...prev, criado]);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (vinculo) => {
    try {
      await encerrarVinculoProfessorTurmaDisciplina(vinculo.id);
      setVinculosAdicionados(prev => prev.filter(item => item.id !== vinculo.id));
    } catch (error) {
      setErro(error.message);
    }
  };

  const ultimaEscola = indice === escolas.length - 1;

  return (
    <Modal title={`Turmas e disciplinas — ${professor.nome}`} onClose={onFinish}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Escola {indice + 1} de {escolas.length}</p>
          <p className="text-sm font-bold text-slate-900">{escolaAtual.nome}</p>
        </div>

        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}

        {vinculosAdicionados.length > 0 && (
          <div className="space-y-2">
            {vinculosAdicionados.map(vinculo => (
              <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-900">{vinculo.turmaNome} — {vinculo.disciplinaNome}</p>
                <Button size="sm" variant="outline" onClick={() => remover(vinculo)}>Remover</Button>
              </div>
            ))}
          </div>
        )}

        {turmasDaEscola.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Esta escola não tem turmas ativas cadastradas — pule e cadastre a turma antes de voltar aqui.</p>
        ) : (
          <form onSubmit={adicionar} className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-end">
            <div className="flex-1"><FormField label="Turma">
              <select className={inputClass} value={novoVinculo.turmaId} onChange={event => setNovoVinculo(prev => ({ ...prev, turmaId: event.target.value }))}>
                {turmasDaEscola.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
              </select>
            </FormField></div>
            <div className="flex-1"><FormField label="Disciplina">
              <select className={inputClass} value={novoVinculo.disciplinaId} onChange={event => setNovoVinculo(prev => ({ ...prev, disciplinaId: event.target.value }))}>
                {disciplinasReais.map(disciplina => <option key={disciplina.id} value={disciplina.id}>{disciplina.nome}</option>)}
              </select>
            </FormField></div>
            <Button type="submit" size="sm" disabled={salvando}>{salvando ? 'Adicionando...' : '+ Adicionar'}</Button>
          </form>
        )}

        <div className="flex justify-between gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onFinish}>Concluir depois</Button>
          <Button type="button" onClick={() => (ultimaEscola ? onFinish() : setIndice(prev => prev + 1))}>
            {ultimaEscola ? 'Concluir cadastro' : 'Próxima escola →'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// --- Professores (conta real, backend) ------------------------------------------------------
// Único ponto do app onde uma nova PESSOA real (com login/JWT de verdade) é criada — Secretaria
// em qualquer escola, Diretora só nas suas (checado de novo no backend, nunca só aqui). Ver
// backend/src/api/routes/pessoas.ts para as regras completas.
const SenhaTemporariaModal = ({ pessoa, senha, mensagem, titulo = 'Professor cadastrado com sucesso', mensagemPadrao = 'Professor vinculado com sucesso.', onClose }) => {
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
    <Modal title={titulo} onClose={onClose}>
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
            Esta senha será exibida somente agora — anote ou copie antes de fechar. A pessoa deverá alterá-la no primeiro acesso. Repasse pessoalmente ou por WhatsApp.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar senha'}</Button>
            <Button onClick={onClose}>Concluir</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-600">{mensagem || mensagemPadrao}</p>
          <div className="flex justify-end"><Button onClick={onClose}>Concluir</Button></div>
        </div>
      )}
    </Modal>
  );
};

const ProfessoresReaisManager = ({ user }) => {
  const { turmas, disciplinasReais } = useData();

  const [professores, setProfessores] = useState([]);
  const [minhasEscolas, setMinhasEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [form, setForm] = useState(null);
  const [buscaEscolaCadastro, setBuscaEscolaCadastro] = useState('');
  const [formError, setFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [wizardVinculos, setWizardVinculos] = useState(null);
  const [resultadoCriacao, setResultadoCriacao] = useState(null);
  const [resetando, setResetando] = useState(null);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  const [managingTurmas, setManagingTurmas] = useState(null);
  const [managingEscolas, setManagingEscolas] = useState(null);
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

  const abrirCadastro = () => { setFormError(''); setForm({ nome: '', email: '', escolaIds: [] }); setBuscaEscolaCadastro(''); };
  const fecharCadastro = () => { setForm(null); setFormError(''); };

  const toggleEscola = (escolaId) => {
    setForm(prev => ({
      ...prev,
      escolaIds: prev.escolaIds.includes(escolaId) ? prev.escolaIds.filter(id => id !== escolaId) : [...prev.escolaIds, escolaId],
    }));
  };

  // Cria a Pessoa + VinculoEscolar(es) e, em seguida, abre o wizard de turmas/disciplinas (uma
  // escola por vez) em vez de ir direto pra senha temporária — a criação em si não muda, só o que
  // acontece logo depois dela.
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
      // form.escolaIds nunca é vazio aqui (validado acima), então escolasSelecionadas sempre tem
      // ao menos uma escola pro wizard percorrer.
      const escolasSelecionadas = minhasEscolas.filter(escola => form.escolaIds.includes(escola.id));
      fecharCadastro();
      await carregar();
      setWizardVinculos({ professor: resultado.pessoa, escolas: escolasSelecionadas, senha: resultado });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const finalizarWizardVinculos = () => {
    const { senha } = wizardVinculos;
    setWizardVinculos(null);
    setResultadoCriacao(senha);
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
        <Button size="sm" variant="outline" onClick={() => setManagingEscolas(row)}>Escolas</Button>
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
              {minhasEscolas.length > 6 && (
                <input className={`${inputClass} mb-2`} value={buscaEscolaCadastro} onChange={event => setBuscaEscolaCadastro(event.target.value)} placeholder="Buscar escola..." />
              )}
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {minhasEscolas.filter(escola => escola.nome.toLowerCase().includes(buscaEscolaCadastro.toLowerCase())).map(escola => (
                  <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.escolaIds.includes(escola.id)} onChange={() => toggleEscola(escola.id)} />
                    {escola.nome}
                  </label>
                ))}
              </div>
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharCadastro} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Próximo →'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {wizardVinculos && (
        <VinculosWizardCriacaoProfessor
          professor={wizardVinculos.professor}
          escolas={wizardVinculos.escolas}
          disciplinasReais={disciplinasReais}
          turmas={turmas}
          onFinish={finalizarWizardVinculos}
        />
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
        <VinculosPedagogicosProfessorModal
          professor={managingTurmas}
          turmasDoProfessor={turmas.filter(turma => (
            turma.status === 'ativa' && managingTurmas.escolas.some(escola => escola.id === turma.escolaId)
          ))}
          disciplinasReais={disciplinasReais}
          onClose={() => setManagingTurmas(null)}
        />
      )}

      {managingEscolas && (
        <VinculosEscolaModal
          pessoa={managingEscolas}
          minhasEscolas={minhasEscolas}
          onClose={() => { setManagingEscolas(null); carregar(); }}
        />
      )}
    </div>
  );
};

// --- Gestores e Diretoras (conta real, backend) ---------------------------------------------
// Mesmo padrão de ProfessoresReaisManager, só que sempre exclusivo da Secretaria (decisão do
// usuário: mais restrito que Professor, que também aceita Diretora) — por isso nunca precisa de
// `user` pra decidir texto/permissão, e nunca tem o wizard de turma/disciplina (não se aplica a
// esses dois perfis). Diretora tem uma regra própria: exatamente 1 escola, nunca várias — o
// formulário reflete isso com um <select> único em vez de checkboxes.
const GestoresReaisManager = () => {
  const [gestoresReais, setGestoresReais] = useState([]);
  const [minhasEscolas, setMinhasEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [form, setForm] = useState(null);
  const [buscaEscolaCadastro, setBuscaEscolaCadastro] = useState('');
  const [formError, setFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultadoCriacao, setResultadoCriacao] = useState(null);
  const [resetando, setResetando] = useState(null);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  const [managingEscolas, setManagingEscolas] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, listaEscolas] = await Promise.all([
        apiFetch('/api/pessoas/gestores'),
        apiFetch('/api/pessoas/minhas-escolas'),
      ]);
      setGestoresReais(lista);
      setMinhasEscolas(listaEscolas);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirCadastro = () => { setFormError(''); setForm({ nome: '', email: '', escolaIds: [] }); setBuscaEscolaCadastro(''); };
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
      const resultado = await apiFetch('/api/pessoas/gestores', {
        method: 'POST',
        body: { nome: form.nome || undefined, email: form.email, escolaIds: form.escolaIds },
      });
      fecharCadastro();
      await carregar();
      setResultadoCriacao(resultado);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarResetarSenha = async () => {
    const alvo = resetando;
    try {
      const resultado = await apiFetch(`/api/pessoas/gestores/${alvo.id}/resetar-senha`, { method: 'POST' });
      setResetando(null);
      setResultadoCriacao({ pessoa: alvo, senhaTemporaria: resultado.senhaTemporaria });
    } catch (error) {
      setResetando(null);
      setMensagem(error.message);
    }
  };

  const confirmarMudarStatus = async () => {
    const { pessoa, novoStatus } = mudandoStatus;
    try {
      await apiFetch(`/api/pessoas/gestores/${pessoa.id}/${novoStatus === 'ATIVO' ? 'reativar' : 'inativar'}`, { method: 'POST' });
      setMudandoStatus(null);
      setMensagem(novoStatus === 'ATIVO' ? `${pessoa.nome} reativado(a) com sucesso.` : `${pessoa.nome} inativado(a) com sucesso.`);
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
        <Button size="sm" variant="outline" onClick={() => setManagingEscolas(row)}>Escolas</Button>
        <ActionMenu items={[
          { label: 'Gerar nova senha temporária', onClick: () => setResetando(row) },
          row.status === 'ATIVO'
            ? { label: 'Inativar', variant: 'danger', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'INATIVO' }) }
            : { label: 'Reativar', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'ATIVO' }) },
        ]} />
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <p className="max-w-2xl text-sm text-slate-600">Cadastro de contas reais de Supervisor(a), com login e senha próprios.</p>
        <Button onClick={abrirCadastro} disabled={carregando}>+ Cadastrar supervisor(a)</Button>
      </div>

      {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar os supervisores: {erro}</span>
          <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
        </div>
      )}

      {carregando ? (
        <Card><p className="text-center text-slate-500">Carregando supervisores...</p></Card>
      ) : gestoresReais.length === 0 ? (
        !erro && <Card className="py-12 text-center"><p className="font-semibold text-slate-800">Nenhum supervisor(a) cadastrado</p><p className="mt-1 text-sm text-slate-500">Cadastre o(a) primeiro(a) supervisor(a) com uma conta real.</p></Card>
      ) : (
        <DataTable columns={columns} rows={gestoresReais} />
      )}

      {form && (
        <Modal title="Cadastrar supervisor(a)" onClose={fecharCadastro}>
          <form onSubmit={salvarCadastro} className="space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</div>}
            <FormField label="E-mail">
              <input className={inputClass} type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} required />
            </FormField>
            <FormField label="Nome completo">
              <input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} />
              <p className="mt-1 text-xs text-slate-500">Se já existir uma conta com esse e-mail, o nome informado é ignorado — a pessoa só será vinculada à(s) escola(s) selecionada(s).</p>
            </FormField>
            <FormField label="Escolas de vínculo">
              {minhasEscolas.length > 6 && (
                <input className={`${inputClass} mb-2`} value={buscaEscolaCadastro} onChange={event => setBuscaEscolaCadastro(event.target.value)} placeholder="Buscar escola..." />
              )}
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {minhasEscolas.filter(escola => escola.nome.toLowerCase().includes(buscaEscolaCadastro.toLowerCase())).map(escola => (
                  <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.escolaIds.includes(escola.id)} onChange={() => toggleEscola(escola.id)} />
                    {escola.nome}
                  </label>
                ))}
              </div>
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharCadastro} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Cadastrar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {resultadoCriacao && (
        <SenhaTemporariaModal
          pessoa={resultadoCriacao.pessoa}
          senha={resultadoCriacao.senhaTemporaria}
          mensagem={resultadoCriacao.mensagem}
          titulo="Supervisor(a) cadastrado(a) com sucesso"
          mensagemPadrao="Supervisor(a) vinculado(a) com sucesso."
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
          title={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar supervisor(a)' : 'Inativar supervisor(a)'}
          message={mudandoStatus.novoStatus === 'ATIVO'
            ? `Deseja reativar ${mudandoStatus.pessoa.nome}? O login volta a funcionar normalmente.`
            : `Deseja inativar ${mudandoStatus.pessoa.nome}? O login é bloqueado e qualquer sessão aberta é encerrada na hora. O histórico é preservado.`}
          confirmLabel={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar' : 'Inativar'}
          onCancel={() => setMudandoStatus(null)}
          onConfirm={confirmarMudarStatus}
        />
      )}

      {managingEscolas && (
        <VinculosEscolaModal
          pessoa={managingEscolas}
          minhasEscolas={minhasEscolas}
          onClose={() => { setManagingEscolas(null); carregar(); }}
        />
      )}
    </div>
  );
};

// Diretora: mesmíssimo padrão de Gestor, só que o cadastro aceita exatamente 1 escola (backend
// rejeita qualquer outra quantidade) — por isso o formulário usa um <select> único, nunca
// checkboxes, e envia `escolaIds: [escolaId]`.
const DiretorasReaisManager = () => {
  const [diretorasReais, setDiretorasReais] = useState([]);
  const [minhasEscolas, setMinhasEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultadoCriacao, setResultadoCriacao] = useState(null);
  const [resetando, setResetando] = useState(null);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  const [managingEscolas, setManagingEscolas] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, listaEscolas] = await Promise.all([
        apiFetch('/api/pessoas/diretoras'),
        apiFetch('/api/pessoas/minhas-escolas'),
      ]);
      setDiretorasReais(lista);
      setMinhasEscolas(listaEscolas);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirCadastro = () => { setFormError(''); setForm({ nome: '', email: '', escolaId: minhasEscolas[0]?.id ?? '' }); };
  const fecharCadastro = () => { setForm(null); setFormError(''); };

  const salvarCadastro = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.escolaId) {
      setFormError('Selecione a escola.');
      return;
    }
    setSalvando(true);
    try {
      const resultado = await apiFetch('/api/pessoas/diretoras', {
        method: 'POST',
        body: { nome: form.nome || undefined, email: form.email, escolaIds: [Number(form.escolaId)] },
      });
      fecharCadastro();
      await carregar();
      setResultadoCriacao(resultado);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarResetarSenha = async () => {
    const alvo = resetando;
    try {
      const resultado = await apiFetch(`/api/pessoas/diretoras/${alvo.id}/resetar-senha`, { method: 'POST' });
      setResetando(null);
      setResultadoCriacao({ pessoa: alvo, senhaTemporaria: resultado.senhaTemporaria });
    } catch (error) {
      setResetando(null);
      setMensagem(error.message);
    }
  };

  const confirmarMudarStatus = async () => {
    const { pessoa, novoStatus } = mudandoStatus;
    try {
      await apiFetch(`/api/pessoas/diretoras/${pessoa.id}/${novoStatus === 'ATIVO' ? 'reativar' : 'inativar'}`, { method: 'POST' });
      setMudandoStatus(null);
      setMensagem(novoStatus === 'ATIVO' ? `${pessoa.nome} reativado(a) com sucesso.` : `${pessoa.nome} inativado(a) com sucesso.`);
      await carregar();
    } catch (error) {
      setMudandoStatus(null);
      setMensagem(error.message);
    }
  };

  const columns = [
    { key: 'nome', header: 'Nome', render: row => <PersonName nome={row.nome} /> },
    { key: 'email', header: 'E-mail' },
    { key: 'escolas', header: 'Escola', render: row => (
      row.escolas.length === 0
        ? <span className="text-xs text-slate-400">Nenhuma nesta visão</span>
        : <div className="flex flex-wrap gap-1">{row.escolas.map(escola => <Badge key={escola.id} variant="blue">{escola.nome}</Badge>)}</div>
    ) },
    { key: 'status', header: 'Status', render: row => <Badge variant={row.status === 'ATIVO' ? 'green' : 'gray'}>{row.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'acoes', header: 'Ações', render: row => (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setManagingEscolas(row)}>Escolas</Button>
        <ActionMenu items={[
          { label: 'Gerar nova senha temporária', onClick: () => setResetando(row) },
          row.status === 'ATIVO'
            ? { label: 'Inativar', variant: 'danger', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'INATIVO' }) }
            : { label: 'Reativar', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'ATIVO' }) },
        ]} />
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <p className="max-w-2xl text-sm text-slate-600">Cadastro de contas reais de Diretora, com login e senha próprios. Cada diretora administra exatamente uma escola.</p>
        <Button onClick={abrirCadastro} disabled={carregando}>+ Cadastrar diretora</Button>
      </div>

      {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar as diretoras: {erro}</span>
          <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
        </div>
      )}

      {carregando ? (
        <Card><p className="text-center text-slate-500">Carregando diretoras...</p></Card>
      ) : diretorasReais.length === 0 ? (
        !erro && <Card className="py-12 text-center"><p className="font-semibold text-slate-800">Nenhuma diretora cadastrada</p><p className="mt-1 text-sm text-slate-500">Cadastre a primeira diretora com uma conta real.</p></Card>
      ) : (
        <DataTable columns={columns} rows={diretorasReais} />
      )}

      {form && (
        <Modal title="Cadastrar diretora" onClose={fecharCadastro}>
          <form onSubmit={salvarCadastro} className="space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</div>}
            <FormField label="E-mail">
              <input className={inputClass} type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} required />
            </FormField>
            <FormField label="Nome completo">
              <input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} />
              <p className="mt-1 text-xs text-slate-500">Se já existir uma conta com esse e-mail, o nome informado é ignorado.</p>
            </FormField>
            <FormField label="Escola">
              <select className={inputClass} value={form.escolaId} onChange={event => setForm(prev => ({ ...prev, escolaId: event.target.value }))} required>
                <option value="" disabled>Selecione</option>
                {minhasEscolas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
              </select>
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharCadastro} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Cadastrar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {resultadoCriacao && (
        <SenhaTemporariaModal
          pessoa={resultadoCriacao.pessoa}
          senha={resultadoCriacao.senhaTemporaria}
          mensagem={resultadoCriacao.mensagem}
          titulo="Diretora cadastrada com sucesso"
          mensagemPadrao="Diretora vinculada com sucesso."
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
          title={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar diretora' : 'Inativar diretora'}
          message={mudandoStatus.novoStatus === 'ATIVO'
            ? `Deseja reativar ${mudandoStatus.pessoa.nome}? O login volta a funcionar normalmente.`
            : `Deseja inativar ${mudandoStatus.pessoa.nome}? O login é bloqueado e qualquer sessão aberta é encerrada na hora. O histórico é preservado.`}
          confirmLabel={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar' : 'Inativar'}
          onCancel={() => setMudandoStatus(null)}
          onConfirm={confirmarMudarStatus}
        />
      )}

      {managingEscolas && (
        <VinculosEscolaModal
          pessoa={managingEscolas}
          minhasEscolas={minhasEscolas}
          onClose={() => { setManagingEscolas(null); carregar(); }}
        />
      )}
    </div>
  );
};

// --- Auxiliares (vínculo real com escola e turma, backend) --------------------------------------
// Auxiliar agora tem VinculoEscolar igual Professor (ver vinculosEscolares.ts) — mas continua sem
// um fluxo de "cadastrar por e-mail" (não foi pedido criar contas novas de Auxiliar por aqui), por
// isso a listagem abaixo não é escopada por escola: precisa mostrar TODO Auxiliar ativo da rede,
// mesmo sem nenhum vínculo ainda, para que dê pra atribuir a ele a primeira escola. O que É
// escopado é a lista `escolas` de cada um (nunca mostra vínculos fora do escopo de quem está
// vendo) e as turmas oferecidas no vínculo pedagógico, restritas às escolas do próprio Auxiliar
// (minhasEscolas, mesmo endpoint já usado por ProfessoresReaisManager).
const VinculosTurmaAuxiliarModal = ({ auxiliar, turmasPermitidas, onClose }) => {
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  // Mesmo cuidado de VinculosPedagogicosProfessorModal: escola escolhida primeiro, pra evitar
  // vincular na turma "6M1" errada quando o Auxiliar tem mais de uma escola.
  const [escolaId, setEscolaId] = useState(auxiliar.escolas[0]?.id ?? '');
  const turmasDaEscolaSelecionada = turmasPermitidas.filter(turma => turma.escolaId === Number(escolaId));
  const [turmaId, setTurmaId] = useState(turmasDaEscolaSelecionada[0]?.id ?? '');
  const [ocupanteDaTurma, setOcupanteDaTurma] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroForm, setErroForm] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setVinculos(await listarVinculosAuxiliarTurma({ auxiliarId: auxiliar.id }));
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!turmaId) { setOcupanteDaTurma(null); return; }
    listarVinculosAuxiliarTurma({ turmaId }).then(lista => setOcupanteDaTurma(lista.find(item => item.status === 'ATIVO') || null)).catch(() => setOcupanteDaTurma(null));
  }, [turmaId]);

  const vinculosAtivos = vinculos.filter(item => item.status === 'ATIVO').sort((a, b) => a.turmaNome.localeCompare(b.turmaNome));
  const historico = vinculos.filter(item => item.status === 'ENCERRADO').sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
  const conflitoComOutro = ocupanteDaTurma && ocupanteDaTurma.auxiliarId !== auxiliar.id ? ocupanteDaTurma : null;

  const vincular = async (event) => {
    event.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      await criarVinculoAuxiliarTurma({ turmaId: Number(turmaId), auxiliarId: auxiliar.id });
      setMensagem('Vínculo criado com sucesso.');
      await carregar();
    } catch (error) {
      setErroForm(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const encerrar = async (vinculo) => {
    try {
      await encerrarVinculoAuxiliarTurma(vinculo.id);
      setMensagem('Vínculo encerrado com sucesso.');
      await carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  return (
    <Modal title={`Turmas — ${auxiliar.nome}`} onClose={onClose}>
      <div className="space-y-5">
        {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar os vínculos: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Turmas ativas</p>
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : vinculosAtivos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma turma vinculada no momento.</p>
          ) : (
            <div className="space-y-2">
              {vinculosAtivos.map(vinculo => (
                <div key={vinculo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{vinculo.turmaNome}</p>
                    <p className="text-xs text-slate-500">desde {formatDataReal(vinculo.dataInicio)}</p>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => encerrar(vinculo)}>Encerrar</Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {turmasPermitidas.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Não há turmas ativas nas escolas que você administra.
          </p>
        ) : (
          <form onSubmit={vincular} className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700">Vincular a uma turma</p>
            {erroForm && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erroForm}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Escola">
                <select
                  className={inputClass}
                  value={escolaId}
                  onChange={event => {
                    const novoEscolaId = Number(event.target.value);
                    const primeiraTurma = turmasPermitidas.find(turma => turma.escolaId === novoEscolaId);
                    setEscolaId(novoEscolaId);
                    setTurmaId(primeiraTurma?.id ?? '');
                  }}
                >
                  {auxiliar.escolas.map(escola => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Turma">
                <select className={inputClass} value={turmaId} onChange={event => setTurmaId(event.target.value)}>
                  <option value="" disabled>{turmasDaEscolaSelecionada.length === 0 ? 'Nenhuma turma nesta escola' : 'Selecione'}</option>
                  {turmasDaEscolaSelecionada.map(turma => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
                </select>
              </FormField>
            </div>
            {conflitoComOutro && (
              <p className="text-xs font-semibold text-amber-700">
                Esta turma já tem um Auxiliar ativo — vincular aqui encerra o vínculo dele automaticamente.
              </p>
            )}
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={salvando || !turmaId}>{salvando ? 'Salvando...' : 'Vincular'}</Button></div>
          </form>
        )}

        {historico.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Histórico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead><tr className="text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2 pr-4">Turma</th><th className="pb-2 pr-4">Início</th><th className="pb-2">Fim</th></tr></thead>
                <tbody>
                  {historico.map(item => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{item.turmaNome}</td>
                      <td className="py-2 pr-4">{formatDataReal(item.dataInicio)}</td>
                      <td className="py-2">{formatDataReal(item.dataFim)}</td>
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

const AuxiliaresReaisManager = ({ user }) => {
  const { turmas } = useData();
  const [auxiliares, setAuxiliares] = useState([]);
  const [minhasEscolas, setMinhasEscolas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [managingTurmas, setManagingTurmas] = useState(null);
  const [managingEscolas, setManagingEscolas] = useState(null);

  // Cadastro (criar a Pessoa de verdade) é restrito à Secretaria — mais restrito que o resto
  // desta tela (gerenciar vínculos de Escolas/Turmas continua liberado pra Diretora também).
  const [form, setForm] = useState(null);
  const [buscaEscolaCadastro, setBuscaEscolaCadastro] = useState('');
  const [formError, setFormError] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultadoCriacao, setResultadoCriacao] = useState(null);
  const [resetando, setResetando] = useState(null);
  const [mudandoStatus, setMudandoStatus] = useState(null);
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaAuxiliares, listaEscolas] = await Promise.all([listarAuxiliaresReais(), apiFetch('/api/pessoas/minhas-escolas')]);
      setAuxiliares(listaAuxiliares);
      setMinhasEscolas(listaEscolas);
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirCadastro = () => { setFormError(''); setForm({ nome: '', email: '', escolaIds: [] }); setBuscaEscolaCadastro(''); };
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
      const resultado = await apiFetch('/api/pessoas/auxiliares', {
        method: 'POST',
        body: { nome: form.nome || undefined, email: form.email, escolaIds: form.escolaIds },
      });
      fecharCadastro();
      await carregar();
      setResultadoCriacao(resultado);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarResetarSenha = async () => {
    const alvo = resetando;
    try {
      const resultado = await apiFetch(`/api/pessoas/auxiliares/${alvo.id}/resetar-senha`, { method: 'POST' });
      setResetando(null);
      setResultadoCriacao({ pessoa: alvo, senhaTemporaria: resultado.senhaTemporaria });
    } catch (error) {
      setResetando(null);
      setMensagem(error.message);
    }
  };

  const confirmarMudarStatus = async () => {
    const { pessoa, novoStatus } = mudandoStatus;
    try {
      await apiFetch(`/api/pessoas/auxiliares/${pessoa.id}/${novoStatus === 'ATIVO' ? 'reativar' : 'inativar'}`, { method: 'POST' });
      setMudandoStatus(null);
      setMensagem(novoStatus === 'ATIVO' ? `${pessoa.nome} reativado(a) com sucesso.` : `${pessoa.nome} inativado(a) com sucesso.`);
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
        <Button size="sm" variant="outline" onClick={() => setManagingEscolas(row)}>Escolas</Button>
        <Button size="sm" variant="outline" onClick={() => setManagingTurmas(row)}>Turmas</Button>
        {isSecretaria(user) && (
          <ActionMenu items={[
            { label: 'Gerar nova senha temporária', onClick: () => setResetando(row) },
            row.status === 'ATIVO'
              ? { label: 'Inativar', variant: 'danger', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'INATIVO' }) }
              : { label: 'Reativar', onClick: () => setMudandoStatus({ pessoa: row, novoStatus: 'ATIVO' }) },
          ]} />
        )}
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <p className="max-w-2xl text-sm text-slate-600">Vínculo de Auxiliares de Aprendizagem com escolas e turmas. Um Auxiliar só pode ser vinculado a uma turma se já tiver vínculo ativo com a escola dela.</p>
        {isSecretaria(user) && <Button onClick={abrirCadastro} disabled={carregando}>+ Cadastrar auxiliar</Button>}
      </div>

      {mensagem && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{mensagem}</div>}

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <span>Não foi possível carregar os auxiliares: {erro}</span>
          <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
        </div>
      )}

      {carregando ? (
        <Card><p className="text-center text-slate-500">Carregando auxiliares...</p></Card>
      ) : auxiliares.length === 0 ? (
        !erro && <Card className="py-12 text-center"><p className="font-semibold text-slate-800">Nenhum Auxiliar ativo</p></Card>
      ) : (
        <DataTable columns={columns} rows={auxiliares} />
      )}

      {form && (
        <Modal title="Cadastrar auxiliar" onClose={fecharCadastro}>
          <form onSubmit={salvarCadastro} className="space-y-4">
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</div>}
            <FormField label="E-mail">
              <input className={inputClass} type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))} required />
            </FormField>
            <FormField label="Nome completo">
              <input className={inputClass} value={form.nome} onChange={event => setForm(prev => ({ ...prev, nome: event.target.value }))} />
              <p className="mt-1 text-xs text-slate-500">Se já existir uma conta com esse e-mail, o nome informado é ignorado — o auxiliar só será vinculado à(s) escola(s) selecionada(s).</p>
            </FormField>
            <FormField label="Escolas de vínculo">
              {minhasEscolas.length > 6 && (
                <input className={`${inputClass} mb-2`} value={buscaEscolaCadastro} onChange={event => setBuscaEscolaCadastro(event.target.value)} placeholder="Buscar escola..." />
              )}
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                {minhasEscolas.filter(escola => escola.nome.toLowerCase().includes(buscaEscolaCadastro.toLowerCase())).map(escola => (
                  <label key={escola.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.escolaIds.includes(escola.id)} onChange={() => toggleEscola(escola.id)} />
                    {escola.nome}
                  </label>
                ))}
              </div>
            </FormField>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fecharCadastro} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Cadastrar'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {resultadoCriacao && (
        <SenhaTemporariaModal
          pessoa={resultadoCriacao.pessoa}
          senha={resultadoCriacao.senhaTemporaria}
          mensagem={resultadoCriacao.mensagem}
          titulo="Auxiliar cadastrado(a) com sucesso"
          mensagemPadrao="Auxiliar vinculado(a) com sucesso."
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
          title={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar auxiliar' : 'Inativar auxiliar'}
          message={mudandoStatus.novoStatus === 'ATIVO'
            ? `Deseja reativar ${mudandoStatus.pessoa.nome}? O login volta a funcionar normalmente.`
            : `Deseja inativar ${mudandoStatus.pessoa.nome}? O login é bloqueado e qualquer sessão aberta é encerrada na hora. O histórico é preservado.`}
          confirmLabel={mudandoStatus.novoStatus === 'ATIVO' ? 'Reativar' : 'Inativar'}
          onCancel={() => setMudandoStatus(null)}
          onConfirm={confirmarMudarStatus}
        />
      )}

      {managingEscolas && (
        <VinculosEscolaModal
          pessoa={managingEscolas}
          minhasEscolas={minhasEscolas}
          onClose={() => { setManagingEscolas(null); carregar(); }}
        />
      )}

      {managingTurmas && (
        <VinculosTurmaAuxiliarModal
          auxiliar={managingTurmas}
          turmasPermitidas={turmas.filter(turma => turma.status === 'ativa' && managingTurmas.escolas.some(escola => escola.id === turma.escolaId))}
          onClose={() => setManagingTurmas(null)}
        />
      )}
    </div>
  );
};

export const GestaoPessoas = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('professores');

  if (!canManageProfessores(user)) return <Navigate to="/dashboard" replace />;
  // Supervisores(as)/Diretores(as) continuam exclusivos da Secretaria — a Diretora só enxerga a
  // aba Professores(as), mesmo passando na checagem acima.
  const podeGerenciarPessoasAmplo = canManagePessoas(user);

  const tabs = podeGerenciarPessoasAmplo
    ? [
      { key: 'professores', label: 'Professores(as)' },
      { key: 'auxiliares', label: 'Auxiliares' },
      { key: 'supervisores', label: 'Supervisores(as)' },
      { key: 'diretores', label: 'Diretores(as)' },
    ]
    : [
      { key: 'professores', label: 'Professores(as)' },
      { key: 'auxiliares', label: 'Auxiliares' },
    ];

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

        {tab === 'auxiliares' && <AuxiliaresReaisManager user={user} />}

        {tab === 'supervisores' && podeGerenciarPessoasAmplo && <GestoresReaisManager />}

        {tab === 'diretores' && podeGerenciarPessoasAmplo && <DiretorasReaisManager />}
      </div>
    </MainLayout>
  );
};

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getAuthToken } from '../services/api';
import { listarDisciplinas } from '../services/disciplinas';
import { criarTurma as criarTurmaApi, editarTurma, inativarTurmaApi, listarTurmas, reativarTurmaApi } from '../services/turmas';
import { arquivarPdiAlunoReal, criarPdiAlunoReal, editarPdiAlunoReal, listarMeusAlunosAuxiliarReais, listarPdiAlunos, obterPdiAluno, reativarPdiAlunoReal } from '../services/pdiAlunos';
import {
  criarPdiModeloPerguntaReal, criarPdiModeloReal, editarPdiModeloPerguntaReal, excluirPdiModeloReal, inativarPdiModeloReal,
  inativarPdiPerguntaReal, listarPdiModelosReais, reativarPdiModeloReal, reativarPdiPerguntaReal,
  reordenarPdiModeloPerguntasReais,
} from '../services/pdiModelos';
import {
  criarPdiAplicacaoReal, criarReaberturaPdiReal, editarPdiAplicacaoReal, listarPdiAplicacoesReais,
  listarReaberturasPdiReais, obterSnapshotPdiAplicacaoReal,
} from '../services/pdiAplicacoes';
import { concluirFichaReal, listarFichasPdiReais, listarMeusPdisReais, obterFichaReal, obterOuCriarFichaReal, salvarRespostasFichaReal } from '../services/pdiFichas';
import {
  concluirAnamneseReal, criarAnamnesePerguntaReal, editarAnamnesePerguntaReal, iniciarAnamneseReal,
  inativarAnamnesePerguntaReal, listarAnamneseModelosReais, listarAnamnesesPendentesReal, obterAnamneseModeloReal, obterAnamneseReal,
  obterHistoricoAnamneseReal, reativarAnamnesePerguntaReal, reordenarAnamnesePerguntasReais, salvarAnamneseReal,
} from '../services/anamnese';
import {
  auxiliares as auxiliaresIniciais,
  correcoesSimulados as correcoesIniciais,
  disciplinas,
  eventosPedagogicos as eventosIniciais,
  formulariosPrazos,
  diretores as diretoresIniciais,
  formulariosUmTerco as formulariosIniciais,
  gestores as gestoresIniciais,
  mensagensIniciais,
  noticiasRede as noticiasIniciais,
  pdis as pdisIniciais,
  professores as professoresIniciais,
  secretarias as secretariasIniciais,
  trimestrePeriodsIniciais,
  turmaProfessores as turmaProfessoresIniciais,
  vinculosEscolares as vinculosEscolaresIniciais,
} from '../data/mockData';
import {
  pdiAcompanhamentosHistoricos as pdiAcompanhamentosIniciais,
  pdiAlunos as pdiAlunosIniciais,
  pdiAuxiliaresVinculos as pdiAuxiliaresVinculosIniciais,
  pdiAvaliacoesIniciais,
  pdiMetasDesenvolvimento,
  pdiPerguntasFormulario,
  pdiRespostasAcompanhamento,
} from '../data/pdiData';
import { pdiSummary } from '../utils/pdi';
import { canSendMessage } from '../utils/mensagens';
import { CURRENT_DATE } from '../utils/formAvailability';

const DataContext = createContext();

const completedStatuses = ['concluido', 'concluído'];
const pendingStatuses = ['pendente', 'em_andamento', 'em_atraso'];

const nextId = (items) => Math.max(0, ...items.map(item => Number(item.id))) + 1;

const daysLate = (date) => {
  const today = new Date(`${CURRENT_DATE}T12:00:00`);
  const due = new Date(`${date}T12:00:00`);
  return Math.max(1, Math.ceil((today - due) / (1000 * 60 * 60 * 24)));
};

const percentageComplete = (items) => {
  if (!items.length) return 0;
  const completed = items.filter(item => completedStatuses.includes(item.status)).length;
  return Math.round((completed / items.length) * 100);
};

export const DataProvider = ({ children }) => {
  const [formularios, setFormularios] = useState(formulariosIniciais);
  const [pdis, setPdis] = useState(pdisIniciais);
  const [correcoes, setCorrecoes] = useState(correcoesIniciais);
  const [eventos, setEventos] = useState(eventosIniciais);
  const [noticias, setNoticias] = useState(noticiasIniciais);
  const [pdiAlunos, setPdiAlunos] = useState(pdiAlunosIniciais);
  const [pdiAvaliacoes, setPdiAvaliacoes] = useState(pdiAvaliacoesIniciais);
  const [pdiMetas, setPdiMetas] = useState(pdiMetasDesenvolvimento);
  const [pdiAcompanhamentos, setPdiAcompanhamentos] = useState(pdiAcompanhamentosIniciais);
  const [pdiPerguntas, setPdiPerguntas] = useState(pdiPerguntasFormulario);
  const [pdiRespostas, setPdiRespostas] = useState(pdiRespostasAcompanhamento);
  const [pdiAuxiliaresVinculos] = useState(pdiAuxiliaresVinculosIniciais);
  const [trimestrePeriods, setTrimestrePeriods] = useState(trimestrePeriodsIniciais);
  const [formPeriods, setFormPeriods] = useState(formulariosPrazos);
  // Escolas é o piloto de integração real com o backend (Node/Express/Prisma/Neon) — todas as
  // outras coleções deste contexto continuam mockadas. Ver README do backend e o resumo da
  // integração para o raciocínio completo.
  const [escolas, setEscolas] = useState([]);
  const [escolasLoading, setEscolasLoading] = useState(true);
  const [escolasError, setEscolasError] = useState(null);
  const [vinculosEscolares, setVinculosEscolares] = useState(vinculosEscolaresIniciais);
  // Turmas é o segundo piloto de integração real com o backend (depois de Escolas) — igual lá,
  // sem optimistic update: só atualiza o estado local com o que o backend confirmou salvar. As
  // 544 turmas reais no Neon foram semeadas com os MESMOS ids que este array mock sempre teve
  // (ver backend/scripts/seed-turmas-reais.ts), então turmaProfessores/pdiAlunos/
  // pdiAuxiliaresVinculos abaixo (ainda 100% mock) continuam resolvendo corretamente pelos
  // mesmos turmaId de sempre — nenhuma outra tela precisou mudar por causa disso.
  const [turmas, setTurmas] = useState([]);
  const [turmasLoading, setTurmasLoading] = useState(true);
  const [turmasError, setTurmasError] = useState(null);
  const [turmaProfessores, setTurmaProfessores] = useState(turmaProfessoresIniciais);
  // Disciplinas reais (10 já cadastradas no Neon) — fonte nova para os próximos blocos
  // (Professor↔Turma↔Disciplina, Modelos PDI). O mock `disciplinas` (importado acima) continua
  // sendo quem alimenta o PDI por disciplina hoje; nada foi migrado para esta lista ainda.
  const [disciplinasReais, setDisciplinasReais] = useState([]);
  const [disciplinasReaisLoading, setDisciplinasReaisLoading] = useState(true);
  const [disciplinasReaisError, setDisciplinasReaisError] = useState(null);
  // Aluno PDI real (Neon) — fonte nova e PARALELA ao mock `pdiAlunos` abaixo. Os 26 alunos mock
  // foram migrados com os MESMOS ids (confirmado com o usuário), mas isso não torna as duas
  // fontes intercambiáveis: o real nunca tem professorId/escolaId solto/dataNascimento/
  // condicaoInformada/cid (proibido explicitamente — autorização e vínculos são sempre derivados
  // de turmaId). Só PdiPage.jsx e PdiAlunoPerfil.jsx usam `pdiAlunosReais`; todo o resto do PDI
  // (Anamnese, Meus Alunos do Auxiliar, Fichas/Respostas, Meus PDIs, Dashboards) continua 100%
  // no mock `pdiAlunos`, que seguimos sem tocar.
  const [pdiAlunosReais, setPdiAlunosReais] = useState([]);
  const [pdiAlunosReaisLoading, setPdiAlunosReaisLoading] = useState(true);
  const [pdiAlunosReaisError, setPdiAlunosReaisError] = useState(null);
  // Modelo/Pergunta PDI real — diferente de Turmas/Escolas/AlunoPdi, NÃO carrega automaticamente
  // no login (GET é Secretaria+Gestor apenas; todo o resto do app faria uma chamada 403 inútil).
  // Quem carrega é FormularioPdiPage.jsx, ao montar. `pdiModelos` (mock, abaixo) continua
  // alimentando todo o resto do PDI por disciplina ainda não migrado (Fichas/Respostas/Meus
  // PDIs). createPdiAplicacao usa `pdiModelosReais` (ver mais abaixo) — Aplicações continuam
  // mock, mas o snapshot de "quais modelos estão ativos agora" passa a vir do Neon.
  const [pdiModelosReais, setPdiModelosReais] = useState([]);
  const [pdiModelosReaisLoading, setPdiModelosReaisLoading] = useState(true);
  const [pdiModelosReaisError, setPdiModelosReaisError] = useState(null);
  // Aplicação/Reabertura PDI real — mesmo padrão de pdiModelosReais (carregado só por
  // FormularioPdiPage.jsx, nunca automaticamente no login). O mock `pdiAplicacoes` (abaixo)
  // continua intacto: PdiAlunoPerfil/DashboardProfessor/FormularioPdiProfessor/MeusPdisPage/
  // PdiHomePage ainda dependem dele (Fichas/Meus PDIs, próximo bloco).
  const [pdiAplicacoesReais, setPdiAplicacoesReais] = useState([]);
  const [pdiAplicacoesReaisLoading, setPdiAplicacoesReaisLoading] = useState(true);
  const [pdiAplicacoesReaisError, setPdiAplicacoesReaisError] = useState(null);
  const [professores, setProfessores] = useState(professoresIniciais);
  const [gestores, setGestores] = useState(gestoresIniciais);
  const [diretores, setDiretores] = useState(diretoresIniciais);
  // Sem CRUD de Auxiliares nesta etapa (só o vínculo com aluno é gerenciável) — lista fixa.
  const [auxiliares] = useState(auxiliaresIniciais);
  const [mensagens, setMensagens] = useState(mensagensIniciais);

  const createItem = (setter) => (payload) => {
    let created;
    setter(prev => {
      created = { ...payload, id: nextId(prev), atualizadoEm: 'agora' };
      return [created, ...prev];
    });
    return created;
  };

  const updateItem = (setter) => (id, payload) => {
    setter(prev => prev.map(item => item.id === Number(id) ? { ...item, ...payload, atualizadoEm: 'agora' } : item));
  };

  const deleteItem = (setter) => (id) => {
    setter(prev => prev.filter(item => item.id !== Number(id)));
  };

  const pdiAlunoNome = useCallback((alunoId) => pdiAlunos.find(aluno => aluno.id === alunoId)?.nome || 'Aluno', [pdiAlunos]);

  const pendencias = useMemo(() => {
    const formularioPendencias = formularios
      .filter(item => item.status === 'em_atraso')
      .map(item => ({
        id: `formulario-${item.id}`,
        origem: 'formulario',
        origemId: item.id,
        professorId: item.professorId,
        turmaId: item.turmaId,
        escolaId: item.escolaId,
        disciplinaId: item.disciplinaId,
        atividade: 'Formulário 1/3',
        prazo: item.prazo,
        diasAtraso: daysLate(item.prazo),
        status: item.status,
        descricao: item.conteudo,
      }));

    const pdiPendencias = pdis
      .filter(item => item.status === 'em_atraso')
      .map(item => ({
        id: `pdi-${item.id}`,
        origem: 'pdi',
        origemId: item.id,
        professorId: item.professorId,
        turmaId: item.turmaId,
        escolaId: item.escolaId,
        disciplinaId: null,
        atividade: 'PDI',
        prazo: item.prazo,
        diasAtraso: daysLate(item.prazo),
        status: item.status,
        descricao: `${pdiAlunoNome(item.alunoId)} - ${item.indicador}`,
      }));

    const correcaoPendencias = correcoes
      .filter(item => item.status === 'em_atraso')
      .map(item => ({
        id: `correcao-${item.id}`,
        origem: 'correcao',
        origemId: item.id,
        professorId: item.professorId,
        turmaId: item.turmaId,
        escolaId: item.escolaId,
        disciplinaId: item.disciplinaId,
        atividade: 'Correções dos simulados',
        prazo: item.prazoCorrecao,
        diasAtraso: daysLate(item.prazoCorrecao),
        status: item.status,
        descricao: item.simulado,
      }));

    return [...formularioPendencias, ...pdiPendencias, ...correcaoPendencias]
      .sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [formularios, pdis, correcoes, pdiAlunoNome]);

  const indicadores = useMemo(() => ({
    formulario: percentageComplete(formularios),
    pdi: percentageComplete(pdis),
    correcoes: percentageComplete(correcoes),
    totalProfessores: professores.length,
    professoresComPendencias: new Set(pendencias.map(item => item.professorId)).size,
  }), [formularios, pdis, correcoes, pendencias]);

  const atividadesRecentes = useMemo(() => {
    const fromFormularios = formularios.slice(0, 4).map(item => ({
      id: `formulario-${item.id}`,
      professorId: item.professorId,
      escolaId: item.escolaId,
      texto: 'enviou o Formulário 1/3',
      tempo: `há ${item.atualizadoEm}`,
    }));
    const fromPdis = pdis.slice(0, 4).map(item => ({
      id: `pdi-${item.id}`,
      professorId: item.professorId,
      escolaId: item.escolaId,
      texto: `atualizou um PDI de ${pdiAlunoNome(item.alunoId)}`,
      tempo: `há ${item.atualizadoEm}`,
    }));
    const fromCorrecoes = correcoes.slice(0, 4).map(item => ({
      id: `correcao-${item.id}`,
      professorId: item.professorId,
      escolaId: item.escolaId,
      texto: 'registrou correções dos simulados',
      tempo: `há ${item.atualizadoEm}`,
    }));

    return [...fromFormularios, ...fromPdis, ...fromCorrecoes].slice(0, 8);
  }, [formularios, pdis, correcoes, pdiAlunoNome]);

  const proximosEventos = useMemo(() => {
    const today = new Date(`${CURRENT_DATE}T12:00:00`);
    return eventos
      .filter(evento => new Date(`${evento.data}T12:00:00`) >= today)
      .sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [eventos]);

  const resumoPdi = useMemo(
    () => pdiSummary(pdiAlunos, pdiMetas, pdiRespostas.filter(resposta => Number.isFinite(Number(resposta.resposta)))),
    [pdiAlunos, pdiMetas, pdiRespostas]
  );

  const archivePdiAluno = (id) => {
    setPdiAlunos(prev => prev.map(aluno => aluno.id === Number(id) ? { ...aluno, status: 'arquivado' } : aluno));
  };

  // Toda pergunta criada pela tela da Secretaria é sempre 'personalizada' — perguntas padrão
  // vêm só do seed (ver src/utils/pdiIndicadores.js), nunca são criadas pela interface.
  const createPdiPergunta = (payload) => createItem(setPdiPerguntas)({ ...payload, origem: 'personalizada', indicador: null });

  // Em perguntas padrão, só redação (`pergunta`) e `status` podem ser alterados — indicador,
  // tipoResposta, opções e complementar ficam protegidos para não quebrar a identidade
  // analítica que sustenta a série histórica (ver seção 24 do pedido). Personalizadas seguem
  // totalmente editáveis.
  const updatePdiPergunta = (id, payload) => {
    setPdiPerguntas(prev => prev.map(item => {
      if (item.id !== Number(id)) return item;
      if (item.origem === 'personalizada') return { ...item, ...payload, atualizadoEm: 'agora' };
      const { pergunta, status, ordem } = payload;
      return {
        ...item,
        ...(pergunta !== undefined ? { pergunta } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(ordem !== undefined ? { ordem } : {}),
        atualizadoEm: 'agora',
      };
    }));
  };

  // Perguntas padrão (origem 'estruturada'/'qualitativa'/'habilidade') sustentam a série
  // histórica e a Análise de Desenvolvimento — nunca são excluídas, só desativadas via
  // updatePdiPergunta({status:'inativa'}). Só perguntas 'personalizada' podem ser excluídas.
  const deletePdiPergunta = (id) => {
    setPdiPerguntas(prev => {
      const pergunta = prev.find(item => item.id === Number(id));
      if (pergunta && pergunta.origem !== 'personalizada') return prev;
      return prev.filter(item => item.id !== Number(id));
    });
  };

  // --- PDI por disciplina: modelos -----------------------------------------------------------
  // Toda pergunta é igualmente editável/removível, inclusive as que vieram prontas no modelo —
  // --- Modelo/Pergunta PDI real (piloto igual Turmas/Escolas/AlunoPdi) -----------------------
  const loadPdiModelosReais = useCallback(async () => {
    setPdiModelosReaisLoading(true);
    setPdiModelosReaisError(null);
    try {
      setPdiModelosReais(await listarPdiModelosReais());
    } catch (error) {
      setPdiModelosReaisError(error.message);
    } finally {
      setPdiModelosReaisLoading(false);
    }
  }, []);

  const createPdiModeloReal = async (payload) => {
    try {
      const modelo = await criarPdiModeloReal(payload);
      setPdiModelosReais(prev => [...prev, modelo]);
      return { ok: true, modelo };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const mudarStatusPdiModeloReal = async (id, ativar) => {
    try {
      const modelo = await (ativar ? reativarPdiModeloReal(id) : inativarPdiModeloReal(id));
      setPdiModelosReais(prev => prev.map(item => (item.id === Number(id) ? { ...item, ...modelo, perguntas: item.perguntas } : item)));
      return { ok: true, modelo };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  const inativarPdiModelo = (id) => mudarStatusPdiModeloReal(id, false);
  const reativarPdiModeloReaisFn = (id) => mudarStatusPdiModeloReal(id, true);

  // "Excluir" na UI: o backend decide se apaga fisicamente (nunca usado) ou arquiva (já usado em
  // Aplicação) — nunca confiamos nisso no frontend, só refletimos o resultado que veio pronto.
  const excluirPdiModelo = async (id) => {
    try {
      const resultado = await excluirPdiModeloReal(id);
      if (resultado.removidoFisicamente) {
        setPdiModelosReais(prev => prev.filter(item => item.id !== Number(id)));
      } else {
        setPdiModelosReais(prev => prev.map(item => (item.id === Number(id) ? { ...item, status: 'inativa' } : item)));
      }
      return { ok: true, ...resultado };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const atualizarPerguntaNoModelo = (modeloId, pergunta) => {
    setPdiModelosReais(prev => prev.map(modelo => (modelo.id === Number(modeloId)
      ? { ...modelo, perguntas: [...(modelo.perguntas || []).filter(item => item.id !== pergunta.id), pergunta] }
      : modelo)));
  };

  const createPdiModeloPerguntaRealFn = async (modeloId, payload) => {
    try {
      const pergunta = await criarPdiModeloPerguntaReal(modeloId, payload);
      atualizarPerguntaNoModelo(modeloId, pergunta);
      return { ok: true, pergunta };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const updatePdiModeloPerguntaRealFn = async (modeloId, perguntaId, payload) => {
    try {
      const pergunta = await editarPdiModeloPerguntaReal(perguntaId, payload);
      atualizarPerguntaNoModelo(modeloId, pergunta);
      return { ok: true, pergunta };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const mudarStatusPdiPerguntaReal = async (modeloId, perguntaId, ativar) => {
    try {
      const pergunta = await (ativar ? reativarPdiPerguntaReal(perguntaId) : inativarPdiPerguntaReal(perguntaId));
      atualizarPerguntaNoModelo(modeloId, pergunta);
      return { ok: true, pergunta };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const reorderPdiModeloPerguntaReal = async (modeloId, ordens) => {
    try {
      const perguntas = await reordenarPdiModeloPerguntasReais(modeloId, ordens);
      setPdiModelosReais(prev => prev.map(modelo => (modelo.id === Number(modeloId) ? { ...modelo, perguntas } : modelo)));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // --- Aplicação/Reabertura PDI real (piloto igual Modelo/Pergunta PDI) ----------------------
  const loadPdiAplicacoesReais = useCallback(async () => {
    setPdiAplicacoesReaisLoading(true);
    setPdiAplicacoesReaisError(null);
    try {
      setPdiAplicacoesReais(await listarPdiAplicacoesReais());
    } catch (error) {
      setPdiAplicacoesReaisError(error.message);
    } finally {
      setPdiAplicacoesReaisLoading(false);
    }
  }, []);

  const createPdiAplicacaoReal = async (payload) => {
    try {
      const aplicacao = await criarPdiAplicacaoReal(payload);
      setPdiAplicacoesReais(prev => [aplicacao, ...prev]);
      return { ok: true, aplicacao };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const updatePdiAplicacaoReal = async (id, payload) => {
    try {
      const aplicacao = await editarPdiAplicacaoReal(id, payload);
      setPdiAplicacoesReais(prev => prev.map(item => (item.id === Number(id) ? aplicacao : item)));
      return { ok: true, aplicacao };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Snapshot completo (com perguntas) não é mantido em estado global — é consultado sob demanda
  // pela tela, só quando a Secretaria realmente abre os detalhes de uma aplicação específica.
  const obterSnapshotPdiAplicacao = async (id) => {
    try {
      return { ok: true, modelos: await obterSnapshotPdiAplicacaoReal(id) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const listarReaberturasPdiAplicacao = async (aplicacaoId) => {
    try {
      return { ok: true, reaberturas: await listarReaberturasPdiReais(aplicacaoId) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const criarReaberturaPdiAplicacao = async (aplicacaoId, payload) => {
    try {
      return { ok: true, reabertura: await criarReaberturaPdiReal(aplicacaoId, payload) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // --- Ficha/Resposta PDI real (criação sob demanda — ver FormularioPdiProfessor.jsx) --------
  // Sem estado de lista global aqui de propósito: cada tela lida com UMA ficha por vez (a
  // identidade aplicação+aluno+disciplina já vem da própria URL/parâmetros).
  const obterOuCriarFichaPdi = async (payload) => {
    try {
      return { ok: true, ...(await obterOuCriarFichaReal(payload)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const obterFichaPdi = async (aplicacaoId, alunoId, disciplinaId) => {
    try {
      return { ok: true, ...(await obterFichaReal(aplicacaoId, alunoId, disciplinaId)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const salvarRespostasFichaPdi = async (fichaId, respostas) => {
    try {
      return { ok: true, ...(await salvarRespostasFichaReal(fichaId, respostas)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const concluirFichaPdi = async (fichaId) => {
    try {
      return { ok: true, ...(await concluirFichaReal(fichaId)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Consulta de Fichas já existentes (nunca cria) — usada pelo perfil do aluno (Diretora/Auxiliar/
  // Gestor/Secretaria) pra montar o resumo de PDI por disciplina sem passar por obter-ou-criar.
  const listarFichasPdi = async (filtros) => {
    try {
      return { ok: true, fichas: await listarFichasPdiReais(filtros) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Meus PDIs (Professor) — lista TODAS as combinações operacionalmente disponíveis, com ou sem
  // Ficha ainda criada (ver GET /api/pdi-fichas/meus-pdis). Carregado só sob demanda pela própria
  // tela, mesmo padrão de pdiAplicacoesReais/pdiModelosReais.
  const [meusPdisReais, setMeusPdisReais] = useState([]);
  const [meusPdisReaisLoading, setMeusPdisReaisLoading] = useState(true);
  const [meusPdisReaisError, setMeusPdisReaisError] = useState(null);
  const loadMeusPdisReais = useCallback(async () => {
    setMeusPdisReaisLoading(true);
    setMeusPdisReaisError(null);
    try {
      setMeusPdisReais(await listarMeusPdisReais());
    } catch (error) {
      setMeusPdisReaisError(error.message);
    } finally {
      setMeusPdisReaisLoading(false);
    }
  }, []);

  // --- Anamnese real (entidades próprias, ver domain/anamnese.ts no backend) -----------------
  // Modelo/Pergunta: mesmo padrão de pdiModelosReais (carregado só sob demanda pela tela de
  // administração da Secretaria).
  const [anamneseModelosReais, setAnamneseModelosReais] = useState([]);
  const [anamneseModelosReaisLoading, setAnamneseModelosReaisLoading] = useState(true);
  const [anamneseModelosReaisError, setAnamneseModelosReaisError] = useState(null);
  const loadAnamneseModelosReais = useCallback(async () => {
    setAnamneseModelosReaisLoading(true);
    setAnamneseModelosReaisError(null);
    try {
      setAnamneseModelosReais(await listarAnamneseModelosReais());
    } catch (error) {
      setAnamneseModelosReaisError(error.message);
    } finally {
      setAnamneseModelosReaisLoading(false);
    }
  }, []);

  // Busca sempre o Modelo ATIVO (primeira posição, já que a listagem vem ordenada por versão
  // desc) com as perguntas completas — usado pela tela de administração ao abrir o construtor.
  const obterAnamneseModeloAtivo = async () => {
    try {
      const modelos = await listarAnamneseModelosReais();
      const ativo = modelos.find((m) => m.status === 'ativa');
      if (!ativo) return { ok: false, error: 'Nenhum Modelo de Anamnese ativo encontrado.' };
      return { ok: true, modelo: await obterAnamneseModeloReal(ativo.id) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const criarAnamnesePergunta = async (payload) => {
    try {
      return { ok: true, pergunta: await criarAnamnesePerguntaReal(payload) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const editarAnamnesePergunta = async (perguntaId, payload) => {
    try {
      return { ok: true, pergunta: await editarAnamnesePerguntaReal(perguntaId, payload) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const mudarStatusAnamnesePergunta = async (id, ativar) => {
    try {
      return { ok: true, pergunta: await (ativar ? reativarAnamnesePerguntaReal(id) : inativarAnamnesePerguntaReal(id)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const reordenarAnamnesePerguntas = async (ordens) => {
    try {
      return { ok: true, perguntas: await reordenarAnamnesePerguntasReais(ordens) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Anamnese do aluno (histórico + versão atual) — sem estado de lista global, cada perfil de
  // aluno lida com UM histórico por vez (mesmo padrão de Ficha PDI).
  const obterHistoricoAnamnese = async (alunoId) => {
    try {
      return { ok: true, ...(await obterHistoricoAnamneseReal(alunoId)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const obterAnamnese = async (id) => {
    try {
      return { ok: true, ...(await obterAnamneseReal(id)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const listarAnamnesesPendentes = async (escolaId) => {
    try {
      return { ok: true, alunos: await listarAnamnesesPendentesReal(escolaId) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const iniciarAnamnese = async (alunoId) => {
    try {
      return { ok: true, ...(await iniciarAnamneseReal(alunoId)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const salvarAnamnese = async (id, payload) => {
    try {
      return { ok: true, ...(await salvarAnamneseReal(id, payload)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const concluirAnamnese = async (id) => {
    try {
      return { ok: true, ...(await concluirAnamneseReal(id)) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };


  // --- Gestão de Turmas (piloto de integração real com o backend, igual Escolas) -----------
  // Turma nunca é excluída fisicamente: tem `status` ('ativa'/'inativa'), preservando o registro
  // e todos os relacionamentos que apontam para o mesmo `id` (turmaProfessores.turmaId,
  // pdiAlunos.turmaId, pdiAuxiliaresVinculos.turmaId — ver utils/turmas.js). Nome de exibição e
  // detecção de conflito de identidade agora são responsabilidade do backend (ver
  // backend/src/domain/turma.ts) — o frontend só repassa o erro que ele devolver.
  const loadTurmas = useCallback(async () => {
    setTurmasLoading(true);
    setTurmasError(null);
    try {
      setTurmas(await listarTurmas());
    } catch (error) {
      setTurmasError(error.message);
    } finally {
      setTurmasLoading(false);
    }
  }, []);

  const createTurma = async (payload) => {
    try {
      const turma = await criarTurmaApi(payload);
      setTurmas(prev => [...prev, turma]);
      return { ok: true, turma };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const updateTurma = async (id, payload) => {
    try {
      const turma = await editarTurma(id, payload);
      setTurmas(prev => prev.map(item => (item.id === Number(id) ? turma : item)));
      return { ok: true, turma };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Inativar/reativar só muda `status` — nunca apaga a turma nem cascateia para nenhum vínculo
  // (professor, aluno PDI ou Auxiliar continuam exatamente como estavam, pois são mock e nem
  // sabem que a turma agora é real).
  const inativarTurma = async (id) => {
    try {
      const turma = await inativarTurmaApi(id);
      setTurmas(prev => prev.map(item => (item.id === Number(id) ? turma : item)));
      return { ok: true, turma };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const reativarTurma = async (id) => {
    try {
      const turma = await reativarTurmaApi(id);
      setTurmas(prev => prev.map(item => (item.id === Number(id) ? turma : item)));
      return { ok: true, turma };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const loadDisciplinasReais = useCallback(async () => {
    setDisciplinasReaisLoading(true);
    setDisciplinasReaisError(null);
    try {
      setDisciplinasReais(await listarDisciplinas());
    } catch (error) {
      setDisciplinasReaisError(error.message);
    } finally {
      setDisciplinasReaisLoading(false);
    }
  }, []);

  // --- Aluno PDI real (piloto igual Escolas/Turmas) ----------------------------------------
  const loadPdiAlunosReais = useCallback(async () => {
    setPdiAlunosReaisLoading(true);
    setPdiAlunosReaisError(null);
    try {
      setPdiAlunosReais(await listarPdiAlunos());
    } catch (error) {
      setPdiAlunosReaisError(error.message);
    } finally {
      setPdiAlunosReaisLoading(false);
    }
  }, []);

  const createPdiAlunoReal = async (payload) => {
    try {
      const aluno = await criarPdiAlunoReal(payload);
      setPdiAlunosReais(prev => [...prev, aluno]);
      return { ok: true, aluno };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const updatePdiAlunoReal = async (id, payload) => {
    try {
      const aluno = await editarPdiAlunoReal(id, payload);
      setPdiAlunosReais(prev => prev.map(item => (item.id === Number(id) ? aluno : item)));
      return { ok: true, aluno };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const arquivarPdiAluno = async (id) => {
    try {
      const aluno = await arquivarPdiAlunoReal(id);
      setPdiAlunosReais(prev => prev.map(item => (item.id === Number(id) ? aluno : item)));
      return { ok: true, aluno };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const reativarPdiAluno = async (id) => {
    try {
      const aluno = await reativarPdiAlunoReal(id);
      setPdiAlunosReais(prev => prev.map(item => (item.id === Number(id) ? aluno : item)));
      return { ok: true, aluno };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Busca um único Aluno PDI real por id, sem depender da listagem geral (que o Auxiliar não pode
  // chamar — ver GET /api/pdi-alunos exigirLeitura). Usado por AuxiliarAlunoPerfilPage.jsx.
  const obterPdiAlunoReal = async (id) => {
    try {
      return { ok: true, aluno: await obterPdiAluno(id) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // Meus Alunos (Auxiliar) — VinculoEscolar ATIVO → AuxiliarTurma ATIVO → Turma ATIVA → AlunoPdi
  // ATIVO, unificado entre escolas (ver GET /api/pdi-alunos/meus-alunos). Carregado só sob demanda
  // pela própria tela do Auxiliar.
  const [meusAlunosAuxiliarReais, setMeusAlunosAuxiliarReais] = useState([]);
  const [meusAlunosAuxiliarReaisLoading, setMeusAlunosAuxiliarReaisLoading] = useState(true);
  const [meusAlunosAuxiliarReaisError, setMeusAlunosAuxiliarReaisError] = useState(null);
  const loadMeusAlunosAuxiliarReais = useCallback(async () => {
    setMeusAlunosAuxiliarReaisLoading(true);
    setMeusAlunosAuxiliarReaisError(null);
    try {
      setMeusAlunosAuxiliarReais(await listarMeusAlunosAuxiliarReais());
    } catch (error) {
      setMeusAlunosAuxiliarReaisError(error.message);
    } finally {
      setMeusAlunosAuxiliarReaisLoading(false);
    }
  }, []);

  // Vincula um professor a uma disciplina numa turma. No máximo um vínculo ATIVO por
  // (turmaId, disciplinaId) — se já existir outro professor ativo ali, ele é encerrado
  // (dataFim = novo dataInicio, status 'encerrado') em vez de sobrescrito, preservando o
  // histórico de quem lecionou o quê e até quando (mesmo padrão do vínculo Auxiliar<->Turma).
  // Um mesmo professor pode ter vários vínculos ativos ao mesmo tempo (turmas/disciplinas
  // diferentes) — isso nunca foi restringido.
  const vincularProfessorTurma = (turmaId, professorId, disciplinaId, dataInicio) => {
    setTurmaProfessores(prev => {
      const encerrados = prev.map(item => (
        item.turmaId === Number(turmaId) && item.disciplinaId === Number(disciplinaId) && item.status === 'ativo'
          ? { ...item, dataFim: dataInicio, status: 'encerrado' }
          : item
      ));
      return [...encerrados, { id: nextId(encerrados), turmaId: Number(turmaId), professorId: Number(professorId), disciplinaId: Number(disciplinaId), dataInicio, dataFim: null, status: 'ativo' }];
    });
  };

  // Encerra o vínculo sem criar substituto — a turma fica temporariamente sem professor daquela
  // disciplina (o professor imediatamente para de ver as fichas PDI dela, mas o que ele já
  // respondeu antes continua no histórico).
  const encerrarVinculoProfessorTurma = (vinculoId, dataFim) => {
    setTurmaProfessores(prev => prev.map(item => (
      item.id === Number(vinculoId) && item.status === 'ativo'
        ? { ...item, dataFim, status: 'encerrado' }
        : item
    )));
  };

  const updateTrimestrePeriod = (trimestre, payload) => {
    setTrimestrePeriods(prev => prev.map(item => item.trimestre === trimestre ? { ...item, ...payload } : item));
  };

  const updateFormPeriod = (id, payload) => {
    setFormPeriods(prev => prev.map(period => period.id === id ? { ...period, ...payload } : period));
  };

  // Atualiza a vigência da escola indicada. "Todas as escolas" só pode ser usado quando
  // o usuário escolheu explicitamente esse modo de lote; caso contrário, null não altera tudo.
  const updateFormPeriodForEscola = (id, escolaId, payload, options = {}) => {
    const { isExplicitBatchSelection = false } = options;
    if (escolaId === null && !isExplicitBatchSelection) return;
    setFormPeriods(prev => prev.map(period => {
      if (period.id !== id) return period;
      if (escolaId === null) return { ...period, ...payload };
      return period.escolaId === Number(escolaId) ? { ...period, ...payload } : period;
    }));
  };

  const updateFormPeriodsForEscolas = (id, escolaIds, payload) => {
    const selectedIds = new Set(escolaIds.map(Number));
    setFormPeriods(prev => prev.map(period => (
      period.id === id && selectedIds.has(Number(period.escolaId))
        ? { ...period, ...payload }
        : period
    )));
  };

  // Escolas que atualmente têm o PDI habilitado: existência de um formPeriod 'pdi' para a
  // escola (mesma fonte usada para a vigência). Ajustar a seleção adiciona/remove esse
  // registro, sem duplicar as perguntas — que permanecem únicas e compartilhadas.
  const setPdiEscolas = (escolaIds) => {
    const selectedIds = new Set(escolaIds.map(Number));
    setFormPeriods(prev => {
      const outrosFormularios = prev.filter(period => period.id !== 'pdi');
      const pdiAtual = prev.filter(period => period.id === 'pdi');
      const mantidos = pdiAtual.filter(period => selectedIds.has(Number(period.escolaId)));
      const existentes = new Set(mantidos.map(period => Number(period.escolaId)));
      const referencia = pdiAtual[0] || { startDate: CURRENT_DATE, endDate: CURRENT_DATE };
      const novos = [...selectedIds]
        .filter(escolaId => !existentes.has(escolaId))
        .map(escolaId => ({ id: 'pdi', escolaId, startDate: referencia.startDate, endDate: referencia.endDate }));
      return [...outrosFormularios, ...mantidos, ...novos];
    });
  };

  const criarMensagem = (payload, remetente) => {
    const messageData = { gestores, diretores, professores, secretarias: secretariasIniciais, vinculosEscolares };
    if (!canSendMessage(remetente, payload, messageData)) {
      throw new Error('Destinatário não permitido para este perfil ou escola.');
    }
    let created;
    setMensagens(prev => {
      created = { ...payload, id: nextId(prev), remetenteTipo: remetente.tipo, remetenteId: remetente.id, enviadaEm: new Date().toISOString(), lidaEm: null };
      return [created, ...prev];
    });
    return created;
  };

  const marcarMensagemComoLida = (id, leitor) => {
    setMensagens(prev => prev.map(mensagem => (
      mensagem.id === Number(id)
      && mensagem.destinatarioTipo === leitor.tipo
      && mensagem.destinatarioId === leitor.id
        ? { ...mensagem, lidaEm: mensagem.lidaEm || new Date().toISOString() }
        : mensagem
    )));
  };

  // Desvincular preserva o registro como histórico (status: 'removido'), em vez de removê-lo.
  const desvincularEscola = (id) => {
    setVinculosEscolares(prev => prev.map(vinculo => vinculo.id === Number(id) ? { ...vinculo, status: 'removido' } : vinculo));
  };

  // --- Escolas (piloto de integração real com o backend) ----------------------------------
  // O backend guarda status como 'ATIVA'/'INATIVA' (enum Postgres); todo o resto do frontend
  // (Badge, filtros, canAccessEscola em utils/escolas.js) já compara com 'ativa'/'inativa'
  // minúsculo. Normalizamos aqui, na fronteira, para não precisar mudar nada fora de Escolas.
  const normalizeEscola = (escola) => ({ ...escola, status: escola.status === 'ATIVA' ? 'ativa' : 'inativa' });

  const loadEscolas = useCallback(async () => {
    setEscolasLoading(true);
    setEscolasError(null);
    try {
      const data = await apiFetch('/api/escolas');
      setEscolas(data.map(normalizeEscola));
    } catch (error) {
      setEscolasError(error.message);
    } finally {
      setEscolasLoading(false);
    }
  }, []);

  // Sem token (ainda não logou) não há o que buscar — o AuthContext chama loadEscolas()/
  // loadTurmas()/loadDisciplinasReais()/loadPdiAlunosReais() logo depois de um login bem-sucedido.
  useEffect(() => {
    if (getAuthToken()) {
      loadEscolas();
      loadTurmas();
      loadDisciplinasReais();
      // GET /api/pdi-alunos é exclusivo de Secretaria/Gestor/Diretora (ver exigirLeitura em
      // pdiAlunos.ts) — Professor e Auxiliar sempre recebiam 403 aqui à toa. DataContext não tem
      // acesso ao AuthContext (é o contrário), por isso lê o perfil direto do localStorage, igual
      // getStoredUser() em AuthContext.jsx.
      let tipo = null;
      try { tipo = JSON.parse(localStorage.getItem('user'))?.tipo; } catch { /* ignora */ }
      if (['secretaria', 'gestor', 'diretora'].includes(tipo)) loadPdiAlunosReais();
      else setPdiAlunosReaisLoading(false);
    } else {
      setEscolasLoading(false);
      setTurmasLoading(false);
      setDisciplinasReaisLoading(false);
      setPdiAlunosReaisLoading(false);
    }
  }, [loadEscolas, loadTurmas, loadDisciplinasReais, loadPdiAlunosReais]);

  // Sem optimistic update neste piloto: só atualiza o estado local com o registro que o backend
  // efetivamente confirmou salvar. Em caso de erro, a lista atual permanece intacta.
  const createEscola = async (payload) => {
    try {
      const escola = normalizeEscola(await apiFetch('/api/escolas', { method: 'POST', body: { nome: payload.nome } }));
      setEscolas(prev => [...prev, escola]);
      return { ok: true, escola };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  // O backend só grava `nome` neste endpoint — mudança de status é feita à parte, pelos
  // endpoints dedicados de inativar/reativar (ver abaixo), nunca por aqui.
  const updateEscola = async (id, payload) => {
    try {
      const escola = normalizeEscola(await apiFetch(`/api/escolas/${id}`, { method: 'PUT', body: { nome: payload.nome } }));
      setEscolas(prev => prev.map(item => (item.id === Number(id) ? escola : item)));
      return { ok: true, escola };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const inativarEscola = async (id) => {
    try {
      const escola = normalizeEscola(await apiFetch(`/api/escolas/${id}/inativar`, { method: 'POST' }));
      setEscolas(prev => prev.map(item => (item.id === Number(id) ? escola : item)));
      return { ok: true, escola };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const reativarEscola = async (id) => {
    try {
      const escola = normalizeEscola(await apiFetch(`/api/escolas/${id}/reativar`, { method: 'POST' }));
      setEscolas(prev => prev.map(item => (item.id === Number(id) ? escola : item)));
      return { ok: true, escola };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const value = {
    professores,
    gestores,
    diretores,
    secretarias: secretariasIniciais,
    auxiliares,
    // `quantidadeAlunos` NÃO existe aqui de propósito — Turma real não guarda contagem de alunos
    // (não temos cadastro geral de alunos pra calcular isso de verdade), e usar `pdiAlunos.length`
    // como substituto já foi tentado e revertido: são coisas diferentes (total da turma vs.
    // quantos daquela turma têm PDI). Onde a UI precisava de "quantidade de alunos", ou foi
    // removido (legendas secundárias) ou virou "—"/indisponível (StatCards de rede — ver
    // resumoEscola em utils/escolas.js). Uma contagem real de matrícula fica pra quando existir
    // uma fonte de verdade de alunos.
    turmas,
    turmasLoading,
    turmasError,
    loadTurmas,
    createTurma,
    updateTurma,
    inativarTurma,
    reativarTurma,
    turmaProfessores,
    disciplinas,
    disciplinasReais,
    disciplinasReaisLoading,
    disciplinasReaisError,
    loadDisciplinasReais,
    pdiAlunosReais,
    pdiAlunosReaisLoading,
    pdiAlunosReaisError,
    loadPdiAlunosReais,
    createPdiAlunoReal,
    updatePdiAlunoReal,
    arquivarPdiAluno,
    reativarPdiAluno,
    obterPdiAlunoReal,
    meusAlunosAuxiliarReais,
    meusAlunosAuxiliarReaisLoading,
    meusAlunosAuxiliarReaisError,
    loadMeusAlunosAuxiliarReais,
    pdiModelosReais,
    pdiModelosReaisLoading,
    pdiModelosReaisError,
    loadPdiModelosReais,
    createPdiModeloReal,
    inativarPdiModelo,
    reativarPdiModeloReal: reativarPdiModeloReaisFn,
    excluirPdiModelo,
    createPdiModeloPerguntaReal: createPdiModeloPerguntaRealFn,
    updatePdiModeloPerguntaReal: updatePdiModeloPerguntaRealFn,
    inativarPdiPergunta: (modeloId, perguntaId) => mudarStatusPdiPerguntaReal(modeloId, perguntaId, false),
    reativarPdiPergunta: (modeloId, perguntaId) => mudarStatusPdiPerguntaReal(modeloId, perguntaId, true),
    reorderPdiModeloPerguntaReal,
    pdiAplicacoesReais,
    pdiAplicacoesReaisLoading,
    pdiAplicacoesReaisError,
    loadPdiAplicacoesReais,
    createPdiAplicacaoReal,
    updatePdiAplicacaoReal,
    obterSnapshotPdiAplicacao,
    listarReaberturasPdiAplicacao,
    criarReaberturaPdiAplicacao,
    obterOuCriarFichaPdi,
    obterFichaPdi,
    salvarRespostasFichaPdi,
    concluirFichaPdi,
    listarFichasPdi,
    meusPdisReais,
    meusPdisReaisLoading,
    meusPdisReaisError,
    loadMeusPdisReais,
    anamneseModelosReais,
    anamneseModelosReaisLoading,
    anamneseModelosReaisError,
    loadAnamneseModelosReais,
    obterAnamneseModeloAtivo,
    criarAnamnesePergunta,
    editarAnamnesePergunta,
    inativarAnamnesePergunta: (id) => mudarStatusAnamnesePergunta(id, false),
    reativarAnamnesePergunta: (id) => mudarStatusAnamnesePergunta(id, true),
    reordenarAnamnesePerguntas,
    obterHistoricoAnamnese,
    obterAnamnese,
    listarAnamnesesPendentes,
    iniciarAnamnese,
    salvarAnamnese,
    concluirAnamnese,
    escolas,
    escolasLoading,
    escolasError,
    loadEscolas,
    vinculosEscolares,
    formularios,
    pdis,
    correcoes,
    eventos,
    noticias,
    formPeriods,
    pdiAlunos,
    pdiAvaliacoes,
    pdiMetas,
    pdiAcompanhamentos,
    pdiPerguntas,
    pdiRespostas,
    pdiAuxiliaresVinculos,
    vincularProfessorTurma,
    encerrarVinculoProfessorTurma,
    trimestrePeriods,
    updateTrimestrePeriod,
    pendencias,
    indicadores,
    atividadesRecentes,
    proximosEventos,
    resumoPdi,
    mensagens,
    createFormulario: createItem(setFormularios),
    updateFormulario: updateItem(setFormularios),
    deleteFormulario: deleteItem(setFormularios),
    createPdi: createItem(setPdis),
    updatePdi: updateItem(setPdis),
    deletePdi: deleteItem(setPdis),
    createCorrecao: createItem(setCorrecoes),
    updateCorrecao: updateItem(setCorrecoes),
    deleteCorrecao: deleteItem(setCorrecoes),
    createEvento: createItem(setEventos),
    updateEvento: updateItem(setEventos),
    deleteEvento: deleteItem(setEventos),
    createNoticia: createItem(setNoticias),
    updateNoticia: updateItem(setNoticias),
    deleteNoticia: deleteItem(setNoticias),
    createPdiAluno: createItem(setPdiAlunos),
    updatePdiAluno: updateItem(setPdiAlunos),
    archivePdiAluno,
    createPdiAvaliacao: createItem(setPdiAvaliacoes),
    updatePdiAvaliacao: updateItem(setPdiAvaliacoes),
    deletePdiAvaliacao: deleteItem(setPdiAvaliacoes),
    createPdiMeta: createItem(setPdiMetas),
    updatePdiMeta: updateItem(setPdiMetas),
    deletePdiMeta: deleteItem(setPdiMetas),
    createPdiAcompanhamento: createItem(setPdiAcompanhamentos),
    updatePdiAcompanhamento: updateItem(setPdiAcompanhamentos),
    deletePdiAcompanhamento: deleteItem(setPdiAcompanhamentos),
    createPdiPergunta,
    updatePdiPergunta,
    deletePdiPergunta,
    createPdiResposta: createItem(setPdiRespostas),
    updatePdiResposta: updateItem(setPdiRespostas),
    deletePdiResposta: deleteItem(setPdiRespostas),
    updateFormPeriod,
    updateFormPeriodForEscola,
    updateFormPeriodsForEscolas,
    setPdiEscolas,
    createEscola,
    updateEscola,
    inativarEscola,
    reativarEscola,
    createVinculoEscolar: createItem(setVinculosEscolares),
    updateVinculoEscolar: updateItem(setVinculosEscolares),
    desvincularEscola,
    createProfessor: createItem(setProfessores),
    updateProfessor: updateItem(setProfessores),
    createGestor: createItem(setGestores),
    updateGestor: updateItem(setGestores),
    createDiretor: createItem(setDiretores),
    updateDiretor: updateItem(setDiretores),
    criarMensagem,
    marcarMensagemComoLida,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const isPendingStatus = (status) => pendingStatuses.includes(status);

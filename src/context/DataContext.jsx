import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  auxiliares as auxiliaresIniciais,
  correcoesSimulados as correcoesIniciais,
  disciplinas,
  escolas as escolasIniciais,
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
  turmas,
  turmaProfessores,
  vinculosEscolares as vinculosEscolaresIniciais,
} from '../data/mockData';
import {
  pdiAcompanhamentosHistoricos as pdiAcompanhamentosIniciais,
  pdiAlunos as pdiAlunosIniciais,
  pdiAuxiliaresVinculos as pdiAuxiliaresVinculosIniciais,
  pdiAvaliacoesIniciais,
  pdiHistoricoPreenchimento as pdiHistoricoPreenchimentoIniciais,
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
  const [pdiAnamneses, setPdiAnamneses] = useState([]);
  const [pdiAuxiliaresVinculos, setPdiAuxiliaresVinculos] = useState(pdiAuxiliaresVinculosIniciais);
  const [pdiHistoricoPreenchimento, setPdiHistoricoPreenchimento] = useState(pdiHistoricoPreenchimentoIniciais);
  const [trimestrePeriods, setTrimestrePeriods] = useState(trimestrePeriodsIniciais);
  const [formPeriods, setFormPeriods] = useState(formulariosPrazos);
  const [escolas, setEscolas] = useState(escolasIniciais);
  const [vinculosEscolares, setVinculosEscolares] = useState(vinculosEscolaresIniciais);
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

  // Uma anamnese por aluno (1:1). Cria na primeira vez que é salva; nas seguintes, atualiza
  // o registro existente. Não gera nenhum valor automaticamente — só grava o que foi preenchido.
  const savePdiAnamnese = (alunoId, payload) => {
    setPdiAnamneses(prev => {
      const existente = prev.find(item => item.alunoId === Number(alunoId));
      if (existente) return prev.map(item => item.alunoId === Number(alunoId) ? { ...item, ...payload } : item);
      return [...prev, { id: nextId(prev), ...payload, alunoId: Number(alunoId) }];
    });
  };

  // Um evento por ENVIO do Formulário PDI (não por pergunta) — quem preencheu/editou e quando.
  // professorId é sempre o professor responsável do aluno (aluno.professorId), mesmo quando
  // quem preencheu foi a Supervisora: garante que ela edita o MESMO registro do professor,
  // nunca um paralelo (ver src/utils/pdiHistorico.js).
  const registrarPreenchimentoPdi = (alunoId, professorId, trimestre, autor, acao) => {
    setPdiHistoricoPreenchimento(prev => [...prev, {
      id: nextId(prev),
      alunoId: Number(alunoId),
      professorId: Number(professorId),
      trimestre,
      usuarioTipo: autor.tipo,
      usuarioId: autor.id,
      dataHora: new Date().toISOString(),
      acao,
    }]);
  };

  // Vincula um Auxiliar de Aprendizagem a um aluno. Se já existir um vínculo ativo para esse
  // aluno, encerra-o (dataFim = novo dataInicio, status 'encerrado') em vez de sobrescrever —
  // histórico nunca é apagado. Nunca cria vínculo Auxiliar->turma/escola.
  const vincularAuxiliar = (alunoId, auxiliarId, dataInicio) => {
    setPdiAuxiliaresVinculos(prev => {
      const encerrados = prev.map(item => (
        item.alunoId === Number(alunoId) && item.status === 'ativo'
          ? { ...item, dataFim: dataInicio, status: 'encerrado' }
          : item
      ));
      return [...encerrados, { id: nextId(encerrados), alunoId: Number(alunoId), auxiliarId: Number(auxiliarId), dataInicio, dataFim: null, status: 'ativo' }];
    });
  };

  // Encerra o vínculo ativo sem criar substituto — aluno fica temporariamente sem Auxiliar.
  const encerrarAuxiliar = (alunoId, dataFim) => {
    setPdiAuxiliaresVinculos(prev => prev.map(item => (
      item.alunoId === Number(alunoId) && item.status === 'ativo'
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

  const value = {
    professores,
    gestores,
    diretores,
    secretarias: secretariasIniciais,
    auxiliares,
    turmas,
    turmaProfessores,
    disciplinas,
    escolas,
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
    pdiAnamneses,
    savePdiAnamnese,
    pdiAuxiliaresVinculos,
    vincularAuxiliar,
    encerrarAuxiliar,
    pdiHistoricoPreenchimento,
    registrarPreenchimentoPdi,
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
    createEscola: createItem(setEscolas),
    updateEscola: updateItem(setEscolas),
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
import { createContext, useContext, useMemo, useState } from 'react';
import {
  correcoesSimulados as correcoesIniciais,
  disciplinas,
  eventosPedagogicos as eventosIniciais,
  formulariosPrazos,
  formulariosUmTerco as formulariosIniciais,
  pdis as pdisIniciais,
  professores,
  turmas,
} from '../data/mockData';
import {
  pdiAcompanhamentosHistoricos as pdiAcompanhamentosIniciais,
  pdiAlunos as pdiAlunosIniciais,
  pdiAvaliacoesIniciais,
  pdiMetasDesenvolvimento,
  pdiPerguntasFormulario,
  pdiRespostasAcompanhamento,
} from '../data/pdiData';
import { pdiSummary } from '../utils/pdi';

const DataContext = createContext();

const completedStatuses = ['concluido', 'concluído'];
const pendingStatuses = ['pendente', 'em_andamento', 'em_atraso'];

const nextId = (items) => Math.max(0, ...items.map(item => Number(item.id))) + 1;

const daysLate = (date) => {
  const today = new Date('2026-08-31T12:00:00');
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
  const [pdiAlunos, setPdiAlunos] = useState(pdiAlunosIniciais);
  const [pdiAvaliacoes, setPdiAvaliacoes] = useState(pdiAvaliacoesIniciais);
  const [pdiMetas, setPdiMetas] = useState(pdiMetasDesenvolvimento);
  const [pdiAcompanhamentos, setPdiAcompanhamentos] = useState(pdiAcompanhamentosIniciais);
  const [pdiPerguntas, setPdiPerguntas] = useState(pdiPerguntasFormulario);
  const [pdiRespostas, setPdiRespostas] = useState(pdiRespostasAcompanhamento);
  const [formPeriods, setFormPeriods] = useState(formulariosPrazos);

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

  const pendencias = useMemo(() => {
    const formularioPendencias = formularios
      .filter(item => item.status === 'em_atraso')
      .map(item => ({
        id: `formulario-${item.id}`,
        origem: 'formulario',
        origemId: item.id,
        professorId: item.professorId,
        turmaId: item.turmaId,
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
        disciplinaId: null,
        atividade: 'PDI',
        prazo: item.prazo,
        diasAtraso: daysLate(item.prazo),
        status: item.status,
        descricao: `${item.aluno} - ${item.indicador}`,
      }));

    const correcaoPendencias = correcoes
      .filter(item => item.status === 'em_atraso')
      .map(item => ({
        id: `correcao-${item.id}`,
        origem: 'correcao',
        origemId: item.id,
        professorId: item.professorId,
        turmaId: item.turmaId,
        disciplinaId: item.disciplinaId,
        atividade: 'Correções dos simulados',
        prazo: item.prazoCorrecao,
        diasAtraso: daysLate(item.prazoCorrecao),
        status: item.status,
        descricao: item.simulado,
      }));

    return [...formularioPendencias, ...pdiPendencias, ...correcaoPendencias]
      .sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [formularios, pdis, correcoes]);

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
      texto: 'enviou o Formulário 1/3',
      tempo: `há ${item.atualizadoEm}`,
    }));
    const fromPdis = pdis.slice(0, 4).map(item => ({
      id: `pdi-${item.id}`,
      professorId: item.professorId,
      texto: `atualizou um PDI de ${item.aluno}`,
      tempo: `há ${item.atualizadoEm}`,
    }));
    const fromCorrecoes = correcoes.slice(0, 4).map(item => ({
      id: `correcao-${item.id}`,
      professorId: item.professorId,
      texto: 'registrou correções dos simulados',
      tempo: `há ${item.atualizadoEm}`,
    }));

    return [...fromFormularios, ...fromPdis, ...fromCorrecoes].slice(0, 8);
  }, [formularios, pdis, correcoes]);

  const proximosEventos = useMemo(() => {
    const today = new Date('2026-08-31T12:00:00');
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

  const updateFormPeriod = (id, payload) => {
    setFormPeriods(prev => prev.map(period => period.id === id ? { ...period, ...payload } : period));
  };

  const value = {
    professores,
    turmas,
    disciplinas,
    formularios,
    pdis,
    correcoes,
    eventos,
    formPeriods,
    pdiAlunos,
    pdiAvaliacoes,
    pdiMetas,
    pdiAcompanhamentos,
    pdiPerguntas,
    pdiRespostas,
    pendencias,
    indicadores,
    atividadesRecentes,
    proximosEventos,
    resumoPdi,
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
    createPdiPergunta: createItem(setPdiPerguntas),
    updatePdiPergunta: updateItem(setPdiPerguntas),
    deletePdiPergunta: deleteItem(setPdiPerguntas),
    createPdiResposta: createItem(setPdiRespostas),
    updatePdiResposta: updateItem(setPdiRespostas),
    deletePdiResposta: deleteItem(setPdiRespostas),
    updateFormPeriod,
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
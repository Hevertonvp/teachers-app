import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getAuthToken } from '../services/api';
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
  turmas as turmasIniciais,
  turmaProfessores as turmaProfessoresIniciais,
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
import { buildPerguntasModelo, pdiModelosIniciais } from '../data/pdiModelos';
import { existeSobreposicaoNaEscola, MENSAGEM_SOBREPOSICAO_APLICACAO } from '../utils/pdiFichas';
import { pdiSummary } from '../utils/pdi';
import { canSendMessage } from '../utils/mensagens';
import { CURRENT_DATE } from '../utils/formAvailability';
import { nomeTurma, turmaConflitante } from '../utils/turmas';

const DataContext = createContext();

// Aplicação PDI de teste (escola 10 = Prudenciana, vigente na CURRENT_DATE) — permite validar o
// PDI por disciplina (Inglês) de imediato, sem precisar criar uma aplicação pela tela da
// Secretaria antes. Segue exatamente o mesmo formato produzido por createPdiAplicacao abaixo
// (snapshot dos modelos ativos no momento da criação).
const pdiAplicacoesIniciais = [
  {
    id: 1,
    escolaId: 10,
    dataInicio: '2026-09-01',
    dataFim: '2026-09-30',
    criadaEm: '2026-09-01T08:00:00.000Z',
    modelos: pdiModelosIniciais.filter(modelo => modelo.status === 'ativa').map(modelo => ({
      modeloId: modelo.id,
      disciplinaId: modelo.disciplinaId,
      nome: modelo.nome,
      perguntas: modelo.perguntas.map(pergunta => ({ ...pergunta })),
    })),
  },
  // Segunda escola (CAIC, escolaId 1) com aplicação própria — usada no cenário de teste
  // Heverton x Renato (ver mockData.js/pdiData.js), para que a turma do Heverton no CAIC também
  // gere fichas de verdade.
  {
    id: 2,
    escolaId: 1,
    dataInicio: '2026-09-01',
    dataFim: '2026-09-30',
    criadaEm: '2026-09-01T08:00:00.000Z',
    modelos: pdiModelosIniciais.filter(modelo => modelo.status === 'ativa').map(modelo => ({
      modeloId: modelo.id,
      disciplinaId: modelo.disciplinaId,
      nome: modelo.nome,
      perguntas: modelo.perguntas.map(pergunta => ({ ...pergunta })),
    })),
  },
];

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
  // PDI por disciplina (modelos/aplicações/fichas) — estrutura nova, paralela e independente da
  // antiga (pdiPerguntas/pdiRespostas acima, que ficam congeladas alimentando só a Análise de
  // Desenvolvimento e o gráfico legado em PdiAlunoPerfil.jsx). Ver src/data/pdiModelos.js e
  // src/utils/pdiFichas.js para o desenho completo.
  const [pdiModelos, setPdiModelos] = useState(pdiModelosIniciais);
  const [pdiAplicacoes, setPdiAplicacoes] = useState(pdiAplicacoesIniciais);
  const [pdiFichaRespostas, setPdiFichaRespostas] = useState([]);
  const [pdiFichaHistorico, setPdiFichaHistorico] = useState([]);
  const [pdiAnamneses, setPdiAnamneses] = useState([]);
  const [pdiAuxiliaresVinculos, setPdiAuxiliaresVinculos] = useState(pdiAuxiliaresVinculosIniciais);
  const [pdiHistoricoPreenchimento, setPdiHistoricoPreenchimento] = useState(pdiHistoricoPreenchimentoIniciais);
  const [trimestrePeriods, setTrimestrePeriods] = useState(trimestrePeriodsIniciais);
  // Configuração da Secretaria: se true (padrão atual), todo modelo PDI novo já nasce com a base
  // de perguntas padrão (ver buildPerguntasModelo). Desligada, o modelo nasce sem perguntas.
  const [pdiPreencherPerguntasPadrao, setPdiPreencherPerguntasPadrao] = useState(true);
  const [formPeriods, setFormPeriods] = useState(formulariosPrazos);
  // Escolas é o piloto de integração real com o backend (Node/Express/Prisma/Neon) — todas as
  // outras coleções deste contexto continuam mockadas. Ver README do backend e o resumo da
  // integração para o raciocínio completo.
  const [escolas, setEscolas] = useState([]);
  const [escolasLoading, setEscolasLoading] = useState(true);
  const [escolasError, setEscolasError] = useState(null);
  const [vinculosEscolares, setVinculosEscolares] = useState(vinculosEscolaresIniciais);
  const [turmas, setTurmas] = useState(turmasIniciais);
  const [turmaProfessores, setTurmaProfessores] = useState(turmaProfessoresIniciais);
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
  // `origem` é só informação organizacional (ver seção 6/33 do pedido), nunca proteção.
  const nextPerguntaId = (modelos) => Math.max(0, ...modelos.flatMap(modelo => modelo.perguntas.map(pergunta => Number(pergunta.id)))) + 1;

  // Todo modelo novo nasce com a base padrão comum (perguntas 1-9, Computação/BNCC, qualitativas
  // 10-13) — ver buildPerguntasModelo em pdiModelos.js. Nenhuma habilidade específica de
  // disciplina é inventada aqui; a Secretaria adiciona o bloco próprio da matéria depois, à mão,
  // como qualquer outra pergunta. A base é só o ponto de partida — tudo continua editável/
  // excluível normalmente, e cada modelo recebe objetos novos (nunca reaproveita referência de
  // outro modelo).
  const createPdiModelo = (payload) => {
    let created;
    setPdiModelos(prev => {
      created = { id: nextId(prev), nome: payload.nome, disciplinaId: Number(payload.disciplinaId), status: 'ativa', perguntas: pdiPreencherPerguntasPadrao ? buildPerguntasModelo() : [] };
      return [...prev, created];
    });
    return created;
  };

  const updatePdiModelo = (id, payload) => {
    setPdiModelos(prev => prev.map(modelo => (modelo.id === Number(id) ? { ...modelo, ...payload } : modelo)));
  };

  // Excluir o modelo não afeta aplicações já criadas — elas guardam uma cópia (snapshot) das
  // perguntas no momento em que foram abertas, independente do modelo continuar existindo.
  const deletePdiModelo = (id) => {
    setPdiModelos(prev => prev.filter(modelo => modelo.id !== Number(id)));
  };

  const createPdiModeloPergunta = (modeloId, payload) => {
    setPdiModelos(prev => {
      const novoId = nextPerguntaId(prev);
      return prev.map(modelo => (modelo.id === Number(modeloId)
        ? { ...modelo, perguntas: [...modelo.perguntas, { origem: 'personalizada', status: 'ativa', ...payload, id: novoId, ordem: modelo.perguntas.length + 1 }] }
        : modelo));
    });
  };

  const updatePdiModeloPergunta = (modeloId, perguntaId, payload) => {
    setPdiModelos(prev => prev.map(modelo => (modelo.id === Number(modeloId)
      ? { ...modelo, perguntas: modelo.perguntas.map(pergunta => (pergunta.id === Number(perguntaId) ? { ...pergunta, ...payload } : pergunta)) }
      : modelo)));
  };

  const deletePdiModeloPergunta = (modeloId, perguntaId) => {
    setPdiModelos(prev => prev.map(modelo => (modelo.id === Number(modeloId)
      ? { ...modelo, perguntas: modelo.perguntas.filter(pergunta => pergunta.id !== Number(perguntaId)) }
      : modelo)));
  };

  const reorderPdiModeloPergunta = (modeloId, perguntaId, direction) => {
    setPdiModelos(prev => prev.map(modelo => {
      if (modelo.id !== Number(modeloId)) return modelo;
      const ordenadas = [...modelo.perguntas].sort((left, right) => Number(left.ordem) - Number(right.ordem));
      const index = ordenadas.findIndex(item => item.id === Number(perguntaId));
      const sibling = ordenadas[index + direction];
      if (!sibling) return modelo;
      const atual = ordenadas[index];
      return {
        ...modelo,
        perguntas: modelo.perguntas.map(item => {
          if (item.id === atual.id) return { ...item, ordem: sibling.ordem };
          if (item.id === sibling.id) return { ...item, ordem: atual.ordem };
          return item;
        }),
      };
    }));
  };

  // --- PDI por disciplina: aplicações (vigência por escola) -----------------------------------
  // Vigências são independentes entre escolas; dentro da MESMA escola, duas aplicações nunca
  // podem ter períodos sobrepostos (ver src/utils/pdiFichas.js). Isso não é "uma aplicação por
  // trimestre" — várias aplicações podem coexistir na mesma escola, desde que não se sobreponham.
  const createPdiAplicacao = (payload) => {
    if (payload.dataInicio > payload.dataFim) {
      return { ok: false, error: 'A data de início não pode ser depois da data de encerramento.' };
    }
    // Só os modelos ATIVOS e escolhidos em `payload.modeloIds` entram nesta aplicação — sem
    // seleção nenhuma (ou nenhum deles mais ativo), não há o que colocar na aplicação.
    const modelosSelecionados = pdiModelos.filter(modelo => modelo.status === 'ativa' && payload.modeloIds?.includes(modelo.id));
    if (modelosSelecionados.length === 0) {
      return { ok: false, error: 'Selecione ao menos um modelo PDI ativo para esta aplicação.' };
    }
    if (existeSobreposicaoNaEscola(pdiAplicacoes, { escolaId: payload.escolaId, dataInicio: payload.dataInicio, dataFim: payload.dataFim })) {
      return { ok: false, error: MENSAGEM_SOBREPOSICAO_APLICACAO };
    }
    let created;
    setPdiAplicacoes(prev => {
      // Snapshot simples: cópia das perguntas de cada modelo selecionado no momento da criação —
      // mudanças futuras no modelo não afetam esta aplicação (ver seção 6/7 do pedido).
      created = {
        id: nextId(prev),
        escolaId: Number(payload.escolaId),
        dataInicio: payload.dataInicio,
        dataFim: payload.dataFim,
        criadaEm: new Date().toISOString(),
        modelos: modelosSelecionados.map(modelo => ({
          modeloId: modelo.id,
          disciplinaId: modelo.disciplinaId,
          nome: modelo.nome,
          perguntas: modelo.perguntas.map(pergunta => ({ ...pergunta })),
        })),
      };
      return [...prev, created];
    });
    return { ok: true, aplicacao: created };
  };

  const updatePdiAplicacao = (id, payload) => {
    const atual = pdiAplicacoes.find(aplicacao => aplicacao.id === Number(id));
    if (!atual) return { ok: false, error: 'Aplicação não encontrada.' };
    const dataInicio = payload.dataInicio ?? atual.dataInicio;
    const dataFim = payload.dataFim ?? atual.dataFim;
    if (dataInicio > dataFim) {
      return { ok: false, error: 'A data de início não pode ser depois da data de encerramento.' };
    }
    // A aplicação editada nunca conflita com ela mesma (`ignorarId`).
    if (existeSobreposicaoNaEscola(pdiAplicacoes, { escolaId: atual.escolaId, dataInicio, dataFim, ignorarId: atual.id })) {
      return { ok: false, error: MENSAGEM_SOBREPOSICAO_APLICACAO };
    }
    setPdiAplicacoes(prev => prev.map(aplicacao => (aplicacao.id === Number(id) ? { ...aplicacao, ...payload } : aplicacao)));
    return { ok: true };
  };

  const deletePdiAplicacao = (id) => {
    setPdiAplicacoes(prev => prev.filter(aplicacao => aplicacao.id !== Number(id)));
  };

  // Exclui todas as aplicações PDI de uma vez (todas as escolas) — usado pelo botão "Excluir
  // todas as aplicações" na Secretaria, sempre com confirmação antes na tela.
  const deleteAllPdiAplicacoes = () => {
    setPdiAplicacoes([]);
  };

  // --- PDI por disciplina: respostas e histórico da ficha --------------------------------------
  // Identidade da resposta: aplicacaoId + disciplinaId + alunoId + perguntaId — nunca colide
  // entre aplicações diferentes (mesmo aluno, mesma disciplina, vigências sobrepostas) nem entre
  // disciplinas diferentes do mesmo aluno na mesma aplicação (ver seção 7/8/22 do pedido).
  const salvarRespostaFicha = (payload) => {
    setPdiFichaRespostas(prev => {
      const existente = prev.find(item => (
        item.aplicacaoId === Number(payload.aplicacaoId)
        && item.disciplinaId === Number(payload.disciplinaId)
        && item.alunoId === Number(payload.alunoId)
        && item.perguntaId === payload.perguntaId
      ));
      if (existente) return prev.map(item => (item.id === existente.id ? { ...item, ...payload } : item));
      return [...prev, { id: nextId(prev), ...payload }];
    });
  };

  // Um evento por ENVIO da ficha (não por pergunta). professorId no payload de
  // salvarRespostaFicha guarda a autoria de cada resposta; aqui é só quem executou a ação.
  const registrarPreenchimentoFicha = (aplicacaoId, disciplinaId, alunoId, autor, acao) => {
    setPdiFichaHistorico(prev => [...prev, {
      id: nextId(prev),
      aplicacaoId: Number(aplicacaoId),
      disciplinaId: Number(disciplinaId),
      alunoId: Number(alunoId),
      usuarioTipo: autor.tipo,
      usuarioId: autor.id,
      dataHora: new Date().toISOString(),
      acao,
    }]);
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

  // Vincula um Auxiliar de Aprendizagem a uma TURMA (não mais a um aluno individual) — os
  // alunos PDI acompanhados são sempre derivados dos alunos daquela turma (ver
  // src/utils/auxiliares.js). Se já existir um vínculo ativo para essa turma, encerra-o
  // (dataFim = novo dataInicio, status 'encerrado') em vez de sobrescrever — histórico nunca é
  // apagado, e isso já garante no máximo um vínculo ativo por turma.
  const vincularAuxiliar = (turmaId, auxiliarId, dataInicio) => {
    setPdiAuxiliaresVinculos(prev => {
      const encerrados = prev.map(item => (
        item.turmaId === Number(turmaId) && item.status === 'ativo'
          ? { ...item, dataFim: dataInicio, status: 'encerrado' }
          : item
      ));
      return [...encerrados, { id: nextId(encerrados), turmaId: Number(turmaId), auxiliarId: Number(auxiliarId), dataInicio, dataFim: null, status: 'ativo' }];
    });
  };

  // Encerra o vínculo ativo da turma sem criar substituto — os alunos PDI dela ficam
  // temporariamente sem Auxiliar.
  const encerrarAuxiliar = (turmaId, dataFim) => {
    setPdiAuxiliaresVinculos(prev => prev.map(item => (
      item.turmaId === Number(turmaId) && item.status === 'ativo'
        ? { ...item, dataFim, status: 'encerrado' }
        : item
    )));
  };

  // --- Gestão de Turmas (Secretaria) ------------------------------------------------------
  // Turma nunca é excluída fisicamente: tem `status` ('ativa'/'inativa'), preservando o registro
  // e todos os relacionamentos que apontam para o mesmo `id` (turmaProfessores.turmaId,
  // pdiAlunos.turmaId, pdiAuxiliaresVinculos.turmaId — ver utils/turmas.js). O nome de exibição
  // é sempre gerado por nomeTurma(), nunca digitado pela Secretaria.
  // Mensagem de conflito de identidade — distingue duplicar uma turma ATIVA de tentar recriar
  // uma que já existe INATIVA (nesse caso a ação correta é reativar, não cadastrar de novo; ver
  // seção 1/3 do pedido de correção: turma inativa continua ocupando sua identidade histórica).
  const mensagemConflitoTurma = (conflito) => (conflito.status === 'inativa'
    ? `Já existe uma turma com essa configuração neste ano letivo (${conflito.nome}, inativa). Reative a turma existente em vez de criar uma nova.`
    : `Já existe uma turma ativa com essa combinação de escola, ano letivo, série/segmento, turno e identificador (${conflito.nome}).`);

  const createTurma = (payload) => {
    const conflito = turmaConflitante(turmas, payload);
    if (conflito) return { ok: false, error: mensagemConflitoTurma(conflito) };
    const turma = { id: nextId(turmas), ...payload, nome: nomeTurma(payload), status: 'ativa' };
    setTurmas(prev => [...prev, turma]);
    return { ok: true, turma };
  };

  // Reaproveita o `id` e recalcula o nome de exibição a partir dos campos enviados — nunca troca
  // o id nem remove o registro, então turmaProfessores/pdiAlunos/pdiAuxiliaresVinculos que já
  // apontam para ele continuam funcionando sem nenhuma alteração.
  const updateTurma = (id, payload) => {
    const atual = turmas.find(turma => turma.id === Number(id));
    if (!atual) return { ok: false, error: 'Turma não encontrada.' };
    const mesclada = { ...atual, ...payload };
    const conflito = turmaConflitante(turmas, mesclada, atual.id);
    if (conflito) return { ok: false, error: mensagemConflitoTurma(conflito) };
    const turmaAtualizada = { ...mesclada, nome: nomeTurma(mesclada) };
    setTurmas(prev => prev.map(turma => (turma.id === Number(id) ? turmaAtualizada : turma)));
    return { ok: true, turma: turmaAtualizada };
  };

  // Inativar/reativar só muda `status` — nunca apaga a turma nem cascateia para nenhum vínculo
  // (professor, aluno PDI ou Auxiliar continuam exatamente como estavam).
  const inativarTurma = (id) => {
    setTurmas(prev => prev.map(turma => (turma.id === Number(id) ? { ...turma, status: 'inativa' } : turma)));
  };

  const reativarTurma = (id) => {
    const atual = turmas.find(turma => turma.id === Number(id));
    if (!atual) return { ok: false, error: 'Turma não encontrada.' };
    const conflito = turmaConflitante(turmas, atual, atual.id);
    if (conflito) return { ok: false, error: `Já existe outra turma (${conflito.nome}, ${conflito.status === 'ativa' ? 'ativa' : 'inativa'}) com essa mesma combinação — ajuste-a antes de reativar esta.` };
    setTurmas(prev => prev.map(turma => (turma.id === Number(id) ? { ...turma, status: 'ativa' } : turma)));
    return { ok: true };
  };

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

  // Sem token (ainda não logou) não há o que buscar — o AuthContext chama loadEscolas() logo
  // depois de um login bem-sucedido.
  useEffect(() => {
    if (getAuthToken()) loadEscolas();
    else setEscolasLoading(false);
  }, [loadEscolas]);

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
    turmas,
    createTurma,
    updateTurma,
    inativarTurma,
    reativarTurma,
    turmaProfessores,
    disciplinas,
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
    pdiModelos,
    pdiAplicacoes,
    pdiFichaRespostas,
    pdiFichaHistorico,
    pdiAnamneses,
    savePdiAnamnese,
    pdiAuxiliaresVinculos,
    vincularAuxiliar,
    encerrarAuxiliar,
    vincularProfessorTurma,
    encerrarVinculoProfessorTurma,
    pdiHistoricoPreenchimento,
    registrarPreenchimentoPdi,
    trimestrePeriods,
    updateTrimestrePeriod,
    pdiPreencherPerguntasPadrao,
    setPdiPreencherPerguntasPadrao,
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
    createPdiModelo,
    updatePdiModelo,
    deletePdiModelo,
    createPdiModeloPergunta,
    updatePdiModeloPergunta,
    deletePdiModeloPergunta,
    reorderPdiModeloPergunta,
    createPdiAplicacao,
    updatePdiAplicacao,
    deletePdiAplicacao,
    deleteAllPdiAplicacoes,
    salvarRespostaFicha,
    registrarPreenchimentoFicha,
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
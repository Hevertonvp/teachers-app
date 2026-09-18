import { trimestres } from '../utils/trimestres';
import { HABILIDADE_OPCOES, PDI_HABILIDADES_EXEMPLO, PDI_INDICADORES_ESTRUTURADOS, PDI_QUALITATIVAS_PADRAO } from '../utils/pdiIndicadores';

// escolaId: 1=Aurora, 2=Caminhos, 3=Modelo, 4=Esperança, 5=Primavera, 6=Horizonte (ver mockData.js).
// Nota: o vínculo aluno->escola é preservado como estava informado originalmente (por nome),
// e pode não coincidir com a escola da turma (turmas.escolaId) em alguns registros —
// a base de dados de origem já não era consistente nesse ponto (ver ressalva na análise).
// responsavelNome/Parentesco/Telefone1/Telefone2: dados mínimos do responsável legal,
// obrigatórios desde a introdução dessa regra no cadastro do aluno (ver PdiPage.jsx).
const alunosBase = [
  ['João Silva', '2014-03-12', 1, 7, 5, '2022-02-03', '2026-08-05', 'TEA informado pela família', 'F84.0', 'ativo', 'Marta Silva', 'mae', '(32) 98811-2233', ''],
  ['Ana Costa', '2013-11-08', 1, 9, 6, '2021-02-01', '2026-08-06', 'TDAH informado no cadastro', 'F90.0', 'ativo', 'Roberta Costa', 'mae', '(32) 98822-3344', '(32) 3271-1002'],
  ['Pedro Lima', '2015-01-20', 6, 5, 3, '2023-02-06', '2026-08-08', 'Acompanhamento pedagógico sem CID informado', '', 'ativo', 'Antônio Lima', 'pai', '(32) 98833-4455', ''],
  ['Mariana Alves', '2014-07-02', 2, 1, 1, '2022-02-07', '2026-08-01', 'Dificuldade persistente de aprendizagem informada', '', 'ativo', 'Débora Alves', 'mae', '(32) 98844-5566', ''],
  ['Lucas Pereira', '2015-05-17', 3, 2, 1, '2023-02-01', '2026-08-02', 'Necessidade de apoio pedagógico individualizado', '', 'ativo', 'Sandra Pereira', 'avo_f', '(32) 98855-6677', ''],
  ['Camila Ribeiro', '2013-09-29', 3, 4, 2, '2021-02-08', '2026-08-07', 'Deficiência intelectual informada pela família', 'F79', 'ativo', 'Fábio Ribeiro', 'pai', '(32) 98866-7788', '(32) 3271-1003'],
  ['Sofia Martins', '2014-12-10', 6, 6, 4, '2022-02-02', '2026-08-09', 'Acompanhamento pedagógico sem CID informado', '', 'ativo', 'Renata Martins', 'mae', '(32) 98877-8899', ''],
  ['Gustavo Lima', '2012-06-14', 4, 10, 11, '2020-02-03', '2026-08-03', 'Baixa visão informada no cadastro', 'H54.2', 'ativo', 'Cláudio Lima', 'pai', '(32) 98888-9900', ''],
  ['Isabela Rocha', '2015-04-25', 5, 3, 12, '2023-02-06', '2026-08-11', 'Transtorno de linguagem informado', 'F80.9', 'ativo', 'Vanessa Rocha', 'mae', '(32) 98899-0011', ''],
  ['Tiago Moreira', '2013-02-18', 5, 8, 10, '2021-02-04', '2026-08-04', 'Acompanhamento pedagógico sem CID informado', '', 'ativo', 'Osvaldo Moreira', 'avo_m', '(32) 98800-1122', ''],
  ['Larissa Gomes', '2014-10-22', 6, 6, 15, '2022-02-01', '2026-08-10', 'Necessidade de apoio pedagógico individualizado', '', 'arquivado', 'Patrícia Gomes', 'mae', '(32) 98811-2244', ''],
  ['Rafael Cardoso', '2015-08-19', 6, 5, 14, '2023-02-02', '2026-08-12', 'TEA informado pela família', 'F84.0', 'ativo', 'Marcelo Cardoso', 'pai', '(32) 98822-3355', ''],
];

export const pdiAlunos = alunosBase.map(([
  nome, dataNascimento, escolaId, turmaId, professorId, dataEntradaRede, dataInicio, condicaoInformada, cid, status,
  responsavelNome, responsavelParentesco, responsavelTelefone1, responsavelTelefone2,
], index) => ({
  id: index + 1,
  nome,
  dataNascimento,
  escolaId,
  turmaId,
  professorId,
  dataEntradaRede,
  dataInicio,
  condicaoInformada,
  cid,
  status,
  responsavelNome,
  responsavelParentesco,
  responsavelTelefone1,
  responsavelTelefone2,
}));

// Histórico de vínculos Auxiliar de Aprendizagem <-> aluno. Regra: no máximo um vínculo com
// status 'ativo' por aluno ao mesmo tempo; trocas/encerramentos preservam os registros
// anteriores (dataFim preenchida, status 'encerrado'), nunca apagam ou sobrescrevem.
// Auxiliar não tem vínculo direto com turma/escola — isso é sempre derivado via aluno.
// auxiliarId 1=Débora (1 aluno ativo), 2=Ricardo (vários alunos, escolas diferentes: 5 e 2),
// 3=Simone (nenhum vínculo). Aluno 2 (Ana Costa) fica sem Auxiliar (estado válido). Aluno 6
// (Camila Ribeiro) tem histórico de troca (Débora -> Ricardo).
export const pdiAuxiliaresVinculos = [
  { id: 1, alunoId: 1, auxiliarId: 1, dataInicio: '2026-02-10', dataFim: null, status: 'ativo' },
  { id: 2, alunoId: 9, auxiliarId: 2, dataInicio: '2026-02-15', dataFim: null, status: 'ativo' },
  { id: 3, alunoId: 4, auxiliarId: 2, dataInicio: '2026-03-01', dataFim: null, status: 'ativo' },
  { id: 4, alunoId: 6, auxiliarId: 1, dataInicio: '2026-02-01', dataFim: '2026-05-20', status: 'encerrado' },
  { id: 5, alunoId: 6, auxiliarId: 2, dataInicio: '2026-05-21', dataFim: null, status: 'ativo' },
];

// Histórico de preenchimento/edição do Formulário PDI trimestral — quem preencheu, quando, e
// se foi preenchimento inicial ou edição. Populado em tempo de uso (ver DataContext.jsx,
// registrarPreenchimentoPdi); começa vazio, igual a pdiAnamneses.
export const pdiHistoricoPreenchimento = [];

// As perguntas do PDI são únicas e compartilhadas entre todas as escolas selecionadas pela
// Secretaria (ver src/context/DataContext.jsx) — não existem cópias por escola.
// tipoResposta: 'texto' (resposta aberta) | 'selecao' (opções fechadas) | 'marcacao'
// (marcado/desmarcado) | 'numero' (nota/rendimento — reservado às perguntas padrão).
// complementar: quando presente, exibe um campo de texto extra ao professor apenas quando a
// resposta dada for igual a `gatilho` (uma das opções, para 'selecao'; `true`, para 'marcacao').
// origem: 'estruturada' (padrão, alimenta a Análise de Desenvolvimento via `indicador` estável)
// | 'qualitativa' (padrão, texto livre, nunca alimenta gráfico) | 'habilidade' (padrão, BNCC,
// estruturado mas fora da análise por ora) | 'personalizada' (criada pela Secretaria, nunca
// alimenta análise). Perguntas padrão (as três primeiras origens) não podem ser excluídas —
// só desativadas (ver deletePdiPergunta em DataContext.jsx) — para não quebrar série histórica.
export const pdiPerguntasFormulario = [
  ...PDI_INDICADORES_ESTRUTURADOS.map((item, index) => ({
    id: index + 1,
    pergunta: item.pergunta,
    indicador: item.indicador,
    origem: 'estruturada',
    tipoResposta: item.tipoResposta,
    opcoes: item.opcoes,
    complementar: item.complementar,
    ordem: index + 1,
    status: 'ativa',
  })),
  ...PDI_QUALITATIVAS_PADRAO.map((item, index) => ({
    id: PDI_INDICADORES_ESTRUTURADOS.length + index + 1,
    pergunta: item.pergunta,
    indicador: null,
    origem: 'qualitativa',
    tipoResposta: 'texto',
    opcoes: [],
    complementar: null,
    ordem: PDI_INDICADORES_ESTRUTURADOS.length + index + 1,
    status: 'ativa',
  })),
  ...PDI_HABILIDADES_EXEMPLO.map((item, index) => ({
    id: PDI_INDICADORES_ESTRUTURADOS.length + PDI_QUALITATIVAS_PADRAO.length + index + 1,
    pergunta: item.descricao,
    codigo: item.codigo,
    indicador: null,
    origem: 'habilidade',
    tipoResposta: 'selecao',
    opcoes: HABILIDADE_OPCOES,
    complementar: null,
    ordem: PDI_INDICADORES_ESTRUTURADOS.length + PDI_QUALITATIVAS_PADRAO.length + index + 1,
    status: 'ativa',
  })),
];

const indicadores = [
  ['Aprendizagem', 'Leitura'],
  ['Aprendizagem', 'Compreensão'],
  ['Autonomia', 'Organização'],
  ['Comunicação', 'Comunicação oral'],
  ['Participação e socialização', 'Participação nas atividades'],
];

export const pdiAvaliacoesIniciais = pdiAlunos.flatMap((aluno, alunoIndex) => indicadores.slice(0, 3).map(([area, indicador], index) => ({
  id: alunoIndex * 3 + index + 1,
  alunoId: aluno.id,
  area,
  indicador,
  nivel: ((alunoIndex + index) % 3) + 1,
  observacao: 'Observação pedagógica inicial registrada a partir de atividades em sala e interações escolares.',
  data: aluno.dataInicio,
})));

export const pdiMetasDesenvolvimento = pdiAlunos.flatMap((aluno, alunoIndex) => indicadores.slice(0, alunoIndex % 2 === 0 ? 3 : 2).map(([area, indicador], index) => ({
  id: alunoIndex * 3 + index + 1,
  alunoId: aluno.id,
  area,
  indicador,
  descricao: indicador === 'Compreensão'
    ? 'Desenvolver a capacidade de localizar informações explícitas em textos curtos.'
    : `Ampliar a autonomia do estudante em ${indicador.toLowerCase()} por meio de atividades mediadas.`,
  nivelInicial: ((alunoIndex + index) % 3) + 1,
  nivelEsperado: Math.min(5, ((alunoIndex + index) % 3) + 3),
  prazo: `2026-${String(10 + (index % 2)).padStart(2, '0')}-${String(20 + index * 3).padStart(2, '0')}`,
  estrategias: 'Leitura mediada, registros curtos, devolutivas frequentes e tarefas com complexidade gradual.',
  status: ['em_andamento', 'nao_iniciada', 'revisar', 'concluida'][(alunoIndex + index) % 4],
})));

const trendSeries = [
  [2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5],
  [3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  [4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4],
  [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5],
  [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5],
  [2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5],
  [3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1],
  [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4],
  [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5],
];

export const pdiAcompanhamentosHistoricos = pdiAlunos.flatMap((aluno, alunoIndex) => {
  const [area, indicador] = indicadores[alunoIndex % indicadores.length];
  return trendSeries[alunoIndex].map((nivelObservado, index) => ({
    id: alunoIndex * 12 + index + 1,
    alunoId: aluno.id,
    data: `2026-${String(index + 1).padStart(2, '0')}-${String(18 + alunoIndex % 8).padStart(2, '0')}`,
    area,
    indicador,
    nivelObservado,
    evidencia: `Realizou atividade observada com nível ${nivelObservado} de apoio pedagógico no contexto escolar.`,
    estrategia: index % 2 === 0 ? 'Leitura compartilhada e mediação individual.' : 'Atividade guiada com devolutiva imediata.',
    observacao: index === 2 ? 'Registro mais recente utilizado para acompanhamento da tendência.' : 'Registro histórico do acompanhamento pedagógico.',
  }));
});

// Simula respostas reais que professores já teriam preenchido no Formulário PDI, no mesmo
// formato gravado por src/pages/FormularioPdiProfessor.jsx (alunoId, professorId, perguntaId,
// trimestre, data, resposta, complementarTexto). Propositalmente parcial: nem todo aluno tem
// os 3 trimestres preenchidos, para exercitar o estado de "dados insuficientes" nos gráficos.
const avancosPool = [
  'Apresentou avanços na participação das atividades em grupo e maior autonomia na realização das tarefas propostas.',
  'Demonstrou maior engajamento nas atividades de leitura, com necessidade de apoio pontual para interpretação de textos mais longos.',
  'Consolidou rotinas de organização do material escolar, mantendo regularidade na entrega das atividades.',
];
const dificuldadesPool = [
  'Ainda apresenta dificuldade de concentração em atividades de longa duração, necessitando de pausas orientadas.',
  'Persiste dificuldade em tarefas que exigem leitura e interpretação de enunciados mais complexos.',
  'Necessita de apoio individualizado para conclusão de atividades escritas dentro do tempo previsto.',
];
const parecerPool = [
  'Trimestre com avanços graduais na autonomia e participação, mantendo acompanhamento pedagógico individualizado.',
  'Consolidação parcial das habilidades trabalhadas, com necessidade de reforço contínuo em leitura e escrita.',
  'Evolução consistente em relação ao trimestre anterior, com maior engajamento nas propostas pedagógicas.',
];
const metodologiasPool = [
  'Atividades apresentadas de diferentes formas, buscando despertar o interesse do aluno e incentivar sua participação.',
  'Uso de apoio visual e roteiros de atividade divididos em etapas menores.',
  'Tempo adicional para conclusão das atividades e mediação individual nos momentos de leitura.',
];
const adaptacoesPool = [
  'Reorganização do espaço de trabalho e uso de reforço positivo ao longo da aula.',
  'Tempo adicional para conclusão das atividades e mediação individual nos momentos de leitura.',
  'Uso de apoio visual e roteiros de atividade divididos em etapas menores.',
];
const trimestresPorAluno = ['2026-04-15', '2026-08-15', '2026-12-15'];

// Índice dentro de uma escala ordinal (opcoes), variando de forma determinística por aluno e
// trimestre — não é aleatório, só para gerar séries plausíveis (algumas melhorando, outras
// estáveis) o suficiente para testar comparação/gráfico. `seed` distingue os indicadores entre
// si para não gerarem sempre o mesmo valor no mesmo trimestre.
const indiceOrdinal = (tamanho, alunoIndex, trimestreIndex, seed) => {
  const base = (alunoIndex + seed) % tamanho;
  const direcao = alunoIndex % 2 === 0 ? 1 : -1;
  return Math.min(tamanho - 1, Math.max(0, base + trimestreIndex * direcao));
};

export const pdiRespostasAcompanhamento = pdiAlunos.flatMap((aluno, alunoIndex) => {
  const trimestresPreenchidos = Math.min(trimestres.length, (alunoIndex % 4) + 1);
  return Array.from({ length: trimestresPreenchidos }, (_, trimestreIndex) => trimestreIndex).flatMap(trimestreIndex => {
    const trimestre = trimestres[trimestreIndex];
    const data = trimestresPorAluno[trimestreIndex];

    return pdiPerguntasFormulario.map((pergunta, perguntaSeed) => {
      let resposta = '';
      let complementarTexto = '';

      if (pergunta.origem === 'estruturada') {
        if (pergunta.tipoResposta === 'numero') {
          resposta = 20 + alunoIndex + trimestreIndex * 3;
        } else {
          const necessitaAlteracao = pergunta.indicador?.startsWith('necessidade_alteracao');
          if (necessitaAlteracao) {
            resposta = (alunoIndex + trimestreIndex) % 3 === 0 ? 'Sim' : 'Não';
            if (resposta === 'Sim') complementarTexto = adaptacoesPool[(alunoIndex + trimestreIndex) % adaptacoesPool.length];
          } else {
            const index = indiceOrdinal(pergunta.opcoes.length, alunoIndex, trimestreIndex, perguntaSeed);
            resposta = pergunta.opcoes[index];
          }
        }
      } else if (pergunta.origem === 'habilidade') {
        const index = indiceOrdinal(pergunta.opcoes.length, alunoIndex, trimestreIndex, perguntaSeed);
        resposta = pergunta.opcoes[index];
      } else if (pergunta.indicador === null && pergunta.origem === 'qualitativa') {
        if (pergunta.pergunta.startsWith('Quais aspectos')) resposta = dificuldadesPool[(alunoIndex + trimestreIndex) % dificuldadesPool.length];
        else if (pergunta.pergunta.startsWith('Descreva as metodologias')) resposta = metodologiasPool[(alunoIndex + trimestreIndex) % metodologiasPool.length];
        else if (pergunta.pergunta.startsWith('Redija um parecer')) resposta = parecerPool[(alunoIndex + trimestreIndex) % parecerPool.length];
        else resposta = avancosPool[(alunoIndex + trimestreIndex) % avancosPool.length];
      }

      return {
        id: alunoIndex * 100 + trimestreIndex * 20 + pergunta.id,
        alunoId: aluno.id,
        professorId: aluno.professorId,
        perguntaId: pergunta.id,
        trimestre,
        data,
        resposta,
        complementarTexto,
      };
    });
  });
});
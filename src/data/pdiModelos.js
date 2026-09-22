// Modelos PDI por disciplina. Cada modelo pertence a exatamente uma disciplina (`disciplinaId`,
// FK para `disciplinas` em mockData.js — nunca identificada por nome/texto) e carrega sua
// própria lista de perguntas. Ao contrário do antigo formulário único e global, cada disciplina
// pode ter um conjunto de perguntas diferente (mesmo que hoje só Inglês esteja cadastrado).
//
// Todas as perguntas de um modelo são igualmente editáveis/removíveis pela Secretaria (ver
// DataContext.jsx) — `origem` é só informação organizacional (de onde a pergunta veio
// inicialmente), nunca uma proteção contra edição/exclusão.
//
// `secao`/`subsecao` só agrupam a exibição do formulário (ver FormularioPdiProfessor.jsx) — não
// têm efeito na Análise de Desenvolvimento nem nas respostas.
import { HABILIDADE_OPCOES, PDI_HABILIDADES_EXEMPLO, PDI_INDICADORES_ESTRUTURADOS, PDI_QUALITATIVAS_PADRAO } from '../utils/pdiIndicadores';

// id da disciplina "Inglês" cadastrada em mockData.js (`disciplinas`) — mantido como constante
// nomeada em vez de espalhar o número 6 pelo módulo.
export const DISCIPLINA_INGLES_ID = 6;

// --- Bloco "Computação (BNCC)", preservado da planilha original de Inglês -------------------
const COMPUTACAO_ORIENTACAO = 'Esta seção se refere às habilidades da BNCC de Computação. Caso suas aulas já contemplem alguma dessas habilidades, registre-as no espaço correspondente. Se ainda não realiza o planejamento com base nas habilidades de Computação, deixe este campo em branco ou preencha apenas as que foram efetivamente trabalhadas.';

const PENSAMENTO_COMPUTACIONAL = [
  { codigo: 'EF06CO01', descricao: "Classificar informações, agrupando-as em coleções (conjuntos) e associando cada coleção a um 'tipo de dados'." },
  { codigo: 'EF06CO02', descricao: 'Elaborar algoritmos que envolvam instruções sequenciais, de repetição e de seleção usando uma linguagem de programação.' },
  { codigo: 'EF06CO03', descricao: 'Descrever com precisão a solução de um problema, construindo o programa que implementa a solução descrita.' },
  { codigo: 'EF06CO04', descricao: 'Construir soluções de problemas usando a técnica de decomposição e automatizar tais soluções usando uma linguagem de programação.' },
  { codigo: 'EF06CO05', descricao: 'Identificar os recursos ou insumos necessários (entradas) para a resolução de problemas, bem como os resultados esperados (saídas), determinando os respectivos tipos de dados, e estabelecendo a definição de problema como uma relação entre entrada e saída.' },
  { codigo: 'EF06CO06', descricao: 'Comparar diferentes casos particulares (instâncias) de um mesmo problema, identificando as semelhanças e diferenças entre eles, e criar um algoritmo para resolver todos, fazendo uso de variáveis (parâmetros) para permitir o tratamento de todos os casos de forma genérica.' },
];

const MUNDO_DIGITAL = [
  { codigo: 'EF06CO07', descricao: 'Entender o processo de transmissão de dados, como a informação é quebrada em pedaços, transmitida em pacotes através de múltiplos equipamentos, e reconstruída no destino.' },
  { codigo: 'EF06CO08', descricao: 'Compreender e utilizar diferentes formas de armazenar, manipular, compactar e recuperar arquivos, documentos e metadados.' },
];

const CULTURA_DIGITAL = [
  { codigo: 'EF06CO09', descricao: 'Apresentar conduta e linguagem apropriadas ao se comunicar em ambiente digital, considerando a ética e o respeito.' },
  { codigo: 'EF06CO10', descricao: 'Analisar o consumo de tecnologia na sociedade, compreendendo criticamente o caminho da produção dos recursos bem como aspectos ligados à obsolescência e a sustentabilidade.' },
];

// Base padrão reutilizável: perguntas 1-9 (Acompanhamento estruturado), bloco Computação/BNCC
// (orientação + EF06CO01-10) e qualitativas 10-13 — todo modelo PDI de QUALQUER disciplina
// nasce com essas mesmas perguntas (ver createPdiModelo em DataContext.jsx). `procedimentosEsperados`
// é o único parâmetro pensado para variar por disciplina (as habilidades específicas da matéria,
// ex.: EF06LI* para Inglês) — sem valor, o modelo simplesmente nasce sem esse bloco, para não
// inventar conteúdo de disciplinas que ainda não têm habilidades confirmadas.
//
// Monta a lista de perguntas de um modelo a partir dos blocos acima, numerando os ids de forma
// sequencial e ÚNICA dentro do modelo. Cada chamada gera objetos novos (nunca reaproveita a
// mesma referência entre modelos), então editar/excluir uma pergunta em um modelo nunca afeta
// outro, mesmo que os dois tenham nascido da mesma base padrão.
export const buildPerguntasModelo = ({
  estruturadas = PDI_INDICADORES_ESTRUTURADOS,
  procedimentosEsperados = [],
  computacaoOrientacao = COMPUTACAO_ORIENTACAO,
  computacaoBlocos = [
    { subsecao: 'Pensamento Computacional', itens: PENSAMENTO_COMPUTACIONAL },
    { subsecao: 'Mundo Digital', itens: MUNDO_DIGITAL },
    { subsecao: 'Cultura Digital', itens: CULTURA_DIGITAL },
  ],
  qualitativas = PDI_QUALITATIVAS_PADRAO,
} = {}) => {
  let seq = 0;
  const nextId = () => { seq += 1; return seq; };

  const perguntasEstruturadas = estruturadas.map(item => {
    const id = nextId();
    return {
      id,
      secao: 'Acompanhamento estruturado',
      pergunta: item.pergunta,
      indicador: item.indicador,
      origem: 'estruturada',
      tipoResposta: item.tipoResposta,
      opcoes: item.opcoes,
      complementar: item.complementar,
      ordem: id,
      status: 'ativa',
    };
  });

  const perguntasProcedimentos = procedimentosEsperados.map(item => {
    const id = nextId();
    return {
      id,
      secao: 'Procedimentos Esperados',
      codigo: item.codigo,
      pergunta: item.descricao,
      indicador: null,
      origem: 'habilidade',
      tipoResposta: 'selecao',
      opcoes: HABILIDADE_OPCOES,
      complementar: null,
      ordem: id,
      status: 'ativa',
    };
  });

  const orientacaoId = nextId();
  const orientacaoComputacao = [{
    id: orientacaoId,
    secao: 'Computação (BNCC)',
    subsecao: 'Orientação sobre o preenchimento',
    pergunta: computacaoOrientacao,
    indicador: null,
    origem: 'orientacao',
    tipoResposta: 'orientacao',
    opcoes: [],
    complementar: null,
    ordem: orientacaoId,
    status: 'ativa',
  }];

  const perguntasComputacao = computacaoBlocos.flatMap(({ subsecao, itens }) => itens.map(item => {
    const id = nextId();
    return {
      id,
      secao: 'Computação (BNCC)',
      subsecao,
      codigo: item.codigo,
      pergunta: item.descricao,
      indicador: null,
      origem: 'habilidade',
      tipoResposta: 'selecao',
      opcoes: HABILIDADE_OPCOES,
      complementar: null,
      ordem: id,
      status: 'ativa',
    };
  }));

  const perguntasQualitativas = qualitativas.map(item => {
    const id = nextId();
    return {
      id,
      secao: 'Registro pedagógico',
      pergunta: item.pergunta,
      indicador: null,
      origem: 'qualitativa',
      tipoResposta: 'texto',
      opcoes: [],
      complementar: null,
      ordem: id,
      status: 'ativa',
    };
  });

  return [...perguntasEstruturadas, ...perguntasProcedimentos, ...orientacaoComputacao, ...perguntasComputacao, ...perguntasQualitativas];
};

// Único modelo cadastrado nesta etapa: Inglês. Novas disciplinas passam a ter PDI só cadastrando
// um novo item aqui (ou pela tela da Secretaria, ver createPdiModelo em DataContext.jsx) — nada
// no restante do módulo (autorização, aplicação, respostas, dashboard) precisa mudar.
export const pdiModelosIniciais = [
  {
    id: 1,
    nome: 'PDI - Inglês',
    disciplinaId: DISCIPLINA_INGLES_ID,
    status: 'ativa',
    // Só o bloco de habilidades específicas (EF06LI*) precisa ser informado — o resto (1-9,
    // Computação/BNCC, qualitativas) já vem da base padrão por default.
    perguntas: buildPerguntasModelo({ procedimentosEsperados: PDI_HABILIDADES_EXEMPLO }),
  },
];

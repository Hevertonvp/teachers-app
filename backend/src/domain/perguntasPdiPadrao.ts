// Conteúdo das perguntas PADRÃO do PDI por disciplina, portado literalmente de
// src/utils/pdiIndicadores.js e src/data/pdiModelos.js (frontend) — nenhum texto foi inventado
// aqui, só transcrito para o domínio do backend. Todo ModeloPdi novo nasce com este conjunto (ver
// seção 17 do pedido); depois disso, a Secretaria pode editar/reordenar/inativar livremente,
// inclusive estas — `origem` é só informativo, nunca proteção (seção 16).
import type { OrigemPerguntaPdi, TipoRespostaPdi } from '@prisma/client';

interface PerguntaPadrao {
  secao: string;
  subsecao?: string;
  codigo?: string;
  texto: string;
  indicador?: string;
  origem: OrigemPerguntaPdi;
  tipoResposta: TipoRespostaPdi;
  opcoes?: string[];
  complementar?: { gatilho: string; label: string } | null;
}

// --- Acompanhamento estruturado (1-9) — alimenta a Análise de Desenvolvimento -----------------
const ESTRUTURADAS: PerguntaPadrao[] = [
  { secao: 'Acompanhamento estruturado', indicador: 'necessidade_alteracao_metodologia', texto: 'O aluno apresenta necessidade de alteração na metodologia utilizada em sala de aula?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Sim', 'Não'], complementar: { gatilho: 'Sim', label: 'Como?' } },
  { secao: 'Acompanhamento estruturado', indicador: 'necessidade_alteracao_avaliacao', texto: 'O aluno apresenta necessidade de alteração nas atividades e avaliações programadas?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Sim', 'Não'], complementar: { gatilho: 'Sim', label: 'Como?' } },
  { secao: 'Acompanhamento estruturado', indicador: 'nivel_suporte', texto: 'Qual o nível de suporte necessário para o aluno em sua aula?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Nenhum suporte', 'Pouco suporte', 'Muito suporte'] },
  { secao: 'Acompanhamento estruturado', indicador: 'participacao_verbal', texto: 'O aluno é participativo verbalmente?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Não', 'Em algumas situações', 'Sim'] },
  { secao: 'Acompanhamento estruturado', indicador: 'participacao_atividades_sala', texto: 'O aluno é participativo quanto à realização das atividades em sala?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Não', 'Em algumas situações', 'Sim'] },
  { secao: 'Acompanhamento estruturado', indicador: 'participacao_atividades_casa', texto: 'O aluno é participativo quanto à realização das atividades em casa?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Não', 'Em algumas situações', 'Sim'] },
  { secao: 'Acompanhamento estruturado', indicador: 'interacao_professor', texto: 'Quanto ao nível de interação do aluno com o professor, você classificaria como?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Nenhuma interação', 'Pouca interação', 'Muita interação'] },
  { secao: 'Acompanhamento estruturado', indicador: 'interacao_turma', texto: 'Quanto ao nível de interação do aluno com a turma, você classificaria como?', origem: 'ESTRUTURADA', tipoResposta: 'SELECAO', opcoes: ['Nenhuma interação', 'Pouca interação', 'Muita interação'] },
  { secao: 'Acompanhamento estruturado', indicador: 'rendimento_trimestral', texto: 'Qual o rendimento (nota alcançada) no trimestre?', origem: 'ESTRUTURADA', tipoResposta: 'NUMERO' },
];

// --- Computação (BNCC) — orientação + EF06CO01-10 ---------------------------------------------
const HABILIDADE_OPCOES = ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'];

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

const ORIENTACAO_COMPUTACAO: PerguntaPadrao = {
  secao: 'Computação (BNCC)', subsecao: 'Orientação sobre o preenchimento', texto: COMPUTACAO_ORIENTACAO, origem: 'ORIENTACAO', tipoResposta: 'ORIENTACAO',
};

const HABILIDADES_COMPUTACAO: PerguntaPadrao[] = [
  { subsecao: 'Pensamento Computacional', itens: PENSAMENTO_COMPUTACIONAL },
  { subsecao: 'Mundo Digital', itens: MUNDO_DIGITAL },
  { subsecao: 'Cultura Digital', itens: CULTURA_DIGITAL },
].flatMap(({ subsecao, itens }) => itens.map((item) => ({
  secao: 'Computação (BNCC)', subsecao, codigo: item.codigo, texto: item.descricao,
  origem: 'HABILIDADE' as const, tipoResposta: 'SELECAO' as const, opcoes: HABILIDADE_OPCOES,
})));

// --- Registro pedagógico (qualitativas 10-13) — nunca alimenta gráfico -------------------------
const QUALITATIVAS: PerguntaPadrao[] = [
  { secao: 'Registro pedagógico', texto: 'Que avanços e potencialidades puderam ser identificados no desempenho do(a) aluno(a)?', origem: 'QUALITATIVA', tipoResposta: 'TEXTO' },
  { secao: 'Registro pedagógico', texto: 'Quais aspectos apresentam dificuldades que ainda necessitam de superação? Quais fragilidades persistem no desempenho do(a) estudante?', origem: 'QUALITATIVA', tipoResposta: 'TEXTO' },
  { secao: 'Registro pedagógico', texto: 'Descreva as metodologias e ações adotadas para favorecer o avanço do aluno, bem como indique quais adequações em seu planejamento pedagógico necessitam ser reformuladas.', origem: 'QUALITATIVA', tipoResposta: 'TEXTO' },
  { secao: 'Registro pedagógico', texto: 'Redija um parecer pedagógico conclusivo referente ao trimestre, descrevendo as aprendizagens consolidadas, as habilidades desenvolvidas e as dificuldades apresentadas pelo(a) estudante.', origem: 'QUALITATIVA', tipoResposta: 'TEXTO' },
];

// Conjunto padrão completo (24 perguntas) que TODO modelo novo recebe, em qualquer disciplina —
// nada específico de Inglês (EF06LI*) entra aqui: aquilo foi uma customização manual feita depois
// da criação, não faz parte do padrão (ver seção 18 do pedido — nunca hardcodar disciplina no
// domínio).
export function perguntasPadrao(): PerguntaPadrao[] {
  return [...ESTRUTURADAS, ORIENTACAO_COMPUTACAO, ...HABILIDADES_COMPUTACAO, ...QUALITATIVAS];
}

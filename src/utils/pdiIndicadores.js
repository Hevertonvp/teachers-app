// Definições fixas das perguntas PADRÃO do PDI trimestral, equivalentes às da planilha
// original. Cada pergunta "estruturada" tem um `indicador` interno estável — a Análise de
// Desenvolvimento depende SEMPRE desse indicador, nunca do texto da pergunta ou da sua
// posição, para que a redação possa mudar sem quebrar a série histórica (ver seção 19/25 do
// pedido). Perguntas "qualitativa" e "habilidade" são padrão também (vêm do sistema, protegidas
// contra exclusão), mas não alimentam gráfico — só "estruturada" alimenta.

// --- Acompanhamento estruturado (alimenta a Análise de Desenvolvimento) --------------------
export const PDI_INDICADORES_ESTRUTURADOS = [
  {
    indicador: 'necessidade_alteracao_metodologia',
    pergunta: 'O aluno apresenta necessidade de alteração na metodologia utilizada em sala de aula?',
    tipoResposta: 'selecao',
    opcoes: ['Sim', 'Não'],
    complementar: { gatilho: 'Sim', label: 'Como?' },
  },
  {
    indicador: 'necessidade_alteracao_avaliacao',
    pergunta: 'O aluno apresenta necessidade de alteração nas atividades e avaliações programadas?',
    tipoResposta: 'selecao',
    opcoes: ['Sim', 'Não'],
    complementar: { gatilho: 'Sim', label: 'Como?' },
  },
  {
    indicador: 'nivel_suporte',
    pergunta: 'Qual o nível de suporte necessário para o aluno em sua aula?',
    tipoResposta: 'selecao',
    opcoes: ['Nenhum suporte', 'Pouco suporte', 'Muito suporte'],
    complementar: null,
  },
  {
    indicador: 'participacao_verbal',
    pergunta: 'O aluno é participativo verbalmente?',
    tipoResposta: 'selecao',
    opcoes: ['Não', 'Em algumas situações', 'Sim'],
    complementar: null,
  },
  {
    indicador: 'participacao_atividades_sala',
    pergunta: 'O aluno é participativo quanto à realização das atividades em sala?',
    tipoResposta: 'selecao',
    opcoes: ['Não', 'Em algumas situações', 'Sim'],
    complementar: null,
  },
  {
    indicador: 'participacao_atividades_casa',
    pergunta: 'O aluno é participativo quanto à realização das atividades em casa?',
    tipoResposta: 'selecao',
    opcoes: ['Não', 'Em algumas situações', 'Sim'],
    complementar: null,
  },
  {
    indicador: 'interacao_professor',
    pergunta: 'Quanto ao nível de interação do aluno com o professor, você classificaria como?',
    tipoResposta: 'selecao',
    opcoes: ['Nenhuma interação', 'Pouca interação', 'Muita interação'],
    complementar: null,
  },
  {
    indicador: 'interacao_turma',
    pergunta: 'Quanto ao nível de interação do aluno com a turma, você classificaria como?',
    tipoResposta: 'selecao',
    opcoes: ['Nenhuma interação', 'Pouca interação', 'Muita interação'],
    complementar: null,
  },
  {
    indicador: 'rendimento_trimestral',
    pergunta: 'Qual o rendimento (nota alcançada) no trimestre?',
    tipoResposta: 'numero',
    opcoes: [],
    complementar: null,
  },
];

// --- Registro pedagógico (padrão, qualitativo — nunca alimenta gráfico) --------------------
export const PDI_QUALITATIVAS_PADRAO = [
  { chave: 'avancos_potencialidades', pergunta: 'Que avanços e potencialidades puderam ser identificados no desempenho do(a) aluno(a)?' },
  { chave: 'dificuldades_fragilidades', pergunta: 'Quais aspectos apresentam dificuldades que ainda necessitam de superação? Quais fragilidades persistem no desempenho do(a) estudante?' },
  { chave: 'metodologias_acoes', pergunta: 'Descreva as metodologias e ações adotadas para favorecer o avanço do aluno, bem como indique quais adequações em seu planejamento pedagógico necessitam ser reformuladas.' },
  { chave: 'parecer_conclusivo', pergunta: 'Redija um parecer pedagógico conclusivo referente ao trimestre, descrevendo as aprendizagens consolidadas, as habilidades desenvolvidas e as dificuldades apresentadas pelo(a) estudante.' },
];

// --- Habilidades / procedimentos esperados (BNCC) -------------------------------------------
// Estruturado (código + descrição + escala fixa), mas NÃO alimenta a Análise de Desenvolvimento
// ainda (só "estruturada" alimenta — ver seção 14/26 do pedido: "podem futuramente").
// A lista abaixo é só um EXEMPLO real (Inglês, 6º ano), extraído do documento de referência —
// não é um banco completo de habilidades por disciplina/ano, que exigiria inventar conteúdo de
// currículo que não temos. Ver ressalva no relatório final.
export const HABILIDADE_OPCOES = ['Consegue com autonomia', 'Consegue com mediação', 'Não consegue autonomia', 'Não trabalhado'];

export const PDI_HABILIDADES_EXEMPLO = [
  { codigo: 'EF06LI17', descricao: 'Construir repertório lexical relativo a temas familiares (escola, família, rotina diária, atividades de lazer, esportes, entre outros).' },
  { codigo: 'EF06LI22', descricao: "Descrever relações de posse por meio do caso genitivo com o uso de apóstrofo (') + s." },
  { codigo: 'EF06LI03', descricao: 'Solicitar esclarecimentos em língua inglesa sobre o que não entendeu e o significado das palavras e expressões desconhecidas.' },
  { codigo: 'EF06LI02', descricao: 'Coletar informações do grupo, perguntando e respondendo sobre a família, os amigos, a escola e a comunidade em diálogos simples.' },
  { codigo: 'EF06LI06', descricao: 'Planejar apresentação sobre a família, a comunidade e a escola, compartilhando-a oralmente com o grupo.' },
  { codigo: 'EF06LI23', descricao: 'Empregar, de forma inteligível, os adjetivos possessivos.' },
];

// Evolução de UM indicador estruturado para um aluno: só os trimestres com resposta real
// registrada (nunca inventa ponto). `perguntas` é a lista atual de pdiPerguntas (para achar o
// id da pergunta que carrega esse indicador hoje); `respostas` é pdiRespostas.
export const evolucaoIndicador = (perguntas, respostas, alunoId, indicador, trimestresOrdenados) => {
  const pergunta = perguntas.find(item => item.indicador === indicador);
  if (!pergunta) return null;
  const pontos = trimestresOrdenados
    .map(trimestre => {
      const registro = respostas.find(item => item.alunoId === Number(alunoId) && item.perguntaId === pergunta.id && item.trimestre === trimestre);
      if (!registro || registro.resposta === '' || registro.resposta === null || registro.resposta === undefined) return null;
      return { trimestre, valor: registro.resposta, complementarTexto: registro.complementarTexto || '' };
    })
    .filter(Boolean);
  return { pergunta, pontos };
};

const alunosBase = [
  ['João Silva', '2014-03-12', 'Escola Municipal Aurora', 7, 5, '2022-02-03', '2026-08-05', 'TEA informado pela família', 'F84.0', 'ativo'],
  ['Ana Costa', '2013-11-08', 'Escola Municipal Aurora', 9, 6, '2021-02-01', '2026-08-06', 'TDAH informado no cadastro', 'F90.0', 'ativo'],
  ['Pedro Lima', '2015-01-20', 'Escola Municipal Caminhos', 5, 3, '2023-02-06', '2026-08-08', 'Acompanhamento pedagógico sem CID informado', '', 'ativo'],
  ['Mariana Alves', '2014-07-02', 'Escola Municipal Caminhos', 1, 1, '2022-02-07', '2026-08-01', 'Dificuldade persistente de aprendizagem informada', '', 'ativo'],
  ['Lucas Pereira', '2015-05-17', 'Escola Municipal Modelo', 2, 1, '2023-02-01', '2026-08-02', 'Necessidade de apoio pedagógico individualizado', '', 'ativo'],
  ['Camila Ribeiro', '2013-09-29', 'Escola Municipal Modelo', 4, 2, '2021-02-08', '2026-08-07', 'Deficiência intelectual informada pela família', 'F79', 'ativo'],
  ['Sofia Martins', '2014-12-10', 'Escola Municipal Esperança', 6, 4, '2022-02-02', '2026-08-09', 'Acompanhamento pedagógico sem CID informado', '', 'ativo'],
  ['Gustavo Lima', '2012-06-14', 'Escola Municipal Esperança', 10, 11, '2020-02-03', '2026-08-03', 'Baixa visão informada no cadastro', 'H54.2', 'ativo'],
  ['Isabela Rocha', '2015-04-25', 'Escola Municipal Primavera', 3, 12, '2023-02-06', '2026-08-11', 'Transtorno de linguagem informado', 'F80.9', 'ativo'],
  ['Tiago Moreira', '2013-02-18', 'Escola Municipal Primavera', 8, 10, '2021-02-04', '2026-08-04', 'Acompanhamento pedagógico sem CID informado', '', 'ativo'],
  ['Larissa Gomes', '2014-10-22', 'Escola Municipal Horizonte', 6, 15, '2022-02-01', '2026-08-10', 'Necessidade de apoio pedagógico individualizado', '', 'arquivado'],
  ['Rafael Cardoso', '2015-08-19', 'Escola Municipal Horizonte', 5, 14, '2023-02-02', '2026-08-12', 'TEA informado pela família', 'F84.0', 'ativo'],
];

export const pdiAlunos = alunosBase.map(([nome, dataNascimento, escola, turmaId, professorId, dataEntradaRede, dataInicio, condicaoInformada, cid, status], index) => ({
  id: index + 1,
  nome,
  dataNascimento,
  escola,
  turmaId,
  professorId,
  dataEntradaRede,
  dataInicio,
  condicaoInformada,
  cid,
  status,
}));

export const pdiPerguntasFormulario = [
  { id: 1, pergunta: 'QUE AVANÇOS E POTENCIALIDADES PUDERAM SER IDENTIFICADOS NO DESEMPENHO DO(A) ALUNO(A)?', area: 'Aprendizagem', indicador: 'Avanços e potencialidades', tipoResposta: 'texto', ordem: 1, status: 'ativa' },
  { id: 2, pergunta: 'QUAIS ASPECTOS APRESENTAM DIFICULDADES QUE AINDA NECESSITAM DE SUPERAÇÃO? QUAIS FRAGILIDADES PERSISTEM NO DESEMPENHO DO(A) ESTUDANTE?', area: 'Aprendizagem', indicador: 'Dificuldades e fragilidades', tipoResposta: 'texto', ordem: 2, status: 'ativa' },
  { id: 3, pergunta: 'DESCREVER AS METODOLOGIAS E AÇÕES ADOTADAS PARA FAVORECER O AVANÇO DO(A) ALUNO(A), BEM COMO INDICAR QUAIS ADEQUAÇÕES EM SEU PLANEJAMENTO PEDAGÓGICO NECESSITAM SER REFORMULADAS.', area: 'Aprendizagem', indicador: 'Metodologias e ações', tipoResposta: 'texto', ordem: 3, status: 'ativa' },
  { id: 4, pergunta: 'REDIJA UM PARECER PEDAGÓGICO CONCLUSIVO REFERENTE AO TRIMESTRE, DESCREVENDO AS APRENDIZAGENS CONSOLIDADAS, AS HABILIDADES DESENVOLVIDAS E AS DIFICULDADES APRESENTADAS PELO(A) ESTUDANTE.', area: 'Aprendizagem', indicador: 'Parecer pedagógico conclusivo', tipoResposta: 'texto', ordem: 4, status: 'ativa' },
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

export const pdiRespostasAcompanhamento = pdiAlunos.flatMap((aluno, alunoIndex) => {
  const perguntas = [1, 2, 4, 5];
  return perguntas.flatMap((perguntaId, perguntaIndex) => trendSeries[(alunoIndex + perguntaIndex) % trendSeries.length].map((resposta, mesIndex) => ({
    id: alunoIndex * 1000 + perguntaIndex * 100 + mesIndex + 1,
    alunoId: aluno.id,
    perguntaId,
    data: `2026-${String(mesIndex + 1).padStart(2, '0')}-${String(10 + alunoIndex % 12).padStart(2, '0')}`,
    resposta,
    observacao: 'Resposta registrada em acompanhamento pedagógico do PDI.',
  })));
});
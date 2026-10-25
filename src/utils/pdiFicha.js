// Helpers de preenchimento de Ficha PDI compartilhados entre a tela de UMA Ficha
// (FormularioPdiProfessor.jsx) e o formulário único do aluno (FormularioPdiAlunoPage.jsx).

// Valor salvo no backend (RespostaPdi.valor / RespostaPadraoPdi.valor) -> estado de edição da tela.
export const answerFromResposta = (question, respostaRow) => {
  const valor = respostaRow?.valor || {};
  if (question.tipoResposta === 'numero') {
    return { valor: valor.resposta === undefined || valor.resposta === null || valor.resposta === '' ? '' : String(valor.resposta) };
  }
  if (question.tipoResposta === 'selecao') return { opcao: valor.resposta || '', complementar: valor.complementarTexto || '' };
  // Habilidades do CRMG: o valor salvo já traz código/descrição congelados das marcadas.
  if (question.tipoResposta === 'habilidade_crmg') return { todas: !!valor.todas, habilidades: valor.habilidades || [], componenteNome: valor.componenteNome };
  if (question.tipoResposta === 'marcacao') return { marcado: !!valor.resposta, complementar: valor.complementarTexto || '' };
  return { texto: valor.resposta || '', complementar: '' };
};

// Agrupa as perguntas por seção/subseção preservando a ordem em que aparecem no snapshot —
// genérico para qualquer disciplina, não assume nenhuma seção específica.
export const agruparPorSecao = (questions) => {
  const secoes = [];
  questions.forEach(question => {
    const secaoNome = question.secao || 'Perguntas';
    let secao = secoes.find(item => item.nome === secaoNome);
    if (!secao) { secao = { nome: secaoNome, subsecoes: [] }; secoes.push(secao); }
    const subsecaoNome = question.subsecao || null;
    let subsecao = secao.subsecoes.find(item => item.nome === subsecaoNome);
    if (!subsecao) { subsecao = { nome: subsecaoNome, questions: [] }; secao.subsecoes.push(subsecao); }
    subsecao.questions.push(question);
  });
  return secoes;
};

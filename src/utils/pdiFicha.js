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

// DEF-19 — rascunho local × versão atual do servidor (formulário único do aluno e tela de UMA Ficha).
// O rascunho guarda `base`: a versão do servidor sobre a qual foi escrito (updatedAt da Ficha ou
// version do bloco comum). Resultado:
//   'nenhum'    — não há rascunho;
//   'igual'     — o servidor já tem exatamente esse conteúdo (descartar o rascunho);
//   'recuperar' — o servidor não mudou depois: recuperar como sempre;
//   'conflito'  — o servidor mudou depois (ou rascunho antigo, sem `base`, e o servidor já tem outra
//                 resposta): NÃO misturar; mostrar a versão salva e deixar o professor escolher.
export const analisarRascunho = (draft, perguntas, baseServidor, temRespostaNoServidor, versaoServidor) => {
  if (!draft) return { tipo: 'nenhum' };
  const ids = (draft.touchedIds || []).filter(id => perguntas.some(question => question.id === id));
  const diferentes = ids.filter(id => JSON.stringify(draft.answers?.[id]) !== JSON.stringify(baseServidor[id]));
  if (diferentes.length === 0) return { tipo: 'igual' };
  const servidorMudou = draft.base === undefined ? diferentes.some(temRespostaNoServidor) : draft.base !== versaoServidor;
  return { tipo: servidorMudou ? 'conflito' : 'recuperar', ids, answers: draft.answers };
};

export const MENSAGEM_CONFLITO_RASCUNHO = 'Recuperamos o que você digitou neste aparelho, mas esta parte foi alterada depois em outro lugar. Os campos mostram a versão salva; nada foi enviado nem sobrescrito. Escolha qual versão manter.';

// Regra de visibilidade e identidade do PDI por disciplina (ver CLAUDE.md / pedido do módulo
// PDI). Uma FICHA é a combinação (aplicação PDI + disciplina + aluno) — nunca um aluno sozinho.
// Estas funções são puras e genéricas: nada aqui depende de "Inglês" especificamente, só do
// conteúdo que os modelos/aplicações carregam. Uma nova disciplina passa a aparecer aqui assim
// que tiver um modelo cadastrado, sem precisar mudar nenhuma função deste arquivo.
import { getFormStatus } from './formAvailability';
import { eventosPreenchimentoFicha } from './pdiHistorico';

// Modelo ativo de uma disciplina (no máximo um é esperado por disciplina nesta etapa). Sem
// modelo => sem ficha para essa disciplina, nunca um formulário genérico no lugar.
export const modeloAtivoDaDisciplina = (pdiModelos, disciplinaId) => (
  pdiModelos.find(modelo => modelo.disciplinaId === Number(disciplinaId) && modelo.status === 'ativa')
);

// Snapshot de uma disciplina dentro de uma aplicação já criada (congelado no momento da
// criação da aplicação — ver createPdiAplicacao em DataContext.jsx).
export const snapshotDaDisciplina = (aplicacao, disciplinaId) => (
  aplicacao?.modelos.find(modelo => modelo.disciplinaId === Number(disciplinaId))
);

export const statusVigenciaAplicacao = (aplicacao, currentDate) => getFormStatus(aplicacao.dataInicio, aplicacao.dataFim, currentDate);

// Duas vigências se sobrepõem quando um intervalo começa antes do outro terminar E termina
// depois do outro começar (datas iguais nas pontas contam como sobreposição — ver seção
// "REGRA DE COMPARAÇÃO" do pedido de vigência das aplicações PDI).
const vigenciasSobrepoem = (a, b) => a.dataInicio <= b.dataFim && a.dataFim >= b.dataInicio;

// Sobreposição só é comparada dentro da MESMA escola — escolas diferentes têm vigências
// totalmente independentes, mesmo com datas iguais ou sobrepostas entre si. `ignorarId` exclui
// a própria aplicação da comparação ao editar (ela nunca conflita consigo mesma).
export const existeSobreposicaoNaEscola = (aplicacoesExistentes, { escolaId, dataInicio, dataFim, ignorarId = null }) => (
  aplicacoesExistentes.some(existente => (
    existente.escolaId === Number(escolaId)
    && existente.id !== ignorarId
    && vigenciasSobrepoem({ dataInicio, dataFim }, existente)
  ))
);

export const MENSAGEM_SOBREPOSICAO_APLICACAO = 'Já existe uma aplicação PDI para esta escola dentro desse período. Escolha uma vigência que não sobreponha a aplicação existente.';

// Fichas às quais um PROFESSOR tem direito: derivadas só de turmaProfessores (nunca de
// aluno.professorId) + aplicações da escola da turma + modelo existente para a disciplina do
// vínculo. Um professor com vínculo em duas disciplinas na mesma turma recebe uma ficha por
// disciplina (desde que exista modelo); sem modelo, aquela disciplina simplesmente não gera
// ficha (sem fallback). Só vínculos ATIVOS contam — se o professor deixar de lecionar aquela
// turma/disciplina, ele para de receber as fichas dela imediatamente (o histórico das respostas
// já dadas continua preservado, ver pdiFichaRespostas).
export const fichasDoProfessor = (professorId, { turmaProfessores, pdiAlunos, pdiAplicacoes, disciplinas, turmas }) => {
  const vinculos = turmaProfessores.filter(vinculo => vinculo.professorId === Number(professorId) && vinculo.status === 'ativo');
  const fichas = [];

  vinculos.forEach(vinculo => {
    const turma = turmas.find(item => item.id === vinculo.turmaId);
    if (!turma) return;

    const alunosDaTurma = pdiAlunos.filter(aluno => aluno.turmaId === turma.id && aluno.status !== 'arquivado');
    if (alunosDaTurma.length === 0) return;

    const aplicacoesDaEscolaDaTurma = pdiAplicacoes.filter(aplicacao => aplicacao.escolaId === turma.escolaId);
    if (aplicacoesDaEscolaDaTurma.length === 0) return;

    aplicacoesDaEscolaDaTurma.forEach(aplicacao => {
      const snapshot = snapshotDaDisciplina(aplicacao, vinculo.disciplinaId);
      if (!snapshot) return;

      alunosDaTurma.forEach(aluno => {
        fichas.push({
          id: `${aplicacao.id}-${vinculo.disciplinaId}-${aluno.id}`,
          aplicacaoId: aplicacao.id,
          dataInicio: aplicacao.dataInicio,
          dataFim: aplicacao.dataFim,
          escolaId: aplicacao.escolaId,
          disciplinaId: vinculo.disciplinaId,
          disciplinaNome: disciplinas.find(item => item.id === vinculo.disciplinaId)?.nome || 'Disciplina não encontrada',
          modeloNome: snapshot.nome,
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          turmaId: turma.id,
          turmaNome: turma.nome,
          professorId: Number(professorId),
        });
      });
    });
  });

  return fichas;
};

// Fichas possíveis para um aluno, do ponto de vista do Gestor/Supervisor: qualquer disciplina
// com modelo dentro de uma aplicação da escola da turma do aluno — sem exigir vínculo em
// turmaProfessores (o Gestor supervisiona, não "leciona"). Usado para o Gestor escolher qual
// ficha abrir quando há mais de uma disciplina disponível (ver PdiAlunoPerfil.jsx).
export const fichasDoAlunoParaGestor = (aluno, { pdiAplicacoes, disciplinas, turmas }) => {
  const turma = turmas.find(item => item.id === aluno?.turmaId);
  if (!turma) return [];

  return pdiAplicacoes
    .filter(aplicacao => aplicacao.escolaId === turma.escolaId)
    .flatMap(aplicacao => aplicacao.modelos.map(snapshot => ({
      aplicacaoId: aplicacao.id,
      dataInicio: aplicacao.dataInicio,
      dataFim: aplicacao.dataFim,
      escolaId: aplicacao.escolaId,
      disciplinaId: snapshot.disciplinaId,
      disciplinaNome: disciplinas.find(item => item.id === snapshot.disciplinaId)?.nome || 'Disciplina não encontrada',
      modeloNome: snapshot.nome,
    })));
};

// Alguma resposta real (não vazia) já salva para esta ficha — inclui rascunhos salvos antes do
// envio final (ver persistAnswer em FormularioPdiProfessor.jsx), não só o que foi enviado.
const temRespostaSalva = (respostas, aplicacao) => respostas.some(item => (
  item.aplicacaoId === aplicacao.aplicacaoId
  && item.disciplinaId === aplicacao.disciplinaId
  && item.alunoId === aplicacao.alunoId
  && item.resposta !== '' && item.resposta !== null && item.resposta !== undefined
));

// Status de exibição de uma ficha:
// - 'concluido': já houve algum envio ("Enviar formulário") registrado no histórico da ficha;
// - 'em_andamento': tem pelo menos uma resposta salva como rascunho, mas nunca foi enviada
//   (formulário preenchido pela metade — ver persistAnswer, que salva a cada campo alterado);
// - 'nao_preenchido': a vigência já encerrou sem nenhum envio;
// - 'pendente': dentro ou antes da vigência, sem nenhuma resposta ainda.
export const statusFicha = ({ aplicacao, historico, respostas = [], currentDate }) => {
  const jaPreenchida = eventosPreenchimentoFicha(historico, aplicacao.aplicacaoId, aplicacao.disciplinaId, aplicacao.alunoId).length > 0;
  if (jaPreenchida) return 'concluido';
  if (temRespostaSalva(respostas, aplicacao)) return 'em_andamento';
  if (statusVigenciaAplicacao(aplicacao, currentDate) === 'expired') return 'nao_preenchido';
  return 'pendente';
};

export const STATUS_FICHA_LABEL = {
  concluido: 'Concluído',
  em_andamento: 'Em preenchimento',
  pendente: 'Pendente',
  nao_preenchido: 'Não preenchido',
};

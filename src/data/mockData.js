// Dados mockados centralizados para o protótipo frontend.

export const professores = [
  { id: 1, nome: 'Cláudia Santos', email: 'claudia.santos@escola.gov.br', turmas: [1, 2], disciplinas: [1, 2], avatar: 'CS' },
  { id: 2, nome: 'Roberto Oliveira', email: 'roberto.oliveira@escola.gov.br', turmas: [3, 4], disciplinas: [3, 4], avatar: 'RO' },
  { id: 3, nome: 'Fernanda Costa', email: 'fernanda.costa@escola.gov.br', turmas: [1, 5], disciplinas: [2, 5], avatar: 'FC' },
  { id: 4, nome: 'Maria Silva', email: 'maria.silva@escola.gov.br', turmas: [6], disciplinas: [1], avatar: 'MS' },
  { id: 5, nome: 'João Souza', email: 'joao.souza@escola.gov.br', turmas: [7, 8], disciplinas: [2], avatar: 'JS' },
  { id: 6, nome: 'Ana Costa', email: 'ana.costa@escola.gov.br', turmas: [2, 9], disciplinas: [3], avatar: 'AC' },
  { id: 7, nome: 'Carlos Mendes', email: 'carlos.mendes@escola.gov.br', turmas: [4, 10], disciplinas: [4], avatar: 'CM' },
  { id: 8, nome: 'Patrícia Lima', email: 'patricia.lima@escola.gov.br', turmas: [5, 6], disciplinas: [5], avatar: 'PL' },
  { id: 9, nome: 'Marcos Almeida', email: 'marcos.almeida@escola.gov.br', turmas: [7], disciplinas: [1, 3], avatar: 'MA' },
  { id: 10, nome: 'Juliana Rocha', email: 'juliana.rocha@escola.gov.br', turmas: [8, 9], disciplinas: [2, 4], avatar: 'JR' },
  { id: 11, nome: 'Rafael Nunes', email: 'rafael.nunes@escola.gov.br', turmas: [10], disciplinas: [1], avatar: 'RN' },
  { id: 12, nome: 'Beatriz Ferreira', email: 'beatriz.ferreira@escola.gov.br', turmas: [1, 3], disciplinas: [5], avatar: 'BF' },
  { id: 13, nome: 'Luciana Barbosa', email: 'luciana.barbosa@escola.gov.br', turmas: [2, 4], disciplinas: [3], avatar: 'LB' },
  { id: 14, nome: 'Eduardo Martins', email: 'eduardo.martins@escola.gov.br', turmas: [5, 7], disciplinas: [4], avatar: 'EM' },
  { id: 15, nome: 'Renata Araújo', email: 'renata.araujo@escola.gov.br', turmas: [6, 8], disciplinas: [1, 2], avatar: 'RA' },
];

export const gestores = [
  { id: 1, nome: 'Helena Duarte', email: 'gestor@escola.gov.br', cargo: 'Diretora Pedagógica', avatar: 'HD' },
  { id: 2, nome: 'Sérgio Batista', email: 'sergio.batista@escola.gov.br', cargo: 'Supervisor Educacional', avatar: 'SB' },
];

export const turmas = [
  { id: 1, nome: '4º Ano A', ciclo: 'Ensino Fundamental', professores: [1, 3, 12], quantidadeAlunos: 29 },
  { id: 2, nome: '4º Ano B', ciclo: 'Ensino Fundamental', professores: [1, 6, 13], quantidadeAlunos: 31 },
  { id: 3, nome: '5º Ano A', ciclo: 'Ensino Fundamental', professores: [2, 12], quantidadeAlunos: 30 },
  { id: 4, nome: '5º Ano B', ciclo: 'Ensino Fundamental', professores: [2, 7, 13], quantidadeAlunos: 28 },
  { id: 5, nome: '6º Ano A', ciclo: 'Ensino Fundamental', professores: [3, 8, 14], quantidadeAlunos: 32 },
  { id: 6, nome: '6º Ano B', ciclo: 'Ensino Fundamental', professores: [4, 8, 15], quantidadeAlunos: 27 },
  { id: 7, nome: '7º Ano A', ciclo: 'Ensino Fundamental', professores: [5, 9, 14], quantidadeAlunos: 33 },
  { id: 8, nome: '7º Ano B', ciclo: 'Ensino Fundamental', professores: [5, 10, 15], quantidadeAlunos: 26 },
  { id: 9, nome: '8º Ano A', ciclo: 'Ensino Fundamental', professores: [6, 10], quantidadeAlunos: 35 },
  { id: 10, nome: '9º Ano A', ciclo: 'Ensino Fundamental', professores: [7, 11], quantidadeAlunos: 25 },
];

export const disciplinas = [
  { id: 1, nome: 'Língua Portuguesa', cor: 'bg-blue-100' },
  { id: 2, nome: 'Matemática', cor: 'bg-emerald-100' },
  { id: 3, nome: 'Ciências', cor: 'bg-amber-100' },
  { id: 4, nome: 'História', cor: 'bg-indigo-100' },
  { id: 5, nome: 'Geografia', cor: 'bg-teal-100' },
];

const conteudos = [
  'Leitura e interpretação de textos informativos',
  'Operações com números racionais',
  'Ecossistemas e preservação ambiental',
  'Brasil República e cidadania',
  'Mapas, território e paisagem',
  'Produção de narrativas curtas',
  'Resolução de problemas matemáticos',
  'Saúde, corpo humano e hábitos preventivos',
  'Patrimônio cultural local',
  'Regiões brasileiras e diversidade',
];

export const formulariosUmTerco = Array.from({ length: 30 }, (_, index) => {
  const professorId = (index % professores.length) + 1;
  const professor = professores.find(item => item.id === professorId);
  const turmaId = professor.turmas[index % professor.turmas.length];
  const disciplinaId = professor.disciplinas[index % professor.disciplinas.length];
  const statusCycle = ['concluido', 'concluido', 'concluido', 'em_andamento', 'pendente', 'em_atraso'];
  const status = index === 0 ? 'em_atraso' : statusCycle[index % statusCycle.length];
  const dia = String((index % 24) + 1).padStart(2, '0');

  return {
    id: index + 1,
    professorId,
    turmaId,
    disciplinaId,
    data: `2026-08-${dia}`,
    conteudo: conteudos[index % conteudos.length],
    objetivo: 'Organizar habilidades prioritárias e evidências esperadas para o período.',
    metodologia: index % 2 === 0 ? 'Sequência didática com atividades em duplas e devolutivas curtas.' : 'Aula dialogada, produção guiada e registro no caderno.',
    status,
    prazo: index === 0 ? '2026-08-26' : status === 'em_atraso' ? `2026-08-${String((index % 9) + 1).padStart(2, '0')}` : `2026-09-${String((index % 18) + 5).padStart(2, '0')}`,
    atualizadoEm: `${index + 5} min`,
  };
});

export const pdis = Array.from({ length: 20 }, (_, index) => {
  const professorId = ((index + 3) % professores.length) + 1;
  const professor = professores.find(item => item.id === professorId);
  const statusCycle = ['concluido', 'em_andamento', 'concluido', 'pendente', 'em_atraso'];
  const alunos = ['Lucas Pereira', 'Mariana Alves', 'Pedro Henrique', 'Camila Ribeiro', 'Sofia Martins', 'Gustavo Lima', 'Isabela Rocha', 'Tiago Moreira'];
  const status = index === 12 ? 'pendente' : statusCycle[index % statusCycle.length];

  return {
    id: index + 1,
    aluno: alunos[index % alunos.length],
    professorId,
    turmaId: professor.turmas[index % professor.turmas.length],
    dataAcompanhamento: `2026-08-${String((index % 22) + 1).padStart(2, '0')}`,
    indicador: ['Participação', 'Leitura', 'Escrita', 'Raciocínio lógico'][index % 4],
    nivelAtual: (index % 5) + 1,
    observacao: 'Registro de acompanhamento com foco em intervenções objetivas para o próximo ciclo.',
    status,
    prazo: index === 12 ? '2026-09-02' : status === 'em_atraso' ? `2026-08-${String((index % 7) + 2).padStart(2, '0')}` : `2026-09-${String((index % 15) + 8).padStart(2, '0')}`,
    atualizadoEm: `${index + 12} min`,
  };
});

export const correcoesSimulados = Array.from({ length: 25 }, (_, index) => {
  const professorId = ((index + 6) % professores.length) + 1;
  const professor = professores.find(item => item.id === professorId);
  const quantidadeAlunos = 24 + (index % 12);
  const statusCycle = ['concluido', 'em_andamento', 'pendente', 'concluido', 'em_atraso'];
  const status = index === 8 ? 'em_andamento' : statusCycle[index % statusCycle.length];
  const quantidadeCorrigida = status === 'concluido' ? quantidadeAlunos : status === 'pendente' ? 0 : Math.floor(quantidadeAlunos * (0.35 + (index % 4) * 0.12));

  return {
    id: index + 1,
    professorId,
    turmaId: professor.turmas[index % professor.turmas.length],
    simulado: `${(index % 3) + 1}º Simulado Municipal`,
    disciplinaId: professor.disciplinas[index % professor.disciplinas.length],
    dataAplicacao: `2026-08-${String((index % 18) + 1).padStart(2, '0')}`,
    prazoCorrecao: index === 8 ? '2026-09-04' : status === 'em_atraso' ? `2026-08-${String((index % 8) + 3).padStart(2, '0')}` : `2026-09-${String((index % 14) + 6).padStart(2, '0')}`,
    dataCorrecao: status === 'concluido' ? `2026-08-${String((index % 20) + 4).padStart(2, '0')}` : '',
    quantidadeAlunos,
    quantidadeCorrigida,
    status,
    atualizadoEm: `${index + 20} min`,
  };
});

export const planejamentos = formulariosUmTerco.map(item => ({
  id: item.id,
  professorId: item.professorId,
  turmaId: item.turmaId,
  disciplinaId: item.disciplinaId,
  titulo: item.conteudo,
  descricao: item.objetivo,
  dataInicio: item.data,
  dataFim: item.prazo,
  objetivos: item.objetivo,
  conteudos: item.conteudo,
  metodologia: item.metodologia,
  avaliacao: 'Registro acompanhado pela coordenação pedagógica.',
  status: item.status === 'concluido' ? 'concluído' : item.status === 'em_atraso' ? 'pendente' : item.status,
  dataPreenchimento: item.status === 'concluido' ? item.data : null,
  preenchidoPor: item.status === 'concluido' ? item.professorId : null,
}));

export const calendarioPedagogico = [
  { id: 1, titulo: 'Início do Ano Letivo', data: '2026-02-02', tipo: 'evento' },
  { id: 2, titulo: 'Avaliação Diagnóstica', data: '2026-03-05', tipo: 'evento' },
  { id: 3, titulo: 'Conselho de Classe', data: '2026-05-22', tipo: 'evento' },
  { id: 4, titulo: 'Recesso Escolar', data: '2026-07-01', tipo: 'recesso' },
  { id: 5, titulo: 'Simulado Municipal', data: '2026-08-12', tipo: 'evento' },
  { id: 6, titulo: 'Fechamento do Trimestre', data: '2026-09-30', tipo: 'evento' },
];

export const eventosPedagogicos = [
  {
    id: 1,
    titulo: 'Reunião pedagógica com coordenadores',
    descricao: 'Alinhamento das pendências do Formulário 1/3, PDI e correções dos simulados.',
    data: '2026-09-04',
    tipo: 'Reunião',
    local: 'Sala da coordenação',
  },
  {
    id: 2,
    titulo: 'Sábado letivo de recomposição',
    descricao: 'Atividades de reforço com foco em leitura, escrita e resolução de problemas.',
    data: '2026-09-12',
    tipo: 'Sábado letivo',
    local: 'Unidades escolares',
  },
  {
    id: 3,
    titulo: 'Formação de professores',
    descricao: 'Encontro formativo sobre registros pedagógicos e acompanhamento das aprendizagens.',
    data: '2026-09-18',
    tipo: 'Formação',
    local: 'Auditório municipal',
  },
  {
    id: 4,
    titulo: 'Conselho de classe bimestral',
    descricao: 'Análise dos indicadores das turmas e definição de encaminhamentos pedagógicos.',
    data: '2026-09-25',
    tipo: 'Conselho',
    local: 'Escola Municipal Modelo',
  },
  {
    id: 5,
    titulo: 'Aplicação do simulado municipal',
    descricao: 'Aplicação padronizada do simulado para acompanhamento da rede.',
    data: '2026-10-03',
    tipo: 'Simulado',
    local: 'Todas as turmas',
  },
];

export const formulariosPrazos = [
  {
    id: 'formulario_um_terco',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    fillingPeriods: [
      { startDate: '2026-09-01', endDate: '2026-09-07' },
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      { startDate: '2026-09-15', endDate: '2026-09-21' },
      { startDate: '2026-09-22', endDate: '2026-09-30' },
    ],
  },
  {
    id: 'pdi',
    startDate: '2026-09-01',
    endDate: '2026-09-10',
  },
  {
    id: 'correcoes_simulados',
    startDate: '2026-08-25',
    endDate: '2026-08-30',
  },
];

export const usuarios = [
  { id: 1, email: 'professor@escola.gov.br', senha: '123456', tipo: 'professor', professorId: 1 },
  { id: 2, email: 'gestor@escola.gov.br', senha: '123456', tipo: 'gestor', gestorId: 1 },
];

export const notificacoesAtraso = [
  { id: 1, professorId: 4, formulario: 'Correções dos simulados', diasAtraso: 3, prazo: '2026-08-08', descricao: 'Correções pendentes após o prazo definido.' },
  { id: 2, professorId: 5, formulario: 'Formulário 1/3', diasAtraso: 2, prazo: '2026-08-09', descricao: 'Registro de conteúdos ainda não enviado.' },
  { id: 3, professorId: 6, formulario: 'PDI', diasAtraso: 1, prazo: '2026-08-10', descricao: 'Acompanhamento individual precisa ser atualizado.' },
];
// Dados mockados centralizados para o protótipo frontend.
import { getEscolaIdsAplicaveis, RECURSOS } from '../utils/aplicabilidade';
import { pdiAlunos } from './pdiData';

export const professores = [
  { id: 1, nome: 'Cláudia Santos', email: 'claudia.santos@escola.gov.br', disciplinas: [1, 2], avatar: 'CS', status: 'ativo' },
  { id: 2, nome: 'Roberto Oliveira', email: 'roberto.oliveira@escola.gov.br', disciplinas: [3, 4], avatar: 'RO', status: 'ativo' },
  { id: 3, nome: 'Fernanda Costa', email: 'fernanda.costa@escola.gov.br', disciplinas: [2, 5], avatar: 'FC', status: 'ativo' },
  { id: 4, nome: 'Maria Silva', email: 'maria.silva@escola.gov.br', disciplinas: [1], avatar: 'MS', status: 'ativo' },
  { id: 5, nome: 'João Souza', email: 'joao.souza@escola.gov.br', disciplinas: [2], avatar: 'JS', status: 'ativo' },
  { id: 6, nome: 'Ana Costa', email: 'ana.costa@escola.gov.br', disciplinas: [3], avatar: 'AC', status: 'ativo' },
  { id: 7, nome: 'Carlos Mendes', email: 'carlos.mendes@escola.gov.br', disciplinas: [4], avatar: 'CM', status: 'ativo' },
  { id: 8, nome: 'Patrícia Lima', email: 'patricia.lima@escola.gov.br', disciplinas: [5], avatar: 'PL', status: 'ativo' },
  { id: 9, nome: 'Marcos Almeida', email: 'marcos.almeida@escola.gov.br', disciplinas: [1, 3], avatar: 'MA', status: 'ativo' },
  { id: 10, nome: 'Juliana Rocha', email: 'juliana.rocha@escola.gov.br', disciplinas: [2, 4], avatar: 'JR', status: 'ativo' },
  { id: 11, nome: 'Rafael Nunes', email: 'rafael.nunes@escola.gov.br', disciplinas: [1], avatar: 'RN', status: 'ativo' },
  { id: 12, nome: 'Beatriz Ferreira', email: 'beatriz.ferreira@escola.gov.br', disciplinas: [5], avatar: 'BF', status: 'ativo' },
  { id: 13, nome: 'Luciana Barbosa', email: 'luciana.barbosa@escola.gov.br', disciplinas: [3], avatar: 'LB', status: 'ativo' },
  { id: 14, nome: 'Eduardo Martins', email: 'eduardo.martins@escola.gov.br', disciplinas: [4], avatar: 'EM', status: 'ativo' },
  { id: 15, nome: 'Renata Araújo', email: 'renata.araujo@escola.gov.br', disciplinas: [1, 2], avatar: 'RA', status: 'ativo' },
];

export const gestores = [
  { id: 1, nome: 'Helena Duarte', email: 'gestor@escola.gov.br', cargo: 'Supervisora Educacional', avatar: 'HD', status: 'ativo' },
  { id: 2, nome: 'Sérgio Batista', email: 'sergio.batista@escola.gov.br', cargo: 'Supervisor Educacional', avatar: 'SB', status: 'ativo' },
];

// Diretores: cadastro administrativo por enquanto (sem login próprio) — cada um dirige
// uma escola (vínculo 1:1 semeado abaixo), gerenciado pela Secretaria em Gestão de Pessoas.
export const diretores = [
  { id: 1, nome: 'Marcos Vinícius Teixeira', email: 'marcos.teixeira@escola.gov.br', cargo: 'Diretor Escolar', avatar: 'MT', status: 'ativo' },
  { id: 2, nome: 'Cristina Alves Pinto', email: 'cristina.pinto@escola.gov.br', cargo: 'Diretora Escolar', avatar: 'CP', status: 'ativo' },
  { id: 3, nome: 'Fábio Ramos Cardoso', email: 'fabio.cardoso@escola.gov.br', cargo: 'Diretor Escolar', avatar: 'FC', status: 'ativo' },
  { id: 4, nome: 'Vanessa Souza Lima', email: 'vanessa.lima@escola.gov.br', cargo: 'Diretora Escolar', avatar: 'VL', status: 'ativo' },
  { id: 5, nome: 'André Luiz Freitas', email: 'andre.freitas@escola.gov.br', cargo: 'Diretor Escolar', avatar: 'AF', status: 'ativo' },
  { id: 6, nome: 'Patrícia Gomes Duarte', email: 'patricia.duarte@escola.gov.br', cargo: 'Diretora Escolar', avatar: 'PD', status: 'ativo' },
];

export const secretarias = [
  { id: 1, nome: 'Secretaria Municipal de Educação', email: 'secretaria@escola.gov.br', cargo: 'Secretaria de Educação', avatar: 'SE' },
];

// status 'inativa' em uma escola preserva os dados históricos (turmas, formulários, PDI),
// mas bloqueia o acesso operacional de professor/supervisor (ver utils/escolas.js).
export const escolas = [
  { id: 1, nome: 'CENTRO EDUCACIONAL INFANTIL DEA VERARDO LOURES', endereco: 'Esmeralda Furtado Louras, 160 - Alto dos Pinheiros - São João Nepomuceno/MG', cep: '36686-327', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 2, nome: 'CMEI PROF UBI BARROSO SILVA', endereco: 'Presidente Getúlio Vargas, 32 - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 3, nome: 'CRECHE MUNICIPAL PIPOQUINHA DOCE', endereco: 'Nelson Henriques Cruz, 123 - Bela Vista - São João Nepomuceno/MG', cep: '36684-426', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 4, nome: 'CRECHE MUNICIPAL SEMENTINHA DA VIDA', endereco: 'Elza Sporch de Freitas, 235 - Distrito Industrial - São João Nepomuceno/MG', cep: '36682-496', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 5, nome: 'EM CAPITAO MANOEL MOREIRA', endereco: 'Faz. dos Teixeiras, 0 - São João Nepomuceno/MG', cep: '36688-000', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 6, nome: 'EM CEL JOSE BRAS', endereco: 'Coronel Jose Braz, 52 - Centro - São João Nepomuceno/MG', cep: '36680-084', rede: 'municipal', zona: 'Urbana', status: 'inativa' },
  { id: 7, nome: 'EM DE ENSINO FUNDAMENTAL - ANOS INICIAIS', endereco: 'Rural, 0 - Área Rural de São João Nepomuceno/MG', cep: '36687-899', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 8, nome: 'EM DE ENSINO FUNDAMENTAL - ANOS INICIAIS', endereco: 'Doutor Joao de Cavalheiro, 474 - Aeroporto - São João Nepomuceno/MG', cep: '36686-440', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 9, nome: 'EM DO LARANJAL', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 10, nome: 'EM DONA PRUDENCIANA FAUSTINA DE SAO JOSE', endereco: 'Professor Gabriel Arcanjo Mendonca, 70 - Centro - São João Nepomuceno/MG', cep: '36680-063', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 11, nome: 'EM DR AUGUSTO GLORIA', endereco: 'Praça Treze de Maio, 602 - Matriz - São João Nepomuceno/MG', cep: '36680-244', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 12, nome: 'EM DR JOAO CAVALHEIRO', endereco: 'Rua Carlos Stiebler - Centro - São João Nepomuceno/MG', cep: '36688-500', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 13, nome: 'EM DR PERICLES VIEIRA DE MENDONCA', endereco: 'Norma Pimenta Menezes, s/n - Novo Horizonte - São João Nepomuceno/MG', cep: '36684-304', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 14, nome: 'EM FARMACEUTICO DARIO MEDINA', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 15, nome: 'EM FAUSTO PROCOPIO NETTO', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 16, nome: 'EM FRANCISCO SOUZA CASTRO', endereco: 'Rua Elvira Maria Favero Azevedo - São João Nepomuceno/MG', cep: '36689-500', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 17, nome: 'EM JOSE GONCALVES FILGUEIRAS', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 18, nome: 'EM OLIVIA ANTUNES LOPES', endereco: 'Rua Nicodemos Alves Souza - São João Nepomuceno/MG', cep: '36689-500', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 19, nome: 'EM OTAVIO GONCALVES', endereco: 'Praça Joao Teodosio Araujo, s/n - São João Nepomuceno/MG', cep: '36689-000', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 20, nome: 'EM SAO BENTO', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 21, nome: 'EM SAO DOMINGOS', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 22, nome: 'EM SAO GERALDO', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 23, nome: 'EM SILVESTRE DETONI', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 24, nome: 'EM SITIO CORREGO DE SANTANA', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 25, nome: 'EM TRES MARIAS', endereco: 'Antonio Duarte Bezerra, s/n - Três Marias - São João Nepomuceno/MG', cep: '36684-180', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 26, nome: 'EM VARGEM GRANDE', endereco: 'Rua Presidente Getulio Vargas - Centro - São João Nepomuceno/MG', cep: '36680-057', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 27, nome: 'PEM ALGODAO DOCE', endereco: 'Doutor Joao de Cavalheiro, 474 - Aeroporto - São João Nepomuceno/MG', cep: '36686-440', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 28, nome: 'PEM CANTINHO FELIZ', endereco: 'Barao de Sao Joao - Centro - São João Nepomuceno/MG', cep: '36680-054', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 29, nome: 'PEM COELHINHO FUJAO', endereco: 'Rua Otavio Goncalves, 0 - Centro - São João Nepomuceno/MG', cep: '36689-000', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 30, nome: 'PEM ITALIA CAUTIERO FRANCO', endereco: 'Rural - Área Rural de São João Nepomuceno/MG', cep: '36687-899', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 31, nome: 'PEM PATINHO FELIZ', endereco: 'Rua Nicodemos Alves Souza - Povoado de Araci - São João Nepomuceno/MG', cep: '36689-500', rede: 'municipal', zona: 'Rural', status: 'ativa' },
  { id: 32, nome: 'PEM PEIXINHO DOURADO', endereco: 'Rua Pedro Crescembene, s/n - Centro - São João Nepomuceno/MG', cep: '36688-500', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 33, nome: 'PEM REINO DA FANTASIA', endereco: 'Norma Pimenta Menezes - Novo Horizonte - São João Nepomuceno/MG', cep: '36684-304', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
  { id: 34, nome: 'PEM URSINHO SABIDO', endereco: 'Antonio Duarte Bezerra, s/n - Três Marias - São João Nepomuceno/MG', cep: '36684-180', rede: 'municipal', zona: 'Urbana', status: 'ativa' },
];

// `quantidadeAlunos` é só uma contagem — hoje não existe uma entidade `alunos` genérica da
// rede (só os alunos do módulo PDI, em pdiData.js). Não preencher aqui com alunos fictícios;
// o modelo já está pronto para receber futuramente uma coleção `alunos` real (turmaId, nome,
// ...) sem precisar mudar a forma de `turmas` — é só passar a somar a partir dela em vez de
// usar este campo.
export const turmas = [
  { id: 1, nome: '4º Ano A', ciclo: 'Ensino Fundamental', escolaId: 2, quantidadeAlunos: 29 },
  { id: 2, nome: '4º Ano B', ciclo: 'Ensino Fundamental', escolaId: 3, quantidadeAlunos: 31 },
  { id: 3, nome: '5º Ano A', ciclo: 'Ensino Fundamental', escolaId: 5, quantidadeAlunos: 30 },
  { id: 4, nome: '5º Ano B', ciclo: 'Ensino Fundamental', escolaId: 3, quantidadeAlunos: 28 },
  { id: 5, nome: '6º Ano A', ciclo: 'Ensino Fundamental', escolaId: 6, quantidadeAlunos: 32 },
  { id: 6, nome: '6º Ano B', ciclo: 'Ensino Fundamental', escolaId: 6, quantidadeAlunos: 27 },
  { id: 7, nome: '7º Ano A', ciclo: 'Ensino Fundamental', escolaId: 1, quantidadeAlunos: 33 },
  { id: 8, nome: '7º Ano B', ciclo: 'Ensino Fundamental', escolaId: 5, quantidadeAlunos: 26 },
  { id: 9, nome: '8º Ano A', ciclo: 'Ensino Fundamental', escolaId: 1, quantidadeAlunos: 35 },
  { id: 10, nome: '9º Ano A', ciclo: 'Ensino Fundamental', escolaId: 4, quantidadeAlunos: 25 },
];

// Vínculo N:N turma <-> professor, como coleção normalizada (não array embutido nos dois
// sentidos) — fonte única da relação, substitui os antigos `turma.professores`/`professor.turmas`
// que duplicavam a mesma informação sem nenhuma garantia de sincronia entre si.
export const turmaProfessores = [
  { turmaId: 1, professorId: 1, disciplinaId: 1 },
  { turmaId: 2, professorId: 1, disciplinaId: 2 },
  { turmaId: 3, professorId: 2, disciplinaId: 3 },
  { turmaId: 4, professorId: 2, disciplinaId: 4 },
  { turmaId: 1, professorId: 3, disciplinaId: 2 },
  { turmaId: 5, professorId: 3, disciplinaId: 5 },
  { turmaId: 6, professorId: 4, disciplinaId: 1 },
  { turmaId: 7, professorId: 5, disciplinaId: 2 },
  { turmaId: 8, professorId: 5, disciplinaId: 2 },
  { turmaId: 2, professorId: 6, disciplinaId: 3 },
  { turmaId: 9, professorId: 6, disciplinaId: 3 },
  { turmaId: 4, professorId: 7, disciplinaId: 4 },
  { turmaId: 10, professorId: 7, disciplinaId: 4 },
  { turmaId: 5, professorId: 8, disciplinaId: 5 },
  { turmaId: 6, professorId: 8, disciplinaId: 5 },
  { turmaId: 7, professorId: 9, disciplinaId: 1 },
  { turmaId: 8, professorId: 10, disciplinaId: 2 },
  { turmaId: 9, professorId: 10, disciplinaId: 4 },
  { turmaId: 10, professorId: 11, disciplinaId: 1 },
  { turmaId: 1, professorId: 12, disciplinaId: 5 },
  { turmaId: 3, professorId: 12, disciplinaId: 5 },
  { turmaId: 2, professorId: 13, disciplinaId: 3 },
  { turmaId: 4, professorId: 13, disciplinaId: 3 },
  { turmaId: 5, professorId: 14, disciplinaId: 4 },
  { turmaId: 7, professorId: 14, disciplinaId: 4 },
  { turmaId: 6, professorId: 15, disciplinaId: 1 },
  { turmaId: 8, professorId: 15, disciplinaId: 2 },
];

// Turmas de um professor, na mesma ordem em que apareciam no antigo `professor.turmas`
// (preservado para os geradores abaixo continuarem produzindo os mesmos registros).
const turmaIdsPorProfessor = Object.fromEntries(
  professores.map(professor => [professor.id, turmaProfessores.filter(tp => tp.professorId === professor.id).map(tp => tp.turmaId)])
);

// Vínculo N:N professor/supervisor <-> escola, como coleção normalizada (não array embutido),
// para casar com o formato que um backend real usaria (tabela de junção) e permitir
// desvincular sem perder histórico (status: 'removido' em vez de remoção física).
const escolaIdsFromTurmas = (turmaIds) => [...new Set(turmaIds.map(turmaId => turmas.find(turma => turma.id === turmaId)?.escolaId))];

export const vinculosEscolares = [
  ...professores.flatMap(professor => escolaIdsFromTurmas(turmaIdsPorProfessor[professor.id]).map(escolaId => ({
    escolaId,
    usuarioTipo: 'professor',
    usuarioId: professor.id,
    status: 'ativo',
  }))),
  ...[
    { gestorId: 1, escolaIds: [1, 2, 3] },
    { gestorId: 2, escolaIds: [4, 5, 6] },
  ].flatMap(({ gestorId, escolaIds }) => escolaIds.map(escolaId => ({
    escolaId,
    usuarioTipo: 'gestor',
    usuarioId: gestorId,
    status: 'ativo',
  }))),
  ...[
    { diretorId: 1, escolaId: 1 },
    { diretorId: 2, escolaId: 2 },
    { diretorId: 3, escolaId: 3 },
    { diretorId: 4, escolaId: 4 },
    { diretorId: 5, escolaId: 5 },
    { diretorId: 6, escolaId: 6 },
  ].map(({ diretorId, escolaId }) => ({
    escolaId,
    usuarioTipo: 'diretora',
    usuarioId: diretorId,
    status: 'ativo',
  })),
].map((vinculo, index) => ({ id: index + 1, ...vinculo }));

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

// Períodos já preenchidos no Formulário 1/3 (novo formato, ver FormularioUmTerco.jsx) por status,
// aplicado apenas ao primeiro registro de cada professor para que a tela do professor logado
// não comece sempre em branco.
const periodosPreenchidosPorStatus = { concluido: 4, em_andamento: 2, em_atraso: 1, pendente: 0 };

export const formulariosUmTerco = Array.from({ length: 30 }, (_, index) => {
  const professorId = (index % professores.length) + 1;
  const professor = professores.find(item => item.id === professorId);
  const turmaIds = turmaIdsPorProfessor[professorId];
  const turmaId = turmaIds[index % turmaIds.length];
  const disciplinaId = professor.disciplinas[index % professor.disciplinas.length];
  const statusCycle = ['concluido', 'concluido', 'concluido', 'em_andamento', 'pendente', 'em_atraso'];
  const status = index === 0 ? 'em_atraso' : statusCycle[index % statusCycle.length];
  const dia = String((index % 24) + 1).padStart(2, '0');
  const isPrimeiroRegistroDoProfessor = index === professorId - 1;
  const totalPeriodos = periodosPreenchidosPorStatus[status];
  const atividadesPlanejadas = Object.fromEntries(
    Array.from({ length: totalPeriodos }, (_, periodo) => [periodo, `Período ${periodo + 1}: ${conteudos[(index + periodo) % conteudos.length]}.`])
  );

  return {
    id: index + 1,
    professorId,
    turmaId,
    escolaId: turmas.find(item => item.id === turmaId)?.escolaId,
    disciplinaId,
    data: `2026-08-${dia}`,
    conteudo: conteudos[index % conteudos.length],
    objetivo: 'Organizar habilidades prioritárias e evidências esperadas para o período.',
    metodologia: index % 2 === 0 ? 'Sequência didática com atividades em duplas e devolutivas curtas.' : 'Aula dialogada, produção guiada e registro no caderno.',
    status,
    prazo: index === 0 ? '2026-08-26' : status === 'em_atraso' ? `2026-08-${String((index % 9) + 1).padStart(2, '0')}` : `2026-09-${String((index % 18) + 5).padStart(2, '0')}`,
    atualizadoEm: `${index + 5} min`,
    ...(isPrimeiroRegistroDoProfessor ? { formularioUmTerco: true, atividadesPlanejadas } : {}),
  };
});

// Nomes usados historicamente neste array (rastreio simplificado de PDI, independente do
// cadastro completo de pdiAlunos). "Pedro Henrique" não existia em pdiAlunos — era um nome
// digitado à parte, sem nenhum aluno real correspondente; resolvido aqui para o aluno mais
// próximo já cadastrado na base (Pedro Lima) em vez de criar um aluno fictício só para isso.
const nomeParaAlunoIdLegado = { 'Pedro Henrique': 'Pedro Lima' };
const alunoIdsLegado = ['Lucas Pereira', 'Mariana Alves', 'Pedro Henrique', 'Camila Ribeiro', 'Sofia Martins', 'Gustavo Lima', 'Isabela Rocha', 'Tiago Moreira']
  .map(nome => pdiAlunos.find(aluno => aluno.nome === (nomeParaAlunoIdLegado[nome] || nome)).id);

export const pdis = Array.from({ length: 20 }, (_, index) => {
  const professorId = ((index + 3) % professores.length) + 1;
  const statusCycle = ['concluido', 'em_andamento', 'concluido', 'pendente', 'em_atraso'];
  const status = index === 12 ? 'pendente' : statusCycle[index % statusCycle.length];
  const turmaIds = turmaIdsPorProfessor[professorId];
  const turmaId = turmaIds[index % turmaIds.length];

  return {
    id: index + 1,
    alunoId: alunoIdsLegado[index % alunoIdsLegado.length],
    professorId,
    turmaId,
    escolaId: turmas.find(item => item.id === turmaId)?.escolaId,
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
  const turmaIds = turmaIdsPorProfessor[professorId];
  const turmaId = turmaIds[index % turmaIds.length];

  return {
    id: index + 1,
    professorId,
    turmaId,
    escolaId: turmas.find(item => item.id === turmaId)?.escolaId,
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

// escolaId: null = evento de rede inteira; preenchido = evento específico daquela escola.
// Os 5 eventos originais eram todos de rede, então preservam null (nenhuma regressão).
export const eventosPedagogicos = [
  {
    id: 1,
    titulo: 'Reunião pedagógica com coordenadores',
    descricao: 'Alinhamento das pendências do Formulário 1/3, PDI e correções dos simulados.',
    data: '2026-09-04',
    tipo: 'Reunião',
    local: 'Sala da coordenação',
    escolaId: null,
  },
  {
    id: 2,
    titulo: 'Sábado letivo de recomposição',
    descricao: 'Atividades de reforço com foco em leitura, escrita e resolução de problemas.',
    data: '2026-09-12',
    tipo: 'Sábado letivo',
    local: 'Unidades escolares',
    escolaId: null,
  },
  {
    id: 3,
    titulo: 'Formação de professores',
    descricao: 'Encontro formativo sobre registros pedagógicos e acompanhamento das aprendizagens.',
    data: '2026-09-18',
    tipo: 'Formação',
    local: 'Auditório municipal',
    escolaId: null,
  },
  {
    id: 4,
    titulo: 'Conselho de classe bimestral',
    descricao: 'Análise dos indicadores das turmas e definição de encaminhamentos pedagógicos.',
    data: '2026-09-25',
    tipo: 'Conselho',
    local: 'Escola Municipal Modelo',
    escolaId: null,
  },
  {
    id: 5,
    titulo: 'Aplicação do simulado municipal',
    descricao: 'Aplicação padronizada do simulado para acompanhamento da rede.',
    data: '2026-10-03',
    tipo: 'Simulado',
    local: 'Todas as turmas',
    escolaId: null,
  },
];

export const noticiasRede = [
  {
    id: 1,
    titulo: 'Rede inicia ciclo de acompanhamento pedagógico individual',
    resumo: 'Gestores e professores terão novos indicadores para acompanhar avanços dos estudantes ao longo do ano letivo.',
    categoria: 'PDI',
    data: '2026-08-28',
  },
  {
    id: 2,
    titulo: 'Formulário 1/3 entra em período de preenchimento',
    resumo: 'O registro de conteúdos já está disponível para professores com prazo definido pela gestão pedagógica.',
    categoria: 'Planejamento',
    data: '2026-09-01',
  },
];

// Vigência agora é escopada por (id, escolaId): um registro por tipo de formulário
// para cada escola, em vez de um único registro global por tipo.
// Nesta fase os valores são replicados iguais para todas as escolas (nenhuma tela ainda
// lê por escola), mas o formato já suporta vigências distintas por escola no futuro.
export const formulariosPrazos = escolas.flatMap(escola => [
  ...(getEscolaIdsAplicaveis(RECURSOS.FORMULARIO_UM_TERCO).includes(escola.id) ? [{
    id: 'formulario_um_terco',
    escolaId: escola.id,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    fillingPeriods: [
      { startDate: '2026-09-01', endDate: '2026-09-07' },
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      { startDate: '2026-09-15', endDate: '2026-09-21' },
      { startDate: '2026-09-22', endDate: '2026-09-30' },
    ],
  }] : []),
  ...(getEscolaIdsAplicaveis(RECURSOS.PDI).includes(escola.id) ? [{
    id: 'pdi',
    escolaId: escola.id,
    startDate: '2026-09-01',
    endDate: '2026-09-10',
  }] : []),
  ...(getEscolaIdsAplicaveis(RECURSOS.CORRECOES_SIMULADOS).includes(escola.id) ? [{
    id: 'correcoes_simulados',
    escolaId: escola.id,
    startDate: '2026-08-25',
    endDate: '2026-08-30',
  }] : []),
]);

export const usuarios = [
  { id: 1, email: 'professor@escola.gov.br', senha: '123456', tipo: 'professor', professorId: 1 },
  { id: 2, email: 'gestor@escola.gov.br', senha: '123456', tipo: 'gestor', gestorId: 1 },
  { id: 3, email: 'secretaria@escola.gov.br', senha: '123456', tipo: 'secretaria', secretariaId: 1 },
  { id: 4, email: 'diretora@escola.gov.br', senha: '123456', tipo: 'diretora', diretoraId: 1 },
];

export const notificacoesAtraso = [
  { id: 1, professorId: 4, formulario: 'Correções dos simulados', diasAtraso: 3, prazo: '2026-08-08', descricao: 'Correções pendentes após o prazo definido.' },
  { id: 2, professorId: 5, formulario: 'Formulário 1/3', diasAtraso: 2, prazo: '2026-08-09', descricao: 'Registro de conteúdos ainda não enviado.' },
  { id: 3, professorId: 6, formulario: 'PDI', diasAtraso: 1, prazo: '2026-08-10', descricao: 'Acompanhamento individual precisa ser atualizado.' },
];

// remetenteTipo+remetenteId / destinatarioTipo+destinatarioId são uma FK polimórfica (tipo+id
// em vez de uma referência única) — funciona no mock, mas um banco relacional não valida isso
// nativamente. Futuramente, com a separação usuario.id / perfil.id já existente em
// AuthContext.jsx (ver `usuarioId`), remetente/destinatário devem passar a referenciar
// usuarios.id diretamente, uma FK só, em vez de depender do par tipo+id.
export const mensagensIniciais = [
  { id: 1, remetenteTipo: 'secretaria', remetenteId: 1, destinatarioTipo: 'diretora', destinatarioId: 1, escolaId: 1, assunto: 'Reunião de alinhamento', corpo: 'Precisamos alinhar o calendário pedagógico da escola.', enviadaEm: '2026-09-15T09:00:00.000Z', lidaEm: null, respondendoA: null },
  { id: 2, remetenteTipo: 'diretora', remetenteId: 1, destinatarioTipo: 'secretaria', destinatarioId: 1, escolaId: 1, assunto: 'Confirmação de reunião', corpo: 'Confirmo a participação da escola no alinhamento.', enviadaEm: '2026-09-15T10:30:00.000Z', lidaEm: '2026-09-15T11:00:00.000Z', respondendoA: 1 },
  { id: 3, remetenteTipo: 'diretora', remetenteId: 1, destinatarioTipo: 'gestor', destinatarioId: 1, escolaId: 1, assunto: 'Acompanhamento semanal', corpo: 'Envie o resumo agregado da semana até sexta-feira.', enviadaEm: '2026-09-15T13:00:00.000Z', lidaEm: null, respondendoA: null },
  { id: 4, remetenteTipo: 'gestor', remetenteId: 1, destinatarioTipo: 'diretora', destinatarioId: 1, escolaId: 1, assunto: 'Resumo semanal', corpo: 'O acompanhamento da escola está dentro do prazo previsto.', enviadaEm: '2026-09-15T14:00:00.000Z', lidaEm: null, respondendoA: 3 },
  { id: 5, remetenteTipo: 'gestor', remetenteId: 1, destinatarioTipo: 'professor', destinatarioId: 5, escolaId: 1, assunto: 'Prazo do formulário', corpo: 'Lembrete sobre o prazo do Formulário 1/3 desta escola.', enviadaEm: '2026-09-16T08:00:00.000Z', lidaEm: null, respondendoA: null },
  { id: 6, remetenteTipo: 'professor', remetenteId: 5, destinatarioTipo: 'gestor', destinatarioId: 1, escolaId: 1, assunto: 'Dúvida sobre o prazo', corpo: 'Gostaria de confirmar o período disponível para envio.', enviadaEm: '2026-09-16T08:30:00.000Z', lidaEm: null, respondendoA: null },
];
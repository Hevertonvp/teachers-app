// Seed de dados estruturais (disciplinas) + as 10 CONTAS DE DEMONSTRAÇÃO de login (mesmas do mock
// do frontend, com senha de teste). NÃO copia alunos/escolas/turmas do mock — esses dados são
// fictícios/inconsistentes (ver auditoria). Em produção real, trocar as senhas de demonstração
// (ou remover estas contas) antes de liberar o sistema para usuários reais.
import bcrypt from 'bcryptjs';
import { PerfilPessoa, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SENHA_DEMONSTRACAO = '123456';

const CONTAS_DEMONSTRACAO: { email: string; nome: string; cargo: string | null; perfil: PerfilPessoa }[] = [
  { email: 'professor@escola.gov.br', nome: 'Cláudia Santos', cargo: null, perfil: 'PROFESSOR' },
  { email: 'gestor@escola.gov.br', nome: 'Helena Duarte', cargo: 'Supervisora Educacional', perfil: 'GESTOR' },
  { email: 'secretaria@escola.gov.br', nome: 'Secretaria Municipal de Educação', cargo: 'Secretaria de Educação', perfil: 'SECRETARIA' },
  { email: 'diretora@escola.gov.br', nome: 'Marcos Vinícius Teixeira', cargo: 'Diretor Escolar', perfil: 'DIRETORA' },
  { email: 'auxiliar@escola.gov.br', nome: 'Débora Nascimento', cargo: null, perfil: 'AUXILIAR' },
  { email: 'ricardo.tavares@escola.gov.br', nome: 'Ricardo Tavares', cargo: null, perfil: 'AUXILIAR' },
  { email: 'simone.cardoso@escola.gov.br', nome: 'Simone Cardoso', cargo: null, perfil: 'AUXILIAR' },
  { email: 'sergio.batista@escola.gov.br', nome: 'Sérgio Batista', cargo: 'Supervisor Educacional', perfil: 'GESTOR' },
  { email: 'heverton.prado@escola.gov.br', nome: 'Heverton Prado', cargo: null, perfil: 'PROFESSOR' },
  { email: 'renato.ferreira@escola.gov.br', nome: 'Renato Ferreira', cargo: null, perfil: 'PROFESSOR' },
];

// Nenhuma regra de runtime pode assumir estes IDs (ex.: "Inglês = 6") — só o nome importa.
const DISCIPLINAS = [
  'Língua Portuguesa',
  'Redação',
  'Arte',
  'Educação Física',
  'Matemática',
  'Ciências',
  'Geografia',
  'História',
  'Inglês',
  'Ensino Religioso',
];

async function main() {
  for (const nome of DISCIPLINAS) {
    await prisma.disciplina.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }
  console.log(`Seed concluído: ${DISCIPLINAS.length} disciplinas garantidas.`);

  const senhaHash = await bcrypt.hash(SENHA_DEMONSTRACAO, 10);
  for (const conta of CONTAS_DEMONSTRACAO) {
    await prisma.pessoa.upsert({
      where: { email: conta.email },
      update: { nome: conta.nome, cargo: conta.cargo, perfil: conta.perfil, senhaHash },
      create: { ...conta, senhaHash },
    });
  }
  console.log(`Seed concluído: ${CONTAS_DEMONSTRACAO.length} contas de demonstração garantidas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Seed só de dados estruturais (disciplinas). NÃO copia pessoas/alunos/escolas do mock do
// frontend — esses dados são fictícios/inconsistentes (ver auditoria), e a Secretaria vai
// cadastrar os reais pela API quando ela estiver em uso.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

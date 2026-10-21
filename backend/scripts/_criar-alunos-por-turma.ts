// Cria 2 AlunoPdi por turma ATIVA, com nomes variados sempre terminando em "_criado_por_ia"
// (deixa claro que é dado de demonstração/teste, nunca aluno real). Via API real, autenticado
// como a Secretaria de verdade.
import 'dotenv/config';
import type { AddressInfo } from 'node:net';

const { createApp } = await import('../src/api/app.js');
const { assinarToken } = await import('../src/api/middleware/auth.js');
const { prisma } = await import('../src/lib/prisma.js');

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const api = async (token: string, body: unknown) => {
  const r = await fetch(`${base}/api/pdi-alunos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const secretaria = await prisma.pessoa.findFirstOrThrow({ where: { perfil: 'SECRETARIA' } });
const token = assinarToken(secretaria);

const NOMES = [
  'renato', 'camila', 'bruno', 'larissa', 'fernando', 'juliana', 'rafael', 'patricia', 'thiago', 'aline',
  'gustavo', 'vanessa', 'leonardo', 'carolina', 'diego', 'fernanda', 'marcelo', 'beatriz', 'eduardo', 'natalia',
  'felipe', 'gabriela', 'rodrigo', 'luciana', 'andre', 'priscila', 'vinicius', 'roberta', 'daniel', 'simone',
  'alexandre', 'tatiane', 'mauricio', 'cristiane', 'paulo', 'sabrina', 'fabio', 'monica', 'ricardo', 'eliane',
];

const turmas = await prisma.turma.findMany({ where: { status: 'ATIVA' }, orderBy: { id: 'asc' } });
console.log(`${turmas.length} turmas ATIVAS encontradas — criando 2 alunos cada (${turmas.length * 2} no total).`);

let contador = 0;
let criados = 0;
let falhas = 0;

for (const turma of turmas) {
  for (let i = 0; i < 2; i++) {
    const nome = `${NOMES[contador % NOMES.length]}_criado_por_ia`;
    contador++;
    const r = await api(token, {
      nome,
      turmaId: turma.id,
      responsavelNome: `Responsável de ${nome}`,
      responsavelParentesco: i === 0 ? 'Mãe' : 'Pai',
      responsavelTelefone: '31999990000',
    });
    if (r.status === 201) criados++;
    else {
      falhas++;
      console.error('FALHOU:', turma.nome, nome, '=>', r.status, JSON.stringify(r.data));
    }
  }
}

console.log(`\n${criados} alunos criados, ${falhas} falhas, em ${turmas.length} turmas.`);
server.close();
await prisma.$disconnect();
process.exitCode = falhas > 0 ? 1 : 0;

// Apaga PARA SEMPRE professores inativos escolhidos (pedido e confirmação do usuário, 15/11/2026: #265, #264, #280,
// contas de teste sem nada escrito no 1/3). Exceção à regra "nunca apagar, só desativar" — vale só para esta limpeza.
// Sem --aplicar: só mostra o que sairia (ensaio). Com --aplicar: apaga numa transação e confere que nada sobrou.
//   npx tsx scripts/lancamento/apagar-professores-inativos.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-professores-inativos.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const IDS = [265, 264, 280];
const aplicar = process.argv.includes('--aplicar');

async function contar() {
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: IDS } }, select: { id: true } })).map((c) => c.id);
  return {
    cargos,
    n: {
      pessoas: await prisma.pessoa.count({ where: { id: { in: IDS } } }),
      cargos: cargos.length,
      cargoVersoes: await prisma.cargoVersao.count({ where: { cargoId: { in: cargos } } }),
      entregasDosCargos: await prisma.entregaUmTercoCargo.count({ where: { cargoId: { in: cargos } } }),
      entregas: await prisma.entregaUmTerco.count({ where: { professorId: { in: IDS } } }),
      vinculosEscolares: await prisma.vinculoEscolar.count({ where: { pessoaId: { in: IDS } } }),
      vinculosTurma: await prisma.professorTurmaDisciplina.count({ where: { professorId: { in: IDS } } }),
      eventos: await prisma.pessoaEvento.count({ where: { OR: [{ pessoaId: { in: IDS } }, { autorId: { in: IDS } }] } }),
    },
  };
}

const pessoas = await prisma.pessoa.findMany({ where: { id: { in: IDS } }, select: { id: true, nome: true, email: true, perfil: true, status: true } });
console.log('Alvo:', pessoas.map((p) => `#${p.id} ${p.nome} <${p.email}> ${p.perfil}/${p.status}`).join(' | '));
const invalidos = pessoas.filter((p) => p.perfil !== 'PROFESSOR' || p.status !== 'INATIVO');
if (invalidos.length) { console.error('ABORTADO: alguém deixou de ser professor inativo:', invalidos.map((p) => p.id)); process.exit(1); }

const antes = await contar();
console.log('Vai apagar:', JSON.stringify(antes.n));
if (antes.n.entregas > 0 || antes.n.entregasDosCargos > 0) { console.error('ABORTADO: há entregas do 1/3 ligadas (não estava no combinado).'); process.exit(1); }

if (!aplicar) { console.log('ENSAIO: nada foi apagado. Rode com --aplicar para apagar.'); await prisma.$disconnect(); process.exit(0); }

await prisma.$transaction(async (tx) => {
  await tx.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: IDS } }, { autorId: { in: IDS } }] } });
  await tx.professorTurmaDisciplina.deleteMany({ where: { professorId: { in: IDS } } });
  await tx.vinculoEscolar.deleteMany({ where: { pessoaId: { in: IDS } } });
  await tx.cargoVersao.deleteMany({ where: { cargoId: { in: antes.cargos } } });
  await tx.cargoProfessor.deleteMany({ where: { id: { in: antes.cargos } } });
  const r = await tx.pessoa.deleteMany({ where: { id: { in: IDS }, perfil: 'PROFESSOR', status: 'INATIVO' } });
  if (r.count !== IDS.length) throw new Error(`Esperava apagar ${IDS.length} pessoas, apagaria ${r.count}. Nada foi gravado.`);
});
const depois = await contar();
console.log('Depois:', JSON.stringify(depois.n));
console.log(Object.values(depois.n).every((v) => v === 0) ? 'OK: nada sobrou.' : 'ATENÇÃO: sobrou algo.');
await prisma.$disconnect();

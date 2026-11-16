// Apaga PARA SEMPRE a turma 7M1 (#1733) do CMEI Prof. Ubi Barroso (#2) — teste (decisão do usuário, 16/11/2026:
// "apaga só o 7º, de vez"). Recusa se a turma tiver QUALQUER referência (vínculos, alunos, fichas, 1/3...).
// Sem --aplicar: ensaio (executa numa transação e desfaz).
//   npx tsx scripts/lancamento/apagar-turma-7m1-cmei.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-turma-7m1-cmei.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const TURMA_ID = 1733;
const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}
try {
  await prisma.$transaction(async (tx) => {
    // select explícito: roda antes e depois da migration de estrutura da escola (sem ler colunas novas).
    const t = await tx.turma.findUnique({ where: { id: TURMA_ID }, select: { id: true, nome: true, escolaId: true, status: true, escola: { select: { nome: true } }, _count: true } }) as any;
    if (!t) throw new Error('Turma não existe.');
    if (t.nome !== '7M1' || t.escolaId !== 2) throw new Error(`ABORTADO: #${TURMA_ID} é "${t.nome}" da escola ${t.escolaId}.`);
    const refs = Object.entries(t._count).filter(([, v]) => (v as number) > 0);
    console.log(`Turma #${t.id} ${t.nome} (${t.escola.nome}) ${t.status}; referências: ${refs.length ? JSON.stringify(refs) : 'nenhuma'}`);
    if (refs.length) throw new Error('ABORTADO: a turma tem referências.');
    const apagadas = await tx.turma.deleteMany({ where: { id: TURMA_ID } });
    if (apagadas.count !== 1) throw new Error('Esperava apagar 1 turma.');
    console.log('Turmas do CMEI depois:', (await tx.turma.findMany({ where: { escolaId: 2 }, select: { nome: true } })).map((x) => x.nome).join(', '));
    if (!aplicar) throw new Ensaio();
  });
  console.log('APAGADA.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO OK: nada foi gravado.'); else throw e;
} finally { await prisma.$disconnect(); }

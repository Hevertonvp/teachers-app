// Apaga PARA SEMPRE os ciclos 1/3 de teste #13, #14 e #15 da PRODUÇÃO (decisão do usuário, 16/11/2026: "apaga todos
// os ciclos"; o #16 já foi apagado). Recusa se algum tiver entrega ou reabertura, ou não estiver INATIVO.
// Semanas e escolas do ciclo saem em cascata. Sem --aplicar: ensaio (transação desfeita).
//   npx tsx scripts/lancamento/apagar-ciclos-teste-13-15.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-ciclos-teste-13-15.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const IDS = [13, 14, 15];
const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}
try {
  await prisma.$transaction(async (tx) => {
    console.log('Ciclos no banco antes:', (await tx.cicloUmTerco.findMany({ select: { id: true, status: true } })).map((c) => `#${c.id} ${c.status}`).join(', '));
    for (const id of IDS) {
      const c = await tx.cicloUmTerco.findUnique({ where: { id }, include: { semanas: true } });
      if (!c) throw new Error(`Ciclo #${id} não existe.`);
      const entregas = await tx.entregaUmTerco.count({ where: { cicloId: id } });
      const reaberturas = await tx.reaberturaUmTerco.count({ where: { cicloId: id } });
      console.log(`#${id} ${c.status}, ${c.semanas.length} semanas, ${entregas} entregas, ${reaberturas} reaberturas`);
      if (c.status !== 'INATIVA' || entregas || reaberturas) throw new Error(`ABORTADO: #${id} não é um ciclo inativo vazio.`);
    }
    const r = await tx.cicloUmTerco.deleteMany({ where: { id: { in: IDS } } });
    if (r.count !== IDS.length) throw new Error(`Esperava apagar ${IDS.length}, apagaria ${r.count}.`);
    console.log('Ciclos no banco depois:', await tx.cicloUmTerco.count());
    if (!aplicar) throw new Ensaio();
  }, { timeout: 60000, maxWait: 20000 });
  console.log('APAGADOS.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO OK: nada foi gravado.'); else throw e;
} finally { await prisma.$disconnect(); }

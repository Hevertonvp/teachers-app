// Remove o ciclo #16 do 1/3 da PRODUÇÃO (teste aberto em 15/11/2026; decisão do usuário em 16/11: "ainda é teste").
// Por padrão é ENSAIO (transação desfeita no fim). Só grava com: CONFIRMO=APAGAR-CICLO-16 npx tsx ... --executar
// Travas: o ciclo precisa existir, ter 0 entregas e 0 reaberturas; apaga só ele (semanas e escolas vão em cascata).
import { PrismaClient } from '@prisma/client';

const CICLO_ID = 16;
const executar = process.argv.includes('--executar') && process.env.CONFIRMO === 'APAGAR-CICLO-16';
const prisma = new PrismaClient();

class Ensaio extends Error {}

try {
  await prisma.$transaction(async (tx) => {
    const ciclo = await tx.cicloUmTerco.findUnique({ where: { id: CICLO_ID }, include: { semanas: true, escolas: true } });
    if (!ciclo) throw new Error(`Ciclo #${CICLO_ID} não existe.`);
    const entregas = await tx.entregaUmTerco.count({ where: { cicloId: CICLO_ID } });
    const reaberturas = await tx.reaberturaUmTerco.count({ where: { cicloId: CICLO_ID } });
    console.log(`Ciclo #${ciclo.id} "${ciclo.titulo}" ${ciclo.trimestre}º tri ${ciclo.anoLetivo}: ${ciclo.semanas.length} semanas, ${ciclo.escolas.length} escolas escolhidas, ${entregas} entregas, ${reaberturas} reaberturas.`);
    if (entregas || reaberturas) throw new Error('O ciclo tem entregas ou reaberturas: nada foi apagado.');
    await tx.cicloUmTerco.delete({ where: { id: CICLO_ID } });
    const restantes = await tx.cicloUmTerco.count();
    console.log(`Depois: ${restantes} ciclo(s) do 1/3 no banco.`);
    if (!executar) throw new Ensaio();
  });
  console.log('EXECUTADO: ciclo apagado.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO: nada foi gravado.');
  else { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }
} finally {
  await prisma.$disconnect();
}

// Reinicia entregas de TESTE do P04 no banco local (apenas homolog). Uso: node reset-entregas.mjs 9:Inglês 8:Inglês
import { prisma } from './db.mjs';
for (const arg of process.argv.slice(2)) {
  const [serie, nome] = arg.split(':');
  const es = await prisma.entregaUmTerco.findMany({ where: { professor: { email: { endsWith: '@homolog.nexo' } }, anoSerie: Number(serie), disciplina: { nome } }, select: { id: true } });
  const ids = es.map(e => e.id);
  if (!ids.length) { console.log(arg, 'sem entrega'); continue; }
  await prisma.$transaction([
    prisma.respostaSemanaUmTerco.deleteMany({ where: { entregaId: { in: ids } } }),
    prisma.coberturaEntregaUmTerco.deleteMany({ where: { entregaId: { in: ids } } }),
    prisma.historicoEntregaUmTerco.deleteMany({ where: { entregaId: { in: ids } } }),
    prisma.entregaUmTerco.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(arg, 'removidas', ids.length);
}
await prisma.$disconnect();

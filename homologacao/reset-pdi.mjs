// Reinicia fichas PDI de TESTE do P04 no banco local para repetir a jornada.
import { prisma } from './db.mjs';
const fs_ = await prisma.fichaPdi.findMany({ where: { professorResponsavel: { email: 'p04@homolog.nexo' } }, select: { id: true } });
const ids = fs_.map(f => f.id);
console.log('fichas P04:', ids.length);
await prisma.$disconnect();

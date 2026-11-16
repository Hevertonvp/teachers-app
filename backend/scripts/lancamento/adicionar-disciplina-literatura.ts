// Cadastra a disciplina "Literatura" (pedido do usuário, 16/11/2026), com as MESMAS habilidades BNCC/CRMG de Língua
// Portuguesa — igual à Redação: Disciplina independente mapeada ao componente LINGUA_PORTUGUESA
// (disciplina_componentes_curriculares). Só dado, sem migration. Idempotente: o que já existir não muda.
// Sem --aplicar: só mostra (ensaio). Usa a DATABASE_URL do ambiente (.env = produção; local: passe DATABASE_URL).
//   npx tsx scripts/lancamento/adicionar-disciplina-literatura.ts            (ensaio)
//   npx tsx scripts/lancamento/adicionar-disciplina-literatura.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const NOME = 'Literatura';
const COMPONENTE = 'LINGUA_PORTUGUESA' as const;
const aplicar = process.argv.includes('--aplicar');
const alvo = /neon\.tech/.test(process.env.DATABASE_URL ?? '') ? 'PRODUÇÃO' : 'local';

const existente = await prisma.disciplina.findFirst({ where: { nome: { equals: NOME, mode: 'insensitive' } } });
const mapa = existente ? await prisma.disciplinaComponenteCurricular.findUnique({ where: { disciplinaId: existente.id } }) : null;
console.log(`Banco: ${alvo}. Disciplinas hoje: ${await prisma.disciplina.count()}. "${NOME}" ${existente ? `já existe (#${existente.id}), componente: ${mapa?.componente ?? 'nenhum'}` : 'não existe'}.`);
if (mapa && mapa.componente !== COMPONENTE) { console.error(`ABORTADO: "${NOME}" já está ligada a ${mapa.componente}.`); process.exit(1); }
if (existente && mapa) { console.log('Nada a fazer.'); await prisma.$disconnect(); process.exit(0); }
if (!aplicar) { console.log('ENSAIO: nada foi gravado. Rode com --aplicar.'); await prisma.$disconnect(); process.exit(0); }

const d = await prisma.$transaction(async (tx) => {
  const disc = existente ?? (await tx.disciplina.create({ data: { nome: NOME } }));
  await tx.disciplinaComponenteCurricular.create({ data: { disciplinaId: disc.id, componente: COMPONENTE } });
  return disc;
});
const habilidades = await prisma.habilidadeCurricular.count({ where: { componente: COMPONENTE, ativa: true } });
console.log(`OK: "${d.nome}" #${d.id} ligada a ${COMPONENTE} (${habilidades} habilidades ativas). Disciplinas agora: ${await prisma.disciplina.count()}.`);
await prisma.$disconnect();

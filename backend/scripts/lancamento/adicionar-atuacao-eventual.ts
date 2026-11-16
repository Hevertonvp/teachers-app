// Cadastra a atuação pedagógica "Eventual" (pedido do usuário, 16/11/2026). Ela NÃO se liga a turmas
// (ATUACOES_SEM_TURMA em src/domain/cargos.ts). Só dado, sem migration. Idempotente.
// Sem --aplicar: só mostra (ensaio). Usa a DATABASE_URL do ambiente (.env = produção; local: passe DATABASE_URL).
//   npx tsx scripts/lancamento/adicionar-atuacao-eventual.ts            (ensaio)
//   npx tsx scripts/lancamento/adicionar-atuacao-eventual.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const NOME = 'Eventual';
const aplicar = process.argv.includes('--aplicar');
const alvo = /neon\.tech/.test(process.env.DATABASE_URL ?? '') ? 'PRODUÇÃO' : 'local';
const existente = await prisma.atuacaoPedagogica.findFirst({ where: { nome: { equals: NOME, mode: 'insensitive' } } });
console.log(`Banco: ${alvo}. Atuações: ${(await prisma.atuacaoPedagogica.findMany({ select: { nome: true } })).map((a) => a.nome).join(', ')}. "${NOME}" ${existente ? `já existe (#${existente.id})` : 'não existe'}.`);
if (existente) { await prisma.$disconnect(); process.exit(0); }
if (!aplicar) { console.log('ENSAIO: nada foi gravado. Rode com --aplicar.'); await prisma.$disconnect(); process.exit(0); }
const criada = await prisma.atuacaoPedagogica.create({ data: { nome: NOME, createdBy: 'script adicionar-atuacao-eventual' } });
console.log(`OK: "${criada.nome}" #${criada.id} cadastrada.`);
await prisma.$disconnect();

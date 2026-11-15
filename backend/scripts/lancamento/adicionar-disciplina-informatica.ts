// Cadastra a disciplina "Informática" (pedido do usuário, 15/11/2026). Só dado, sem migration; não há tela de
// cadastro de disciplina. Idempotente: se já existir, não faz nada. Informática fica FORA do 1/3 e do PDI por
// enquanto (ver DISCIPLINAS_FORA_DO_UM_TERCO em src/domain/cargos.ts; não criar Modelo PDI de Informática).
// Sem --aplicar: só mostra (ensaio). Usa a DATABASE_URL do ambiente (.env = produção; local: passe DATABASE_URL).
//   npx tsx scripts/lancamento/adicionar-disciplina-informatica.ts            (ensaio)
//   npx tsx scripts/lancamento/adicionar-disciplina-informatica.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const NOME = 'Informática';
const aplicar = process.argv.includes('--aplicar');
const alvo = /neon\.tech/.test(process.env.DATABASE_URL ?? '') ? 'PRODUÇÃO' : 'local';

const existente = await prisma.disciplina.findFirst({ where: { nome: { equals: NOME, mode: 'insensitive' } } });
const total = await prisma.disciplina.count();
console.log(`Banco: ${alvo}. Disciplinas hoje: ${total}. "${NOME}" ${existente ? `já existe (#${existente.id} "${existente.nome}")` : 'não existe'}.`);
if (existente) { await prisma.$disconnect(); process.exit(0); }
if (!aplicar) { console.log('ENSAIO: nada foi gravado. Rode com --aplicar para cadastrar.'); await prisma.$disconnect(); process.exit(0); }
const criada = await prisma.disciplina.create({ data: { nome: NOME } });
console.log(`Cadastrada: #${criada.id} "${criada.nome}". Disciplinas agora: ${await prisma.disciplina.count()}.`);
await prisma.$disconnect();

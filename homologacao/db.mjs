// Acesso DIRETO ao banco local de homologação (somente para preparar condições especiais e
// conferir persistência — sempre declarado no relatório). Recusa qualquer alvo que não seja o local.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');

export const URL_LOCAL = 'postgresql://homolog:homolog@localhost:54329/nexo_homolog';
if (!URL_LOCAL.includes('localhost:54329')) throw new Error('ABORTADO: alvo não é o banco local de homologação');
export const prisma = new PrismaClient({ datasources: { db: { url: URL_LOCAL } } });

// Garantia extra: o banco conectado tem que ser o de homologação.
const [{ current_database }] = await prisma.$queryRaw`SELECT current_database()`;
if (current_database !== 'nexo_homolog') throw new Error('ABORTADO: banco inesperado ' + current_database);
export const sql = (strings, ...v) => prisma.$queryRaw(strings, ...v);

import { PrismaClient } from '@prisma/client';

// Instância única do Prisma Client para todo o processo — evitar `new PrismaClient()` por
// request, que esgotaria conexões rapidamente (ainda mais relevante usando o pooler do Neon).
export const prisma = new PrismaClient();

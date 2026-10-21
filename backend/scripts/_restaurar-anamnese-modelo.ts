// Restaura o Modelo de Anamnese + suas 57 perguntas a partir do backup feito antes do "zerar
// tudo" (neondb_antes_de_zerar_20261021.json) — conteúdo real, fielmente preservado, nunca
// inventado. Insert direto via Prisma (não existe endpoint de API para o bootstrap do PRIMEIRO
// Modelo de Anamnese — só para versionar um que já existe, ver anamneseModelos.ts).
import 'dotenv/config';
import fs from 'fs';
import { prisma } from '../src/lib/prisma.js';

const dump = JSON.parse(fs.readFileSync(String.raw`C:\Users\hevertonvp\Documents\teachers-app-backups\neondb_antes_de_zerar_20261021.json`, 'utf8'));

const existente = await prisma.modeloAnamnese.findFirst({ where: { status: 'ATIVA' } });
if (existente) {
  console.log('Já existe um Modelo de Anamnese ATIVO — nada a fazer.');
  await prisma.$disconnect();
  process.exit(0);
}

const modeloBackup = dump.modeloAnamnese[0];
const perguntasBackup = dump.perguntaAnamnese.filter((p: { modeloAnamneseId: number }) => p.modeloAnamneseId === modeloBackup.id);
console.log(`Restaurando "${modeloBackup.nome}" com ${perguntasBackup.length} perguntas.`);

await prisma.$transaction(async (tx) => {
  const modelo = await tx.modeloAnamnese.create({
    data: { nome: modeloBackup.nome, versao: 1, status: 'ATIVA', createdBy: 'restauracao-pos-zerar-tudo-20261021' },
  });
  await tx.perguntaAnamnese.createMany({
    data: perguntasBackup.map((p: { secao: string; subsecao: string | null; texto: string; explicacao: string | null; tipoResposta: string; opcoes: unknown; complementar: unknown; ordem: number; status: string }) => ({
      modeloAnamneseId: modelo.id,
      secao: p.secao,
      subsecao: p.subsecao,
      texto: p.texto,
      explicacao: p.explicacao,
      tipoResposta: p.tipoResposta as never,
      opcoes: p.opcoes ?? [],
      complementar: p.complementar ?? undefined,
      ordem: p.ordem,
      status: p.status as never,
      createdBy: 'restauracao-pos-zerar-tudo-20261021',
    })),
  });
  console.log(`Modelo criado (id ${modelo.id}) com ${perguntasBackup.length} perguntas.`);
});

const confirmacao = await prisma.modeloAnamnese.findFirst({ where: { status: 'ATIVA' }, include: { perguntas: true } });
console.log(`Confirmado: Modelo "${confirmacao?.nome}" ATIVO com ${confirmacao?.perguntas.length} perguntas.`);
await prisma.$disconnect();

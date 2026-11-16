// Apaga PARA SEMPRE a escola de teste #62 "sjchsaj" da PRODUÇÃO (criada e inativada pelo usuário em 16/11/2026;
// decisão do usuário: apagar de vez). Recusa se ela tiver turma ou qualquer referência. SQL direto (roda antes e
// depois da migration da estrutura de escola). Sem --aplicar: ensaio (transação desfeita).
//   npx tsx scripts/lancamento/apagar-escola-sjchsaj.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-escola-sjchsaj.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const ID = 62;
const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}
try {
  await prisma.$transaction(async (tx) => {
    const [e] = await tx.$queryRawUnsafe<{ id: number; nome: string; status: string }[]>(`SELECT id, nome, status FROM escolas WHERE id = ${ID}`);
    if (!e || e.nome !== 'sjchsaj' || e.status !== 'INATIVA') throw new Error(`ABORTADO: #${ID} não é a escola inativa "sjchsaj" (${JSON.stringify(e)}).`);
    // Todas as tabelas com chave estrangeira para escolas, lidas do próprio banco (nenhuma fica de fora).
    const fks = await tx.$queryRawUnsafe<{ tabela: string; coluna: string }[]>(`SELECT tc.table_name AS tabela, kcu.column_name AS coluna FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'escolas'`);
    const refs: Record<string, number> = {};
    for (const { tabela, coluna } of fks) {
      const [{ n }] = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${tabela}" WHERE "${coluna}" = ${ID}`);
      if (n) refs[tabela] = n;
    }
    console.log(`Tabelas que apontam para escolas: ${fks.length}`);
    console.log(`Escola #${e.id} "${e.nome}" ${e.status}; referências: ${JSON.stringify(refs)}`);
    if (Object.keys(refs).length) throw new Error('ABORTADO: a escola tem referências.');
    const n = await tx.$executeRawUnsafe(`DELETE FROM escolas WHERE id = ${ID}`);
    if (n !== 1) throw new Error('Esperava apagar 1 escola.');
    if (!aplicar) throw new Ensaio();
  }, { timeout: 60000, maxWait: 20000 });
  console.log('APAGADA.');
} catch (err) {
  if (err instanceof Ensaio) console.log('ENSAIO OK: nada foi gravado.'); else throw err;
} finally { await prisma.$disconnect(); }

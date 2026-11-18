// Auxiliar do roteiro 91 (banco LOCAL): roda os avisos de entrega com datas simuladas.
// Uso (a partir de backend/): DATABASE_URL=<local> npx tsx ../homologacao/91-avisos-job.mts <modo> [arg]
//   job <ISO>                 → executarAvisosDeEntrega com agora = <ISO>
//   completa <escolaId>       → avisarEscolasCompletas (1/3, ciclo 1) com a escola a 100% (situação simulada)
//   pdi-completo <aplicacaoId> → verificarPdiCompleto (contagem real)
if (!(process.env.DATABASE_URL ?? '').includes('localhost:54329')) { console.error('ABORTADO: só no banco local'); process.exit(1); }
const { prisma } = await import('../backend/src/lib/prisma.js');
const { executarAvisosDeEntrega } = await import('../backend/src/jobs/avisosEntregaJob.js');
const { avisarEscolasCompletas, refUmTerco, verificarPdiCompleto } = await import('../backend/src/lib/avisosEntrega.js');

const [modo, arg] = process.argv.slice(2);
if (modo === 'job') console.log(JSON.stringify(await executarAvisosDeEntrega(prisma, { agora: new Date(arg) })));
if (modo === 'completa') { await avisarEscolasCompletas(prisma, refUmTerco(1), [{ escolaId: Number(arg), escolaNome: 'Escola teste', esperado: 2, concluidas: 2 }]); console.log('ok'); }
if (modo === 'pdi-completo') { await verificarPdiCompleto(prisma, Number(arg)); console.log('ok'); }
await prisma.$disconnect();

// Correção pontual na PRODUÇÃO (13/11/2026, decisão do usuário): a Professora #267 fica só com o Cargo 1
// (E. M. DR. PÉRICLES, Língua Portuguesa + Redação). O vínculo #299 com a E. M. TRÊS MARIAS (#25), criado
// pela janela "Escolas" fora do cargo, é encerrado. Ela não tem turmas lá (conferido abaixo).
// Uso: npx tsx scripts/umTerco/corrigir-flavia-tres-marias.ts            (só mostra)
//      npx tsx scripts/umTerco/corrigir-flavia-tres-marias.ts --aplicar  (grava)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');
try {
  console.log('Banco:', new URL(process.env.DATABASE_URL ?? 'postgres://x/x').hostname, aplicar ? '(APLICANDO)' : '(só leitura)');
  const v = await prisma.vinculoEscolar.findUniqueOrThrow({ where: { id: 299 }, include: { pessoa: { select: { nome: true } }, escola: { select: { nome: true } } } });
  console.log('Vínculo:', JSON.stringify({ id: v.id, pessoaId: v.pessoaId, pessoa: v.pessoa.nome, escolaId: v.escolaId, escola: v.escola.nome, status: v.status, dataInicio: v.dataInicio }));
  if (v.pessoaId !== 267 || v.escolaId !== 25) throw new Error('Vínculo não é o esperado (#267 na escola #25). Nada feito.');
  const turmas = await prisma.professorTurmaDisciplina.count({ where: { professorId: 267, status: 'ATIVO', turma: { escolaId: 25 } } });
  const cargos = await prisma.cargoProfessor.findMany({ where: { professorId: 267, status: 'ATIVO' }, include: { versoes: { orderBy: { criadaEm: 'desc' }, take: 1 } } });
  console.log('Turmas ativas na Três Marias:', turmas);
  console.log('Cargos ativos:', JSON.stringify(cargos.map(c => ({ id: c.id, composicao: c.versoes[0]?.composicao }))));
  if (turmas > 0) throw new Error('Ela tem turma na Três Marias. Nada feito.');
  if (v.status !== 'ATIVO') { console.log('Vínculo já encerrado. Nada a fazer.'); }
  else if (aplicar) {
    const agora = new Date();
    const r = await prisma.vinculoEscolar.update({ where: { id: 299 }, data: { status: 'ENCERRADO', dataFim: v.dataInicio > agora ? v.dataInicio : agora } });
    console.log('Encerrado:', JSON.stringify({ id: r.id, status: r.status, dataFim: r.dataFim }));
  } else console.log('Rode com --aplicar para encerrar.');
} finally {
  await prisma.$disconnect();
}

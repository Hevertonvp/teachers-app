// Apaga PARA SEMPRE as contas de Professor com "teste" ou "heverton" no nome/e-mail (pedido e confirmação do usuário,
// 16/11/2026): #281, #284, #285, #286 — com cargos, vínculos, turma, as 2 entregas do 1/3 (#247, #248, com correção),
// a conversa #50 (Secretaria ↔ #281), notificação e eventos. Exceção à regra "nunca apagar, só desativar".
// Sem --aplicar: ENSAIO (executa numa transação e desfaz). Com --aplicar: grava e confere que nada sobrou.
//   npx tsx scripts/lancamento/apagar-contas-teste-heverton.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-contas-teste-heverton.ts --aplicar
import 'dotenv/config';
import { prisma } from '../../src/lib/prisma.js';

const ALVO: Record<number, string> = {
  281: 'heverton2@gmail.com',
  284: 'teste-prod@gmail.com',
  285: 'hevertonvp@gmail.com',
  286: 'teste@teste.com',
};
const IDS = Object.keys(ALVO).map(Number);
const CONVERSA = 50;
const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}

const pessoas = await prisma.pessoa.findMany({ where: { id: { in: IDS } }, select: { id: true, nome: true, email: true, perfil: true } });
console.log('Alvo:', pessoas.map((p) => `#${p.id} ${p.nome} <${p.email}> ${p.perfil}`).join(' | '));
const errados = IDS.filter((id) => { const p = pessoas.find((x) => x.id === id); return !p || p.email !== ALVO[id] || p.perfil !== 'PROFESSOR'; });
if (errados.length) { console.error('ABORTADO: não confere (e-mail/perfil):', errados); process.exit(1); }

// A conversa #50 só pode ter a Secretaria (#4) e o #281.
const part = await prisma.participanteConversa.findMany({ where: { conversaId: CONVERSA }, select: { pessoaId: true } });
if (part.some((p) => p.pessoaId !== 4 && !IDS.includes(p.pessoaId))) { console.error('ABORTADO: conversa 50 tem outros participantes.'); process.exit(1); }
const conversas = (await prisma.participanteConversa.findMany({ where: { pessoaId: { in: IDS } }, select: { conversaId: true } })).map((c) => c.conversaId);
if (conversas.some((c) => c !== CONVERSA)) { console.error('ABORTADO: há outras conversas:', conversas); process.exit(1); }

async function contar() {
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: IDS } }, select: { id: true } })).map((c) => c.id);
  const entregas = (await prisma.entregaUmTerco.findMany({ where: { professorId: { in: IDS } }, select: { id: true } })).map((e) => e.id);
  return {
    cargos, entregas,
    n: {
      pessoas: await prisma.pessoa.count({ where: { id: { in: IDS } } }),
      cargos: cargos.length,
      entregas: entregas.length,
      vinculosEscolares: await prisma.vinculoEscolar.count({ where: { pessoaId: { in: IDS } } }),
      vinculosTurma: await prisma.professorTurmaDisciplina.count({ where: { professorId: { in: IDS } } }),
      eventos: await prisma.pessoaEvento.count({ where: { OR: [{ pessoaId: { in: IDS } }, { autorId: { in: IDS } }] } }),
      notificacoes: await prisma.notificacao.count({ where: { destinatarioId: { in: IDS } } }),
      conversa: await prisma.conversaMensagem.count({ where: { id: CONVERSA } }),
      mensagensConversa: await prisma.mensagem.count({ where: { conversaId: CONVERSA } }),
    },
  };
}

const antes = await contar();
console.log('Vai apagar:', JSON.stringify(antes.n));

try {
  await prisma.$transaction(async (tx) => {
    await tx.notificacao.deleteMany({ where: { destinatarioId: { in: IDS } } });
    await tx.mensagem.deleteMany({ where: { conversaId: CONVERSA } });
    await tx.participanteConversa.deleteMany({ where: { conversaId: CONVERSA } });
    await tx.conversaMensagem.delete({ where: { id: CONVERSA } });
    await tx.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: antes.entregas } } });
    await tx.entregaUmTerco.deleteMany({ where: { id: { in: antes.entregas } } }); // respostas/cargos/histórico em cascata
    await tx.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: { in: IDS } }, { autorId: { in: IDS } }] } });
    await tx.professorTurmaDisciplina.deleteMany({ where: { professorId: { in: IDS } } });
    await tx.vinculoEscolar.deleteMany({ where: { pessoaId: { in: IDS } } });
    await tx.cargoVersao.deleteMany({ where: { cargoId: { in: antes.cargos } } });
    await tx.cargoProfessor.deleteMany({ where: { id: { in: antes.cargos } } });
    const r = await tx.pessoa.deleteMany({ where: { id: { in: IDS }, perfil: 'PROFESSOR' } });
    if (r.count !== IDS.length) throw new Error(`Esperava ${IDS.length} pessoas, apagaria ${r.count}. Nada foi gravado.`);
    if (!aplicar) throw new Ensaio();
  }, { timeout: 60000 });
} catch (e) {
  if (e instanceof Ensaio) { console.log('ENSAIO OK: tudo apagaria sem erro; nada foi gravado. Rode com --aplicar.'); await prisma.$disconnect(); process.exit(0); }
  throw e;
}
const depois = await contar();
console.log('Depois:', JSON.stringify(depois.n));
console.log(Object.values(depois.n).every((v) => v === 0) ? 'OK: nada sobrou.' : 'ATENÇÃO: sobrou algo.');
await prisma.$disconnect();

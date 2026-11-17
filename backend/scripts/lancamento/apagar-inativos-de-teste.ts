// Apaga PARA SEMPRE inativos de teste/sem uso da PRODUÇÃO (decisão do usuário, 16/11/2026: "tudo menos histórico real").
// Grupo A (testes): escolas #63 "teste", #64 "teste1", #65 "novoteste"; professor #287 "homer" (com cargo, vínculos e
// eventos dele); modelo PDI #77 "teste ingles". Grupo B (inativos sem nada ligado): 36 turmas INATIVAS da E. M. Dr.
// Péricles (#13); modelos PDI #78 "PDI - Redação" e #79 "PDI - Língua Portuguesa" (inativos, sem aplicação).
// NÃO toca no histórico real (vínculos/cargo encerrados de professores reais).
// Travas: confere status/nome/e-mail de cada alvo e, pelas chaves estrangeiras lidas do próprio banco, que só existe
// o que é esperado ligado a eles. Uma transação; sem --aplicar é ENSAIO (desfeito no fim).
//   npx tsx scripts/lancamento/apagar-inativos-de-teste.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-inativos-de-teste.ts --aplicar
import 'dotenv/config';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';

const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}
type Tx = Prisma.TransactionClient;

const fkCache = new Map<string, { tabela: string; coluna: string }[]>();
async function referencias(tx: Tx, tabela: string, ids: number[]) {
  if (!ids.length) return {};
  if (!fkCache.has(tabela)) fkCache.set(tabela, await tx.$queryRawUnsafe(`SELECT tc.table_name AS tabela, kcu.column_name AS coluna FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = '${tabela}'`));
  const r: Record<string, number> = {};
  for (const { tabela: t, coluna } of fkCache.get(tabela)!) {
    const [{ n }] = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t}" WHERE "${coluna}" IN (${ids.join(',')})`);
    if (n) r[`${t}.${coluna}`] = n;
  }
  return r;
}
const exigirSo = (rotulo: string, refs: Record<string, number>, permitidas: string[]) => {
  const fora = Object.keys(refs).filter((k) => !permitidas.includes(k));
  if (fora.length) throw new Error(`ABORTADO (${rotulo}): ligado a ${fora.map((k) => `${k}=${refs[k]}`).join(', ')}`);
};

try {
  await prisma.$transaction(async (tx) => {
    // --- Escolas de teste ---
    const escolas = await tx.escola.findMany({ where: { id: { in: [63, 64, 65] } }, select: { id: true, nome: true, status: true } });
    const nomesEsc: Record<number, string> = { 63: 'teste', 64: 'teste1', 65: 'novoteste' };
    if (escolas.length !== 3 || escolas.some((e) => e.status !== 'INATIVA' || e.nome !== nomesEsc[e.id])) throw new Error(`ABORTADO: escolas não conferem ${JSON.stringify(escolas)}`);
    const refEsc = await referencias(tx, 'escolas', [63, 64, 65]);
    exigirSo('escolas', refEsc, ['escola_niveis_infantil.escolaId']);
    await tx.escolaNivelInfantil.deleteMany({ where: { escolaId: { in: [63, 64, 65] } } });
    console.log(`Escolas #63, #64, #65: refs ${JSON.stringify(refEsc)}`);

    // --- Professor de teste "homer" ---
    const homer = await tx.pessoa.findUnique({ where: { id: 287 }, select: { id: true, nome: true, email: true, status: true, perfil: true } });
    if (!homer || homer.nome !== 'homer' || homer.email !== 'kjdhvcusdh@jhsdjhds.com' || homer.status !== 'INATIVO' || homer.perfil !== 'PROFESSOR') throw new Error(`ABORTADO: #287 não confere ${JSON.stringify(homer)}`);
    const cargosHomer = (await tx.cargoProfessor.findMany({ where: { professorId: 287 }, select: { id: true } })).map((c) => c.id);
    const refCargo = await referencias(tx, 'cargos_professor', cargosHomer);
    exigirSo('cargo do homer', refCargo, ['cargo_versoes.cargoId']);
    const refHomer = await referencias(tx, 'pessoas', [287]);
    exigirSo('homer', refHomer, ['vinculos_escolares.pessoaId', 'professor_turma_disciplinas.professorId', 'professor_turma_atuacoes.professorId', 'pessoa_eventos.pessoaId', 'pessoa_eventos.autorId', 'cargos_professor.professorId']);
    const ptdHomer = (await tx.professorTurmaDisciplina.findMany({ where: { professorId: 287 }, select: { id: true } })).map((v) => v.id);
    exigirSo('turmas do homer', await referencias(tx, 'professor_turma_disciplinas', ptdHomer), []);
    await tx.pessoaEvento.deleteMany({ where: { OR: [{ pessoaId: 287 }, { autorId: 287 }] } });
    await tx.professorTurmaDisciplina.deleteMany({ where: { professorId: 287 } });
    await tx.professorTurmaAtuacao.deleteMany({ where: { professorId: 287 } });
    await tx.vinculoEscolar.deleteMany({ where: { pessoaId: 287 } });
    await tx.cargoVersao.deleteMany({ where: { cargoId: { in: cargosHomer } } });
    await tx.cargoProfessor.deleteMany({ where: { id: { in: cargosHomer } } });
    console.log(`Professor #287 homer: refs ${JSON.stringify(refHomer)}; cargo refs ${JSON.stringify(refCargo)}`);

    // --- Modelos PDI inativos (#77 teste, #78 Redação, #79 Língua Portuguesa) ---
    const modelos = await tx.modeloPdi.findMany({ where: { id: { in: [77, 78, 79] } }, select: { id: true, nome: true, status: true } });
    const nomesMod: Record<number, string> = { 77: 'teste ingles', 78: 'PDI - Redação', 79: 'PDI - Língua Portuguesa' };
    if (modelos.length !== 3 || modelos.some((m) => m.status !== 'INATIVA' || m.nome !== nomesMod[m.id])) throw new Error(`ABORTADO: modelos não conferem ${JSON.stringify(modelos)}`);
    const refMod = await referencias(tx, 'modelos_pdi', [77, 78, 79]);
    exigirSo('modelos', refMod, ['perguntas_pdi.modeloId']);
    const perguntas = (await tx.perguntaPdi.findMany({ where: { modeloId: { in: [77, 78, 79] } }, select: { id: true } })).map((p) => p.id);
    const refPerg = await referencias(tx, 'perguntas_pdi', perguntas);
    exigirSo('perguntas dos modelos', refPerg, []);
    await tx.perguntaPdi.deleteMany({ where: { id: { in: perguntas } } });
    console.log(`Modelos #77–79: refs ${JSON.stringify(refMod)}; ${perguntas.length} perguntas sem uso`);

    // --- 36 turmas inativas da E. M. Dr. Péricles ---
    const turmas = await tx.turma.findMany({ where: { escolaId: 13, status: 'INATIVA' }, select: { id: true } });
    if (turmas.length !== 36) throw new Error(`ABORTADO: esperava 36 turmas inativas do Péricles, achei ${turmas.length}.`);
    const idsT = turmas.map((t) => t.id);
    const refT = await referencias(tx, 'turmas', idsT);
    exigirSo('turmas do Péricles', refT, []);
    console.log(`Turmas inativas do Péricles: 36; refs ${JSON.stringify(refT)}`);

    const r1 = await tx.escola.deleteMany({ where: { id: { in: [63, 64, 65] }, status: 'INATIVA' } });
    const r2 = await tx.pessoa.deleteMany({ where: { id: 287, status: 'INATIVO' } });
    const r3 = await tx.modeloPdi.deleteMany({ where: { id: { in: [77, 78, 79] }, status: 'INATIVA' } });
    const r4 = await tx.turma.deleteMany({ where: { id: { in: idsT }, status: 'INATIVA' } });
    if (r1.count !== 3 || r2.count !== 1 || r3.count !== 3 || r4.count !== 36) throw new Error(`Contagem inesperada: ${r1.count}, ${r2.count}, ${r3.count}, ${r4.count}`);
    const ficaram = {
      escolasInativas: await tx.escola.count({ where: { status: 'INATIVA' } }),
      pessoasInativas: await tx.pessoa.count({ where: { status: 'INATIVO' } }),
      modelosInativos: await tx.modeloPdi.count({ where: { status: 'INATIVA' } }),
      turmasInativas: await tx.turma.count({ where: { status: 'INATIVA' } }),
      historicoReal: { cargosEncerrados: await tx.cargoProfessor.count({ where: { status: 'ENCERRADO' } }), turmasEncerradas: await tx.professorTurmaDisciplina.count({ where: { status: 'ENCERRADO' } }), vinculosEscolaresEncerrados: await tx.vinculoEscolar.count({ where: { status: 'ENCERRADO' } }) },
    };
    console.log('Depois:', JSON.stringify(ficaram));
    if (!aplicar) throw new Ensaio();
  }, { timeout: 180000, maxWait: 20000 });
  console.log('APAGADOS.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO OK: nada foi gravado.'); else throw e;
} finally { await prisma.$disconnect(); }

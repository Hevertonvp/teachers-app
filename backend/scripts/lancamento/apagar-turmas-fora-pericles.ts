// Apaga PARA SEMPRE da PRODUÇÃO (decisão do usuário, 17/11/2026: "pode apagar tudo, exceto turmas do Péricles e
// professores ativos no Péricles"; "3 Marias nada, mantém nada"):
//  - todas as turmas fora da E. M. Dr. Péricles (#13), ativas e inativas, com o que depende delas
//    (vínculos de professor, aluno PDI HENRY #664 com ficha/anamnese/bloco/movimentações);
//  - contas Rogério (#138), Heverton (#307) e Aline Guedes (#283), com cargos, vínculos e eventos;
//  - Três Marias (#25): cargos de Jhonatas (#20) e Rosangela (#50) de lá, todos os vínculos escolares com a escola,
//    Aplicação PDI #178 (só tinha a ficha do HENRY).
// Ficam: as escolas (só sem turmas), Secretaria (#4), Administrador (#112) e as 44 contas do Péricles.
// Exclusão recursiva pelas chaves estrangeiras lidas do próprio banco; aborta se tocar em tabela/linha não prevista.
// Uma transação; sem --aplicar é ENSAIO (desfeito no fim).
//   npx tsx scripts/lancamento/apagar-turmas-fora-pericles.ts            (ensaio)
//   npx tsx scripts/lancamento/apagar-turmas-fora-pericles.ts --aplicar
import 'dotenv/config';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';

const aplicar = process.argv.includes('--aplicar');
class Ensaio extends Error {}
type Tx = Prisma.TransactionClient;

const PERICLES = 13;
const TRES_MARIAS = 25;
const PESSOAS: Record<number, string> = { 138: 'Rogério', 307: 'Heverton Vidal Paulino', 283: 'Aline Guedes' };
const CARGOS_TRES_MARIAS: Record<number, number> = { 20: 272, 50: 302 }; // cargo -> professor (Jhonatas, Rosangela)

const fkCache = new Map<string, { tabela: string; coluna: string }[]>();
const temId = new Map<string, boolean>();
async function filhos(tx: Tx, tabela: string) {
  if (!fkCache.has(tabela)) fkCache.set(tabela, await tx.$queryRawUnsafe(`SELECT tc.table_name AS tabela, kcu.column_name AS coluna FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = '${tabela}' AND tc.table_schema = 'public'`));
  return fkCache.get(tabela)!;
}
async function possuiId(tx: Tx, tabela: string) {
  if (!temId.has(tabela)) {
    const r = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tabela}' AND column_name = 'id'`);
    temId.set(tabela, r.length > 0);
  }
  return temId.get(tabela)!;
}

const apagados: Record<string, number> = {};
const visitados = new Map<string, Set<number>>();
// Tabelas que NUNCA podem ser alcançadas pela cascata (proteção do Péricles e do 1/3 real).
const PROIBIDAS = new Set(['escolas', 'disciplinas', 'atuacoes_pedagogicas', 'modelos_pdi', 'perguntas_pdi', 'ciclos_um_terco']);

async function apagar(tx: Tx, tabela: string, ids: number[], caminho: string) {
  const vis = visitados.get(tabela) ?? new Set<number>();
  visitados.set(tabela, vis);
  ids = ids.filter((i) => !vis.has(i));
  if (!ids.length) return;
  if (PROIBIDAS.has(tabela)) throw new Error(`ABORTADO: cascata chegou em ${tabela} (${caminho})`);
  ids.forEach((i) => vis.add(i));
  for (const { tabela: t, coluna } of await filhos(tx, tabela)) {
    if (await possuiId(tx, t)) {
      const rows = await tx.$queryRawUnsafe<{ id: number }[]>(`SELECT id FROM "${t}" WHERE "${coluna}" IN (${ids.join(',')})`);
      if (rows.length) await apagar(tx, t, rows.map((r) => r.id), `${caminho} > ${t}.${coluna}`);
    } else {
      const n = await tx.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "${coluna}" IN (${ids.join(',')})`);
      if (n) apagados[t] = (apagados[t] ?? 0) + n;
    }
  }
  const n = await tx.$executeRawUnsafe(`DELETE FROM "${tabela}" WHERE id IN (${ids.join(',')})`);
  apagados[tabela] = (apagados[tabela] ?? 0) + n;
}

async function contagens(tx: Tx) {
  return {
    escolas: await tx.escola.count(),
    turmas: await tx.turma.count(),
    turmasPericles: await tx.turma.count({ where: { escolaId: PERICLES } }),
    pessoas: await tx.pessoa.count(),
    cargos: await tx.cargoProfessor.count(),
    alunosPdi: await tx.alunoPdi.count(),
    vinculosEscolaresPericles: await tx.vinculoEscolar.count({ where: { escolaId: PERICLES } }),
    vinculosTurmaPericles: await tx.professorTurmaDisciplina.count({ where: { turma: { escolaId: PERICLES } } }),
    atuacoesTurmaPericles: await tx.professorTurmaAtuacao.count({ where: { turma: { escolaId: PERICLES } } }),
    entregasUmTerco: Number((await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int n FROM entregas_um_terco`))[0].n),
  };
}

try {
  await prisma.$transaction(async (tx) => {
    const antes = await contagens(tx);
    console.log('ANTES :', JSON.stringify(antes));

    // Travas de identidade
    const pessoas = await tx.pessoa.findMany({ where: { id: { in: Object.keys(PESSOAS).map(Number) } }, select: { id: true, nome: true, perfil: true } });
    if (pessoas.length !== 3 || pessoas.some((p) => PESSOAS[p.id] !== p.nome)) throw new Error(`ABORTADO: pessoas não conferem ${JSON.stringify(pessoas)}`);
    const peric = await tx.vinculoEscolar.count({ where: { pessoaId: { in: pessoas.map((p) => p.id) }, escolaId: PERICLES } });
    if (peric) throw new Error('ABORTADO: alguma das 3 contas tem vínculo com o Péricles.');
    const cargosTM = await tx.cargoProfessor.findMany({ where: { id: { in: Object.keys(CARGOS_TRES_MARIAS).map(Number) } }, select: { id: true, professorId: true, versoes: { select: { composicao: true } } } });
    for (const c of cargosTM) {
      const escolas = new Set(c.versoes.flatMap((v) => (v.composicao as { escolaId: number }[]).map((x) => x.escolaId)));
      if (CARGOS_TRES_MARIAS[c.id] !== c.professorId || escolas.size !== 1 || !escolas.has(TRES_MARIAS)) throw new Error(`ABORTADO: cargo #${c.id} não é só da Três Marias`);
    }
    if (cargosTM.length !== 2) throw new Error('ABORTADO: cargos da Três Marias não encontrados.');
    const ap = await tx.aplicacaoPdi.findUnique({ where: { id: 178 }, select: { escolaId: true } });
    if (ap?.escolaId !== TRES_MARIAS) throw new Error('ABORTADO: Aplicação 178 não é da Três Marias.');
    if (await tx.fichaPdi.count({ where: { aplicacaoId: 178, NOT: { alunoId: 664 } } })) throw new Error('ABORTADO: Aplicação 178 tem ficha de outro aluno.');

    // 1) Turmas fora do Péricles (cascata: vínculos de turma, aluno HENRY e o que é dele)
    const turmas = (await tx.turma.findMany({ where: { escolaId: { not: PERICLES } }, select: { id: true } })).map((t) => t.id);
    const alunosFora = (await tx.alunoPdi.findMany({ where: { turma: { escolaId: { not: PERICLES } } }, select: { id: true, nome: true } }));
    if (alunosFora.length !== 1 || alunosFora[0].id !== 664) throw new Error(`ABORTADO: alunos fora do Péricles ${JSON.stringify(alunosFora)}`);
    await apagar(tx, 'alunos_pdi', [664], 'aluno HENRY');
    await apagar(tx, 'turmas', turmas, 'turmas fora do Péricles');
    // 2) Aplicação PDI 178 (Três Marias)
    await apagar(tx, 'aplicacoes_pdi', [178], 'aplicação 178');
    // 3) Cargos da Três Marias de Jhonatas e Rosangela
    await apagar(tx, 'cargos_professor', cargosTM.map((c) => c.id), 'cargos Três Marias');
    // 4) Vínculos escolares com a Três Marias (de qualquer pessoa)
    const vincTM = (await tx.vinculoEscolar.findMany({ where: { escolaId: TRES_MARIAS }, select: { id: true } })).map((v) => v.id);
    await apagar(tx, 'vinculos_escolares', vincTM, 'vínculos Três Marias');
    // 5) Contas Rogério, Heverton, Aline
    await apagar(tx, 'pessoas', pessoas.map((p) => p.id), 'contas');

    const tabelasEsperadas = new Set(['turmas', 'professor_turma_disciplinas', 'professor_turma_atuacoes', 'alunos_pdi', 'fichas_pdi', 'respostas_pdi', 'anamneses', 'movimentacoes_aluno_pdi', 'blocos_respostas_padrao_pdi', 'respostas_bloco_padrao_pdi', 'aplicacoes_pdi', 'aplicacao_modelos_pdi', 'aplicacao_perguntas_pdi', 'aplicacao_escolas_pdi', 'cargos_professor', 'cargo_versoes', 'vinculos_escolares', 'pessoas', 'pessoa_eventos', 'notificacoes', 'assinaturas_push', 'fichas_pdi_historico', 'ficha_pdi_historico', 'correcoes_pdi', 'fichas_anuais_pdi']);
    console.log('APAGADOS POR TABELA:', JSON.stringify(apagados, null, 1));
    const inesperadas = Object.keys(apagados).filter((t) => !tabelasEsperadas.has(t));
    if (inesperadas.length) console.log('ATENÇÃO — tabelas fora da lista prevista:', inesperadas.join(', '));

    const depois = await contagens(tx);
    console.log('DEPOIS:', JSON.stringify(depois));
    if (depois.turmasPericles !== antes.turmasPericles || depois.vinculosEscolaresPericles !== antes.vinculosEscolaresPericles
      || depois.vinculosTurmaPericles !== antes.vinculosTurmaPericles || depois.atuacoesTurmaPericles !== antes.atuacoesTurmaPericles
      || depois.entregasUmTerco !== antes.entregasUmTerco || depois.escolas !== antes.escolas)
      throw new Error('ABORTADO: algo do Péricles, do 1/3 ou das escolas mudou.');
    if (depois.turmas !== depois.turmasPericles || depois.pessoas !== antes.pessoas - 3) throw new Error('ABORTADO: contagem final inesperada.');
    if (!aplicar) throw new Ensaio();
  }, { timeout: 300000, maxWait: 20000 });
  console.log('APAGADOS.');
} catch (e) {
  if (e instanceof Ensaio) console.log('ENSAIO OK: nada foi gravado.'); else throw e;
} finally { await prisma.$disconnect(); }

// Teste de carga do Formulário 1/3 na PRODUÇÃO, antes do lançamento (autorizado pelo usuário em 11/11/2026,
// com a produção ainda sem usuários reais). Tudo o que é criado leva o prefixo ZZCARGA e é apagado no fim.
//
//   npx tsx scripts/lancamento/teste-carga.ts --preparar [--professores=120]
//   npx tsx scripts/lancamento/teste-carga.ts --rodar --usuarios=30 --segundos=180 [--pensar=3-8] [--api=https://...]
//   npx tsx scripts/lancamento/teste-carga.ts --pico-login --usuarios=120
//   npx tsx scripts/lancamento/teste-carga.ts --limpar
//
// Cada professor de teste tem 1 turma e 2 disciplinas (2 formulários de 4 semanas). O ciclo de teste vale SÓ para
// a escola de teste (todasEscolas=false), então nenhum professor ou escola real o vê.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIXO = 'ZZCARGA';
const EMAIL = (n: number | string) => `zzcarga-${n}@teste.invalid`;
const SENHA = 'ZzCarga!2026-teste';
const arg = (nome: string, padrao: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? padrao;
const API = arg('api', 'https://teachers-app-xokm.onrender.com');

async function contagens() {
  return {
    pessoas: await prisma.pessoa.count(), escolas: await prisma.escola.count(), turmas: await prisma.turma.count(),
    vinculosEscolares: await prisma.vinculoEscolar.count(), vinculosTurma: await prisma.professorTurmaDisciplina.count(),
    ciclos: await prisma.cicloUmTerco.count(), semanas: await prisma.semanaUmTerco.count(), entregas: await prisma.entregaUmTerco.count(),
    respostas: await prisma.respostaSemanaUmTerco.count(), historico: await prisma.historicoEntregaUmTerco.count(),
    pessoaEventos: await prisma.pessoaEvento.count(), notificacoes: await prisma.notificacao.count(), disciplinas: await prisma.disciplina.count(),
  };
}

async function limpar() {
  const pessoaIds = (await prisma.pessoa.findMany({ where: { email: { startsWith: 'zzcarga-' } }, select: { id: true } })).map((p) => p.id);
  const escolaIds = (await prisma.escola.findMany({ where: { nome: { startsWith: PREFIXO } }, select: { id: true } })).map((e) => e.id);
  const cicloIds = (await prisma.cicloUmTerco.findMany({ where: { titulo: { startsWith: PREFIXO } }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    const entregaIds = (await tx.entregaUmTerco.findMany({ where: { OR: [{ cicloId: { in: cicloIds } }, { professorId: { in: pessoaIds } }] }, select: { id: true } })).map((e) => e.id);
    await tx.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregaIds } } });
    await tx.entregaUmTerco.deleteMany({ where: { id: { in: entregaIds } } }); // respostas, cobertura e histórico em cascata
    await tx.reaberturaUmTerco.deleteMany({ where: { cicloId: { in: cicloIds } } });
    await tx.cicloUmTerco.deleteMany({ where: { id: { in: cicloIds } } }); // semanas e escolas do ciclo em cascata
    await tx.professorTurmaDisciplina.deleteMany({ where: { OR: [{ professorId: { in: pessoaIds } }, { turma: { escolaId: { in: escolaIds } } }] } });
    await tx.vinculoEscolar.deleteMany({ where: { OR: [{ pessoaId: { in: pessoaIds } }, { escolaId: { in: escolaIds } }] } });
    await tx.notificacao.deleteMany({ where: { destinatarioId: { in: pessoaIds } } });
    await tx.assinaturaPush.deleteMany({ where: { pessoaId: { in: pessoaIds } } });
    await tx.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoaIds } } });
    await tx.pessoa.deleteMany({ where: { id: { in: pessoaIds } } });
    await tx.turma.deleteMany({ where: { escolaId: { in: escolaIds } } });
    await tx.escolaModulo.deleteMany({ where: { escolaId: { in: escolaIds } } });
    await tx.escola.deleteMany({ where: { id: { in: escolaIds } } });
  }, { timeout: 120_000 });
}

async function preparar() {
  const n = Number(arg('professores', '120'));
  await limpar();
  const hoje = new Date();
  const trimestre = await prisma.periodoTrimestre.findFirst({ where: { dataInicio: { lte: hoje }, dataFim: { gte: hoje } } });
  if (!trimestre) throw new Error('Nenhum trimestre do calendário contém a data de hoje.');
  const disciplinas = await prisma.disciplina.findMany({ orderBy: { id: 'asc' }, take: 2 });
  const senhaHash = await bcrypt.hash(SENHA, 10);

  const escola = await prisma.escola.create({ data: { nome: `${PREFIXO} Escola de carga`, status: 'ATIVA', createdBy: PREFIXO } });
  await prisma.pessoa.createMany({ data: [
    ...Array.from({ length: n }, (_, i) => ({ nome: `${PREFIXO} Professor ${i + 1}`, email: EMAIL(i + 1), perfil: 'PROFESSOR' as const, status: 'ATIVO' as const, senhaHash, createdBy: PREFIXO })),
    { nome: `${PREFIXO} Secretaria`, email: EMAIL('sec'), perfil: 'SECRETARIA' as const, status: 'ATIVO' as const, senhaHash, createdBy: PREFIXO },
  ] });
  const profs = await prisma.pessoa.findMany({ where: { email: { startsWith: 'zzcarga-' }, perfil: 'PROFESSOR' }, orderBy: { id: 'asc' } });
  await prisma.vinculoEscolar.createMany({ data: profs.map((p) => ({ escolaId: escola.id, pessoaId: p.id, status: 'ATIVO' as const, dataInicio: new Date('2026-01-01T00:00:00Z'), createdBy: PREFIXO })) });
  await prisma.turma.createMany({ data: profs.map((_, i) => {
    const anoSerie = 6 + (i % 4);
    return { escolaId: escola.id, anoLetivo: trimestre.ano, etapa: 'FUNDAMENTAL' as const, anoSerie, turno: 'MANHA' as const, identificador: 100 + i, nome: `${anoSerie}Z${i + 1}`, identidadeChave: `${PREFIXO}|${i}`, createdBy: PREFIXO };
  }) });
  const turmas = await prisma.turma.findMany({ where: { escolaId: escola.id }, orderBy: { identificador: 'asc' } });
  await prisma.professorTurmaDisciplina.createMany({ data: profs.flatMap((p, i) => disciplinas.map((d) => ({ turmaId: turmas[i].id, professorId: p.id, disciplinaId: d.id, status: 'ATIVO' as const, dataInicio: new Date('2026-01-01T00:00:00Z') }))) });

  const d = (offset: number) => { const x = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())); x.setUTCDate(x.getUTCDate() + offset); return x; };
  const ciclo = await prisma.cicloUmTerco.create({ data: {
    anoLetivo: trimestre.ano, trimestre: trimestre.trimestre, titulo: `${PREFIXO} Formulário 1/3 (teste de carga)`,
    abreEm: new Date(Date.now() - 3600_000), prazoEm: new Date(Date.now() + 2 * 86400_000), status: 'ATIVA', todasEscolas: false, createdBy: PREFIXO,
    escolas: { create: [{ escolaId: escola.id }] },
    semanas: { create: [0, 1, 2, 3].map((k) => ({ numero: k + 1, dataInicio: d(-28 + 7 * k), dataFim: d(-24 + 7 * k) })) },
  } });
  console.log(`Preparado: escola #${escola.id}, ${profs.length} professores + 1 secretaria de teste, ${turmas.length} turmas, ciclo #${ciclo.id} (trimestre ${trimestre.trimestre}/${trimestre.ano}).`);
}

// ---------- Execução da carga ----------
type Medida = { rota: string; ms: number; status: number };
const medidas: Medida[] = [];
let erroRede = 0;
async function chamar(token: string | null, metodo: string, caminho: string, rota: string, corpo?: unknown) {
  const t0 = performance.now();
  try {
    const r = await fetch(API + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: AbortSignal.timeout(60_000) });
    const json = await r.json().catch(() => null);
    medidas.push({ rota, ms: performance.now() - t0, status: r.status });
    return { status: r.status, json };
  } catch {
    erroRede += 1;
    medidas.push({ rota, ms: performance.now() - t0, status: 0 });
    return { status: 0, json: null };
  }
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texto = (i: number) => `Semana trabalhada com leitura, interpretação e atividades em grupo. Registro ${i}. `.repeat(8 + (i % 10));

async function login(email: string) {
  const r = await chamar(null, 'POST', '/api/auth/login', 'POST login', { email, senha: SENHA });
  return r.json?.token as string | undefined;
}

async function professorVirtual(i: number, ate: number, pensar: [number, number]) {
  const pausa = () => esperar(pensar[0] * 1000 + Math.random() * (pensar[1] - pensar[0]) * 1000);
  await esperar(Math.random() * 10_000); // entradas espalhadas nos primeiros 10 s
  const token = await login(EMAIL(i));
  if (!token) return;
  await chamar(token, 'GET', '/api/vinculos-escolares/me', 'GET vinculos/me');
  let k = 0;
  while (Date.now() < ate) {
    const minhas = await chamar(token, 'GET', '/api/formulario-um-terco/minhas', 'GET 1/3 minhas');
    const itens = (Array.isArray(minhas.json) ? minhas.json : []).filter((x: { ciclo: { titulo: string } }) => x.ciclo.titulo.startsWith(PREFIXO));
    for (const item of itens) {
      if (Date.now() >= ate) break;
      const base = `/api/formulario-um-terco/ciclos/${item.ciclo.id}/formularios/${item.anoSerie}/${item.disciplinaId}`;
      let det = await chamar(token, 'GET', base, 'GET formulário');
      await pausa();
      for (const s of det.json?.semanas ?? []) {
        if (Date.now() >= ate) break;
        const r = await chamar(token, 'PUT', `${base}/respostas`, 'PUT salvar semana', { baseUpdatedAt: det.json?.updatedAt ?? null, respostas: [{ semanaId: s.id, texto: texto(k++) }] });
        if (r.status === 200) det = r; else det = await chamar(token, 'GET', base, 'GET formulário');
        await pausa();
      }
      if (Date.now() < ate) await chamar(token, 'POST', `${base}/concluir`, 'POST concluir', { baseUpdatedAt: det.json?.updatedAt ?? null });
      await pausa();
    }
  }
}

async function secretariaVirtual(ate: number) {
  const token = await login(EMAIL('sec'));
  if (!token) return;
  const ciclo = await prisma.cicloUmTerco.findFirst({ where: { titulo: { startsWith: PREFIXO } } });
  while (Date.now() < ate) {
    await chamar(token, 'GET', `/api/formulario-um-terco/ciclos/${ciclo!.id}/painel`, 'GET painel (Secretaria)');
    await esperar(15_000);
  }
}

function relatorio(titulo: string, segundos: number) {
  const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;
  console.log(`\n===== ${titulo} =====`);
  console.log(`Requisições: ${medidas.length} em ${segundos}s (${(medidas.length / segundos).toFixed(1)}/s); falhas de rede/timeout: ${erroRede}`);
  const porStatus = medidas.reduce<Record<number, number>>((a, m) => ({ ...a, [m.status]: (a[m.status] ?? 0) + 1 }), {});
  console.log('Por status:', JSON.stringify(porStatus));
  const rotas = [...new Set(medidas.map((m) => m.rota))];
  console.log('Rota'.padEnd(26), 'qtd'.padStart(6), 'p50'.padStart(7), 'p95'.padStart(7), 'p99'.padStart(7), 'máx'.padStart(7), ' erros');
  for (const r of rotas) {
    const ms = medidas.filter((m) => m.rota === r).map((m) => m.ms).sort((a, b) => a - b);
    const erros = medidas.filter((m) => m.rota === r && (m.status === 0 || m.status >= 400)).length;
    console.log(r.padEnd(26), String(ms.length).padStart(6), ...[50, 95, 99].map((p) => `${Math.round(pct(ms, p))}`.padStart(7)), `${Math.round(ms[ms.length - 1])}`.padStart(7), ` ${erros}`);
  }
}

async function rodar() {
  const usuarios = Number(arg('usuarios', '30'));
  const segundos = Number(arg('segundos', '180'));
  const [a, b] = arg('pensar', '3-8').split('-').map(Number);
  const ate = Date.now() + segundos * 1000;
  console.log(`Carga: ${usuarios} professores simultâneos + 1 Secretaria, ${segundos}s, pausa de ${a}-${b}s entre ações, API ${API}`);
  const t0 = Date.now();
  await Promise.all([...Array.from({ length: usuarios }, (_, i) => professorVirtual(i + 1, ate, [a, b])), secretariaVirtual(ate)]);
  relatorio(`${usuarios} usuários`, Math.round((Date.now() - t0) / 1000));
}

async function picoLogin() {
  const usuarios = Number(arg('usuarios', '120'));
  const t0 = Date.now();
  await Promise.all(Array.from({ length: usuarios }, (_, i) => login(EMAIL(i + 1))));
  relatorio(`Pico: ${usuarios} logins ao mesmo tempo`, Math.max(1, Math.round((Date.now() - t0) / 1000)));
}

async function main() {
  const host = (process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[/?].*$/, '');
  console.log(`Banco: ${host}`);
  if (process.argv.includes('--preparar')) { console.log('Antes:', JSON.stringify(await contagens())); await preparar(); }
  else if (process.argv.includes('--rodar')) await rodar();
  else if (process.argv.includes('--pico-login')) await picoLogin();
  else if (process.argv.includes('--limpar')) { await limpar(); console.log('Depois da limpeza:', JSON.stringify(await contagens())); }
  else console.log('Use --preparar, --rodar, --pico-login ou --limpar.');
}

main().finally(() => prisma.$disconnect());

// Fase 6 — bateria temporal e de sobreposição, tudo PELA INTERFACE da Secretaria.
// Referência: ciclo A = "Formulário 1/3 — Nov/2026 (homolog)" (3º tri/2026, 02/11 08:00 → 20/11 18:00, com entregas).
// Expectativas escritas à mão a partir das decisões registradas (seções 61, 62, 69, 70 do CLAUDE_CONTEXT) —
// NUNCA calculadas pelo algoritmo de produção. Toda tentativa aceita é inativada para não contaminar a próxima.
import { abrir, login, foto, criarCiclo, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const S3 = [['2026-11-02', '2026-11-06'], ['2026-11-09', '2026-11-13']];
const S2 = [['2026-06-01', '2026-06-05'], ['2026-06-08', '2026-06-12']];
// [id, descrição, dados, esperado, base da expectativa]
const CASOS = [
  ['S01', 'B começa depois de A terminar (mesmo trimestre)', { tri: 3, abre: '2026-11-21T08:00', prazo: '2026-11-25T18:00', semanas: S3 }, 'ACEITO', 'seção 69/70 (vários ciclos no trimestre, sem sobreposição)'],
  ['S02', 'B começa exatamente quando A termina (20/11 18:00)', { tri: 3, abre: '2026-11-20T18:00', prazo: '2026-11-25T18:00', semanas: S3 }, 'REJEITADO', 'seção 70 (fronteira coincidente = sobreposição)'],
  ['S03', 'B começa 1 minuto antes de A terminar', { tri: 3, abre: '2026-11-20T17:59', prazo: '2026-11-25T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S04', 'B começa durante A e termina depois', { tri: 3, abre: '2026-11-10T08:00', prazo: '2026-11-25T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S05', 'B totalmente contido em A', { tri: 3, abre: '2026-11-05T08:00', prazo: '2026-11-10T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S06', 'B contém A inteiro', { tri: 3, abre: '2026-11-01T08:00', prazo: '2026-11-25T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S07', 'B com janela idêntica à de A', { tri: 3, abre: '2026-11-02T08:00', prazo: '2026-11-20T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S08', 'B começa antes de A e termina durante A', { tri: 3, abre: '2026-10-28T08:00', prazo: '2026-11-05T18:00', semanas: S3 }, 'REJEITADO', 'seção 70'],
  ['S09', 'B termina exatamente quando A começa (02/11 08:00)', { tri: 3, abre: '2026-10-28T08:00', prazo: '2026-11-02T08:00', semanas: S3 }, 'REJEITADO', 'seção 70 (fronteira coincidente)'],
  ['S10', 'B termina 1 minuto antes de A começar (janela toda no passado)', { tri: 3, abre: '2026-10-28T08:00', prazo: '2026-11-02T07:59', semanas: S3 }, 'ACEITO*', 'sem sobreposição → aceito; retroatividade NÃO especificada'],
  ['S12', 'B em outro trimestre (2º/2026), janela no passado', { tri: 2, abre: '2026-06-01T08:00', prazo: '2026-06-10T18:00', semanas: S2 }, 'ACEITO*', 'sem sobreposição; retroatividade NÃO especificada'],
  ['S13', 'B em ano letivo 2027 (calendário não configurado)', { ano: 2027, tri: 1, abre: '2027-02-10T08:00', prazo: '2027-02-20T18:00', semanas: [['2027-02-10', '2027-02-14']] }, 'REJEITADO', 'seção 31 (2027 não configurado)'],
  ['L02', 'Abertura no 1º instante do trimestre (16/08 00:00)', { tri: 3, abre: '2026-08-16T00:00', prazo: '2026-08-20T18:00', semanas: S3 }, 'ACEITO*', 'limite inclusivo do trimestre; passado'],
  ['L03', 'Prazo no último instante do trimestre (18/12 23:59)', { tri: 3, abre: '2026-12-10T08:00', prazo: '2026-12-18T23:59', semanas: S3 }, 'ACEITO', 'limite inclusivo do trimestre'],
  ['L04', 'Abertura 1 min antes do trimestre (15/08 23:59)', { tri: 3, abre: '2026-08-15T23:59', prazo: '2026-08-20T18:00', semanas: S3 }, 'REJEITADO', 'seção 62 (dentro do trimestre global)'],
  ['L05', 'Prazo no dia seguinte ao fim (19/12 00:00)', { tri: 3, abre: '2026-12-10T08:00', prazo: '2026-12-19T00:00', semanas: S3 }, 'REJEITADO', 'seção 62'],
  ['L06', 'Janela inteira fora do trimestre (jan/2027 num ciclo do 3º/2026)', { tri: 3, abre: '2027-01-10T08:00', prazo: '2027-01-20T18:00', semanas: S3 }, 'REJEITADO', 'seção 62'],
  ['L07', 'Janela cruza a fronteira 2º→3º trimestre (rotulado 2º tri)', { tri: 2, abre: '2026-08-10T08:00', prazo: '2026-08-16T08:00', semanas: S2 }, 'REJEITADO', 'seção 62'],
  ['L08', 'Abertura e prazo no mesmo dia (01/12 08:00→18:00)', { tri: 3, abre: '2026-12-01T08:00', prazo: '2026-12-01T18:00', semanas: S3 }, 'ACEITO', 'sem regra de duração mínima'],
  ['L09', 'Abertura DEPOIS do prazo', { tri: 3, abre: '2026-12-05T08:00', prazo: '2026-12-02T18:00', semanas: S3 }, 'REJEITADO', 'seção 63 (prazo depois da abertura)'],
  ['L10', 'Abertura IGUAL ao prazo', { tri: 3, abre: '2026-12-05T08:00', prazo: '2026-12-05T08:00', semanas: S3 }, 'REJEITADO', 'seção 63'],
  ['L12', 'Duração máxima: trimestre inteiro (16/08 → 18/12), sem sobrepor A? (sobrepõe A)', { tri: 3, abre: '2026-08-16T00:00', prazo: '2026-12-18T23:59', semanas: S3 }, 'REJEITADO', 'seção 70 (contém A)'],
  ['Y01', 'Ano letivo 2025 sem calendário configurado', { ano: 2025, tri: 3, abre: '2025-11-10T08:00', prazo: '2025-11-20T18:00', semanas: [['2025-11-10', '2025-11-14']] }, 'REJEITADO', 'seção 29/31 (calendário obrigatório)'],
];

const TAG = Date.now().toString(36).slice(-4);
const { browser, page, erros } = await abrir();
await login(page, 'secretaria@escola.gov.br', '12345678');

async function inativar(titulo) {
  await page.goto(BASE + '/#/formulario-um-terco'); await page.waitForLoadState('networkidle');
  const card = page.locator('h2.text-xl', { hasText: titulo }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  await card.getByRole('button', { name: 'Inativar' }).click();
  await page.locator('div.fixed.inset-0').getByRole('button', { name: 'Inativar' }).click();
  await page.waitForTimeout(900);
}

for (const [id, desc, dados, esperado, base] of CASOS) {
  const titulo = `ZZ-${id}-${TAG}`;
  const r = await criarCiclo(page, { ...dados, titulo });
  const noBanco = await prisma.cicloUmTerco.count({ where: { titulo } });
  const aceito = r.ok && noBanco === 1;
  const resultado = aceito ? 'ACEITO' : 'REJEITADO';
  const confere = esperado.replace('*', '') === resultado;
  const incerto = esperado.includes('*');
  const status = incerto ? 'OBSERVAÇÃO (regra não especificada)' : (confere ? 'APROVADO' : 'REPROVADO');
  if (!r.ok) { await foto(page, `06-${id}-rejeitado`); await page.keyboard.press('Escape'); }
  registrar(`UT-T-${id}`, 'Formulário 1/3 (calendário)', desc, esperado, aceito ? `ACEITO (banco: ${noBanco})` : `REJEITADO: ${r.mensagem.slice(0, 190)}`, status, r.ok ? '' : `06-${id}-rejeitado.png`, base);
  if (aceito) await inativar(titulo);
}

// Invariante: nenhum par de ciclos ATIVOS com janelas sobrepostas.
const pares = await prisma.$queryRaw`SELECT a.id AS a, b.id AS b FROM ciclos_um_terco a JOIN ciclos_um_terco b ON a.id < b.id WHERE a.status = 'ATIVA' AND b.status = 'ATIVA' AND a."abreEm" <= b."prazoEm" AND a."prazoEm" >= b."abreEm"`.catch(async () => prisma.$queryRawUnsafe(`SELECT a.id AS a, b.id AS b FROM "CicloUmTerco" a JOIN "CicloUmTerco" b ON a.id < b.id WHERE a.status = 'ATIVA' AND b.status = 'ATIVA' AND a."abreEm" <= b."prazoEm" AND a."prazoEm" >= b."abreEm"`));
registrar('UT-T-INV1', 'Formulário 1/3 (calendário)', 'Invariante: nenhum par de ciclos ATIVOS sobrepostos no banco', '0 pares', `${pares.length} pares`, pares.length === 0 ? 'APROVADO' : 'REPROVADO');
console.log('Erros console/rede:', erros);
await browser.close(); await prisma.$disconnect();

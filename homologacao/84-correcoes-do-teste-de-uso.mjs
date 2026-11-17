// Correções do teste "como usuário" de 16/11/2026: (1) "+ Nova turma" continua na escola da última turma criada (ou a
// do filtro), em vez de voltar para a primeira da lista; (2) mensagem curta de turma repetida; (3) "Minhas turmas" do
// professor com uma linha por turma (disciplinas/funções juntas). Navegador real, banco LOCAL. Limpa o que cria.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok) => registrar(`USOFIX-${id}`, 'Correções do teste de uso', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO');
const limpar = async () => {
  const ids = (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-USOFIX' } }, select: { id: true } })).map(e => e.id);
  await prisma.turma.deleteMany({ where: { escolaId: { in: ids } } });
  await prisma.escola.deleteMany({ where: { id: { in: ids } } });
  await limparProfessoresDeTeste(['assist-usofix-']);
};
await limpar();
const escola = await prisma.escola.create({ data: { nome: `ZZ-USOFIX ${TAG}` } });
const X = await abrir();
const p = X.page;
const m = () => p.locator('div.fixed.inset-0').last();
await login(p, 'secretaria@escola.gov.br', '12345678');
await p.goto(BASE + '/#/turmas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
await p.getByRole('button', { name: '+ Nova turma' }).first().click(); await p.waitForTimeout(400);
await m().getByLabel('Escola').selectOption(String(escola.id));
await m().getByLabel('Ano/série').selectOption({ label: '3º ano' });
await m().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1200);
await p.getByRole('button', { name: '+ Nova turma' }).first().click(); await p.waitForTimeout(400);
const escolaDaSegunda = await m().getByLabel('Escola').inputValue();
r('1', '"+ Nova turma" depois de criar uma turma continua na mesma escola', `escola #${escola.id}`, `escola #${escolaDaSegunda}`, escolaDaSegunda === String(escola.id));
await m().getByLabel('Ano/série').selectOption({ label: '3º ano' });
await m().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1200);
const msg = await m().locator('.text-red-800').first().innerText().catch(() => '');
r('2', 'Turma repetida: mensagem curta', '"A turma 3M1 já existe nesta escola."', msg, msg === 'A turma 3M1 já existe nesta escola.');
await m().getByRole('button', { name: 'Cancelar' }).click();
await X.browser.close();

// Filtro: sem turma criada na sessão, a escola do filtro vem escolhida.
const Y = await abrir();
const q = Y.page;
const my = () => q.locator('div.fixed.inset-0').last();
await login(q, 'secretaria@escola.gov.br', '12345678');
await q.goto(BASE + '/#/turmas'); await q.waitForLoadState('networkidle'); await q.waitForTimeout(1500);
await q.locator('main select').first().selectOption(String(escola.id)); await q.waitForTimeout(300);
await q.getByRole('button', { name: '+ Nova turma' }).first().click(); await q.waitForTimeout(400);
const peloFiltro = await my().getByLabel('Escola').inputValue();
r('3', 'Sem turma criada, "+ Nova turma" usa a escola escolhida no filtro da lista', `escola #${escola.id}`, `escola #${peloFiltro}`, peloFiltro === String(escola.id));
await Y.browser.close();

// Minhas turmas agrupadas: professor com Redação e Geografia na 6M1 da Aurora.
const S = await abrir();
const s = S.page;
const ms = () => s.locator('div.fixed.inset-0.z-50').last();
const email = `assist-usofix-${TAG}@homolog.nexo`;
await login(s, 'secretaria@escola.gov.br', '12345678');
await s.goto(BASE + '/#/pessoas'); await s.waitForLoadState('networkidle'); await s.waitForTimeout(1200);
await s.getByRole('button', { name: '+ Cadastrar professor' }).click(); await s.waitForTimeout(500);
await ms().locator('input[type=email]').fill(email);
await ms().locator('input:not([type=email]):not([type=date])').first().fill(`Usofix ${TAG}`);
await ms().getByLabel('Escola 1').first().selectOption({ label: 'ZZ-HOMOLOG Escola Aurora' });
await ms().getByLabel('Disciplina 1').first().selectOption({ label: 'Redação' });
await ms().getByRole('button', { name: '+ Adicionar disciplina' }).first().click();
await ms().getByLabel('Disciplina 2').first().selectOption({ label: 'Geografia' }); await s.waitForTimeout(300);
await ms().getByRole('button', { name: 'Turma 6M1', exact: true }).click();
await ms().getByRole('button', { name: 'Cadastrar', exact: true }).click();
await s.getByText('Senha temporária').waitFor({ timeout: 15000 });
const senha = (await ms().innerText()).match(/SENHA TEMPORÁRIA\s+(\S+)/i)?.[1];
await S.browser.close();
const P = await abrir({ viewport: { width: 390, height: 844 } });
const pp = P.page;
await pp.goto(BASE + '/#/login'); await pp.waitForLoadState('networkidle');
await pp.locator('input[type=email]').fill(email); await pp.locator('input[type=password]').first().fill(senha);
await pp.getByRole('button', { name: /entrar/i }).click(); await pp.waitForTimeout(2000);
const pw = pp.locator('input[type=password]'); await pw.nth(0).fill('Senha1234'); await pw.nth(1).fill('Senha1234');
await pp.getByRole('button', { name: 'Salvar nova senha' }).click(); await pp.waitForTimeout(2500);
const linhas = ((await pp.locator('main').innerText()).match(/6M1 · [^\n]+/g) || []);
r('4', '"Minhas turmas": uma linha por turma, com as disciplinas juntas', '["6M1 · Redação, Geografia"] (ordem livre)', JSON.stringify(linhas), linhas.length === 1 && /Redação/.test(linhas[0]) && /Geografia/.test(linhas[0]));
await P.browser.close();
await limpar();
await prisma.$disconnect();

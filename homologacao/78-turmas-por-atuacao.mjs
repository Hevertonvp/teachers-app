// Turmas por ATUAÇÃO pedagógica (decisão do usuário, 16/11/2026): Professor Regente, Oficina do Brincar e TAE
// podem ter turmas mesmo sem disciplina; Biblioteca, Professor de Intervenção e Eventual não mostram turmas.
// Navegador real (computador e celular), banco LOCAL. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const API = 'http://localhost:3340';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`TURMAATU-${id}`, 'Turmas por atuação pedagógica', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const escolher = async (sel, t) => sel.selectOption(await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t).value, t));
const turmasDe = async (email) => (await prisma.professorTurmaAtuacao.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, atuacao: true } }))
  .map(v => `${v.atuacao.nome}:${v.turma.nome}`).sort().join(', ');
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };
await limparProfessoresDeTeste(['assist-atu-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const email = `assist-atu-${nome}-${TAG}@homolog.nexo`;
  const X = await abrir({ viewport: vp });
  let p = X.page;
  const modal = () => p.locator('div.fixed.inset-0.z-50').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(1000);
  await modal().locator('input[type=email]').fill(email);
  await modal().locator('input:not([type=email]):not([type=date])').first().fill(`Regente Atuacao ${nome} ${TAG}`);
  await escolher(modal().getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Aurora');
  // Sem disciplina: só atuações.
  await modal().getByRole('button', { name: 'Remover disciplina' }).first().click();
  await modal().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(modal().getByLabel('Atuação 1').first(), 'Professor Regente'); await p.waitForTimeout(300);
  const chipsRegente = await modal().getByRole('group', { name: 'Turmas de Professor Regente' }).getByRole('button').allInnerTexts().catch(() => []);
  await modal().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(modal().getByLabel('Atuação 2').first(), 'Professor de Intervenção'); await p.waitForTimeout(300);
  await modal().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(modal().getByLabel('Atuação 3').first(), 'Eventual'); await p.waitForTimeout(300);
  const gruposSemTurma = (await modal().getByRole('group', { name: 'Turmas de Professor de Intervenção' }).count()) + (await modal().getByRole('group', { name: 'Turmas de Eventual' }).count());
  r(`1-${nome}`, `${nome}: no cadastro, "Professor Regente" (sem disciplina) mostra as turmas da escola; Intervenção e Eventual não mostram turmas`, 'turmas do Regente; 0 listas para Intervenção/Eventual',
    `Regente: ${chipsRegente.join(' ')}; listas Intervenção/Eventual: ${gruposSemTurma}`, chipsRegente.includes('6M1') && gruposSemTurma === 0);
  await modal().getByRole('button', { name: 'Professor Regente — 6M1', exact: true }).click();
  await modal().getByRole('button', { name: 'Professor Regente — 6M2', exact: true }).click();
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `78-cadastro-regente-${nome}`);
  await modal().getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
  const senhaTemp = (await modal().innerText()).match(/SENHA TEMPORÁRIA\s+(\S+)/i)?.[1];
  await modal().getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(1200);
  const gravadas = await turmasDe(email);
  r(`2-${nome}`, `${nome}: "Cadastrar" grava o cargo e as turmas do Regente (sem disciplina); sem rolagem lateral`, 'Professor Regente:6M1, Professor Regente:6M2; sem rolagem', `${gravadas}; sem rolagem: ${largura}`,
    gravadas === 'Professor Regente:6M1, Professor Regente:6M2' && largura, `78-cadastro-regente-${nome}.png`);

  // Cargos e escolas: Alterar mostra as marcadas; troca 6M2 por 6M3.
  const linha = () => p.getByText(email, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Cargos e escolas"]][1]');
  await p.getByRole('searchbox', { name: /Buscar professores/i }).fill(email); await p.waitForTimeout(400);
  await linha().getByRole('button', { name: 'Cargos e escolas' }).click(); await p.waitForTimeout(1500);
  await modal().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const ja = await modal().getByRole('button', { name: 'Professor Regente — 6M1', exact: true }).getAttribute('aria-pressed');
  await modal().getByRole('button', { name: 'Professor Regente — 6M2', exact: true }).click();
  await modal().getByRole('button', { name: 'Professor Regente — 6M3', exact: true }).click();
  await modal().getByRole('button', { name: 'Salvar cargo' }).click(); await p.waitForTimeout(2500);
  const depois = await turmasDe(email);
  r(`3-${nome}`, `${nome}: "Cargos e escolas" → Alterar mostra as turmas do Regente; trocar 6M2 por 6M3 grava ao salvar`, '6M1 marcada; Professor Regente:6M1, Professor Regente:6M3', `6M1: ${ja}; ${depois}`, ja === 'true' && depois === 'Professor Regente:6M1, Professor Regente:6M3');
  await modal().getByRole('button', { name: 'Fechar' }).last().click(); await p.waitForTimeout(600);

  // Botão "Turmas": linha "Professor Regente" com as marcadas; marcar 6M4 grava na hora.
  await linha().getByRole('button', { name: 'Turmas' }).click(); await p.waitForTimeout(1500);
  const linhaRegente = modal().locator('[data-disciplina="Professor Regente"]');
  const marcadasModal = await linhaRegente.getByRole('button', { pressed: true }).allInnerTexts();
  await linhaRegente.getByRole('button', { name: 'Professor Regente — 6M4', exact: true }).click(); await p.waitForTimeout(1500);
  const comM4 = await turmasDe(email);
  r(`4-${nome}`, `${nome}: botão "Turmas" mostra a linha "Professor Regente" e marca/desmarca na hora`, '✓ 6M1, ✓ 6M3; depois + 6M4', `${marcadasModal.join(', ')}; ${comM4}`,
    marcadasModal.join(', ') === '✓ 6M1, ✓ 6M3' && comM4 === 'Professor Regente:6M1, Professor Regente:6M3, Professor Regente:6M4');
  await X.browser.close();

  // API: Eventual e Intervenção recusadas; Regente idempotente.
  const t = await token('secretaria@escola.gov.br', '12345678');
  const prof = await prisma.pessoa.findUnique({ where: { email } });
  const turma = await prisma.turma.findFirst({ where: { nome: '6M1', escola: { nome: 'ZZ-HOMOLOG Escola Aurora' }, status: 'ATIVA' } });
  const ev = await prisma.atuacaoPedagogica.findFirst({ where: { nome: 'Eventual' } });
  const inter = await prisma.atuacaoPedagogica.findFirst({ where: { nome: 'Professor de Intervenção' } });
  const reg = await prisma.atuacaoPedagogica.findFirst({ where: { nome: 'Professor Regente' } });
  const rEv = await api(t, 'POST', '/api/professor-turma-atuacao', { turmaId: turma.id, professorId: prof.id, atuacaoId: ev.id });
  const rIn = await api(t, 'POST', '/api/professor-turma-atuacao', { turmaId: turma.id, professorId: prof.id, atuacaoId: inter.id });
  const rRe = await api(t, 'POST', '/api/professor-turma-atuacao', { turmaId: turma.id, professorId: prof.id, atuacaoId: reg.id });
  const ativos6M1 = await prisma.professorTurmaAtuacao.count({ where: { professorId: prof.id, turmaId: turma.id, atuacaoId: reg.id, status: 'ATIVO' } });
  r(`5-${nome}`, `${nome}: API recusa turma para Eventual e Intervenção; repetir Regente na mesma turma não duplica`, '400, 400; 200 e 1 ativo', `${rEv.status} "${rEv.json?.message}", ${rIn.status}; Regente ${rRe.status}, ativos ${ativos6M1}`,
    rEv.status === 400 && rIn.status === 400 && rRe.status === 200 && ativos6M1 === 1);

  // Professor vê "6M1 · Professor Regente" em Minhas turmas.
  const P = await abrir({ viewport: vp });
  p = P.page;
  await p.goto(BASE + '/#/login'); await p.waitForLoadState('networkidle');
  await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').first().fill(senhaTemp);
  await p.getByRole('button', { name: /entrar/i }).click(); await p.waitForTimeout(2000);
  const pw = p.locator('input[type=password]'); await pw.nth(0).fill('Senha1234'); await pw.nth(1).fill('Senha1234');
  await p.getByRole('button', { name: 'Salvar nova senha' }).click(); await p.waitForTimeout(2500);
  const minhas = (await p.locator('main').innerText()).match(/\d+M\d · Professor Regente/g) ?? [];
  await foto(p, `78-minhas-turmas-${nome}`);
  r(`6-${nome}`, `${nome}: o professor vê as turmas com a função ("6M1 · Professor Regente") em Minhas turmas`, '6M1, 6M3, 6M4 · Professor Regente', minhas.join(', '),
    minhas.join(', ') === '6M1 · Professor Regente, 6M3 · Professor Regente, 6M4 · Professor Regente', `78-minhas-turmas-${nome}.png`);
  await P.browser.close();

  // Tirar a atuação do cargo encerra as turmas dela.
  const Y = await abrir({ viewport: vp });
  p = Y.page;
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('searchbox', { name: /Buscar professores/i }).fill(email); await p.waitForTimeout(400);
  await linha().getByRole('button', { name: 'Cargos e escolas' }).click(); await p.waitForTimeout(1500);
  await modal().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const sels = await modal().locator('select[aria-label^="Atuação "]').evaluateAll(es => es.map(e => e.options[e.selectedIndex]?.text.trim()));
  await modal().getByRole('button', { name: 'Remover atuação' }).nth(sels.indexOf('Professor Regente')).click();
  await modal().getByRole('button', { name: 'Salvar cargo' }).click(); await p.waitForTimeout(2500);
  const semRegente = await turmasDe(email);
  r(`7-${nome}`, `${nome}: tirar "Professor Regente" do cargo encerra as turmas dele (Intervenção e Eventual ficam no cargo)`, 'nenhuma turma ativa', `"${semRegente}"`, semRegente === '');
  await Y.browser.close();
}

await limparProfessoresDeTeste(['assist-atu-']);
await prisma.$disconnect();

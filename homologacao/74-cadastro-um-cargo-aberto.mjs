// Cadastro de professor com UM cargo aberto por vez (decisão do usuário, 15/11/2026): ao escolher "2", o Cargo 1
// vira uma linha de resumo com "Editar" e o Cargo 2 abre na vista, com o foco na escola — antes o Cargo 2 abria
// embaixo, fora da vista, e o usuário preenchia o Cargo 1 de novo. Navegador real (desktop e celular), banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UMABERTO-${id}`, 'Cadastro: um cargo aberto por vez', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const escolher = async (sel, texto) => sel.selectOption(await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t).value, texto));
await limparProfessoresDeTeste(['assist-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const m = p.locator('div.fixed.inset-0.z-50').first();
  const email = `assist-aberto-${nome}-${TAG}@homolog.nexo`;
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(800);

  // 1. Um cargo: tela de sempre, sem linha de resumo.
  const semResumo = (await m.locator('[data-cargo-fechado]').count()) === 0 && (await m.getByRole('heading', { name: 'Cargo 1' }).isVisible());
  r(`1-${nome}`, `${nome}: com 1 cargo a tela é a de sempre (Cargo 1 aberto, sem resumo)`, 'Cargo 1 aberto; 0 resumos', String(semResumo), semResumo);

  await m.locator('input[type=email]').fill(email);
  await m.locator('input:not([type=email]):not([type=date])').first().fill(`Professor Aberto ${nome} ${TAG}`);
  await escolher(m.getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Aurora');
  await escolher(m.getByLabel('Disciplina 1').first(), 'Redação');
  await m.getByRole('button', { name: 'Redação — 6M1', exact: true }).click();

  // 2. Escolher "2": Cargo 1 vira resumo; Cargo 2 aberto, na vista e com foco na escola.
  await m.getByRole('radio', { name: '2' }).click(); await p.waitForTimeout(900);
  const resumo1 = (await m.locator('[data-cargo-fechado="Cargo 1"]').innerText().catch(() => '')).replace(/\n/g, ' | ');
  const editores = await m.getByRole('heading', { name: /^Cargo \d$/ }).allInnerTexts();
  const foco = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  const caixa = await m.getByRole('heading', { name: 'Cargo 2' }).boundingBox();
  const naVista = !!caixa && caixa.y >= 0 && caixa.y < vp.height;
  await foto(p, `74-cargo2-aberto-${nome}`);
  r(`2-${nome}`, `${nome}: ao escolher "2", Cargo 1 vira uma linha de resumo e só o Cargo 2 fica aberto, na vista, com o foco na escola`, 'resumo "ZZ-HOMOLOG Escola Aurora — Redação (6M1)"; só Cargo 2 aberto; foco Escola 1; na vista',
    `${resumo1}; abertos: ${editores.join(',')}; foco: ${foco}; na vista: ${naVista}`,
    resumo1.includes('ZZ-HOMOLOG Escola Aurora — Redação (6M1)') && JSON.stringify(editores) === '["Cargo 2"]' && foco === 'Escola 1' && naVista, `74-cargo2-aberto-${nome}.png`);

  // 3. Cadastrar com Cargo 2 vazio: fica no Cargo 2 com o erro; nada gravado.
  await m.getByRole('button', { name: 'Cadastrar', exact: true }).click(); await p.waitForTimeout(800);
  const erro = await m.getByText('Escolha a escola.').isVisible();
  const nada = !(await prisma.pessoa.findUnique({ where: { email } }));
  r(`3-${nome}`, `${nome}: "Cadastrar" com o Cargo 2 vazio mostra o erro no Cargo 2 e não grava nada`, 'erro; nada no banco', `erro: ${erro}; nada: ${nada}`, erro && nada);

  // 4. "Editar" do Cargo 1: abre com a turma marcada; Cargo 2 vira resumo e avisa que falta conferir.
  await m.locator('[data-cargo-fechado="Cargo 1"]').getByRole('button', { name: 'Editar' }).click(); await p.waitForTimeout(600);
  const marcada = await m.getByRole('button', { name: 'Redação — 6M1', exact: true }).getAttribute('aria-pressed');
  const resumo2 = await m.locator('[data-cargo-fechado="Cargo 2"]').innerText().catch(() => '');
  r(`4-${nome}`, `${nome}: "Editar" no Cargo 1 abre ele sem perder nada; o Cargo 2 vira resumo com "Confira este cargo."`, '6M1 marcada; Cargo 2 com aviso', `6M1: ${marcada}; Cargo 2: ${resumo2.replace(/\n/g, ' | ')}`, marcada === 'true' && resumo2.includes('Confira este cargo.'));

  // 5. Preenche o Cargo 2 e cadastra: 2 cargos + 1 turma.
  await m.locator('[data-cargo-fechado="Cargo 2"]').getByRole('button', { name: 'Editar' }).click(); await p.waitForTimeout(600);
  await escolher(m.getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Boa Vista');
  await escolher(m.getByLabel('Disciplina 1').first(), 'Geografia');
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await m.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
  const cargos = await prisma.cargoProfessor.count({ where: { professor: { email } } });
  const turmas = await prisma.professorTurmaDisciplina.count({ where: { professor: { email }, status: 'ATIVO' } });
  r(`5-${nome}`, `${nome}: "Cadastrar" grava os 2 cargos e a turma do Cargo 1; sem rolagem lateral`, '2 cargos; 1 turma; sem rolagem', `${cargos} cargos; ${turmas} turma; sem rolagem: ${largura}`, cargos === 2 && turmas === 1 && largura);
  await X.browser.close();
  await limparProfessoresDeTeste(['assist-']);
}
await prisma.$disconnect();

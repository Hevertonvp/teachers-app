// Turmas em "Cargos e escolas" (decisão do usuário, 15/11/2026: "idêntico" ao cadastro; o botão "Turmas" continua).
// Alterar o cargo mostra, em cada disciplina, as turmas que o professor JÁ tem marcadas; marcar/desmarcar só vale
// em "Salvar cargo". Disciplina tirada do cargo não leva as turmas dela. Navegador real, banco LOCAL. Limpa o que cria.
import { abrir, login, foto, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`CARGOTURMA-${id}`, 'Turmas em Cargos e escolas', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const email = `assist-cargo-${TAG}@homolog.nexo`;
const ativas = async () => (await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, disciplina: true } })).map(v => `${v.turma.nome}-${v.disciplina.nome}`).sort().join(', ');
await limparProfessoresDeTeste(['assist-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const modal = () => p.locator('div.fixed.inset-0.z-50').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  // Cadastro com Redação 6M1.
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(1200);
  await preencherCadastroProfessor(modal(), { email, nome: `Professor Assistente Cargo ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplina: 'Redação', turmas: ['Redação — 6M1'] });
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
  await modal().getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(1500);

  const abrirCargos = async () => {
    const linha = p.getByText(email, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Cargos e escolas"]][1]');
    for (let i = 0; i < 12 && !(await p.getByText(email, { exact: true }).count()); i++) { await p.getByRole('button', { name: 'Próxima' }).click(); await p.waitForTimeout(400); }
    await linha.getByRole('button', { name: 'Cargos e escolas' }).click(); await p.waitForTimeout(1500);
  };
  await abrirCargos();
  await modal().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const ja = await modal().getByRole('button', { name: 'Redação — 6M1', exact: true }).getAttribute('aria-pressed');
  r(`1-${nome}`, `${nome}: "Alterar" mostra a turma que o professor já tem marcada`, 'Redação — 6M1 marcada', `aria-pressed=${ja}`, ja === 'true');

  // Troca 6M1 → 6M2 e adiciona Geografia 6M1.
  await modal().getByRole('button', { name: 'Redação — 6M1', exact: true }).click();
  await modal().getByRole('button', { name: 'Redação — 6M2', exact: true }).click();
  const antesDeSalvar = await ativas();
  await modal().getByRole('button', { name: '+ Adicionar disciplina' }).first().click();
  const sel = modal().getByLabel('Disciplina 2').first();
  await sel.selectOption(await sel.evaluate(s => [...s.options].find(o => o.text.trim() === 'Geografia').value));
  await modal().getByRole('button', { name: 'Geografia — 6M1', exact: true }).click();
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `73-cargos-turmas-${nome}`);
  r(`2-${nome}`, `${nome}: marcar/desmarcar não grava antes de "Salvar cargo"; sem rolagem lateral`, '6M1-Redação; sem rolagem', `${antesDeSalvar}; sem rolagem: ${largura}`, antesDeSalvar === '6M1-Redação' && largura, `73-cargos-turmas-${nome}.png`);
  await modal().getByRole('button', { name: 'Salvar cargo' }).click(); await p.waitForTimeout(2500);
  const depois = await ativas();
  r(`3-${nome}`, `${nome}: "Salvar cargo" grava as turmas: sai 6M1 de Redação, entram 6M2 de Redação e 6M1 de Geografia`, '6M1-Geografia, 6M2-Redação', depois, depois === '6M1-Geografia, 6M2-Redação');

  // Tira Geografia do cargo: a turma dela fica (aparece em "Turmas" como fora do cargo).
  await modal().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const nomes = await modal().locator('select[aria-label^="Disciplina "]').evaluateAll(els => els.map(e => e.options[e.selectedIndex]?.text.trim()));
  await modal().getByRole('button', { name: 'Remover disciplina' }).nth(nomes.indexOf('Geografia')).click();
  await modal().getByRole('button', { name: 'Salvar cargo' }).click(); await p.waitForTimeout(2500);
  const semGeo = await ativas();
  r(`4-${nome}`, `${nome}: tirar a disciplina do cargo não apaga as turmas dela`, '6M1-Geografia, 6M2-Redação', semGeo, semGeo === '6M1-Geografia, 6M2-Redação');
  await modal().getByRole('button', { name: 'Fechar' }).last().click(); await p.waitForTimeout(800);

  // Botão "Turmas" continua igual e mostra o mesmo estado.
  const linha = p.getByText(email, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Cargos e escolas"]][1]');
  await linha.getByRole('button', { name: 'Turmas', exact: true }).click(); await p.waitForTimeout(2000);
  await foto(p, `73-botao-turmas-${nome}`);
  const m6m2 = await modal().getByRole('button', { name: 'Redação — 6M2', exact: true }).getAttribute('aria-pressed');
  const fora = await modal().getByText('Fora do cargo').count();
  r(`5-${nome}`, `${nome}: o botão "Turmas" continua e mostra o mesmo (6M2 de Redação marcada; Geografia em "Fora do cargo")`, 'marcada; Fora do cargo', `6M2 aria-pressed=${m6m2}; fora do cargo: ${fora}`, m6m2 === 'true' && fora === 1);
  await X.browser.close();
  await limparProfessoresDeTeste(['assist-']);
}
await prisma.$disconnect();

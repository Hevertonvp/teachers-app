// "Cargos e escolas" (pergunta do usuário, 16/11/2026): durante "Alterar", o "2" parecia quebrado (botão apagado,
// sem explicação). Decisão: continua sem abrir cargo novo no meio da alteração, mas tocar no "2" avisa
// "Salve ou cancele o Cargo 1 primeiro."; depois de cancelar, o "2" abre o Cargo 2. Navegador real, banco LOCAL.
import { abrir, login, foto, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`NUMCARGO-${id}`, 'Cargos e escolas: número de cargos durante Alterar', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
await limparProfessoresDeTeste(['assist-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const modal = () => p.locator('div.fixed.inset-0.z-50').last();
  const email = `assist-num-${nome}-${TAG}@homolog.nexo`;
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(1200);
  await preencherCadastroProfessor(modal(), { email, nome: `Professor Numero ${nome} ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplina: 'Redação' });
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
  await modal().getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && !(await p.getByText(email, { exact: true }).count()); i++) { await p.getByRole('button', { name: 'Próxima' }).click(); await p.waitForTimeout(400); }
  await p.getByText(email, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Cargos e escolas"]][1]').getByRole('button', { name: 'Cargos e escolas' }).click(); await p.waitForTimeout(1500);

  // 1. Alterar o Cargo 1 e tocar no "2": aviso, nenhum Cargo 2 aberto, botão não apagado.
  await modal().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const dois = modal().getByRole('radio', { name: '2' });
  const habilitado = await dois.isEnabled();
  await dois.click(); await p.waitForTimeout(400);
  const aviso = await modal().getByText('Salve ou cancele o Cargo 1 primeiro.').isVisible();
  const cargo2 = await modal().getByRole('heading', { name: 'Cargo 2' }).count();
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `75-aviso-numero-${nome}`);
  r(`1-${nome}`, `${nome}: durante "Alterar", tocar no "2" mostra "Salve ou cancele o Cargo 1 primeiro." e não abre o Cargo 2; sem rolagem lateral`, 'habilitado; aviso; 0 Cargo 2; sem rolagem',
    `habilitado: ${habilitado}; aviso: ${aviso}; Cargo 2: ${cargo2}; sem rolagem: ${largura}`, habilitado && aviso && cargo2 === 0 && largura, `75-aviso-numero-${nome}.png`);

  // 2. Cancelar: aviso some; "2" abre o Cargo 2.
  await modal().getByRole('button', { name: 'Cancelar' }).first().click(); await p.waitForTimeout(400);
  const avisoSumiu = (await modal().getByText('Salve ou cancele o Cargo 1 primeiro.').count()) === 0;
  await dois.click(); await p.waitForTimeout(500);
  const abriu = await modal().getByRole('heading', { name: 'Cargo 2' }).isVisible();
  r(`2-${nome}`, `${nome}: depois de "Cancelar" o aviso some e o "2" abre o Cargo 2`, 'aviso some; Cargo 2 aberto', `aviso some: ${avisoSumiu}; Cargo 2: ${abriu}`, avisoSumiu && abriu);
  await X.browser.close();
}
await limparProfessoresDeTeste(['assist-']);
await prisma.$disconnect();

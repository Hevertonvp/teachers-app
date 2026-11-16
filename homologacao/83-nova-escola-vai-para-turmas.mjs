// Ao CRIAR uma escola, vai direto para "Nova turma" com ela escolhida (pedido do usuário, 16/11/2026). Editar
// escola continua na tela de Escolas; recarregar a tela de Turmas não reabre o formulário. Navegador real
// (computador e celular), banco LOCAL. Limpa o que cria.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok) => registrar(`NOVAESCOLA-${id}`, 'Nova escola vai para Turmas', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO');
const limpar = async () => {
  const ids = (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-NOVAESC' } }, select: { id: true } })).map(e => e.id);
  await prisma.turma.deleteMany({ where: { escolaId: { in: ids } } });
  await prisma.escolaNivelInfantil.deleteMany({ where: { escolaId: { in: ids } } });
  await prisma.escola.deleteMany({ where: { id: { in: ids } } });
};
await limpar();
for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const NOME = `ZZ-NOVAESC ${nome} ${TAG}`;
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const m = () => p.locator('div.fixed.inset-0').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/escolas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: '+ Nova escola' }).click(); await p.waitForTimeout(500);
  await m().getByLabel('Nome da escola').fill(NOME);
  await m().getByRole('group', { name: 'Etapas oferecidas' }).getByRole('button', { name: 'Fundamental I', exact: true }).click();
  await m().getByRole('button', { name: 'Salvar' }).click();
  await p.waitForURL(/#\/turmas/, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const escola = await prisma.escola.findFirst({ where: { nome: NOME } });
  const aberto = await p.locator('div.fixed.inset-0').count();
  const titulo = aberto ? await m().locator('h2, h3').first().innerText().catch(() => '') : '';
  const escolhida = aberto ? await m().getByLabel('Escola').inputValue().catch(() => '') : '';
  const anos = aberto ? await m().getByLabel('Ano/série').evaluate(s => [...s.options].map(o => o.text).join(',')).catch(() => '') : '';
  const aviso = await p.getByText('Escola criada. Cadastre as turmas.').isVisible().catch(() => false);
  r(`1-${nome}`, `${nome}: criar escola leva a Turmas com "Nova turma" aberto, a escola nova escolhida, só os anos dela e o aviso`, `URL /turmas; Nova turma; escola #${escola?.id}; 1º–5º ano; aviso`,
    `${p.url().split('#')[1]}; "${titulo}"; escola ${escolhida}; ${anos}; aviso: ${aviso}`,
    /\/turmas/.test(p.url()) && titulo === 'Nova turma' && escolhida === String(escola?.id) && anos === '1º ano,2º ano,3º ano,4º ano,5º ano' && aviso);
  await m().getByRole('button', { name: 'Cancelar' }).click(); await p.waitForTimeout(400);
  await p.reload(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
  const reaberto = await p.locator('div.fixed.inset-0').count();
  r(`2-${nome}`, `${nome}: recarregar a tela de Turmas não reabre o formulário`, '0 janelas', String(reaberto), reaberto === 0);
  // Editar escola: fica em Escolas.
  await p.goto(BASE + '/#/escolas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  await p.getByLabel('Buscar escola').fill(NOME); await p.waitForTimeout(300);
  await p.locator('tbody tr').first().getByRole('button', { name: 'Editar' }).click(); await p.waitForTimeout(400);
  await m().getByLabel('Nome da escola').fill(`${NOME} editada`);
  await m().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1500);
  r(`3-${nome}`, `${nome}: editar escola continua na tela de Escolas`, '/escolas', p.url().split('#')[1], /\/escolas/.test(p.url()));
  await X.browser.close();
}
await limpar();
await prisma.$disconnect();

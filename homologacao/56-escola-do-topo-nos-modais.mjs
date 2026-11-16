// Escola do seletor do topo vem marcada nos modais com campo de escola (pedido do usuário, 12/11/2026).
// Banco LOCAL. Só abre e cancela modais: nada é gravado.
import { abrir, login, BASE, foto } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`TOPO-${id}`, 'Escola do topo nos modais', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');

const modal = (page) => page.locator('div.fixed.inset-0').last();
const ir = async (page, rota) => { await page.evaluate((h) => { location.hash = h; }, rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600); };
const escolherNoTopo = async (page, indice) => {
  await page.locator('button[aria-haspopup="listbox"]').first().click();
  const opcao = page.getByRole('option').nth(indice);
  const nome = (await opcao.textContent()).trim();
  await opcao.click();
  await page.waitForTimeout(300);
  return nome;
};
const primeiroSelect = (page) => modal(page).locator('select').first().evaluate(s => s.options[s.selectedIndex]?.text?.trim() ?? '');
const marcados = (page) => modal(page).locator('input[type=checkbox]:checked').evaluateAll(l => l.map(i => i.closest('label').textContent.trim()));
const fechar = async (page) => {
  const cancelar = modal(page).getByRole('button', { name: /Cancelar|Fechar/ }).first();
  if (await cancelar.count()) await cancelar.click(); else await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};

const X = await abrir();
const { page, erros } = X;
try {
  await login(page, 'secretaria@escola.gov.br', '12345678');
  const escola = await escolherNoTopo(page, 3); // nem "Todas", nem a 1ª da lista
  r('0', 'Secretaria escolhe uma escola no topo', 'escola escolhida', escola, !!escola);

  await ir(page, '#/turmas');
  await page.getByRole('button', { name: '+ Nova turma' }).click();
  const turma = await primeiroSelect(page);
  await foto(page, '56-nova-turma');
  await fechar(page);
  r('1', 'Nova turma', escola, turma, turma === escola);

  await ir(page, '#/pessoas');
  await page.getByRole('button', { name: '+ Cadastrar professor' }).click();
  // Desde 12/11/2026 a Secretaria cadastra o Professor por CARGO: a escola do topo vem no Cargo 1.
  const prof = await modal(page).getByLabel('Escola 1').first().evaluate(s => s.options[s.selectedIndex]?.text?.trim() ?? '');
  await fechar(page);
  r('2', 'Cadastrar professor (escola do Cargo 1)', escola, prof, prof === escola);

  for (const [id, aba, botao] of [['3', 'Auxiliares', '+ Cadastrar auxiliar'], ['4', 'Supervisores(as)', '+ Cadastrar supervisor(a)']]) {
    await page.getByRole('button', { name: aba, exact: true }).click();
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
    await page.getByRole('button', { name: botao }).click();
    const m = await marcados(page);
    await fechar(page);
    r(id, botao.replace('+ ', ''), `[${escola}]`, JSON.stringify(m), m.length === 1 && m[0] === escola);
  }

  await page.getByRole('button', { name: 'Diretores(as)', exact: true }).click();
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
  await page.getByRole('button', { name: '+ Cadastrar diretora' }).click();
  const dir = await primeiroSelect(page);
  await fechar(page);
  r('5', 'Cadastrar diretora', escola, dir, dir === escola);

  await ir(page, '#/formulario-um-terco');
  await page.getByRole('button', { name: '+ Novo ciclo' }).first().click();
  const ciclo = await marcados(page);
  await foto(page, '56-novo-ciclo');
  await fechar(page);
  r('6', 'Novo ciclo do 1/3: só a escola do topo, sem "Todas as escolas"', `[${escola}]`, JSON.stringify(ciclo), ciclo.length === 1 && ciclo[0] === escola);

  await ir(page, '#/mensagens');
  await page.getByRole('button', { name: 'Nova mensagem' }).click();
  await page.waitForTimeout(1200);
  const temCampo = await modal(page).locator('select').count();
  await fechar(page);
  r('7', 'Nova mensagem da Secretaria', 'sem campo de escola (não se aplica)', temCampo ? 'tem campo' : 'sem campo', true);

  // "Todas as escolas" no topo: comportamento de antes.
  await escolherNoTopo(page, 0);
  await ir(page, '#/turmas');
  await page.getByRole('button', { name: '+ Nova turma' }).click();
  const turmaTodas = await primeiroSelect(page);
  const primeiraEscola = await modal(page).locator('select').first().evaluate(s => [...s.options].filter(o => !o.disabled)[0]?.text?.trim());
  await fechar(page);
  r('8', 'Topo em "Todas": Nova turma vem com a 1ª escola (como antes)', primeiraEscola, turmaTodas, turmaTodas === primeiraEscola);

  await ir(page, '#/formulario-um-terco');
  await page.getByRole('button', { name: '+ Novo ciclo' }).first().click();
  const cicloTodas = await marcados(page);
  await fechar(page);
  r('9', 'Topo em "Todas": Novo ciclo vem com "Todas as escolas" (como antes)', 'só "Todas as escolas"', JSON.stringify(cicloTodas), cicloTodas.length === 1 && /Todas as escolas/.test(cicloTodas[0]));

  r('10', 'Sem erros no console', '0', erros.join(' | ') || '0', erros.length === 0);
} finally {
  await X.browser.close();
}

// Celular (390 px): Nova turma com escola do topo.
const C = await abrir({ viewport: { width: 390, height: 844 } });
try {
  await login(C.page, 'secretaria@escola.gov.br', '12345678');
  const escola = await escolherNoTopo(C.page, 2);
  await ir(C.page, '#/turmas');
  await C.page.getByRole('button', { name: '+ Nova turma' }).click();
  const turma = await primeiroSelect(C.page);
  const largura = await C.page.evaluate(() => document.documentElement.scrollWidth);
  await foto(C.page, '56-nova-turma-celular');
  r('11', 'Celular: Nova turma com a escola do topo, sem rolagem lateral', `${escola}; largura ≤ 390`, `${turma}; ${largura}`, turma === escola && largura <= 390);
} finally {
  await C.browser.close();
}

// Professor com mais de uma escola: Nova mensagem vem com a escola do topo.
const P = await abrir();
try {
  await login(P.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  const opcoes = await P.page.locator('button[aria-haspopup="listbox"]').count() ? (await P.page.locator('button[aria-haspopup="listbox"]').first().click(), await P.page.getByRole('option').count()) : 0;
  if (opcoes > 1) {
    await P.page.keyboard.press('Escape');
    const escola = await escolherNoTopo(P.page, opcoes - 1);
    await ir(P.page, '#/mensagens');
    await P.page.getByRole('button', { name: 'Nova mensagem' }).click();
    await P.page.waitForTimeout(1500);
    const tem = await modal(P.page).locator('select').count();
    const msg = tem ? await primeiroSelect(P.page) : '(sem campo de escola)';
    await foto(P.page, '56-nova-mensagem-professor');
    r('12', 'Professor com 2+ escolas: Nova mensagem', escola, msg, msg === escola);
  } else {
    r('12', 'Professor com 2+ escolas: Nova mensagem', 'professor com 2+ escolas', 'p04 tem ' + opcoes + ' escola(s): não testado', false);
  }
} finally {
  await P.browser.close();
}

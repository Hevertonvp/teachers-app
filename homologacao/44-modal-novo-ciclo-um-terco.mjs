// Modal "Novo Formulário 1/3" (pedido de 10/11/2026), navegador real, banco LOCAL:
// sem ano, trimestre e título; trimestre identificado pela abertura; semanas divididas automaticamente
// dentro da janela abertura→prazo (4 por padrão, editáveis); edição de ciclo existente não redivide sozinha.
// O ciclo criado pelo teste é INATIVADO no fim (não sobrepõe janelas de outros testes).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UT-MODAL-${id}`, 'Formulário 1/3 — modal de novo ciclo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const modal = (page) => page.locator('div.fixed.inset-0.z-50');
const semanasNaTela = async (m) => {
  const n = Number(await m.getByLabel('Quantidade de semanas').inputValue());
  const lista = [];
  for (let i = 1; i <= n; i++) lista.push([await m.getByLabel(`Semana ${i}: início`).inputValue(), await m.getByLabel(`Semana ${i}: fim`).inputValue()]);
  return lista;
};
const txt = (l) => l.map(([a, b]) => `${a.slice(8)}/${a.slice(5, 7)}–${b.slice(8)}/${b.slice(5, 7)}`).join(', ');
const antes = new Set((await prisma.cicloUmTerco.findMany({ select: { id: true } })).map(c => c.id));
let criado = null;

try {
  for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    await login(X.page, 'secretaria@escola.gov.br', '123456');
    await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
    await X.page.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await X.page.waitForTimeout(600);
    const m = modal(X.page);
    const tipos = [await m.getByLabel('Abertura', { exact: true }).getAttribute('type'), await m.getByLabel('Prazo de entrega', { exact: true }).getAttribute('type')];
    r(`0-${nome}`, `${nome}: abertura e prazo são só DATA (sem hora)`, 'date, date', tipos.join(', '), tipos.every(x => x === 'date'));
    const campos = { ano: await m.getByLabel('Ano letivo').count(), tri: await m.getByLabel('Trimestre', { exact: true }).count(), titulo: await m.getByLabel('Título').count() };
    const qtdPadrao = await m.getByLabel('Quantidade de semanas').inputValue();
    r(`1-${nome}`, `${nome}: modal novo sem Ano letivo, Trimestre e Título; 4 semanas por padrão`, 'ano 0, tri 0, título 0; 4 semanas', `ano ${campos.ano}, tri ${campos.tri}, título ${campos.titulo}; ${qtdPadrao} semanas`, campos.ano + campos.tri + campos.titulo === 0 && qtdPadrao === '4');

    await m.getByLabel('Abertura', { exact: true }).fill('2026-12-01');
    await m.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-18'); await X.page.waitForTimeout(300);
    const div4 = await semanasNaTela(m);
    const info = ((await m.innerText()).match(/\dº trimestre de \d{4}[^\n]*/) || [''])[0];
    const esperado4 = [['2026-12-01', '2026-12-04'], ['2026-12-05', '2026-12-09'], ['2026-12-10', '2026-12-13'], ['2026-12-14', '2026-12-18']];
    await foto(X.page, `44-modal-${nome}`);
    r(`2-${nome}`, `${nome}: abertura 01/12 e prazo 18/12 → 4 semanas divididas por igual (18 dias: 4/5/4/5), contínuas, sem buraco; trimestre identificado pela abertura`, `${txt(esperado4)}; "3º trimestre de 2026"`, `${txt(div4)}; "${info.slice(0, 60)}"`, JSON.stringify(div4) === JSON.stringify(esperado4) && info.startsWith('3º trimestre de 2026'), `44-modal-${nome}.png`);

    await m.getByLabel('Quantidade de semanas').fill('3'); await X.page.waitForTimeout(300);
    const div3 = await semanasNaTela(m);
    r(`3-${nome}`, `${nome}: mudar a quantidade para 3 redivide o mesmo período`, '01–06, 07–12, 13–18', txt(div3), txt(div3) === '01/12–06/12, 07/12–12/12, 13/12–18/12');
    await m.getByLabel('Quantidade de semanas').fill('4'); await X.page.waitForTimeout(300);

    if (nome === 'desktop') {
      // edição manual de uma semana + salvar
      await m.getByLabel('Semana 2: fim').fill('2026-12-08'); await m.getByLabel('Semana 3: início').fill('2026-12-09');
      await m.getByRole('button', { name: 'Salvar' }).click(); await X.page.waitForTimeout(2000);
      const fechou = (await modal(X.page).count()) === 0;
      criado = await prisma.cicloUmTerco.findFirst({ where: { id: { notIn: [...antes] } }, include: { semanas: { orderBy: { numero: 'asc' } } }, orderBy: { id: 'desc' } });
      const sem = criado?.semanas.map(s => [s.dataInicio.toISOString().slice(0, 10), s.dataFim.toISOString().slice(0, 10)]) ?? [];
      r('4', 'Salvar com uma semana editada à mão: banco grava título "Formulário 1/3", 2026/3º tri e as semanas exatamente como na tela', 'Formulário 1/3; 2026/3; 01–04, 05–08, 09–13, 14–18', criado ? `${criado.titulo}; ${criado.anoLetivo}/${criado.trimestre}; ${txt(sem)}; modal fechou: ${fechou}` : 'nenhum ciclo criado', !!criado && fechou && criado.titulo === 'Formulário 1/3' && criado.anoLetivo === 2026 && criado.trimestre === 3 && txt(sem) === '01/12–04/12, 05/12–08/12, 09/12–13/12, 14/12–18/12');

      if (criado) {
        const sp = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
        const cartaoTxt = (await X.page.getByText(/Abre 01\/12\/2026/).first().innerText().catch(() => '')).trim();
        r('4b', 'Banco: abertura 01/12 às 00:00 e prazo 18/12 às 23:59 (São Paulo); cartão mostra só as datas', '2026-12-01 00:00 → 2026-12-18 23:59; "Abre 01/12/2026 · prazo 18/12/2026"', `${sp(criado.abreEm)} → ${sp(criado.prazoEm)}; "${cartaoTxt}"`, sp(criado.abreEm) === '2026-12-01 00:00' && sp(criado.prazoEm) === '2026-12-18 23:59' && cartaoTxt === 'Abre 01/12/2026 · prazo 18/12/2026');
      }
      // edição: mudar o prazo NÃO redivide sozinho; botão "Redividir pelo período" existe
      if (criado) {
        const cartao = X.page.locator('div', { has: X.page.getByText('Abre 01/12/2026', { exact: false }) }).filter({ has: X.page.getByRole('button', { name: 'Editar' }) }).last();
        await cartao.getByRole('button', { name: 'Editar' }).click(); await X.page.waitForTimeout(600);
        const e = modal(X.page);
        await e.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-17'); await X.page.waitForTimeout(300);
        const aposPrazo = await semanasNaTela(e);
        const temRedividir = await e.getByRole('button', { name: 'Redividir pelo período' }).count();
        await foto(X.page, '44-modal-edicao');
        r('5', 'Editar ciclo existente: mudar o prazo NÃO mexe nas semanas (professores podem estar preenchendo); há botão "Redividir pelo período"', 'semanas iguais às salvas; botão presente', `${txt(aposPrazo)}; botão: ${temRedividir}`, txt(aposPrazo) === '01/12–04/12, 05/12–08/12, 09/12–13/12, 14/12–18/12' && temRedividir === 1, '44-modal-edicao.png');
        await e.getByRole('button', { name: 'Cancelar' }).click(); await X.page.waitForTimeout(400);
      }

      // ciclo ANTIGO com hora própria (o ativo #1: prazo 20/11 18:00): salvar sem mudar a data mantém a hora
      const c1 = await prisma.cicloUmTerco.findUnique({ where: { id: 1 } });
      const cartao1 = X.page.locator('div', { has: X.page.getByRole('heading', { name: /Nov\/2026 \(homolog\)/ }) }).filter({ has: X.page.getByRole('button', { name: 'Editar' }) }).last();
      await cartao1.getByRole('button', { name: 'Editar' }).click(); await X.page.waitForTimeout(600);
      await modal(X.page).getByRole('button', { name: 'Salvar' }).click(); await X.page.waitForTimeout(2000);
      const c1d = await prisma.cicloUmTerco.findUnique({ where: { id: 1 } });
      r('8', 'Editar e salvar ciclo antigo SEM mudar as datas mantém a hora original (prazo 18:00 não vira 23:59)', `${c1.abreEm.toISOString()} → ${c1.prazoEm.toISOString()}`, `${c1d.abreEm.toISOString()} → ${c1d.prazoEm.toISOString()}; modal fechou: ${(await modal(X.page).count()) === 0}`, c1d.abreEm.getTime() === c1.abreEm.getTime() && c1d.prazoEm.getTime() === c1.prazoEm.getTime());
      if (await modal(X.page).count()) await modal(X.page).getByRole('button', { name: 'Cancelar' }).click();

      // abertura fora de qualquer trimestre (recesso) e período mais curto que as semanas
      await X.page.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await X.page.waitForTimeout(600);
      const n = modal(X.page);
      await n.getByLabel('Abertura', { exact: true }).fill('2026-12-26');
      await n.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-30'); await X.page.waitForTimeout(300);
      const avisoRecesso = /não está dentro de nenhum trimestre/.test(await n.innerText());
      const salvarDesab = await n.getByRole('button', { name: 'Salvar' }).isDisabled();
      r('6', 'Abertura em data fora de qualquer trimestre (26/12, recesso): aviso e Salvar desabilitado', 'aviso; desabilitado', `aviso: ${avisoRecesso}; desabilitado: ${salvarDesab}`, avisoRecesso && salvarDesab);
      await n.getByLabel('Abertura', { exact: true }).fill('2026-12-15');
      await n.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-17'); await X.page.waitForTimeout(300);
      const avisoCurto = /menos dias que a quantidade de semanas/.test(await n.innerText());
      r('7', 'Período de 3 dias com 4 semanas: aviso para preencher à mão ou diminuir a quantidade (não inventa datas)', 'aviso', `aviso: ${avisoCurto}`, avisoCurto);
      await n.getByRole('button', { name: 'Cancelar' }).click();
    }
    console.log(nome, 'erros:', X.erros.filter(e => !/40[134]/.test(e)));
    await X.browser.close();
  }
} finally {
  const novos = await prisma.cicloUmTerco.findMany({ where: { id: { notIn: [...antes] } }, select: { id: true } });
  if (novos.length) await prisma.cicloUmTerco.updateMany({ where: { id: { in: novos.map(c => c.id) } }, data: { status: 'INATIVA' } });
  console.log('ciclos criados pelo teste inativados:', novos.map(c => c.id));
  await prisma.$disconnect();
}

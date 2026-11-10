// Modal "Novo Formulário 1/3" — versão de 10/11/2026 (decisões do usuário), navegador real, banco LOCAL:
// sem ano/trimestre/título; abertura e prazo só por data; semanas preenchidas À MÃO (sem divisão
// automática — semanas são o período de referência, independentes da janela de preenchimento);
// validação na hora: abertura não no passado, prazo não antes da abertura, semana com fim antes do
// início, semanas fora de ordem/sobrepostas, semana terminando depois do prazo; buracos e tamanho livre
// permitidos. O backend recusa as mesmas coisas. Ciclos criados pelo teste são INATIVADOS no fim.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UT-MODAL-${id}`, 'Formulário 1/3 — modal de novo ciclo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const modal = (page) => page.locator('div.fixed.inset-0.z-50');
const API = 'http://localhost:3340';
const antes = new Set((await prisma.cicloUmTerco.findMany({ select: { id: true } })).map(c => c.id));
const sp = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
const hojeSp = sp(new Date()).slice(0, 10);
const ontemSp = sp(new Date(Date.now() - 86400000)).slice(0, 10);

const preencher = async (m, { abre, prazo, semanas }) => {
  if (abre !== undefined) await m.getByLabel('Abertura', { exact: true }).fill(abre);
  if (prazo !== undefined) await m.getByLabel('Prazo de entrega', { exact: true }).fill(prazo);
  if (semanas) {
    await m.getByLabel('Quantidade de semanas').fill(String(semanas.length));
    for (let i = 0; i < semanas.length; i++) {
      await m.getByLabel(`Semana ${i + 1}: início`).fill(semanas[i][0]);
      await m.getByLabel(`Semana ${i + 1}: fim`).fill(semanas[i][1]);
    }
  }
  await m.page().waitForTimeout(250);
};
const alertas = async (m) => (await m.locator('[role=alert]').allInnerTexts()).map(t => t.trim()).filter(Boolean);
const salvarDesab = (m) => m.getByRole('button', { name: 'Salvar' }).isDisabled();
const BOAS = [['2026-11-23', '2026-11-27'], ['2026-12-07', '2026-12-16'], ['2026-12-17', '2026-12-17'], ['2026-12-18', '2026-12-18']];

try {
  for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    await login(X.page, 'secretaria@escola.gov.br', '123456');
    const tk = await X.page.evaluate(() => localStorage.getItem('authToken'));
    await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
    await X.page.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await X.page.waitForTimeout(600);
    const m = modal(X.page);

    const campos = { ano: await m.getByLabel('Ano letivo').count(), tri: await m.getByLabel('Trimestre', { exact: true }).count(), titulo: await m.getByLabel('Título').count(), redividir: await m.getByRole('button', { name: /Redividir/ }).count() };
    const tipos = [await m.getByLabel('Abertura', { exact: true }).getAttribute('type'), await m.getByLabel('Prazo de entrega', { exact: true }).getAttribute('type')];
    await preencher(m, { abre: '2026-12-01', prazo: '2026-12-18' });
    const semanasVazias = [];
    for (let i = 1; i <= 4; i++) semanasVazias.push(await m.getByLabel(`Semana ${i}: início`).inputValue(), await m.getByLabel(`Semana ${i}: fim`).inputValue());
    r(`1-${nome}`, `${nome}: sem Ano/Trimestre/Título; abertura e prazo só data; 4 semanas EM BRANCO mesmo depois de escolher abertura e prazo (sem divisão automática)`, 'ano/tri/título/redividir 0; date,date; 8 campos vazios', `${JSON.stringify(campos)}; ${tipos}; vazios ${semanasVazias.filter(x => !x).length}`, Object.values(campos).every(n => n === 0) && tipos.every(t => t === 'date') && semanasVazias.every(x => !x));

    // abertura no passado
    await preencher(m, { abre: ontemSp, prazo: '2026-12-18' });
    const aPassado = await alertas(m);
    r(`2-${nome}`, `${nome}: abertura ontem (${ontemSp}) → aviso na hora e Salvar bloqueado`, 'aviso "não pode ser no passado"; bloqueado', `${aPassado.join(' | ')}; bloqueado: ${await salvarDesab(m)}`, aPassado.some(t => /não pode ser no passado/.test(t)) && await salvarDesab(m));
    // hoje é permitido
    await preencher(m, { abre: hojeSp });
    const aHoje = (await alertas(m)).filter(t => /passado/.test(t));
    r(`2b-${nome}`, `${nome}: abertura hoje (${hojeSp}) é aceita`, 'sem aviso de passado', aHoje.join(' | ') || 'sem aviso', aHoje.length === 0);

    // prazo antes da abertura
    await preencher(m, { abre: '2026-12-10', prazo: '2026-12-05' });
    const aPrazo = await alertas(m);
    r(`3-${nome}`, `${nome}: prazo 05/12 antes da abertura 10/12 → aviso e Salvar bloqueado`, 'aviso "prazo não pode ser antes da abertura"', `${aPrazo.join(' | ')}; bloqueado: ${await salvarDesab(m)}`, aPrazo.some(t => /prazo não pode ser antes da abertura/.test(t)) && await salvarDesab(m));

    // semana com fim antes do início
    await preencher(m, { abre: '2026-12-01', prazo: '2026-12-18', semanas: [['2026-12-07', '2026-12-03']] });
    const aFim = await alertas(m);
    r(`4-${nome}`, `${nome}: Semana 1 de 07/12 a 03/12 → "fim não pode ser antes do início"`, 'aviso; bloqueado', `${aFim.join(' | ')}; bloqueado: ${await salvarDesab(m)}`, aFim.some(t => /fim não pode ser antes do início/.test(t)) && await salvarDesab(m));

    // sobreposição / fora de ordem
    await preencher(m, { semanas: [['2026-11-23', '2026-11-27'], ['2026-11-26', '2026-12-02']] });
    const aSob = await alertas(m);
    await preencher(m, { semanas: [['2026-12-07', '2026-12-11'], ['2026-11-23', '2026-11-27']] });
    const aOrdem = await alertas(m);
    await foto(X.page, `44-validacao-${nome}`);
    r(`5-${nome}`, `${nome}: Semana 2 começando antes do fim da Semana 1 (sobreposta) e fora de ordem → aviso nas duas situações`, 'aviso "começar depois do fim da Semana 1" ×2; bloqueado', `sobreposta: ${aSob.join(' | ')}; fora de ordem: ${aOrdem.join(' | ')}; bloqueado: ${await salvarDesab(m)}`, aSob.some(t => /depois do fim da Semana 1/.test(t)) && aOrdem.some(t => /depois do fim da Semana 1/.test(t)) && await salvarDesab(m), `44-validacao-${nome}.png`);

    // semana terminando depois do prazo
    await preencher(m, { prazo: '2026-12-15', semanas: [['2026-12-07', '2026-12-16']] });
    const aDepois = await alertas(m);
    r(`6-${nome}`, `${nome}: Semana 1 termina 16/12, prazo 15/12 → "termina depois do prazo"`, 'aviso; bloqueado', `${aDepois.join(' | ')}; bloqueado: ${await salvarDesab(m)}`, aDepois.some(t => /depois do prazo/.test(t)) && await salvarDesab(m));

    // válido: semana antes da abertura (referência), buraco entre semanas, tamanhos livres (5, 10, 1 e 1 dia)
    await preencher(m, { abre: '2026-12-01', prazo: '2026-12-18', semanas: BOAS });
    const aBoas = await alertas(m);
    r(`7-${nome}`, `${nome}: semanas válidas com buraco (28/11–06/12), uma ANTES da abertura e tamanhos 5/10/1/1 dias → sem aviso, Salvar liberado`, 'sem avisos; liberado', `${aBoas.join(' | ') || 'sem avisos'}; bloqueado: ${await salvarDesab(m)}`, aBoas.length === 0 && !(await salvarDesab(m)));

    if (nome === 'desktop') {
      await m.getByRole('button', { name: 'Salvar' }).click(); await X.page.waitForTimeout(2000);
      const criado = await prisma.cicloUmTerco.findFirst({ where: { id: { notIn: [...antes] } }, include: { semanas: { orderBy: { numero: 'asc' } } }, orderBy: { id: 'desc' } });
      const sem = criado?.semanas.map(s => [s.dataInicio.toISOString().slice(0, 10), s.dataFim.toISOString().slice(0, 10)]) ?? [];
      r('8', 'Salvar: banco grava título "Formulário 1/3", 2026/3º tri, abertura 01/12 00:00, prazo 18/12 23:59 e as semanas exatamente como digitadas', `Formulário 1/3; 2026/3; 2026-12-01 00:00 → 2026-12-18 23:59; ${JSON.stringify(BOAS)}`, criado ? `${criado.titulo}; ${criado.anoLetivo}/${criado.trimestre}; ${sp(criado.abreEm)} → ${sp(criado.prazoEm)}; ${JSON.stringify(sem)}` : 'nenhum ciclo criado', !!criado && criado.titulo === 'Formulário 1/3' && criado.anoLetivo === 2026 && criado.trimestre === 3 && sp(criado.abreEm) === '2026-12-01 00:00' && sp(criado.prazoEm) === '2026-12-18 23:59' && JSON.stringify(sem) === JSON.stringify(BOAS));

      // ciclo ANTIGO (o #1: abertura no passado, prazo 20/11 18:00, Semana 4 de 23 a 27/11 — DEPOIS do prazo).
      // Abertura no passado sem mudar: sem aviso. Semana depois do prazo: a regra nova acusa e bloqueia até corrigir.
      const c1 = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } } } });
      const cartao1 = X.page.locator('div', { has: X.page.getByRole('heading', { name: /Nov\/2026 \(homolog\)/ }) }).filter({ has: X.page.getByRole('button', { name: 'Editar' }) }).last();
      await cartao1.getByRole('button', { name: 'Editar' }).click(); await X.page.waitForTimeout(800);
      const avisos1 = await alertas(modal(X.page));
      const bloqueado1 = await salvarDesab(modal(X.page));
      await foto(X.page, '44-ciclo-antigo');
      await modal(X.page).getByRole('button', { name: 'Cancelar' }).click(); await X.page.waitForTimeout(400);
      const c1d = await prisma.cicloUmTerco.findUnique({ where: { id: 1 } });
      const ultima = c1.semanas.at(-1);
      r('9', `Ciclo já aberto (#1): abertura no passado NÃO gera aviso; a Semana ${ultima.numero} (${ultima.dataInicio.toISOString().slice(0, 10)} a ${ultima.dataFim.toISOString().slice(0, 10)}) termina depois do prazo (${sp(c1.prazoEm)}) e é acusada; Salvar bloqueado até corrigir; nada muda no banco`, 'só aviso de semana depois do prazo; bloqueado; banco igual', `avisos: ${avisos1.join(' | ') || 'nenhum'}; bloqueado: ${bloqueado1}; banco igual: ${c1d.prazoEm.getTime() === c1.prazoEm.getTime()}`, avisos1.length >= 1 && avisos1.every(t => /depois do prazo/.test(t)) && bloqueado1 && c1d.prazoEm.getTime() === c1.prazoEm.getTime(), '44-ciclo-antigo.png');

      // o BACKEND recusa as mesmas coisas (cliente que não seja esta tela)
      const base = { anoLetivo: 2026, trimestre: 3, titulo: 'Formulário 1/3', abreEm: '2026-12-01T00:00', prazoEm: '2026-12-18T23:59', semanas: BOAS.map(([dataInicio, dataFim]) => ({ dataInicio, dataFim })) };
      const post = async (corpo) => { const res = await fetch(API + '/api/formulario-um-terco/ciclos', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify(corpo) }); return `${res.status} ${(await res.json()).message ?? ''}`.slice(0, 120); };
      const casos = {
        passado: await post({ ...base, abreEm: `${ontemSp}T00:00`, semanas: [{ dataInicio: '2026-11-23', dataFim: '2026-11-27' }] }),
        sobreposta: await post({ ...base, semanas: [{ dataInicio: '2026-11-23', dataFim: '2026-11-27' }, { dataInicio: '2026-11-27', dataFim: '2026-12-02' }] }),
        foraDeOrdem: await post({ ...base, semanas: [{ dataInicio: '2026-12-07', dataFim: '2026-12-11' }, { dataInicio: '2026-11-23', dataFim: '2026-11-27' }] }),
        depoisDoPrazo: await post({ ...base, prazoEm: '2026-12-15T23:59', semanas: [{ dataInicio: '2026-12-07', dataFim: '2026-12-16' }] }),
      };
      r('10', 'API recusa (400) abertura no passado, semanas sobrepostas, fora de ordem e semana depois do prazo — mesmo sem passar pela tela', '400 nos 4', Object.entries(casos).map(([k, v]) => `${k}: ${v}`).join(' | '), Object.values(casos).every(v => v.startsWith('400')));

      // abertura em recesso (fora de qualquer trimestre)
      await X.page.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await X.page.waitForTimeout(600);
      const n = modal(X.page);
      await preencher(n, { abre: '2026-12-26', prazo: '2026-12-30' });
      r('11', 'Abertura em data fora de qualquer trimestre (26/12, recesso): aviso e Salvar bloqueado', 'aviso; bloqueado', `aviso: ${/não está dentro de nenhum trimestre/.test(await n.innerText())}; bloqueado: ${await salvarDesab(n)}`, /não está dentro de nenhum trimestre/.test(await n.innerText()) && await salvarDesab(n));
      await n.getByRole('button', { name: 'Cancelar' }).click();
    } else {
      const largura = await X.page.evaluate(() => document.documentElement.scrollWidth);
      r('12-celular', 'Celular: modal com avisos sem rolagem horizontal', '≤ 390px', `${largura}px`, largura <= 390, '44-validacao-celular.png');
    }
    console.log(nome, 'erros:', X.erros.filter(e => !/40[0134]/.test(e)));
    await X.browser.close();
  }
} finally {
  const novos = await prisma.cicloUmTerco.findMany({ where: { id: { notIn: [...antes] } }, select: { id: true } });
  if (novos.length) await prisma.cicloUmTerco.updateMany({ where: { id: { in: novos.map(c => c.id) } }, data: { status: 'INATIVA' } });
  console.log('ciclos criados pelo teste inativados:', novos.map(c => c.id));
  await prisma.$disconnect();
}

// Formulário 1/3 com ESCOLAS escolhidas por ciclo (decisão do usuário, 10/11/2026 — substitui o "1/3 global"),
// navegador real + API, banco LOCAL:
// - modal: "Todas as escolas" marcado por padrão; desmarcar exige escolher ao menos uma; salva a lista;
// - só as turmas das escolas escolhidas entram (painel) e só os professores delas veem o formulário;
// - sobreposição de janelas só é proibida entre ciclos com escola em comum;
// - escola com preenchimento iniciado não pode ser retirada do ciclo.
// Ciclos criados pelo teste são INATIVADOS no fim; nada é gravado em ciclos existentes.
// 1/3 POR CARGO (reescrito em 12/11/2026): quem participa sai dos cargos de teste (cargos-homolog.mjs); ciclo de
// algumas escolas mostra só a parte do cargo nessas escolas (P05 tem Aurora + Boa Vista no mesmo cargo).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UT-ESC-${id}`, 'Formulário 1/3 — escolas do ciclo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', evid);
const API = 'http://localhost:3340';
const antes = new Set((await prisma.cicloUmTerco.findMany({ select: { id: true } })).map(c => c.id));
const aurora = await prisma.escola.findFirst({ where: { nome: { contains: 'Aurora' } } });
const boaVista = await prisma.escola.findFirst({ where: { nome: { contains: 'Boa Vista' } } });
const modal = (page) => page.locator('div.fixed.inset-0.z-50');

const loginApi = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const chamar = async (tk, metodo, caminho, corpo) => {
  const res = await fetch(API + caminho, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo ? JSON.stringify(corpo) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};
const SEMANAS = [{ dataInicio: '2026-11-23', dataFim: '2026-11-27' }, { dataInicio: '2026-11-30', dataFim: '2026-12-04' }, { dataInicio: '2026-12-07', dataFim: '2026-12-11' }, { dataInicio: '2026-12-14', dataFim: '2026-12-18' }];
const base = { anoLetivo: 2026, trimestre: 3, abreEm: '2026-12-01T00:00', prazoEm: '2026-12-18T23:59', semanas: SEMANAS };

// Professores com cargo só numa escola (cargos de teste): P01 só Aurora; P15 só Boa Vista.
const professorSo = async (escolaId) => prisma.pessoa.findUnique({ where: { email: escolaId === aurora.id ? 'p01@homolog.nexo' : 'p15@homolog.nexo' } });

try {
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tk = await X.page.evaluate(() => localStorage.getItem('authToken'));
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
  await X.page.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await X.page.waitForTimeout(600);
  const m = modal(X.page);
  const todas = m.getByRole('checkbox', { name: /Todas as escolas/ });
  const marcadaPadrao = await todas.isChecked();
  await todas.uncheck(); await X.page.waitForTimeout(300);
  const avisoVazio = /Escolha ao menos uma escola/.test(await m.innerText());
  await m.getByLabel('Abertura', { exact: true }).fill('2026-12-01');
  await m.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-18');
  for (let i = 0; i < 4; i++) { await m.getByLabel(`Semana ${i + 1}: início`).fill(SEMANAS[i].dataInicio); await m.getByLabel(`Semana ${i + 1}: fim`).fill(SEMANAS[i].dataFim); }
  await X.page.waitForTimeout(300);
  const bloqueadoSemEscola = await m.getByRole('button', { name: 'Salvar' }).isDisabled();
  r('1', 'Modal: "Todas as escolas" vem marcado; desmarcar sem escolher nenhuma mostra aviso e bloqueia Salvar', 'marcado; aviso; bloqueado', `marcado: ${marcadaPadrao}; aviso: ${avisoVazio}; bloqueado: ${bloqueadoSemEscola}`, marcadaPadrao && avisoVazio && bloqueadoSemEscola);

  await m.getByRole('checkbox', { name: aurora.nome }).check(); await X.page.waitForTimeout(300);
  await foto(X.page, '46-modal-escolas');
  await m.getByRole('button', { name: 'Salvar' }).click(); await X.page.waitForTimeout(2000);
  const cicloA = await prisma.cicloUmTerco.findFirst({ where: { id: { notIn: [...antes] } }, include: { escolas: true }, orderBy: { id: 'desc' } });
  const cartao = (await X.page.getByText(/1 escola: /).first().innerText().catch(() => '')).trim();
  await foto(X.page, '46-lista');
  r('2', 'Salvar só com a Aurora: banco grava todasEscolas = false e a Aurora; cartão mostra "1 escola: …Aurora"', `false; [${aurora.id}]; "1 escola: ${aurora.nome}"`, cicloA ? `${cicloA.todasEscolas}; [${cicloA.escolas.map(e => e.escolaId)}]; "${cartao}"` : 'não criou', !!cicloA && cicloA.todasEscolas === false && cicloA.escolas.length === 1 && cicloA.escolas[0].escolaId === aurora.id && cartao === `1 escola: ${aurora.nome}`, '46-modal-escolas.png');

  // painel: só turmas da Aurora
  const painelA = (await chamar(tk, 'GET', `/api/formulario-um-terco/ciclos/${cicloA.id}/painel`)).json;
  const escolasNoPainel = [...new Set(painelA.linhas.flatMap(l => l.escolas.map(t => t.escolaNome)))];
  const p05 = await prisma.pessoa.findUnique({ where: { email: 'p05@homolog.nexo' } });
  const linhaP05 = painelA.linhas.find(l => l.professorId === p05.id);
  r('3', 'Painel do ciclo só da Aurora: todas as folhas esperadas são da Aurora; o cargo de 2 escolas do P05 aparece só com a parte da Aurora', `só "${aurora.nome}"; P05 só Aurora`, `${painelA.linhas.length} folhas; escolas: ${escolasNoPainel.join(', ')}; P05: ${linhaP05?.composicao.map(p => p.escolaNome).join(' + ')}`, painelA.linhas.length > 0 && escolasNoPainel.length === 1 && escolasNoPainel[0] === aurora.nome && linhaP05?.composicao.length === 1 && linhaP05.composicao[0].escolaId === aurora.id);

  // professores: só quem é da Aurora vê o ciclo
  const pA = await professorSo(aurora.id); const pB = await professorSo(boaVista.id);
  const senha = (p) => SENHA(p.email.slice(0, 3));
  const veA = pA ? (await chamar(await loginApi(pA.email, senha(pA)), 'GET', '/api/formulario-um-terco/minhas')).json.some(i => i.ciclo.id === cicloA.id) : null;
  const veB = pB ? (await chamar(await loginApi(pB.email, senha(pB)), 'GET', '/api/formulario-um-terco/minhas')).json.some(i => i.ciclo.id === cicloA.id) : null;
  r('4', 'Professor só da Aurora vê o ciclo em "Meus formulários"; professor só da Boa Vista NÃO vê', `${pA?.email}: vê; ${pB?.email}: não vê`, `${pA?.email}: ${veA}; ${pB?.email}: ${veB}`, veA === true && veB === false);

  // sobreposição: outra escola pode, mesma escola ou "todas" não
  const soBV = await chamar(tk, 'POST', '/api/formulario-um-terco/ciclos', { ...base, todasEscolas: false, escolaIds: [boaVista.id] });
  const outraAurora = await chamar(tk, 'POST', '/api/formulario-um-terco/ciclos', { ...base, todasEscolas: false, escolaIds: [aurora.id, boaVista.id] });
  const outraTodas = await chamar(tk, 'POST', '/api/formulario-um-terco/ciclos', { ...base, todasEscolas: true });
  r('5', 'Mesmas datas: ciclo só da Boa Vista é aceito; ciclo com a Aurora (em comum) e ciclo "todas" são recusados', '201; 409; 409', `${soBV.status}; ${outraAurora.status} ${outraAurora.json.message?.slice(0, 90) ?? ''}; ${outraTodas.status}`, soBV.status === 201 && outraAurora.status === 409 && outraTodas.status === 409);

  // escolha inválida pela API
  const vazia = await chamar(tk, 'POST', '/api/formulario-um-terco/ciclos', { ...base, abreEm: '2026-12-02T00:00', todasEscolas: false, escolaIds: [] });
  r('6', 'API recusa ciclo sem nenhuma escola (todasEscolas = false e lista vazia)', '400', `${vazia.status} ${vazia.json.message ?? ''}`, vazia.status === 400);

  // escola com preenchimento iniciado não pode sair: o P01 (cargo na Aurora) começa a folha do ciclo #1; nada é gravado
  const tkP01 = await loginApi('p01@homolog.nexo', SENHA('p01'));
  const itemP01 = (await chamar(tkP01, 'GET', '/api/formulario-um-terco/minhas')).json.find(i => i.ciclo.id === 1);
  const c1sem = await prisma.semanaUmTerco.findFirst({ where: { cicloId: 1, numero: 1 } });
  await chamar(tkP01, 'PUT', `/api/formulario-um-terco/ciclos/1/cargos/${itemP01.cargoId}/respostas`, { baseUpdatedAt: null, respostas: [{ semanaId: c1sem.id, texto: 'Semana 1 da Aurora (P01).' }] });
  const c1 = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } } } });
  const fmt = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d).replace(' ', 'T');
  const tirarAurora = await chamar(tk, 'PUT', '/api/formulario-um-terco/ciclos/1', {
    anoLetivo: c1.anoLetivo, trimestre: c1.trimestre, titulo: c1.titulo, abreEm: fmt(c1.abreEm), prazoEm: fmt(c1.prazoEm),
    semanas: [{ dataInicio: '2026-11-02', dataFim: '2026-11-06' }, { dataInicio: '2026-11-09', dataFim: '2026-11-13' }, { dataInicio: '2026-11-16', dataFim: '2026-11-18' }, { dataInicio: '2026-11-19', dataFim: '2026-11-20' }],
    todasEscolas: false, escolaIds: [boaVista.id],
  });
  const c1d = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } }, escolas: true } });
  r('7', 'Retirar a Aurora do ciclo #1 (que tem preenchimentos da Aurora) é recusado e nada muda no banco', `409 "Não é possível retirar"; ainda "todas"; semanas iguais`, `${tirarAurora.status} ${tirarAurora.json.message?.slice(0, 100) ?? ''}; todas: ${c1d.todasEscolas}; semanas iguais: ${JSON.stringify(c1d.semanas.map(s => s.dataFim)) === JSON.stringify(c1.semanas.map(s => s.dataFim))}`, tirarAurora.status === 409 && /Não é possível retirar/.test(tirarAurora.json.message ?? '') && c1d.todasEscolas === true && c1d.escolas.length === 0 && JSON.stringify(c1d.semanas.map(s => s.dataFim)) === JSON.stringify(c1.semanas.map(s => s.dataFim)));

  // editar pelo modal: o ciclo da Aurora abre com a Aurora marcada; acrescentar a Boa Vista conflita com o ciclo só da BV
  const cartaoA = X.page.locator('div', { has: X.page.getByText(`1 escola: ${aurora.nome}`) }).filter({ has: X.page.getByRole('button', { name: 'Editar' }) }).last();
  await X.page.reload(); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
  await cartaoA.getByRole('button', { name: 'Editar' }).click(); await X.page.waitForTimeout(600);
  const e = modal(X.page);
  const marcadas = [await e.getByRole('checkbox', { name: /Todas as escolas/ }).isChecked(), await e.getByRole('checkbox', { name: aurora.nome }).isChecked()];
  await e.getByRole('checkbox', { name: boaVista.nome }).check();
  await e.getByRole('button', { name: 'Salvar' }).click(); await X.page.waitForTimeout(1500);
  const msg = (await e.locator('.text-red-800').first().innerText().catch(() => '')).trim();
  r('8', 'Editar o ciclo da Aurora: abre com a Aurora marcada (e "Todas" desmarcado); acrescentar a Boa Vista nas mesmas datas do ciclo só da BV mostra o conflito', 'todas false, Aurora true; mensagem de sobreposição', `todas ${marcadas[0]}, Aurora ${marcadas[1]}; "${msg.slice(0, 120)}"`, marcadas[0] === false && marcadas[1] === true && /se sobrepõe/.test(msg));
  console.log('erros:', X.erros.filter(x => !/40[01349]/.test(x)));
  await X.browser.close();
} finally {
  const novos = await prisma.cicloUmTerco.findMany({ where: { id: { notIn: [...antes] } }, select: { id: true } });
  if (novos.length) await prisma.cicloUmTerco.updateMany({ where: { id: { in: novos.map(c => c.id) } }, data: { status: 'INATIVA' } });
  console.log('ciclos criados pelo teste inativados:', novos.map(c => c.id));
  await prisma.$disconnect();
}

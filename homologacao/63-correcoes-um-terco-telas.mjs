// Correções → Formulário 1/3 (12/11/2026) — TELAS em navegador real, banco LOCAL.
// Secretaria (computador): menu, entrada de Correções, lista com busca/filtros, corrigir diretamente,
// enviar para correção. Professor (celular 390 px): "Correção solicitada", orientações e prazo, edição de
// qualquer semana, rascunho offline, reenvio exige conexão, "Correção reenviada — aguardando revisão".
// Secretaria vê "Reenviada". Correção expirada aparece para o Professor. Limpa tudo no fim.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`CORR13UI-${id}`, 'Correções do 1/3 (telas)', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const API = 'http://localhost:3340/api';
const token = async (email, senha) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const req = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo ? JSON.stringify(corpo) : undefined }); return res.json().catch(() => ({})); };
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); };
const largura = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

await prepararCargosHomolog();
const inicio = new Date();
const sem = await prisma.semanaUmTerco.findMany({ where: { cicloId: 1 }, orderBy: { numero: 'asc' } });
const concluir = async (cod) => {
  const tk = await token(`${cod}@homolog.nexo`, SENHA(cod)); const [c] = await cargosDe(cod);
  const s = await req(tk, 'PUT', `/formulario-um-terco/ciclos/1/cargos/${c}/respostas`, { baseUpdatedAt: null, respostas: sem.map((x) => ({ semanaId: x.id, texto: `${cod.toUpperCase()} semana ${x.numero}: texto original.` })) });
  await req(tk, 'POST', `/formulario-um-terco/ciclos/1/cargos/${c}/concluir`, { baseUpdatedAt: s.updatedAt });
  return { c, entregaId: (await folhaDoCargo(c)).id };
};
const f01 = await concluir('p01'); const f15 = await concluir('p15'); await concluir('p05');

try {
  // ===== Secretaria =====
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  const menu = (await S.page.locator('aside').innerText()).replace(/\s+/g, ' ');
  await ir(S.page, '/correcoes');
  const hub = (await S.page.locator('main').innerText()).replace(/\s+/g, ' ');
  r('1', 'Menu e entrada de Correções: Secretaria vê "Formulário 1/3" (sem "em desenvolvimento") e o PDI com o selo', 'Correções sem selo no menu; cartões 1/3 e PDI', `menu com selo em Correções: ${/Correções EM DESENVOLVIMENTO/i.test(menu)}; 1/3: ${/Formulário 1\/3/.test(hub)}; PDI em desenvolvimento: ${/PDI.*desenvolvimento/i.test(hub)}`, !/Correções EM DESENVOLVIMENTO/i.test(menu) && /Correção das folhas do 1\/3/.test(hub));
  await S.page.getByText('Correção das folhas do 1/3').click(); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(800);
  const totalTodas = Number(((await S.page.getByText(/\d+ folhas?/).first().textContent()) ?? '').match(/\d+/)?.[0]);
  await S.page.getByLabel('Buscar').fill('boa vista matem'); await S.page.waitForTimeout(1500);
  const busca = (await S.page.locator('main ul').innerText().catch(() => '')).replace(/\s+/g, ' ');
  await S.page.getByLabel('Buscar').fill(''); await S.page.waitForTimeout(1200);
  const selEscola = S.page.getByLabel('Escola').first();
  await selEscola.selectOption({ label: 'ZZ-HOMOLOG Escola Boa Vista' }); await S.page.waitForTimeout(1200);
  const porEscola = (await S.page.locator('main ul').innerText()).replace(/\s+/g, ' ');
  await selEscola.selectOption(''); await S.page.waitForTimeout(800);
  await foto(S.page, '63-lista');
  r('2', 'Lista: busca por palavras e filtro por escola (folha de 2 escolas aparece na Boa Vista)', '3 folhas; busca acha P15; Boa Vista com P15 e P05', `total ${totalTodas}; busca: ${busca.slice(0, 60)}; Boa Vista: P15 ${/P15/.test(porEscola)}, P05 ${/Eduardo Fonseca/.test(porEscola)}, P01 ${/Ana Paula/.test(porEscola)}`, totalTodas === 3 && /P15/.test(busca) && !/Ana Paula/.test(busca) && /P15/.test(porEscola) && /Eduardo Fonseca/.test(porEscola) && !/Ana Paula/.test(porEscola), '63-lista.png');

  await ir(S.page, `/correcoes/um-terco/${f01.entregaId}`);
  const cab = (await S.page.locator('main').innerText()).replace(/\s+/g, ' ');
  r('3', 'Abrir a folha: Professor, cargo, ciclo, escola → disciplina, semanas e conteúdos (sem turmas)', 'Ana Paula Ribeiro — Cargo 1; Aurora — Matemática; 4 semanas', cab.slice(0, 200), /Ana Paula Ribeiro — Cargo 1/.test(cab) && /Aurora — Matemática/.test(cab) && /Semana 4/.test(cab) && /P01 semana 3: texto original/.test(cab) && !/\dM\d/.test(cab));
  await S.page.getByRole('button', { name: 'Corrigir diretamente' }).click();
  await S.page.getByLabel('Conteúdo da Semana 2').fill('P01 semana 2: corrigido pela Secretaria (tela).');
  await S.page.getByRole('button', { name: 'Salvar correção' }).click();
  await S.page.getByText(/Correção salva/).waitFor({ timeout: 10000 });
  const depoisDireta = (await S.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await foto(S.page, '63-correcao-direta');
  r('4', 'Corrigir diretamente pela tela: salva, avisa que o professor recebeu mensagem, mostra antes/depois e linha do tempo', 'mensagem; Antes/Depois; "Secretaria corrigiu diretamente"', depoisDireta.match(/Correção salva[^.]*\./)?.[0] ?? '-', /professor recebeu uma mensagem/.test(depoisDireta) && /Antes P01 semana 2: texto original\. Depois P01 semana 2: corrigido pela Secretaria \(tela\)\./.test(depoisDireta) && /Secretaria corrigiu diretamente/.test(depoisDireta), '63-correcao-direta.png');

  await S.page.getByRole('button', { name: 'Enviar para correção' }).click();
  const modal = S.page.locator('div.fixed.inset-0').last();
  const bloqueadoSemTexto = await modal.getByRole('button', { name: 'Enviar para correção' }).isDisabled();
  await modal.getByLabel('O que precisa ser corrigido?').fill('Revise os conteúdos da Semana 2 e detalhe melhor o que foi trabalhado.');
  await modal.getByRole('button', { name: 'Enviar para correção' }).click();
  await modal.getByRole('button', { name: 'Confirmar envio' }).click();
  await S.page.getByText(/Correção enviada/).waitFor({ timeout: 10000 });
  const aposDev = (await S.page.locator('main').innerText()).replace(/\s+/g, ' ');
  r('5', 'Enviar para correção: orientação obrigatória, confirmação, selo "Aguardando o Professor" e prazo de 3 dias', 'botão bloqueado sem texto; enviado; aguardando', `bloqueado: ${bloqueadoSemTexto}; ${aposDev.match(/Aguardando o Professor/)?.[0] ?? '-'}`, bloqueadoSemTexto && /Aguardando o Professor/.test(aposDev) && /prazo da correção/.test(aposDev));

  // ===== Professor (celular) =====
  const P = await abrir({ viewport: { width: 390, height: 844 } });
  await login(P.page, 'p01@homolog.nexo', SENHA('p01'));
  await ir(P.page, '/formulario-um-terco');
  const card = (await P.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await P.page.getByRole('button', { name: 'Corrigir' }).first().click(); await P.page.waitForLoadState('networkidle'); await P.page.waitForTimeout(1000);
  const tela = (await P.page.locator('main').innerText()).replace(/\s+/g, ' ');
  // "Reenviar correção" (como "Concluir") só aparece na última semana.
  await P.page.getByRole('tab', { name: 'Semana 4' }).click(); await P.page.waitForTimeout(800);
  const botaoReenviar = await P.page.getByRole('button', { name: 'Reenviar correção' }).count();
  await foto(P.page, '63-professor-correcao-celular');
  r('6', 'Professor (celular): "Correção solicitada", mensagem da Secretaria, prazo e botão "Reenviar correção"', 'selo na lista; orientação; Prazo; botão', `lista: ${/Correção solicitada/.test(card)}; orientação: ${/Revise os conteúdos da Semana 2/.test(tela)}; prazo: ${/Prazo:/.test(tela)}; botão: ${botaoReenviar}; sobra ${await largura(P.page)}px`, /Correção solicitada/.test(card) && /Revise os conteúdos da Semana 2/.test(tela) && /Prazo:/.test(tela) && botaoReenviar === 1 && (await largura(P.page)) <= 0, '63-professor-correcao-celular.png');

  // Edita outra semana (folha inteira liberada), depois fica offline e escreve: rascunho guardado, reenvio bloqueado.
  await P.page.getByRole('tab', { name: 'Semana 4' }).click(); await P.page.waitForTimeout(800);
  await P.page.locator('#conteudos-semana').fill('P01 semana 4: revisada pelo professor.');
  await P.page.waitForTimeout(3500);
  await P.contexto.setOffline(true);
  await P.page.getByRole('tab', { name: 'Semana 2' }).click(); await P.page.waitForTimeout(800);
  await P.page.locator('#conteudos-semana').fill('P01 semana 2: detalhada OFFLINE pelo professor.');
  await P.page.waitForTimeout(4000);
  const indicador = (await P.page.locator('main').innerText()).match(/Salvo só neste aparelho/)?.[0] ?? '(nenhum)';
  await P.page.getByRole('tab', { name: 'Semana 4' }).click(); await P.page.waitForTimeout(800);
  await P.page.getByRole('button', { name: 'Reenviar correção' }).click(); await P.page.waitForTimeout(1500);
  const avisoConexao = await P.page.getByText(/Conecte-se à internet para concluir/).count();
  const corrOff = await prisma.correcaoEntregaUmTerco.findFirst({ where: { entregaId: f01.entregaId }, orderBy: { criadaEm: 'desc' } });
  r('7', 'Offline: o texto fica guardado no aparelho e "Reenviar correção" exige conexão (nada é marcado como reenviado)', '"Salvo só neste aparelho"; aviso de conexão; correção ABERTA', `${indicador}; aviso: ${avisoConexao}; banco: ${corrOff.status}`, indicador === 'Salvo só neste aparelho' && avisoConexao > 0 && corrOff.status === 'ABERTA');
  await P.contexto.setOffline(false);
  let s2 = ''; for (let i = 0; i < 20; i++) { await dormir(1000); s2 = (await folhaDoCargo(f01.c)).respostas.find((x) => x.semana.numero === 2)?.texto ?? ''; if (s2.includes('OFFLINE')) break; }
  r('8', 'Ao reconectar, o rascunho é enviado sozinho (nenhuma resposta perdida)', 'semana 2 com o texto offline no banco', `"${s2}"`, s2 === 'P01 semana 2: detalhada OFFLINE pelo professor.');
  await P.page.getByRole('button', { name: 'Reenviar correção' }).click();
  await P.page.waitForURL(/formulario-um-terco$/, { timeout: 15000 }).catch(() => {});
  await P.page.waitForTimeout(1200);
  const listaDepois = (await P.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await P.page.getByRole('button', { name: /Editar|Ver|Continuar/ }).first().click(); await P.page.waitForLoadState('networkidle'); await P.page.waitForTimeout(1000);
  const telaDepois = (await P.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const corrDepois = await prisma.correcaoEntregaUmTerco.findFirst({ where: { entregaId: f01.entregaId }, orderBy: { criadaEm: 'desc' } });
  const s4 = (await folhaDoCargo(f01.c)).respostas.find((x) => x.semana.numero === 4)?.texto;
  await foto(P.page, '63-professor-reenviado-celular');
  r('9', 'Reenvio online: mensagem "Correção reenviada — aguardando revisão da Secretaria", selo "Correção reenviada", correção RESOLVIDA, semanas 2 e 4 gravadas', 'tudo presente', `lista: ${/Correção reenviada — aguardando revisão da Secretaria/.test(listaDepois)}/${/Correção reenviada/.test(listaDepois)}; formulário: ${/Correção reenviada — aguardando revisão da Secretaria/.test(telaDepois)}; banco ${corrDepois.status}; S4 "${s4}"`, /Correção reenviada — aguardando revisão da Secretaria/.test(listaDepois) && /Correção reenviada — aguardando revisão da Secretaria/.test(telaDepois) && corrDepois.status === 'RESOLVIDA' && s4 === 'P01 semana 4: revisada pelo professor.', '63-professor-reenviado-celular.png');
  const errosP = P.erros.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::|40[0134]|409/.test(e));
  await P.browser.close();

  // Secretaria vê "Reenviada" na lista (filtro de situação) e o Professor → Secretaria na linha do tempo.
  await ir(S.page, '/correcoes/um-terco');
  await S.page.getByLabel('Situação').selectOption('recebida'); await S.page.waitForTimeout(1200);
  const reenviadas = (await S.page.locator('main ul').innerText().catch(() => '')).replace(/\s+/g, ' ');
  r('10', 'Secretaria filtra "Reenviada · aguardando a Secretaria" e encontra a folha', 'P01 com o selo', reenviadas.slice(0, 120), /Ana Paula Ribeiro/.test(reenviadas) && /Reenviada · aguardando a Secretaria/.test(reenviadas));

  // Expirada (prazo movido no banco, declarado): o Professor vê "Correção expirada".
  const tkS = await token('secretaria@escola.gov.br', '12345678');
  const dv = await req(tkS, 'POST', `/formulario-um-terco/entregas/${f15.entregaId}/devolver`, { observacao: 'Complete a semana 1.' });
  await prisma.correcaoEntregaUmTerco.update({ where: { id: dv.id }, data: { prazoAte: new Date(Date.now() - 60000) } });
  const Q = await abrir({ viewport: { width: 390, height: 844 } });
  await login(Q.page, 'p15@homolog.nexo', SENHA('p15'));
  await ir(Q.page, '/formulario-um-terco');
  const lista15 = (await Q.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await Q.page.getByRole('button', { name: /Editar|Ver/ }).first().click(); await Q.page.waitForLoadState('networkidle'); await Q.page.waitForTimeout(1000);
  const tela15 = (await Q.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await Q.page.getByRole('tab', { name: 'Semana 4' }).click(); await Q.page.waitForTimeout(800);
  const temReenviar = await Q.page.getByRole('button', { name: 'Reenviar correção' }).count();
  await foto(Q.page, '63-professor-expirada-celular');
  r('11', 'Correção expirada: Professor vê o selo e o aviso; não há "Reenviar correção"', 'selo "Correção expirada"; aviso; sem botão', `lista ${/Correção expirada/.test(lista15)}; aviso ${/Correção expirada\. O prazo de 3 dias terminou/.test(tela15)}; botão ${temReenviar}`, /Correção expirada/.test(lista15) && /O prazo de 3 dias terminou/.test(tela15) && temReenviar === 0, '63-professor-expirada-celular.png');
  await Q.browser.close();

  const errosS = S.erros.filter((e) => !/40[0134]|409/.test(e));
  await S.browser.close();
  r('12', 'Sem erros no console nem respostas 5xx', 'nenhum', [...errosS, ...errosP].join(' | ') || 'nenhum', errosS.length + errosP.length === 0);
} finally {
  const convs = (await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção' } }, select: { id: true } })).map((c) => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: convs } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: inicio } } });
  await prepararCargosHomolog();
  await prisma.$disconnect();
}

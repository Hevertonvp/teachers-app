// Devolução para correção no Formulário 1/3 POR CARGO (12/11/2026): API e tela. Banco LOCAL.
// P04 tem 2 cargos (Cargo 1 = Aurora — Arte, Ensino Religioso, Inglês; Cargo 2 = Boa Vista — Inglês).
// Prepara as duas folhas concluídas pela API; no fim apaga só o que criou e devolve o prazo do ciclo 1.
import { abrir, login, BASE, foto } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, resetarFolhas, SENHA } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`COR13-${id}`, 'Correções do 1/3 por cargo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const API = 'http://localhost:3340';
const req = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo === undefined ? undefined : JSON.stringify(corpo) }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;

const inicio = new Date();
const ciclo1 = await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } } } });
const [C1, C2] = await cargosDe('p04');
const p04 = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'p04@homolog.nexo' } });
await resetarFolhas('p04', 1);
const rota = (c) => `/api/formulario-um-terco/ciclos/1/cargos/${c}`;

try {
  const tkS = await token('secretaria@escola.gov.br', '12345678');
  const tkP = await token('p04@homolog.nexo', SENHA('p04'));
  const tkO = await token('p01@homolog.nexo', SENHA('p01'));

  // Preparação: as duas folhas preenchidas e concluídas.
  for (const c of [C1, C2]) {
    const s = await req(tkP, 'PUT', `${rota(c)}/respostas`, { baseUpdatedAt: null, respostas: ciclo1.semanas.map(x => ({ semanaId: x.id, texto: `Cargo ${c === C1 ? 1 : 2}, semana ${x.numero}: conteúdo original.` })) });
    await req(tkP, 'POST', `${rota(c)}/concluir`, { baseUpdatedAt: s.json.updatedAt });
  }
  const e1 = await folhaDoCargo(C1); const e2 = await folhaDoCargo(C2);

  const vazio = await req(tkS, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/devolver`, { observacao: '   ' });
  r('1', 'Orientações obrigatórias: devolver com texto vazio é recusado', '400', vazio.status, vazio.status === 400);

  const [u1, u1b] = await Promise.all([
    req(tkS, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/devolver`, { observacao: 'Revisar a semana 2 (Cargo 1).' }),
    req(tkS, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/devolver`, { observacao: 'Revisar a semana 2 (Cargo 1).' }),
  ]);
  const u2 = await req(tkS, 'POST', `/api/formulario-um-terco/entregas/${e2.id}/devolver`, { observacao: 'Completar a semana 1 (Cargo 2).' });
  const convs = await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção pendente · Formulário 1/3' } }, include: { mensagens: true } });
  const m1 = convs.find(c => c.assunto.includes('Cargo 1'))?.mensagens[0];
  r('2', 'Duplo clique devolve uma vez só; duas folhas do mesmo professor viram duas mensagens, cada uma com o link do seu cargo', `201+409; 2 conversas; link /formulario-um-terco/1/cargo/${C1}`, `${[u1.status, u1b.status].sort().join('+')}; ${u2.status}; ${convs.length} conversas; ${m1?.linkFormulario}`, [u1.status, u1b.status].sort().join('+') === '201+409' && u2.status === 201 && convs.length === 2 && m1?.linkFormulario === `/formulario-um-terco/1/cargo/${C1}`);
  r('3', 'Mensagem identifica o cargo com escola → disciplinas, sem turma e sem ano/série', 'Cargo 1; Aurora — Arte, Ensino Religioso, Inglês', (m1?.conteudo ?? '').split('\n').slice(0, 6).join(' | '), /Cargo 1/.test(m1?.conteudo ?? '') && /Aurora — Arte, Ensino Religioso, Inglês/.test(m1?.conteudo ?? '') && !/º ano|Turma/.test(m1?.conteudo ?? ''));

  const minhas = (await req(tkP, 'GET', '/api/formulario-um-terco/minhas')).json.filter(i => i.ciclo.id === 1);
  r('4', 'Lista do professor: "Correção solicitada" nas duas folhas, sem misturar', 'as duas', minhas.map(i => `${i.rotulo}:${i.correcaoSolicitada}`).join(' '), minhas.length === 2 && minhas.every(i => i.correcaoSolicitada));

  // Conflito 409 dentro do fluxo de correção: base antiga não sobrescreve.
  const det1 = (await req(tkP, 'GET', rota(C1))).json;
  const ok1 = await req(tkP, 'PUT', `${rota(C1)}/respostas`, { baseUpdatedAt: det1.updatedAt, respostas: det1.semanas.map(s => ({ semanaId: s.id, texto: s.numero === 2 ? 'Semana 2 CORRIGIDA no computador.' : s.texto })) });
  const velho = await req(tkP, 'PUT', `${rota(C1)}/respostas`, { baseUpdatedAt: det1.updatedAt, respostas: det1.semanas.map(s => ({ semanaId: s.id, texto: s.numero === 2 ? 'Texto de outra aba com versão antiga.' : s.texto })) });
  const s2 = (await folhaDoCargo(C1)).respostas.find(x => x.semana.numero === 2)?.texto;
  r('5', 'Conflito durante a correção: gravação com versão antiga recebe 409 e nada é sobrescrito', '200; 409; banco com "CORRIGIDA"', `${ok1.status}; ${velho.status} (${velho.json.message ?? ''}); banco: "${s2}"`, ok1.status === 200 && velho.status === 409 && s2 === 'Semana 2 CORRIGIDA no computador.' && velho.json.codigo === 'CONFLITO_VERSAO' && !!velho.json.dadosAtuais?.semanas);

  // Envia a correção do Cargo 2; depois encerra o prazo: só a folha com correção aberta continua editável.
  const d2 = (await req(tkP, 'GET', rota(C2))).json;
  await req(tkP, 'POST', `${rota(C2)}/concluir`, { baseUpdatedAt: d2.updatedAt });
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: new Date(Date.now() - 3600000) } });
  const dA = (await req(tkP, 'GET', rota(C1))).json; const dB = (await req(tkP, 'GET', rota(C2))).json;
  const putA = await req(tkP, 'PUT', `${rota(C1)}/respostas`, { baseUpdatedAt: dA.updatedAt, respostas: dA.semanas.map(s => ({ semanaId: s.id, texto: s.texto })) });
  const putB = await req(tkP, 'PUT', `${rota(C2)}/respostas`, { baseUpdatedAt: dB.updatedAt, respostas: dB.semanas.map(s => ({ semanaId: s.id, texto: s.texto })) });
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: ciclo1.prazoEm } });
  r('6', 'Prazo encerrado: a folha devolvida (Cargo 1) continua editável; a já enviada (Cargo 2) não', 'Cargo 1 200; Cargo 2 400', `C1 ${dA.editavelAgora}/${putA.status}; C2 ${dB.editavelAgora}/${putB.status}`, dA.editavelAgora === true && putA.status === 200 && dB.editavelAgora === false && putB.status === 400);

  const fresco = (await req(tkP, 'GET', rota(C1))).json;
  const [k1, k2] = await Promise.all([req(tkP, 'POST', `${rota(C1)}/concluir`, {}), req(tkP, 'POST', `${rota(C1)}/concluir`, {})]);
  const painel = (await req(tkS, 'GET', '/api/formulario-um-terco/ciclos/1/painel?correcao=em_andamento')).json;
  const linha = painel.linhas.find(l => l.professorId === p04.id && l.cargoId === C1);
  const aceito = await req(tkS, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/aceitar`);
  const detS = (await req(tkS, 'GET', `/api/formulario-um-terco/ciclos/1/entregas/${p04.id}/cargos/${C1}`)).json;
  const textos = (await folhaDoCargo(C1)).respostas.map(x => x.texto);
  r('7', '"Enviar correção" (clique duplo) → painel mostra "recebida" → Secretaria aceita; histórico no detalhe; nenhuma resposta perdida', `recebida; aceita; 4 semanas com texto`, `${k1.status}/${k2.status}; painel ${linha?.correcao}; aceitar ${aceito.status}; histórico ${detS.correcoes?.map(c => c.situacao).join(',')}; semanas ${textos.length}; base ${fresco.updatedAt ? 'ok' : '-'}`, linha?.correcao === 'recebida' && aceito.status === 200 && detS.correcoes?.[0]?.situacao === 'aceita' && textos.length === 4 && textos.includes('Semana 2 CORRIGIDA no computador.'));

  const p01Tenta = await req(tkO, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/devolver`, { observacao: 'x' });
  const p01Aceita = await req(tkO, 'POST', `/api/formulario-um-terco/entregas/${e1.id}/aceitar`);
  r('8', 'Professor não devolve nem aceita correções (só a Secretaria)', '403 e 403', `${p01Tenta.status} e ${p01Aceita.status}`, p01Tenta.status === 403 && p01Aceita.status === 403);

  // ===== Tela: Secretaria devolve no painel; professor (celular) abre pela mensagem e envia =====
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  await S.page.goto(BASE + '/#/formulario-um-terco/ciclos/1'); await S.page.waitForLoadState('networkidle');
  const card = S.page.locator('div.rounded-xl, div', { hasText: /Boa Vista — Inglês/ }).filter({ has: S.page.getByRole('button', { name: 'Ver' }) }).filter({ hasText: /Daniela Moreira|P04/i }).last();
  await card.getByRole('button', { name: 'Ver' }).click();
  await S.page.getByRole('button', { name: 'Enviar para correção' }).click();
  await S.page.getByLabel('O que precisa ser corrigido?').fill('Rever a semana 3 do Cargo 2.');
  await S.page.getByRole('button', { name: 'Enviar para correção' }).last().click();
  await S.page.getByRole('button', { name: 'Confirmar envio' }).click();
  await S.page.getByText('Correção enviada. O professor recebeu').waitFor({ timeout: 10000 });
  const modalTexto = (await S.page.locator('div.fixed.inset-0').last().innerText()).replace(/\s+/g, ' ');
  await foto(S.page, '59-secretaria-devolveu');
  r('9', 'Tela da Secretaria: o detalhe mostra o cargo (escola → disciplina, sem turmas) e devolve com confirmação', 'Boa Vista — Inglês; enviado', modalTexto.slice(0, 160), /Boa Vista — Inglês/.test(modalTexto) && !/\dM\d|Válido para/.test(modalTexto), '59-secretaria-devolveu.png');

  const P = await abrir({ viewport: { width: 390, height: 844 } });
  await login(P.page, 'p04@homolog.nexo', SENHA('p04'));
  await P.page.goto(BASE + '/#/mensagens'); await P.page.waitForLoadState('networkidle');
  await P.page.getByText(/Correção pendente · Formulário 1\/3 · Cargo 2/).first().click();
  await P.page.getByRole('link', { name: 'Abrir formulário' }).first().click();
  await P.page.waitForURL(new RegExp(`formulario-um-terco/1/cargo/${C2}`), { timeout: 10000 });
  await P.page.getByText('Rever a semana 3 do Cargo 2.').waitFor({ timeout: 15000 });
  await P.page.getByRole('tab', { name: 'Semana 3' }).click(); await P.page.waitForTimeout(800);
  await P.page.locator('#conteudos-semana').fill('Cargo 2, semana 3: conteúdo REVISADO após a correção.');
  await P.page.waitForTimeout(3500);
  await P.page.getByRole('tab', { name: 'Semana 4' }).click(); await P.page.waitForTimeout(1200);
  const enviar = P.page.getByRole('button', { name: /Enviar correção/ }).first();
  const temEnviar = await enviar.count();
  if (temEnviar) { await enviar.click(); await P.page.waitForTimeout(2500); const conf = P.page.getByRole('button', { name: /Enviar|Confirmar/ }).last(); if (await conf.isVisible().catch(() => false)) { await conf.click().catch(() => {}); await P.page.waitForTimeout(2000); } }
  await foto(P.page, '59-professor-correcao-celular');
  const rolagem = await P.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const corr = await prisma.correcaoEntregaUmTerco.findFirst({ where: { entregaId: e2.id }, orderBy: { criadaEm: 'desc' } });
  const s3 = (await folhaDoCargo(C2)).respostas.find(x => x.semana.numero === 3)?.texto;
  r('10', 'Professor (celular): mensagem → "Abrir formulário" do cargo certo → corrige → "Enviar correção"; texto gravado; sem rolagem lateral', 'link do Cargo 2; texto revisado no banco; correção RESOLVIDA', `URL ${P.page.url().split('#')[1]}; botão ${temEnviar}; correção ${corr?.status}; S3 "${s3}"; sobra ${rolagem}px`, s3 === 'Cargo 2, semana 3: conteúdo REVISADO após a correção.' && corr?.status === 'RESOLVIDA' && rolagem <= 0, '59-professor-correcao-celular.png');

  const erros = [...S.erros, ...P.erros].filter((e) => !/favicon|40[0134]|409/.test(e));
  await S.browser.close(); await P.browser.close();
  r('11', 'Sem erros no console nem respostas 5xx nas telas', 'nenhum', erros.join(' | ') || 'nenhum', erros.length === 0);
} finally {
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: ciclo1.prazoEm } });
  const convs = await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção pendente' } }, select: { id: true } });
  const ids = convs.map((c) => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: ids } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: ids } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: ids } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: inicio }, chaveIdempotencia: { startsWith: 'correcao-' } } });
  await resetarFolhas('p04', 1);
  await prisma.$disconnect();
}

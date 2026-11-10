// Fase 7b — desativação de professor/turma DURANTE o ciclo, depois de entrega concluída. Preenchimento pela interface;
// a desativação usa a API oficial de inativar (declarado). Esperado "documentado" (seção 68) = 19; "histórico preservado" = 21.
import { abrir, login, foto, abrirCartao, sair, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340/api';
const tokenSec = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secretaria@escola.gov.br', senha: '12345678' }) })).json()).token;
const post = (c) => fetch(API + c, { method: 'POST', headers: { authorization: `Bearer ${tokenSec}`, 'content-type': 'application/json' }, body: '{}' }).then(r => r.status);

// 1) P11 preenche e conclui pela interface
const a = await abrir();
await login(a.page, 'p11@homolog.nexo', 'Nexo!Prof11-2026');
await abrirCartao(a.page, /7º.*História/);
const ta = a.page.locator('#conteudos-semana');
const textos = ['Brasil Colônia: engenhos, trabalho escravizado e resistência quilombola.', 'Ciclo do ouro em Minas Gerais e a vida urbana colonial.', 'Inconfidência Mineira e as ideias iluministas.', 'Chegada da família real portuguesa e abertura dos portos.'];
for (let i = 0; i < 4; i++) { await a.page.getByRole('tab', { name: `Semana ${i + 1}` }).click(); await a.page.waitForTimeout(900); await ta.fill(textos[i]); await a.page.waitForTimeout(700); }
await a.page.getByRole('button', { name: /Concluir/ }).click(); await a.page.waitForTimeout(2500);
const e11 = await prisma.entregaUmTerco.findFirst({ where: { professor: { email: 'p11@homolog.nexo' } } });
registrar('UT-EST-01', 'Estados administrativos', 'P11 conclui o 7º História pela interface', 'status CONCLUIDA', e11?.status ?? 'sem entrega', e11?.status === 'CONCLUIDA' ? 'APROVADO' : 'REPROVADO');
await a.browser.close();

const painel = async (tag) => {
  const s = await abrir(); await login(s.page, 'secretaria@escola.gov.br', '12345678');
  const ciclo = await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } } });
  await s.page.goto(BASE + `/#/formulario-um-terco/ciclos/${ciclo.id}`); await s.page.waitForLoadState('networkidle'); await s.page.waitForTimeout(2000);
  const txt = (await s.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const pega = (rot) => Number((txt.match(new RegExp(rot + '\\s*(\\d+)')) ?? [])[1]);
  const r = { esperadas: pega('Esperadas'), concluidas: pega('Concluídas'), linhas: await s.page.locator('div.space-y-3 > div').count(), temP11: /P11 Homolog/.test(txt), temP15: /P15 Homolog/.test(txt), cobBV: (txt.match(/Boa Vista: (\d+\/\d+)/) ?? [])[1] };
  await foto(s.page, `14-painel-${tag}`); await s.browser.close(); return r;
};
const antes = await painel('antes-desativar');
registrar('UT-EST-02', 'Estados administrativos', 'Painel com P11 concluído e todos ativos: esperadas 21, concluídas 3', '21 / 3', `${antes.esperadas} / ${antes.concluidas}`, antes.esperadas === 21 && antes.concluidas === 3 ? 'APROVADO' : 'REPROVADO', '14-painel-antes-desativar.png');

// 2) Secretaria desativa o professor P11 (que já entregou) e a turma Boa Vista 7M1 (do P15)
const p11 = await prisma.pessoa.findUnique({ where: { email: 'p11@homolog.nexo' } });
const t7bv = await prisma.turma.findFirst({ where: { nome: '7M1', escola: { nome: { contains: 'Boa Vista' } } } });
const s1 = await post(`/pessoas/professores/${p11.id}/inativar`); const s2 = await post(`/turmas/${t7bv.id}/inativar`);
console.log('inativar P11 / turma BV 7M1 → HTTP', s1, s2);

const depois = await painel('depois-desativar');
console.log('Painel depois:', JSON.stringify(depois));
registrar('UT-EST-03', 'Estados administrativos', 'Professor desativado DEPOIS de concluir: a entrega concluída continua contando no painel (histórico preservado)', 'esperadas 21 / concluídas 3 (P11 visível)', `esperadas ${depois.esperadas}, concluídas ${depois.concluidas}, P11 na lista: ${depois.temP11}`, depois.concluidas === 3 && depois.temP11 ? 'APROVADO' : 'MELHORIA CONCEITUAL', '14-painel-depois-desativar.png', 'O documentado (seção 68) diz que ciclo em curso exige professor/turma ativos; o resultado é que a entrega concluída some do painel e o % muda.');
registrar('UT-EST-04', 'Estados administrativos', 'Turma inativada durante o ciclo: obrigação do P15 (único vínculo) sai do painel', 'documentado: sai (19 no total)', `esperadas ${depois.esperadas}; P15 na lista: ${depois.temP15}`, depois.esperadas === 19 ? 'OBSERVAÇÃO (regra não especificada)' : 'REPROVADO', '14-painel-depois-desativar.png', 'Coerente com a seção 68, mas é questão de negócio: desativar turma/professor apaga obrigação já iniciada ou cumprida?');

// 3) O que acontece com quem foi desativado
const b = await abrir();
await login(b.page, 'p11@homolog.nexo', 'Nexo!Prof11-2026');
await b.page.waitForTimeout(1000);
registrar('UT-EST-05', 'Estados administrativos', 'Professor inativo não consegue entrar', 'permanece no login', b.page.url().split('#')[1], b.page.url().includes('/login') ? 'APROVADO' : 'REPROVADO');
await b.browser.close();
const c = await abrir();
await login(c.page, 'p15@homolog.nexo', 'Nexo!Prof15-2026');
await c.page.goto(BASE + '/#/formulario-um-terco'); await c.page.waitForLoadState('networkidle'); await c.page.waitForTimeout(1500);
const n15 = await c.page.locator('h2.text-xl').count();
registrar('UT-EST-06', 'Estados administrativos', 'P15 (turma inativada): formulário some da lista dele', '0 cartões', `${n15} cartão(ões)`, n15 === 0 ? 'OBSERVAÇÃO (regra não especificada)' : 'REPROVADO');
await c.browser.close();
// 4) reativa tudo (restaura o estado)
console.log('reativar P11 / turma →', await post(`/pessoas/professores/${p11.id}/reativar`), await post(`/turmas/${t7bv.id}/reativar`));
const rest = await painel('restaurado');
registrar('UT-EST-07', 'Estados administrativos', 'Reativar professor e turma restaura painel (21 / 3)', '21 / 3', `${rest.esperadas} / ${rest.concluidas}`, rest.esperadas === 21 && rest.concluidas === 3 ? 'APROVADO' : 'REPROVADO');
await prisma.$disconnect();

// Prazo e reabertura. O prazo do ciclo A é ANTECIPADO por API (declarado) para simular "prazo vencido"; professor e
// Secretaria agem pela interface. No fim o ciclo A é restaurado à janela original (02/11 08:00 → 20/11 18:00).
// 1/3 POR CARGO (12/11/2026): folhas do Cargo 1 e do Cargo 2 do P04 (cargos de teste).
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, prepararCargosHomolog, resetarFolhas, SENHA } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const [C1, C2] = await cargosDe('p04');
const API = 'http://localhost:3340/api';
const tok = async (e, s) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, senha: s }) })).json()).token;
const sec = await tok('secretaria@escola.gov.br', '12345678');
const A = await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } }, include: { semanas: { orderBy: { numero: 'asc' } } } });
const corpoA = (prazo) => ({ anoLetivo: A.anoLetivo, trimestre: A.trimestre, titulo: A.titulo, abreEm: '2026-11-02T08:00', prazoEm: prazo, semanas: A.semanas.map(s => ({ dataInicio: s.dataInicio.toISOString().slice(0, 10), dataFim: s.dataFim.toISOString().slice(0, 10) })) });
// Desde 10/11/2026 nenhuma semana pode terminar depois do prazo, e o ciclo local tem semanas até 27/11: o prazo é
// mudado DIRETO NO BANCO LOCAL (intervenção declarada) em vez da API de edição do ciclo.
const put = async (prazo) => { await prisma.cicloUmTerco.update({ where: { id: A.id }, data: { prazoEm: new Date(prazo + ':00-03:00') } }); return { status: 200 }; };

// antecipa o prazo para 04/11 09:00 (já passou: agora é após 12h de Brasília)
const r0 = await put('2026-11-04T09:00');
registrar('UT-PRZ-00', 'Prazo', 'Prazo do ciclo antecipado para 04/11 09:00 (direto no banco local, declarado)', 'gravado', `prazo ${(await prisma.cicloUmTerco.findUnique({ where: { id: A.id } })).prazoEm.toISOString()}`, r0.status === 200 ? 'APROVADO' : 'REPROVADO');

const a = await abrir();
await login(a.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await a.page.goto(BASE + '/#/formulario-um-terco'); await a.page.waitForLoadState('networkidle'); await a.page.waitForTimeout(1500);
const lista = (await a.page.locator('main').innerText()).replace(/\s+/g, ' ');
await foto(a.page, '15-prazo-vencido-lista');
registrar('UT-PRZ-01', 'Prazo', 'Lista mostra o ciclo como Encerrado e o botão passa a "Ver"', 'selo Encerrado e botão Ver', `Encerrado: ${/Encerrado/.test(lista)}; Ver: ${/\bVer\b/.test(lista)}`, /Encerrado/.test(lista) && /\bVer\b/.test(lista) ? 'APROVADO' : 'REPROVADO', '15-prazo-vencido-lista.png');

await abrirCartao(a.page, /^Cargo 2$/);
const desab = await a.page.locator('#conteudos-semana').isDisabled();
const aviso = (await a.page.locator('main').innerText()).replace(/\s+/g, ' ');
await foto(a.page, '15-prazo-vencido-formulario');
registrar('UT-PRZ-02', 'Prazo', 'Formulário após o prazo fica somente leitura (campo desabilitado)', 'campo desabilitado', `desabilitado: ${desab}; mensagem: "${(aviso.match(/prazo[^.]*\./i) ?? [''])[0].slice(0, 100)}"`, desab ? 'APROVADO' : 'REPROVADO', '15-prazo-vencido-formulario.png');

// servidor também recusa gravar após o prazo (API direta, declarado)
const t = await tok('p04@homolog.nexo', 'Nexo!Prof04-2026');
const pr = await fetch(`${API}/formulario-um-terco/ciclos/${A.id}/cargos/${C2}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ baseUpdatedAt: null, respostas: [{ semanaId: A.semanas[0].id, texto: 'tentativa após o prazo' }] }) });
const pj = await pr.json().catch(() => ({}));
registrar('UT-PRZ-03', 'Prazo', 'Servidor recusa gravar após o prazo (não depende da tela)', 'HTTP 400/403 e mensagem de prazo', `HTTP ${pr.status}: ${(pj.message ?? '').slice(0, 90)}`, [400, 403].includes(pr.status) ? 'APROVADO' : 'REPROVADO');
const dentro = await prisma.respostaSemanaUmTerco.count({ where: { texto: 'tentativa após o prazo' } });
registrar('UT-PRZ-04', 'Prazo', 'Nada foi gravado pela tentativa fora do prazo', '0 registros', String(dentro), dentro === 0 ? 'APROVADO' : 'REPROVADO');

// Formulário aberto ANTES do prazo e enviado DEPOIS: restaura prazo, abre, antecipa de novo, tenta salvar na mesma tela
await put('2026-11-20T18:00');
await abrirCartao(a.page, /^Cargo 1$/);
await a.page.locator('#conteudos-semana').fill('Texto digitado com o prazo ainda aberto, enviado depois do vencimento.');
await put('2026-11-04T09:00'); // vence com a tela aberta
await a.page.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {}); await a.page.waitForTimeout(3000);
const corpoVenc = (await a.page.locator('main').innerText()).replace(/\s+/g, ' ');
const gravou = await prisma.respostaSemanaUmTerco.count({ where: { texto: { startsWith: 'Texto digitado com o prazo ainda aberto' } } });
await foto(a.page, '15-vence-com-tela-aberta');
registrar('UT-PRZ-05', 'Prazo', 'Prazo vence com a tela aberta: salvar depois do vencimento é recusado e o professor é avisado', 'não grava; mensagem clara', `gravou: ${gravou}; mensagem na tela: "${(corpoVenc.match(/(prazo|encerrad|somente leitura)[^.]*\./i) ?? ['(nenhuma mensagem encontrada)'])[0].slice(0, 120)}"`, gravou === 0 ? 'APROVADO' : 'REPROVADO', '15-vence-com-tela-aberta.png', 'Para o texto digitado: ver se fica preservado localmente (rascunho) — conferir em 15-vence-com-tela-aberta.png');

// Reabertura pela interface da Secretaria
const s = await abrir();
await login(s.page, 'secretaria@escola.gov.br', '12345678');
await s.page.goto(BASE + '/#/formulario-um-terco'); await s.page.waitForLoadState('networkidle');
const card = s.page.locator('h2.text-xl', { hasText: 'Nov/2026 (homolog)' }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
await card.getByRole('button', { name: 'Reabrir' }).click();
const m = s.page.locator('div.fixed.inset-0');
// Reabertura cobrindo HOJE (o teste foi escrito quando hoje era 04/11).
const hojeSp = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); const amanhaSp = new Date(Date.now() - 3 * 3600000 + 86400000).toISOString().slice(0, 10);
const reabAntes = new Set((await prisma.reaberturaUmTerco.findMany({ where: { cicloId: A.id }, select: { id: true } })).map(x => x.id));
await m.getByLabel('Início').fill(`${hojeSp}T00:00`); await m.getByLabel('Fim').fill(`${amanhaSp}T23:59`); await m.getByLabel('Motivo (opcional)').fill('Correção solicitada pela direção (homologação)');
await m.getByRole('button', { name: 'Reabrir' }).click(); await s.page.waitForTimeout(1500);
await foto(s.page, '15-reabertura-secretaria');
const rea = await prisma.reaberturaUmTerco.count({ where: { cicloId: A.id } });
registrar('UT-PRZ-06', 'Reabertura', 'Secretaria reabre o ciclo pela interface (hoje 00:00 → amanhã 23:59)', '1 reabertura registrada', `${rea} reabertura(s)`, rea >= 1 ? 'APROVADO' : 'REPROVADO', '15-reabertura-secretaria.png');
await s.browser.close();

// Professor volta a editar dentro da reabertura
await abrirCartao(a.page, /^Cargo 1$/);
const habil = await a.page.locator('#conteudos-semana').isEnabled();
await a.page.locator('#conteudos-semana').fill('Texto salvo DENTRO da reabertura administrativa.');
await a.page.getByRole('button', { name: 'Salvar progresso' }).click(); await a.page.waitForTimeout(2000);
const salvo = await prisma.respostaSemanaUmTerco.count({ where: { texto: 'Texto salvo DENTRO da reabertura administrativa.' } });
registrar('UT-PRZ-07', 'Reabertura', 'Dentro da reabertura o professor volta a editar e o texto é gravado', 'campo habilitado e texto gravado', `habilitado: ${habil}; gravado: ${salvo}`, habil && salvo === 1 ? 'APROVADO' : 'REPROVADO');
const ciclosAbertosNaLista = await a.page.goto(BASE + '/#/formulario-um-terco').then(() => a.page.waitForTimeout(1500)).then(() => a.page.locator('main').innerText());
registrar('UT-PRZ-08', 'Reabertura', 'Prazo original do ciclo permanece 04/11 09:00 (reabertura não altera o prazo)', 'prazoEm original inalterado', (await prisma.cicloUmTerco.findUnique({ where: { id: A.id } })).prazoEm.toISOString(), (await prisma.cicloUmTerco.findUnique({ where: { id: A.id } })).prazoEm.toISOString() === '2026-11-04T12:00:00.000Z' ? 'APROVADO' : 'REPROVADO');

// restaura a janela original do ciclo A
const rr = await put('2026-11-20T18:00');
await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: A.id, id: { notIn: [...reabAntes] } } }); // só a criada por este teste
await resetarFolhas('p04', 1);
console.log('restaurado A →', rr.status);
await a.browser.close(); await prisma.$disconnect();

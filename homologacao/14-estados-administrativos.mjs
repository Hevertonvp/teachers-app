// 1/3 POR CARGO — mudanças administrativas DURANTE o ciclo (reescrito em 12/11/2026). Banco LOCAL, navegador real.
// A) Professor inativado depois de concluir: sai do esperado enquanto o ciclo corre; nada é apagado; reativar devolve.
// B) Cargo encerrado durante o ciclo, com texto já escrito: sai do esperado, o texto fica guardado ("Fora do
//    esperado" no painel; "Cargo encerrado · só consulta" para o professor). Decisões do usuário de 12/11/2026.
// No fim, prepararCargosHomolog() restaura os cargos de teste.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, FOLHAS_ESPERADAS_CICLO1, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const API = 'http://localhost:3340/api';
const tokenDe = async (e, s) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, senha: s }) })).json()).token;
const tokenSec = await tokenDe('secretaria@escola.gov.br', '12345678');
const post = (c, corpo = {}) => fetch(API + c, { method: 'POST', headers: { authorization: `Bearer ${tokenSec}`, 'content-type': 'application/json' }, body: JSON.stringify(corpo) }).then(r => r.status);
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

await prepararCargosHomolog();
const painel = async (tag) => {
  const s = await abrir(); await login(s.page, 'secretaria@escola.gov.br', '12345678');
  await s.page.goto(BASE + '/#/formulario-um-terco/ciclos/1'); await s.page.waitForLoadState('networkidle'); await s.page.waitForTimeout(2000);
  const txt = (await s.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const pega = (rot) => Number((txt.match(new RegExp(rot + '\\s*(\\d+)')) ?? [])[1]);
  const fora = (txt.match(/Fora do esperado \((\d+)\)/) ?? [])[1] ?? '0';
  const r = { esperadas: pega('Esperadas'), concluidas: pega('Concluídas'), fora: Number(fora), txt };
  await foto(s.page, `14-painel-${tag}`); await s.browser.close(); return r;
};

try {
  // ===== A) P11 conclui pela interface e depois é inativado =====
  const a = await abrir();
  await login(a.page, 'p11@homolog.nexo', SENHA('p11'));
  await abrirCartao(a.page, /^Cargo 1$/);
  const ta = a.page.locator('#conteudos-semana');
  const textos = ['Brasil Colônia: engenhos e resistência quilombola.', 'Ciclo do ouro e a vida urbana colonial.', 'Inconfidência Mineira e o iluminismo.', 'Chegada da família real e abertura dos portos.'];
  for (let i = 0; i < 4; i++) { await a.page.getByRole('tab', { name: `Semana ${i + 1}` }).click(); await a.page.waitForTimeout(900); await ta.fill(textos[i]); await a.page.waitForTimeout(700); }
  await a.page.getByRole('button', { name: /Concluir/ }).click(); await a.page.waitForTimeout(2500);
  const [c11] = await cargosDe('p11');
  const e11 = await folhaDoCargo(c11);
  registrar('UT-EST-01', 'Estados administrativos', 'P11 conclui a folha do Cargo 1 pela interface', 'status CONCLUIDA', e11?.status ?? 'sem entrega', e11?.status === 'CONCLUIDA' ? 'APROVADO' : 'REPROVADO');
  await a.browser.close();

  const antes = await painel('antes');
  registrar('UT-EST-02', 'Estados administrativos', `Painel com P11 concluído: esperadas ${FOLHAS_ESPERADAS_CICLO1}, concluídas 1`, `${FOLHAS_ESPERADAS_CICLO1} / 1`, `${antes.esperadas} / ${antes.concluidas}`, antes.esperadas === FOLHAS_ESPERADAS_CICLO1 && antes.concluidas === 1 ? 'APROVADO' : 'REPROVADO', '14-painel-antes.png');

  const p11 = await prisma.pessoa.findUnique({ where: { email: 'p11@homolog.nexo' } });
  const st = await post(`/pessoas/professores/${p11.id}/inativar`);
  const depois = await painel('p11-inativo');
  const preservado = (await folhaDoCargo(c11))?.respostas.length === 4;
  registrar('UT-EST-03', 'Estados administrativos', 'Professor inativado com o ciclo aberto: sai do esperado; a folha concluída fica guardada (Fora do esperado)', `esperadas ${FOLHAS_ESPERADAS_CICLO1 - 1}; fora 1; 4 semanas no banco`, `HTTP ${st}; esperadas ${depois.esperadas}; fora ${depois.fora}; semanas guardadas: ${preservado}`, depois.esperadas === FOLHAS_ESPERADAS_CICLO1 - 1 && depois.fora === 1 && preservado ? 'APROVADO' : 'REPROVADO', '14-painel-p11-inativo.png');

  const b = await abrir();
  await login(b.page, 'p11@homolog.nexo', SENHA('p11'));
  await b.page.waitForTimeout(1000);
  registrar('UT-EST-04', 'Estados administrativos', 'Professor inativo não consegue entrar', 'permanece no login', b.page.url().split('#')[1], b.page.url().includes('/login') ? 'APROVADO' : 'REPROVADO');
  await b.browser.close();

  const st2 = await post(`/pessoas/professores/${p11.id}/reativar`);
  const rest = await painel('p11-reativado');
  registrar('UT-EST-05', 'Estados administrativos', 'Reativar o professor devolve a folha concluída ao esperado', `${FOLHAS_ESPERADAS_CICLO1} / 1; fora 0`, `HTTP ${st2}; ${rest.esperadas} / ${rest.concluidas}; fora ${rest.fora}`, rest.esperadas === FOLHAS_ESPERADAS_CICLO1 && rest.concluidas === 1 && rest.fora === 0 ? 'APROVADO' : 'REPROVADO');

  // ===== B) P15 escreve a semana 1 e o cargo é encerrado durante o ciclo =====
  const [c15] = await cargosDe('p15');
  const tk15 = await tokenDe('p15@homolog.nexo', SENHA('p15'));
  const sem1 = await prisma.semanaUmTerco.findFirst({ where: { cicloId: 1, numero: 1 } });
  await fetch(`${API}/formulario-um-terco/ciclos/1/cargos/${c15}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tk15}` }, body: JSON.stringify({ baseUpdatedAt: null, respostas: [{ semanaId: sem1.id, texto: 'P15 semana 1: frações (antes do encerramento).' }] }) });
  const p15 = await prisma.pessoa.findUnique({ where: { email: 'p15@homolog.nexo' } });
  const enc = await post(`/pessoas/professores/${p15.id}/cargos/${c15}/encerrar`, { dataFim: hoje });
  const comEncerrado = await painel('p15-encerrado');
  registrar('UT-EST-06', 'Estados administrativos', 'Cargo encerrado durante o ciclo (com texto): sai do esperado e aparece em "Fora do esperado" no painel', `esperadas ${FOLHAS_ESPERADAS_CICLO1 - 1}; fora 1`, `HTTP ${enc}; esperadas ${comEncerrado.esperadas}; fora ${comEncerrado.fora}`, enc === 200 && comEncerrado.esperadas === FOLHAS_ESPERADAS_CICLO1 - 1 && comEncerrado.fora === 1 ? 'APROVADO' : 'REPROVADO', '14-painel-p15-encerrado.png');

  const c = await abrir();
  await login(c.page, 'p15@homolog.nexo', SENHA('p15'));
  await c.page.goto(BASE + '/#/formulario-um-terco'); await c.page.waitForLoadState('networkidle'); await c.page.waitForTimeout(1500);
  const lista = (await c.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await abrirCartao(c.page, /Cargo encerrado/);
  const desab = await c.page.locator('#conteudos-semana').isDisabled();
  const texto = await c.page.locator('#conteudos-semana').inputValue();
  await foto(c.page, '14-p15-cargo-encerrado');
  registrar('UT-EST-07', 'Estados administrativos', 'Professor do cargo encerrado vê a folha só para consulta, com o texto guardado', '"Cargo encerrado · só consulta"; campo desabilitado; texto preservado', `selo: ${/Cargo encerrado · só consulta/.test(lista)}; desabilitado: ${desab}; texto: "${texto.slice(0, 40)}"`, /Cargo encerrado · só consulta/.test(lista) && desab && texto.startsWith('P15 semana 1') ? 'APROVADO' : 'REPROVADO', '14-p15-cargo-encerrado.png');
  await c.browser.close();
} finally {
  await prisma.pessoa.update({ where: { email: 'p11@homolog.nexo' }, data: { status: 'ATIVO' } });
  await prepararCargosHomolog();
  await prisma.$disconnect();
}

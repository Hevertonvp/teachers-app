// Inativar ciclo do 1/3 mesmo com preenchimentos (decisão do usuário, 10/11/2026). Banco LOCAL.
// Inativa o ciclo 1 (que tem entregas), confere que nada é apagado e reativa no fim.
// 1/3 POR CARGO (12/11/2026): o P04 participa pelos cargos de teste e começa a folha do Cargo 1 antes.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
await prepararCargosHomolog();
const [C1] = await cargosDe('p04');
const r = (id, cen, esp, obs, ok) => registrar(`INA-${id}`, 'Inativar 1/3 com preenchimentos', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const API = 'http://localhost:3340';
const req = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo ? JSON.stringify(corpo) : metodo === 'POST' ? '{}' : undefined }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;

const contar = async () => ({ entregas: await prisma.entregaUmTerco.count({ where: { cicloId: 1 } }), respostas: await prisma.respostaSemanaUmTerco.count({ where: { entrega: { cicloId: 1 } } }) });
try {
  const tkS = await token('secretaria@escola.gov.br', '12345678');
  const tkP = await token('p04@homolog.nexo', SENHA('p04'));
  const sem1 = await prisma.semanaUmTerco.findFirst({ where: { cicloId: 1, numero: 1 } });
  await req(tkP, 'PUT', `/api/formulario-um-terco/ciclos/1/cargos/${C1}/respostas`, { baseUpdatedAt: null, respostas: [{ semanaId: sem1.id, texto: 'Semana 1 (teste de inativação).' }] });
  const antes = await contar();

  // Tela: o botão aparece no ciclo com preenchimentos e o aviso diz quantos já começaram.
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle');
  const cartao = X.page.locator('div', { has: X.page.getByRole('heading', { name: /Nov\/2026 \(homolog\)/ }) }).filter({ has: X.page.getByRole('button', { name: 'Painel de entregas' }) }).last();
  await cartao.getByRole('button', { name: 'Inativar' }).click();
  const aviso = await X.page.getByText(/já (foi|foram) iniciad/).textContent().catch(() => '');
  await X.page.getByRole('button', { name: 'Cancelar' }).click();
  await X.browser.close();
  r('1', 'Ciclo com preenchimentos mostra "Inativar" e avisa quantos já começaram', 'botão + aviso', aviso || 'sem aviso', /iniciad/.test(aviso) && /Nada é apagado/.test(aviso));

  const ina = await req(tkS, 'POST', '/api/formulario-um-terco/ciclos/1/inativar');
  const depois = await contar();
  const minhas = (await req(tkP, 'GET', '/api/formulario-um-terco/minhas')).json;
  r('2', 'Inativar com preenchimentos: aceito; nada apagado; some da lista do professor', `200; ${antes.entregas} entregas e ${antes.respostas} respostas; ciclo 1 fora da lista`, `${ina.status}; ${depois.entregas} e ${depois.respostas}; ciclo 1 na lista: ${minhas.some((i) => i.ciclo.id === 1)}`, ina.status === 200 && depois.entregas === antes.entregas && depois.respostas === antes.respostas && !minhas.some((i) => i.ciclo.id === 1));

  const rea = await req(tkS, 'POST', '/api/formulario-um-terco/ciclos/1/reativar');
  const minhas2 = (await req(tkP, 'GET', '/api/formulario-um-terco/minhas')).json;
  r('3', 'Reativar devolve tudo como estava', '200; ciclo 1 de volta na lista do professor', `${rea.status}; na lista: ${minhas2.some((i) => i.ciclo.id === 1)}`, rea.status === 200 && minhas2.some((i) => i.ciclo.id === 1));
} finally {
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { status: 'ATIVA' } });
  await prisma.$disconnect();
}

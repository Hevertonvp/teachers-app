// Reabrir só depois do prazo (pedido do usuário, 10/11/2026) — 1/3 e Aplicação PDI. Banco LOCAL.
// Cria 1 ciclo 1/3 já encerrado direto no banco (inativado no fim) e remove as reaberturas criadas pelo teste.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`REAB-${id}`, 'Reabrir só após o prazo', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const API = 'http://localhost:3340';
const post = async (tk, p, corpo) => { const res = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify(corpo) }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const agora = Date.now();
const encerrado = await prisma.cicloUmTerco.create({ data: { anoLetivo: 2026, trimestre: 3, titulo: 'ZZ-REAB encerrado', abreEm: new Date('2026-09-01T03:00:00Z'), prazoEm: new Date('2026-09-10T02:59:00Z'), semanas: { create: [{ numero: 1, dataInicio: new Date('2026-09-01'), dataFim: new Date('2026-09-05') }] } } });
const reabPdiAntes = new Set((await prisma.reaberturaPdi.findMany({ select: { id: true } })).map(x => x.id));

try {
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  const tk = await X.page.evaluate(() => localStorage.getItem('authToken'));
  await X.page.goto(BASE + '/#/formulario-um-terco'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
  const cartao = (re) => X.page.locator('div', { has: X.page.getByRole('heading', { name: re }) }).filter({ has: X.page.getByRole('button', { name: 'Painel de entregas' }) }).last();
  const botaoAberto = await cartao(/Nov\/2026 \(homolog\)/).getByRole('button', { name: 'Reabrir' }).count();
  const botaoEncerrado = await cartao(/ZZ-REAB encerrado/).getByRole('button', { name: 'Reabrir' }).count();
  r('1', '1/3 na tela: ciclo ABERTO não mostra "Reabrir"; ciclo ENCERRADO mostra', 'aberto 0; encerrado 1', `aberto ${botaoAberto}; encerrado ${botaoEncerrado}`, botaoAberto === 0 && botaoEncerrado === 1);

  const janela = { inicioEm: new Date(agora).toISOString(), fimEm: new Date(agora + 86400000).toISOString() };
  const apiAberto = await post(tk, '/api/formulario-um-terco/ciclos/1/reaberturas', janela);
  const apiEncerrado = await post(tk, `/api/formulario-um-terco/ciclos/${encerrado.id}/reaberturas`, janela);
  r('2', '1/3 pela API: reabrir ciclo aberto é recusado (409); ciclo encerrado aceita (201)', '409; 201', `${apiAberto.status} ${apiAberto.json.message ?? ''}; ${apiEncerrado.status}`, apiAberto.status === 409 && apiEncerrado.status === 201);

  const hoje = new Date().toISOString().slice(0, 10);
  const vigente = await prisma.aplicacaoPdi.findFirst({ where: { status: 'ATIVA', dataInicio: { lte: new Date(hoje) }, dataFim: { gte: new Date(hoje) } } });
  const apiPdi = vigente ? await post(tk, `/api/pdi-aplicacoes/${vigente.id}/reaberturas`, { dataInicio: '2026-12-20', dataFim: '2026-12-22', solicitadoPorTipo: 'SECRETARIA' }) : { status: 'sem aplicação vigente' };
  r('3', 'PDI pela API: reabrir Aplicação VIGENTE (mesmo com datas depois do fim) é recusado (409)', '409', `${apiPdi.status} ${apiPdi.json?.message ?? ''}`, apiPdi.status === 409);
  console.log('erros:', X.erros.filter(e => !/40[0134]|409/.test(e)));
  await X.browser.close();
} finally {
  await prisma.reaberturaUmTerco.deleteMany({ where: { cicloId: encerrado.id } });
  await prisma.cicloUmTerco.update({ where: { id: encerrado.id }, data: { status: 'INATIVA' } });
  await prisma.reaberturaPdi.deleteMany({ where: { id: { notIn: [...reabPdiAntes] } } });
  await prisma.$disconnect();
}

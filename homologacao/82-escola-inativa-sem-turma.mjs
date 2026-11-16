// Escola INATIVA não recebe turma (pedido do usuário, 16/11/2026): some de "Nova turma"; a API recusa criar, mover
// e reativar turma nela; turma que já estava nela continua editável. Navegador real + API, banco LOCAL. Limpa o que cria.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok) => registrar(`ESCINATIVA-${id}`, 'Escola inativa sem turma', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO');
const token = (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secretaria@escola.gov.br', senha: '12345678' }) })).json()).token;
const api = async (method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };
async function limpar() {
  const ids = (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-INATIVA' } }, select: { id: true } })).map(e => e.id);
  await prisma.turma.deleteMany({ where: { escolaId: { in: ids } } });
  await prisma.escola.deleteMany({ where: { id: { in: ids } } });
}
await limpar();
const NOME = `ZZ-INATIVA ${TAG}`;
const escola = (await api('POST', '/api/escolas', { nome: NOME })).json;
const outra = (await api('POST', '/api/escolas', { nome: `${NOME} ativa` })).json;
const turma = (await api('POST', '/api/turmas', { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 1 })).json;
await api('POST', `/api/escolas/${escola.id}/inativar`);

const nova = await api('POST', '/api/turmas', { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 2 });
const editar = await api('PUT', `/api/turmas/${turma.id}`, { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'TARDE', identificador: 1 });
const outraTurma = (await api('POST', '/api/turmas', { escolaId: outra.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 7, turno: 'MANHA', identificador: 1 })).json;
const mover = await api('PUT', `/api/turmas/${outraTurma.id}`, { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 7, turno: 'MANHA', identificador: 1 });
await api('POST', `/api/turmas/${turma.id}/inativar`);
const reativar = await api('POST', `/api/turmas/${turma.id}/reativar`);
r('1', 'API: criar turma em escola inativa, mover turma para ela e reativar turma dela são recusados; editar a turma que já estava nela continua', '400, 400, 409; editar 200',
  `criar ${nova.status} "${nova.json?.message}", mover ${mover.status}, reativar ${reativar.status}; editar ${editar.status}`,
  nova.status === 400 && mover.status === 400 && reativar.status === 409 && editar.status === 200);

const X = await abrir();
await login(X.page, 'secretaria@escola.gov.br', '12345678');
await X.page.goto(BASE + '/#/turmas'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1500);
await X.page.getByRole('button', { name: '+ Nova turma' }).first().click(); await X.page.waitForTimeout(500);
const opcoes = await X.page.locator('div.fixed.inset-0').last().getByLabel('Escola').evaluate(s => [...s.options].map(o => o.text));
r('2', 'Tela: "Nova turma" não oferece a escola inativa (a ativa aparece)', 'sem a inativa; com a ativa', `inativa: ${opcoes.includes(NOME)}; ativa: ${opcoes.includes(`${NOME} ativa`)}`, !opcoes.includes(NOME) && opcoes.includes(`${NOME} ativa`));
await X.browser.close();
await limpar();
await prisma.$disconnect();

// DEF-17 — Gestor/Diretora reais abrem o perfil do aluno PDI só das escolas a que têm vínculo.
// Uso: node 31-def17-perfil-aluno.mjs antes|depois. Contas REAIS de homologação (login de verdade),
// navegador real; a API é conferida em paralelo como autoridade final. Banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { createRequire } from 'node:module';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');
const FASE = (process.argv[2] || 'depois').toUpperCase();
const API = 'http://localhost:3340';
const SENHA = 'Nexo!Homolog-2026';
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const tSec = await token('secretaria@escola.gov.br', '12345678');

// Conta de Diretora da Aurora (criada pela API da Secretaria; senha definida no banco local — declarado).
if (!(await prisma.pessoa.findUnique({ where: { email: 'diretora.aur@homolog.nexo' } }))) {
  const r = await fetch(API + '/api/pessoas/diretoras', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tSec }, body: JSON.stringify({ nome: 'diretora.aur', email: 'diretora.aur@homolog.nexo', escolaIds: [1] }) });
  console.log('criar diretora.aur', r.status);
}
for (const email of ['diretora.aur@homolog.nexo', 'diretora.bv@homolog.nexo', 'gestor.aur@homolog.nexo', 'gestor.bv@homolog.nexo']) await prisma.pessoa.update({ where: { email }, data: { senhaHash: await bcrypt.hash(SENHA, 10), senhaTemporaria: false } });

const alunos = Object.fromEntries((await prisma.alunoPdi.findMany({ where: { id: { in: [1, 2, 3, 4] } }, include: { turma: true } })).map(a => [a.id, a]));
const desc = (id) => `${alunos[id].nome.split(' ')[0]} (${alunos[id].turma.escolaId === 1 ? 'Aurora' : 'Boa Vista'}${[1, 2, 3].includes(id) ? ', transferido' : ', nunca transferida'})`;

// [conta, senha, alunoId, esperaAcesso, rótulo]
const casos = [
  ['diretora.aur@homolog.nexo', SENHA, 4, true, 'Diretora da Aurora → aluno da própria escola'],
  ['diretora.aur@homolog.nexo', SENHA, 2, false, 'Diretora da Aurora → aluno de outra escola'],
  ['diretora.bv@homolog.nexo', SENHA, 2, true, 'Diretora da Boa Vista → aluna transferida para a escola dela'],
  ['diretora.bv@homolog.nexo', SENHA, 4, false, 'Diretora da Boa Vista → aluno de outra escola'],
  ['gestor.aur@homolog.nexo', SENHA, 4, true, 'Gestor da Aurora → aluno autorizado (nunca transferido)'],
  ['gestor.aur@homolog.nexo', SENHA, 3, true, 'Gestor da Aurora → aluno autorizado (transferido e de volta)'],
  ['gestor.aur@homolog.nexo', SENHA, 2, false, 'Gestor da Aurora → aluna que saiu da escola (não autorizado)'],
  ['gestor.bv@homolog.nexo', SENHA, 2, true, 'Gestor da Boa Vista → aluna transferida para a escola dele'],
  ['gestor.bv@homolog.nexo', SENHA, 1, false, 'Gestor da Boa Vista → aluno de outra escola (não autorizado)'],
  ['secretaria@escola.gov.br', '12345678', 2, true, 'Secretaria → qualquer aluno'],
];
let i = 0;
for (const [email, senha, alunoId, espera, rotulo] of casos) {
  i++;
  const X = await abrir();
  await login(X.page, email, senha);
  await X.page.goto(`${BASE}/#/pdi/alunos/${alunoId}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(3500);
  const tela = (await X.page.locator('main').innerText()).replace(/\s+/g, ' ');
  const abriu = tela.includes(alunos[alunoId].nome) && !tela.includes('Aluno não encontrado');
  const arq = `31-${FASE}-${String(i).padStart(2, '0')}`;
  await foto(X.page, arq);
  const t = await token(email, senha);
  const apiStatus = (await fetch(`${API}/api/pdi-alunos/${alunoId}`, { headers: { authorization: 'Bearer ' + t } })).status;
  const ok = abriu === espera && (espera ? apiStatus === 200 : apiStatus === 403);
  registrar(`DEF17-${FASE}-${String(i).padStart(2, '0')}`, 'PDI perfil do aluno (DEF-17)', `${rotulo}: ${desc(alunoId)}`, espera ? 'perfil abre; API 200' : 'sem acesso na tela; API 403', `tela abriu: ${abriu}${abriu ? '' : ` ("${(tela.match(/Aluno não encontrado|Voltar[^.]{0,20}/) || [tela.slice(0, 40)])[0]}")`}; API ${apiStatus}`, ok ? 'APROVADO' : 'REPROVADO', arq + '.png');
  await X.browser.close();
}

// Professor: perfil redireciona para "Meus PDIs" (comportamento existente) e o aluno dele aparece lá.
{
  const X = await abrir();
  await login(X.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  await X.page.goto(`${BASE}/#/pdi/alunos/3`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const rota = X.page.url().split('#')[1];
  const tela = (await X.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await foto(X.page, `31-${FASE}-professor`);
  registrar(`DEF17-${FASE}-PROF`, 'PDI perfil do aluno (DEF-17)', 'Professor (P04) abre o perfil do aluno dele (Pedro, Inglês 6M2): vai para "Meus PDIs" e o aluno está lá', 'rota /pdi/meus-pdis com Pedro', `rota ${rota}; Pedro na lista: ${tela.includes('Pedro')}`, rota.includes('meus-pdis') && tela.includes('Pedro') ? 'APROVADO' : 'REPROVADO', `31-${FASE}-professor.png`);
  await X.browser.close();
}
await prisma.$disconnect();

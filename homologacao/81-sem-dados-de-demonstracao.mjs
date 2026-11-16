// Dados de demonstração (src/data/mockData.js) removidos (pedido do usuário, 16/11/2026). Percorre TODAS as telas do
// menu de cada perfil (Secretaria, Diretora, Supervisor, Professor) no navegador real: nenhuma tela quebra, nenhum
// erro de console/5xx, nenhum nome falso do protótipo aparece; iniciais no cabeçalho; Escolas sem "Gerenciar
// vínculos"; Turmas com contagem de vínculos REAL. Banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`SEMMOCK-${id}`, 'Sem dados de demonstração', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const FALSOS = ['Helena Duarte', 'Sérgio Batista', 'Roberto Oliveira', 'Maria Silva', 'João Souza', 'Fernanda Costa', 'Carlos Mendes', 'Patrícia Lima', 'Marcos Almeida', 'Juliana Rocha', 'Rafael Nunes', 'Luciana Barbosa', 'Eduardo Martins', 'Renata Araújo', 'Escola Caminhos', 'Escola Modelo'];

const perfis = [
  ['Secretaria', 'secretaria@escola.gov.br', '12345678', 'SE'],
  ['Diretora', 'diretora.aur@homolog.nexo', 'Nexo!Homolog-2026', null],
  ['Supervisor', 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026', null],
  ['Professor', 'p04@homolog.nexo', 'Nexo!Prof04-2026', null],
];
for (const [rotulo, email, senha, iniciaisEsperadas] of perfis) {
  const X = await abrir();
  const p = X.page;
  const respostas5xx = [];
  p.on('response', x => { if (x.status() >= 500) respostas5xx.push(`${x.status()} ${x.url()}`); });
  await login(p, email, senha); await p.waitForTimeout(1500);
  const iniciais = (await p.locator('header').innerText()).match(/\b[A-Z]{2}\b/g) ?? [];
  const links = await p.locator('aside a[href]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')))]);
  const visitadas = [], falsos = [], quebradas = [];
  for (const href of links) {
    await p.goto(BASE + '/' + href.replace(/^\/?/, '')); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(900);
    const texto = await p.locator('body').innerText();
    visitadas.push(href);
    for (const n of FALSOS) if (texto.includes(n)) falsos.push(`${href}: ${n}`);
    if (/Something went wrong|Unexpected Application Error|Cannot read properties/i.test(texto)) quebradas.push(href);
  }
  await foto(p, `81-${rotulo.toLowerCase()}`);
  const erros = X.erros.filter(e => !/Failed to load resource: the server responded with a status of 4\d\d/.test(e));
  r(`1-${rotulo}`, `${rotulo}: todas as telas do menu abrem sem quebrar, sem erro de console nem 5xx, sem nenhum nome falso`, `${links.length} telas; 0 quebradas; 0 erros; 0 nomes falsos`,
    `${visitadas.length} telas; quebradas: ${quebradas.join(', ') || 0}; erros: ${erros.slice(0, 2).join(' | ') || 0}; 5xx: ${respostas5xx.length}; falsos: ${falsos.join(', ') || 0}`,
    quebradas.length === 0 && erros.length === 0 && respostas5xx.length === 0 && falsos.length === 0, `81-${rotulo.toLowerCase()}.png`);
  if (iniciaisEsperadas) r(`2-${rotulo}`, `${rotulo}: o cabeçalho continua com as iniciais`, iniciaisEsperadas, iniciais.join(','), iniciais.includes(iniciaisEsperadas));
  await X.browser.close();
}

// Escolas sem "Gerenciar vínculos"; Turmas com contagem real (6M1 da Aurora tem professor de verdade).
const S = await abrir();
await login(S.page, 'secretaria@escola.gov.br', '12345678');
await S.page.goto(BASE + '/#/escolas'); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(1200);
const botaoVinculos = await S.page.getByRole('button', { name: 'Gerenciar vínculos' }).count();
r('3', 'Escolas: o botão "Gerenciar vínculos" (dados falsos) não existe mais', '0 botões', `${botaoVinculos}`, botaoVinculos === 0);
const aurora = await prisma.escola.findFirst({ where: { nome: 'ZZ-HOMOLOG Escola Aurora' } });
const t6m1 = await prisma.turma.findFirst({ where: { escolaId: aurora.id, nome: '6M1', status: 'ATIVA' } });
const profs = new Set([
  ...(await prisma.professorTurmaDisciplina.findMany({ where: { turmaId: t6m1.id, status: 'ATIVO' }, select: { professorId: true } })).map(v => v.professorId),
  ...(await prisma.professorTurmaAtuacao.findMany({ where: { turmaId: t6m1.id, status: 'ATIVO' }, select: { professorId: true } })).map(v => v.professorId),
]).size;
const alunos = await prisma.alunoPdi.count({ where: { turmaId: t6m1.id, status: 'ATIVO' } });
const aux = await prisma.auxiliarTurma.count({ where: { turmaId: t6m1.id, status: 'ATIVO' } });
await S.page.goto(BASE + '/#/turmas'); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(2000);
const linha = S.page.locator('div.divide-y > div', { has: S.page.getByText('6M1', { exact: true }) }).filter({ hasText: 'Aurora' }).first();
const textoLinha = (await linha.innerText().catch(() => '')).replace(/\n/g, ' | ');
const total = profs + alunos + (aux ? 1 : 0);
r('4', 'Turmas: a contagem de vínculos da 6M1 vem dos dados reais (professores distintos + alunos PDI + auxiliar)', `${total} vínculo(s)`, textoLinha.slice(0, 160), total > 0 ? textoLinha.includes(`${total} vínculo`) : !/vínculo/.test(textoLinha));
await S.browser.close();
await prisma.$disconnect();

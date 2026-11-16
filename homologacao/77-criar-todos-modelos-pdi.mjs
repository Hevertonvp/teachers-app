// "Criar todos os modelos" do PDI (pedido do usuário, 16/11/2026): um clique cria um Modelo PDI para cada disciplina
// sem modelo ativo, com as perguntas padrão; Informática fica de fora (decisão de 15/11/2026). Navegador real,
// banco LOCAL. Apaga os modelos que criou (nunca usados).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`PDILOTE-${id}`, 'PDI: criar todos os modelos', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const inicio = new Date();

const disciplinas = await prisma.disciplina.findMany({ select: { id: true, nome: true } });
const comModelo = new Set((await prisma.modeloPdi.findMany({ where: { status: 'ATIVA' }, select: { disciplinaId: true } })).map(m => m.disciplinaId));
const esperadas = disciplinas.filter(d => !comModelo.has(d.id) && d.nome !== 'Informática').map(d => d.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
const padroes = await prisma.perguntaPdiPadrao.count({ where: { status: 'ATIVA' } });

for (const [nome, vp] of [['celular', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pdi/formulario'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  const botao = p.getByRole('button', { name: 'Criar todos os modelos' });
  if (nome === 'desktop') {
    // Depois do lote (feito no celular), não sobra disciplina para o lote: o botão some.
    r('4', 'Depois de criar, o botão some (só a Informática fica sem modelo)', '0 botões', `${await botao.count()} botão(ões)`, (await botao.count()) === 0);
    await X.browser.close();
    break;
  }
  await botao.first().click(); await p.waitForTimeout(600);
  const m = p.locator('div.fixed.inset-0').last();
  const chips = await m.locator('[data-lote-disciplinas] span').allInnerTexts();
  const fora = await m.getByText(/Fica de fora:/).innerText().catch(() => '');
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, '77-criar-todos-modal');
  r('1', 'Modal lista as disciplinas sem modelo (sem Informática), avisa quem fica de fora e mostra "Criar N modelos"; celular sem rolagem lateral', `${esperadas.join(', ')}; Fica de fora: Informática`,
    `${chips.join(', ')}; ${fora}; botão: ${await m.getByRole('button', { name: /^Criar \d+ modelos$/ }).innerText().catch(() => '?')}; sem rolagem: ${largura}`,
    chips.join(', ') === esperadas.join(', ') && /Informática/.test(fora) && largura, '77-criar-todos-modal.png');
  await m.getByRole('button', { name: `Criar ${esperadas.length} modelos` }).click();
  await p.getByText(`${esperadas.length} modelos criados.`).waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const modalFechou = (await p.locator('div.fixed.inset-0').count()) === 0;
  await foto(p, '77-criar-todos-resultado');
  const criados = await prisma.modeloPdi.findMany({ where: { createdAt: { gte: inicio } }, include: { disciplina: true, _count: { select: { perguntas: true } } } });
  const nomes = criados.map(c => c.disciplina.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  r('2', 'Um clique cria um modelo por disciplina ("PDI - Disciplina"), mostra "N modelos criados." e fecha', `${esperadas.length} modelos: ${esperadas.join(', ')}`, `${criados.length}: ${nomes.join(', ')}; nomes: ${criados.map(c => c.nome).join(', ')}; fechou: ${modalFechou}`,
    nomes.join(', ') === esperadas.join(', ') && criados.every(c => c.nome === `PDI - ${c.disciplina.nome}`) && modalFechou, '77-criar-todos-resultado.png');
  r('3', 'Cada modelo nasce com as perguntas padrão ativas', `${padroes} perguntas cada`, criados.map(c => `${c.disciplina.nome}=${c._count.perguntas}`).join(', '), criados.every(c => c._count.perguntas === padroes));
  await X.browser.close();
}

// Limpeza: os modelos criados agora (nunca usados).
const ids = (await prisma.modeloPdi.findMany({ where: { createdAt: { gte: inicio } }, select: { id: true } })).map(m => m.id);
await prisma.perguntaPdi.deleteMany({ where: { modeloId: { in: ids } } });
await prisma.modeloPdi.deleteMany({ where: { id: { in: ids } } });
console.log('modelos de teste apagados:', ids.length);
await prisma.$disconnect();

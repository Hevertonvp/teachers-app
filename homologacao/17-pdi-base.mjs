// PDI — base montada PELA INTERFACE da Secretaria: perguntas padrão, modelos por disciplina, aplicação da Escola Aurora.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const { browser, page, erros } = await abrir();
const modal = () => page.locator('div.fixed.inset-0');
await login(page, 'secretaria@escola.gov.br', '123456');

// ---- 1. Perguntas padrão (Configurações) ----
await page.goto(BASE + '/#/configuracoes'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
const padroes = [
  { tipo: 'Texto', texto: 'Descreva o desempenho geral do aluno neste trimestre, com exemplos observados em sala.', compartilhada: true },
  { tipo: 'Texto', texto: 'Quais conteúdos da disciplina o aluno ainda não consolidou?', compartilhada: false },
  { tipo: 'Seleção', texto: 'Com que frequência o aluno participa das atividades propostas?', compartilhada: false, opcoes: ['Sempre', 'Às vezes', 'Raramente'] },
];
if ((await prisma.perguntaPdiPadrao.count()) === 0) {
  for (const p of padroes) {
    await page.getByRole('button', { name: '+ Adicionar pergunta padrão' }).click();
    const m = modal();
    await m.getByLabel('Tipo').selectOption({ label: p.tipo });
    await m.locator('textarea').first().fill(p.texto);
    if (p.opcoes) { const ops = m.getByPlaceholder(/Opção \d/); for (let i = 0; i < p.opcoes.length; i++) { if (i >= await ops.count()) await m.getByRole('button', { name: '+ Adicionar opção' }).click(); await m.getByPlaceholder(`Opção ${i + 1}`).fill(p.opcoes[i]); } }
    const chk = m.getByRole('checkbox', { name: /compartilhada entre as disciplinas/i });
    if (await chk.count()) { if (p.compartilhada) await chk.check(); else await chk.uncheck(); }
    await m.getByRole('button', { name: /Salvar|Criar|Adicionar/ }).last().click();
    await page.waitForTimeout(1200);
    if (await modal().count()) { console.log('modal ainda aberto:', (await modal().innerText()).replace(/\s+/g, ' ').slice(0, 300)); await foto(page, '17-padrao-modal-erro'); await page.keyboard.press('Escape'); }
  }
}
const nPad = await prisma.perguntaPdiPadrao.count();
await foto(page, '17-perguntas-padrao');
registrar('PDI-SET-01', 'PDI', 'Secretaria cadastra 3 perguntas padrão pela interface (1 compartilhada, 2 por disciplina)', '3 perguntas padrão', String(nPad), nPad === 3 ? 'APROVADO' : 'REPROVADO', '17-perguntas-padrao.png');

// ---- 2. Modelos por disciplina ----
const disciplinas = ['Matemática', 'Inglês', 'Arte', 'Ensino Religioso', 'Língua Portuguesa', 'Ciências', 'História'];
await page.goto(BASE + '/#/pdi/formulario'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
for (const d of disciplinas) {
  if (await prisma.modeloPdi.count({ where: { disciplina: { nome: d } } })) continue;
  await page.getByRole('button', { name: '+ Novo modelo' }).first().click();
  const m = modal();
  await m.getByLabel('Disciplina').selectOption({ label: d });
  await m.getByRole('button', { name: 'Criar modelo' }).click(); await page.waitForTimeout(1800);
  // volta à listagem se abriu a edição do modelo
  await page.reload(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
}
const modelos = await prisma.modeloPdi.findMany({ include: { disciplina: true, perguntas: true } });
console.log('Modelos:', modelos.map(m => `${m.disciplina.nome}(ativo=${m.ativo ?? m.status},perguntas=${m.perguntas.length})`).join(' | '));
await foto(page, '17-modelos');
registrar('PDI-SET-02', 'PDI', 'Secretaria cria 7 modelos (um por disciplina), cada um nasce com as 3 perguntas padrão', '7 modelos x 3 perguntas', modelos.map(m => `${m.disciplina.nome}:${m.perguntas.length}`).join(', '), modelos.length === 7 && modelos.every(m => m.perguntas.length === 3) ? 'APROVADO' : 'REPROVADO', '17-modelos.png');
console.log('erros', erros);
await browser.close(); await prisma.$disconnect();

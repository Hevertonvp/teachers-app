// Cadastro de professor em páginas (decisão do usuário, 15/11/2026): Dados → Cargo 1 → Cargo 2 (se houver), com
// "Passo X de N", "← Voltar"/"Próximo →", conferência por página, resumo antes de "Cadastrar" e nada salvo antes.
// Navegador real (desktop e celular), banco LOCAL. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`PAGINAS-${id}`, 'Cadastro de professor em páginas', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const escolher = async (sel, texto) => sel.selectOption(await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t).value, texto));
await limparProfessoresDeTeste(['assist-']);

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const m = p.locator('div.fixed.inset-0.z-50').last();
  const email = `assist-pag-${nome}-${TAG}@homolog.nexo`;
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(800);

  // 1. Página 1: só dados; e-mail inválido não avança.
  const passo1 = await m.getByText(/Passo 1 de 2 · Dados/i).count();
  const semCargo = (await m.getByRole('heading', { name: 'Cargo 1' }).count()) === 0;
  await m.locator('input[type=email]').fill('sem-arroba');
  await m.getByRole('button', { name: 'Próximo →' }).click();
  const erroEmail = await m.getByText('Informe um e-mail válido.').isVisible();
  r(`1-${nome}`, `${nome}: página 1 só com dados (sem cargo); e-mail inválido não avança`, 'Passo 1 de 2; sem Cargo 1; erro do e-mail', `passo: ${passo1}; sem cargo: ${semCargo}; erro: ${erroEmail}`, passo1 === 1 && semCargo && erroEmail);

  // 2. Avança para o Cargo 1; sem escola não avança/cadastra.
  await m.locator('input[type=email]').fill(email);
  await m.locator('input:not([type=email]):not([type=date])').first().fill(`Professor Paginas ${nome} ${TAG}`);
  await m.getByRole('button', { name: 'Próximo →' }).click();
  await escolher(m.getByLabel('Escola 1').first(), 'Selecione a escola').catch(() => {});
  const passo2 = await m.getByText(/Passo 2 de 2 · Cargo 1/i).count();
  await m.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  const erroEscola = await m.getByText('Escolha a escola.').isVisible();
  const naoGravou = !(await prisma.pessoa.findUnique({ where: { email } }));
  r(`2-${nome}`, `${nome}: página do Cargo 1; sem escola mostra o erro e não grava nada`, 'Passo 2 de 2; "Escolha a escola."; nada no banco', `passo: ${passo2}; erro: ${erroEscola}; não gravou: ${naoGravou}`, passo2 === 1 && erroEscola && naoGravou);

  // 3. Preenche, volta e avança: nada se perde.
  await escolher(m.getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Aurora');
  await escolher(m.getByLabel('Disciplina 1').first(), 'Redação');
  await m.getByRole('button', { name: 'Redação — 6M1', exact: true }).click();
  await m.getByRole('button', { name: '← Voltar' }).click();
  const emailMantido = await m.locator('input[type=email]').inputValue();
  await m.getByRole('button', { name: 'Próximo →' }).click();
  const turmaMantida = await m.getByRole('button', { name: 'Redação — 6M1', exact: true }).getAttribute('aria-pressed');
  await p.waitForTimeout(1500);
  const naoCadastrouNoProximo = !(await prisma.pessoa.findUnique({ where: { email } })) && (await p.getByText('Senha temporária').count()) === 0;
  r(`3b-${nome}`, `${nome}: "Próximo →" da penúltima página só avança (não cadastra antes do resumo)`, 'nada no banco; sem senha', String(naoCadastrouNoProximo), naoCadastrouNoProximo);
  r(`3-${nome}`, `${nome}: "← Voltar" e "Próximo →" não perdem o que foi preenchido`, 'e-mail e turma marcada mantidos', `e-mail: ${emailMantido === email}; 6M1: ${turmaMantida}`, emailMantido === email && turmaMantida === 'true');

  // 4. Resumo e cadastro.
  const resumo = (await m.locator('[data-resumo]').innerText()).replace(/\n/g, ' | ');
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `74-cadastro-paginas-${nome}`);
  r(`4-${nome}`, `${nome}: última página tem resumo do cargo (escola — disciplina (turmas)); sem rolagem lateral`, 'Cargo 1: ZZ-HOMOLOG Escola Aurora — Redação (6M1)', `${resumo.slice(0, 160)}; sem rolagem: ${largura}`, resumo.includes('Cargo 1: ZZ-HOMOLOG Escola Aurora — Redação (6M1)') && largura, `74-cadastro-paginas-${nome}.png`);
  await p.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 }).catch(async () => { await foto(p, '74-falha'); console.log('TEXTO', (await m.innerText()).slice(0, 600)); throw new Error('sem senha'); });
  const v = await prisma.professorTurmaDisciplina.count({ where: { professor: { email }, status: 'ATIVO' } });
  const cargos = await prisma.cargoProfessor.count({ where: { professor: { email } } });
  r(`5-${nome}`, `${nome}: "Cadastrar" grava professor, 1 cargo e a turma, e mostra a senha`, '1 cargo; 1 turma', `${cargos} cargo; ${v} turma`, cargos === 1 && v === 1);
  await X.browser.close();
  await limparProfessoresDeTeste(['assist-']);
}
await prisma.$disconnect();

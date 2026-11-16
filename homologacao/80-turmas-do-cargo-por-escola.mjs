// Turmas do cargo numa área única por escola (decisão do usuário, 16/11/2026): resumo + "Escolher", abas por etapa,
// linha por ano/nível; lista única para disciplinas e atuações com turma; "Separar por disciplina"; cargo existente
// abre sem mudar nada (separado quando as turmas diferem). Navegador real (computador e celular), banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`TURMASCARGO-${id}`, 'Turmas do cargo por escola', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const escolher = async (sel, t) => sel.selectOption(await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t).value, t));
const vinculosDe = async (email) => {
  const d = await prisma.professorTurmaDisciplina.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, disciplina: true } });
  const a = await prisma.professorTurmaAtuacao.findMany({ where: { professor: { email }, status: 'ATIVO' }, include: { turma: true, atuacao: true } });
  return [...d.map(v => `${v.disciplina.nome}:${v.turma.nome}`), ...a.map(v => `${v.atuacao.nome}:${v.turma.nome}`)].sort().join(', ');
};
await limparProfessoresDeTeste(['assist-tc-']);
await prisma.atuacaoPedagogica.upsert({ where: { nome: 'Biblioteca' }, update: {}, create: { nome: 'Biblioteca' } });

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const email = `assist-tc-${nome}-${TAG}@homolog.nexo`;
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const m = () => p.locator('div.fixed.inset-0.z-50').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(800);
  await m().locator('input[type=email]').fill(email);
  await m().locator('input:not([type=email]):not([type=date])').first().fill(`Turmas Cargo ${nome} ${TAG}`);
  await escolher(m().getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Aurora');
  await escolher(m().getByLabel('Disciplina 1').first(), 'Redação'); await p.waitForTimeout(300);

  // 1. Um item: área aberta sozinha, abas só das etapas da escola, começa no Fundamental.
  const abas = await m().getByRole('tablist', { name: 'Etapas' }).getByRole('tab').allInnerTexts();
  const abaAtual = await m().getByRole('tab', { selected: true }).innerText();
  await m().getByRole('button', { name: 'Redação — 6M1', exact: true }).click();
  r(`1-${nome}`, `${nome}: com uma disciplina a área "Turmas" já abre, com abas só das etapas da escola, começando no Fundamental`, 'Infantil, Fund. II; aba Fund. II',
    `${abas.join(', ')}; aba ${abaAtual}`, abas.join(',') === 'Infantil,Fund. II' && abaAtual.startsWith('Fund. II'));

  // 2. Mais itens: lista única; o item novo herda; Biblioteca não entra.
  await m().getByRole('button', { name: '+ Adicionar disciplina' }).first().click();
  await escolher(m().getByLabel('Disciplina 2').first(), 'Geografia'); await p.waitForTimeout(300);
  await m().getByRole('button', { name: 'Turma 6M2', exact: true }).click();
  await m().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(m().getByLabel('Atuação 1').first(), 'Professor Regente'); await p.waitForTimeout(200);
  await m().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(m().getByLabel('Atuação 2').first(), 'Biblioteca'); await p.waitForTimeout(300);
  const valem = await m().getByText(/^Valem para /).innerText();
  const contagem = await m().getByRole('tab', { selected: true }).innerText();
  await m().getByRole('tab', { name: /^Infantil/ }).click();
  const linhaInfantil = (await m().getByRole('group', { name: 'Turmas de todas as disciplinas' }).innerText()).replace(/\n/g, ' | ');
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `80-cadastro-lista-unica-${nome}`);
  r(`2-${nome}`, `${nome}: com várias disciplinas/atuações, uma lista só ("Valem para…", sem Biblioteca); aba mostra a contagem; Infantil em linha por nível; sem rolagem lateral`,
    'Valem para Redação, Geografia, Professor Regente.; Fund. II (2); linha "Berçário I"',
    `${valem}; ${contagem}; ${linhaInfantil}; sem rolagem: ${largura}`,
    valem === 'Valem para Redação, Geografia, Professor Regente.' && contagem === 'Fund. II (2)' && /Berçário I/.test(linhaInfantil) && largura, `80-cadastro-lista-unica-${nome}.png`);
  await m().getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
  await m().getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(1200);
  const gravado = await vinculosDe(email);
  const esperado = 'Geografia:6M1, Geografia:6M2, Professor Regente:6M1, Professor Regente:6M2, Redação:6M1, Redação:6M2';
  r(`3-${nome}`, `${nome}: "Cadastrar" grava as turmas para cada disciplina e atuação com turma (Geografia e Regente herdaram a 6M1); nada para Biblioteca`, esperado, gravado, gravado === esperado);

  // 4. Cargos e escolas: abre fechado com o resumo, sem mudar nada; separar e tirar a 6M2 só de Geografia.
  const linha = () => p.getByText(email, { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Cargos e escolas"]][1]');
  await p.getByRole('searchbox', { name: /Buscar professores/i }).fill(email); await p.waitForTimeout(400);
  await linha().getByRole('button', { name: 'Cargos e escolas' }).click(); await p.waitForTimeout(1500);
  await m().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const resumo = await m().locator('[data-resumo-turmas]').allInnerTexts();
  const fechado = (await m().getByRole('tab').count()) === 0;
  await m().getByRole('button', { name: 'Escolher turmas', exact: true }).click(); await p.waitForTimeout(200);
  await m().getByRole('button', { name: 'Separar por disciplina' }).click(); await p.waitForTimeout(200);
  const linhasSeparadas = await m().locator('[data-resumo-turmas]').count();
  await m().getByRole('button', { name: 'Escolher turmas de Geografia', exact: true }).click(); await p.waitForTimeout(200);
  await m().getByRole('button', { name: 'Geografia — 6M2', exact: true }).click();
  await foto(p, `80-separado-${nome}`);
  r(`4-${nome}`, `${nome}: "Alterar" abre a área fechada com o resumo; "Separar por disciplina" mostra uma linha por item`, '["6M1, 6M2"]; fechada; 3 linhas',
    `${JSON.stringify(resumo)}; fechada: ${fechado}; ${linhasSeparadas} linhas`, JSON.stringify(resumo) === '["6M1, 6M2"]' && fechado && linhasSeparadas === 3, `80-separado-${nome}.png`);
  await m().getByRole('button', { name: 'Salvar cargo' }).click(); await p.waitForTimeout(2500);
  const depois = await vinculosDe(email);
  r(`5-${nome}`, `${nome}: salvar separado tira a 6M2 só de Geografia`, 'Geografia:6M1, Professor Regente:6M1, Professor Regente:6M2, Redação:6M1, Redação:6M2', depois, depois === 'Geografia:6M1, Professor Regente:6M1, Professor Regente:6M2, Redação:6M1, Redação:6M2');

  // 6. Reabrir: como as turmas diferem, abre SEPARADO e sem mudar nada; cancelar não grava.
  await m().getByRole('button', { name: 'Alterar' }).click(); await p.waitForTimeout(500);
  const reaberto = await m().locator('[data-turmas-escola]').innerText();
  await m().getByRole('button', { name: 'Cancelar' }).first().click(); await p.waitForTimeout(500);
  const igual = (await vinculosDe(email)) === depois;
  r(`6-${nome}`, `${nome}: cargo com turmas diferentes reabre separado, mostrando cada item; cancelar não grava`, 'Geografia: 6M1; Redação: 6M1, 6M2; nada muda',
    `${reaberto.replace(/\n/g, ' | ').slice(0, 160)}; igual: ${igual}`, /Geografia:\s*\|?\s*6M1/.test(reaberto.replace(/\n/g, ' | ')) && /Redação:\s*\|?\s*6M1, 6M2/.test(reaberto.replace(/\n/g, ' | ')) && igual);
  await X.browser.close();
}

// 7. Escola só com atuação sem turma: linha cinza, sem área de turmas.
{
  const X = await abrir();
  const p = X.page;
  const m = () => p.locator('div.fixed.inset-0.z-50').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(800);
  await escolher(m().getByLabel('Escola 1').first(), 'ZZ-HOMOLOG Escola Aurora');
  await m().getByRole('button', { name: 'Remover disciplina' }).first().click();
  await m().getByRole('button', { name: '+ Adicionar atuação' }).click();
  await escolher(m().getByLabel('Atuação 1').first(), 'Biblioteca'); await p.waitForTimeout(300);
  const cinza = await m().locator('[data-sem-turma]').innerText().catch(() => '');
  const area = await m().locator('[data-turmas-escola]').count();
  r('7', 'Escola só com Biblioteca: "Sem turmas para Biblioteca." e nenhuma área de turmas', 'linha cinza; 0 áreas', `"${cinza}"; ${area} área(s)`, cinza === 'Sem turmas para Biblioteca.' && area === 0);
  await X.browser.close();
}
await limparProfessoresDeTeste(['assist-tc-']);
await prisma.$disconnect();

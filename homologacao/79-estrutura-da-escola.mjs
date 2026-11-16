// Cadastro de escola com ETAPAS e níveis (decisão do usuário, 16/11/2026). Navegador real (computador e celular),
// banco LOCAL. Confere também que NENHUMA turma existente muda (nome, chave, nível) — foto antes/depois.
// Limpa o que cria (escola e turmas de teste).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`ESTRUTURA-${id}`, 'Escola: etapas e níveis', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const token = async () => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secretaria@escola.gov.br', senha: '12345678' }) })).json()).token;
const api = async (t, method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };
const fotoTurmas = async () => JSON.stringify((await prisma.turma.findMany({ where: { NOT: { escola: { nome: { startsWith: 'ZZ-ESTR' } } } }, select: { id: true, nome: true, identidadeChave: true, nivel: true, segmento: true, nivelLocalId: true, status: true }, orderBy: { id: 'asc' } })));
const fotoEscolas = async () => JSON.stringify((await prisma.escola.findMany({ where: { NOT: { nome: { startsWith: 'ZZ-ESTR' } } }, select: { id: true, nome: true, etapasOferecidas: true, anosFundamental: true }, orderBy: { id: 'asc' } })));
async function limpar() {
  const escolas = (await prisma.escola.findMany({ where: { nome: { startsWith: 'ZZ-ESTR' } }, select: { id: true } })).map(e => e.id);
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escolaNivelInfantil.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}
await limpar();
const antesTurmas = await fotoTurmas();
const antesEscolas = await fotoEscolas();

for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const NOME = `ZZ-ESTR Escola ${nome} ${TAG}`;
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const modal = () => p.locator('div.fixed.inset-0').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/escolas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: '+ Nova escola' }).click(); await p.waitForTimeout(600);
  await modal().getByLabel('Nome da escola').fill(NOME);
  const inicio = await modal().locator('[data-etapa]').count();
  await modal().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(500);
  const semEtapa = await modal().getByText('Marque ao menos uma etapa.').isVisible();
  r(`1-${nome}`, `${nome}: escola nova mostra só "Etapas oferecidas" (nenhum quadro de nível) e não salva sem etapa`, '0 quadros; "Marque ao menos uma etapa."', `${inicio} quadros; aviso: ${semEtapa}`, inicio === 0 && semEtapa);

  const etapas = modal().getByRole('group', { name: 'Etapas oferecidas' });
  await etapas.getByRole('button', { name: 'Educação Infantil' }).click();
  const niveisMarcados = await modal().getByRole('group', { name: 'Níveis da Educação Infantil' }).getByRole('button', { pressed: true }).count();
  const niveisOpcoes = await modal().getByRole('group', { name: 'Níveis da Educação Infantil' }).getByRole('button').allInnerTexts();
  await modal().getByRole('button', { name: 'Maternal 2', exact: true }).click();
  await modal().getByRole('button', { name: 'Maternal 3', exact: true }).click();
  await etapas.getByRole('button', { name: 'Fundamental I', exact: true }).click();
  const anosMarcados = await modal().getByRole('group', { name: 'Anos do Fundamental I' }).getByRole('button', { pressed: true }).count();
  await modal().getByRole('button', { name: '5º ano' }).click();
  const resumo = await modal().locator('[data-resumo-estrutura]').innerText();
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `79-nova-escola-${nome}`);
  r(`2-${nome}`, `${nome}: níveis da Infantil começam desmarcados; anos do Fund. I começam marcados; resumo claro; sem rolagem lateral`, `0 níveis marcados; 5 anos marcados; "Infantil: Maternal 2, Maternal 3 · Fund. I: 1º ao 4º ano"`,
    `${niveisMarcados} níveis (${niveisOpcoes.join(', ')}); ${anosMarcados} anos; "${resumo}"; sem rolagem: ${largura}`,
    niveisMarcados === 0 && anosMarcados === 5 && resumo === 'Infantil: Maternal 2, Maternal 3 · Fund. I: 1º ao 4º ano' && largura, `79-nova-escola-${nome}.png`);
  await modal().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1500);
  const escola = await prisma.escola.findFirst({ where: { nome: NOME }, include: { niveisInfantil: { include: { nivel: true } } } });
  const gravado = escola ? `${escola.etapasOferecidas.join(',')} | ${escola.anosFundamental.join(',')} | ${escola.niveisInfantil.map(n => n.nivel.nome).sort().join(',')}` : 'não gravou';
  r(`3-${nome}`, `${nome}: salva etapas, anos e níveis`, 'EDUCACAO_INFANTIL,FUNDAMENTAL_I | 1,2,3,4 | Maternal 2,Maternal 3', gravado, gravado === 'EDUCACAO_INFANTIL,FUNDAMENTAL_I | 1,2,3,4 | Maternal 2,Maternal 3');
  await p.getByLabel('Buscar escola').fill(NOME); await p.waitForTimeout(300);
  const linha = (await p.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ');
  r(`4-${nome}`, `${nome}: a lista mostra as etapas da escola`, '"Infantil · Fund. I"', linha.slice(0, 120), linha.includes('Infantil · Fund. I'));
  await X.browser.close();

  // Turmas: só o que a escola oferece; Infantil pelo nível da escola.
  const T = await abrir({ viewport: vp });
  const q = T.page;
  const mt = () => q.locator('div.fixed.inset-0').last();
  await login(q, 'secretaria@escola.gov.br', '12345678');
  await q.goto(BASE + '/#/turmas'); await q.waitForLoadState('networkidle'); await q.waitForTimeout(1500);
  await q.getByRole('button', { name: '+ Nova turma' }).first().click(); await q.waitForTimeout(600);
  const selEscola = mt().getByLabel('Escola');
  await selEscola.selectOption(String(escola.id)); await q.waitForTimeout(300);
  await mt().getByLabel('Etapa').selectOption('fundamental'); await q.waitForTimeout(200);
  const anosTurma = await mt().getByLabel('Ano/série').evaluate(s => [...s.options].map(o => o.text));
  await mt().getByLabel('Etapa').selectOption('educacao_infantil'); await q.waitForTimeout(200);
  const niveisTurma = await mt().getByLabel('Nível').evaluate(s => [...s.options].map(o => o.text));
  const temSegmento = await mt().getByLabel('Segmento').count();
  await mt().getByLabel('Nível').selectOption({ label: 'Maternal 3' });
  await mt().getByLabel('Turma (A, B, C…)').selectOption({ label: 'B' });
  const larguraT = await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(q, `79-nova-turma-infantil-${nome}`);
  r(`5-${nome}`, `${nome}: Nova turma oferece só os anos e níveis da escola (sem "Segmento"); sem rolagem lateral`, '1º–4º ano; Maternal 2, Maternal 3; sem Segmento',
    `${anosTurma.join(', ')}; ${niveisTurma.join(', ')}; Segmento: ${temSegmento}; sem rolagem: ${larguraT}`,
    anosTurma.join(',') === '1º ano,2º ano,3º ano,4º ano' && niveisTurma.join(',') === 'Maternal 2,Maternal 3' && temSegmento === 0 && larguraT, `79-nova-turma-infantil-${nome}.png`);
  await mt().getByRole('button', { name: 'Salvar' }).click(); await q.waitForTimeout(1500);
  const turma = await prisma.turma.findFirst({ where: { escolaId: escola.id, etapa: 'EDUCACAO_INFANTIL' }, include: { nivelLocal: true } });
  r(`6-${nome}`, `${nome}: a turma fica ligada ao nível da escola, com nome "Maternal 3 B — Manhã" e faixa Creche`, 'Maternal 3 B — Manhã; nível Maternal 3; CRECHE; nível antigo vazio',
    turma ? `${turma.nome}; nível ${turma.nivelLocal?.nome}; ${turma.segmento}; antigo ${turma.nivel}` : 'não gravou',
    turma?.nome === 'Maternal 3 B — Manhã' && turma.nivelLocal?.nome === 'Maternal 3' && turma.segmento === 'CRECHE' && turma.nivel === null);
  await T.browser.close();

  // Tirar da escola o nível que tem turma: recusado, nada muda.
  const t = await token();
  const tirar = await api(t, 'PUT', `/api/escolas/${escola.id}`, { nome: NOME, etapasOferecidas: ['EDUCACAO_INFANTIL', 'FUNDAMENTAL_I'], anosFundamental: [1, 2, 3, 4], niveisInfantilIds: escola.niveisInfantil.filter(n => n.nivel.nome !== 'Maternal 3').map(n => n.nivelId) });
  const tirarInfantil = await api(t, 'PUT', `/api/escolas/${escola.id}`, { nome: NOME, etapasOferecidas: ['FUNDAMENTAL_I'], anosFundamental: [1, 2, 3, 4] });
  const quintoAno = await api(t, 'POST', '/api/turmas', { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 5, turno: 'MANHA', identificador: 1 });
  const nivelAntigo = await api(t, 'POST', '/api/turmas', { escolaId: escola.id, anoLetivo: 2026, etapa: 'EDUCACAO_INFANTIL', segmento: 'PRE_ESCOLA', nivel: 'PRE_I', turno: 'MANHA', identificador: 1 });
  const depoisEscola = await prisma.escola.findUnique({ where: { id: escola.id }, include: { niveisInfantil: true } });
  r(`7-${nome}`, `${nome}: não deixa tirar nível/etapa com turma ativa nem criar turma fora do que a escola oferece`, '409, 409, 400, 400; escola sem mudança',
    `${tirar.status} "${tirar.json?.message?.slice(0, 70)}", ${tirarInfantil.status}, ${quintoAno.status}, ${nivelAntigo.status}; níveis ${depoisEscola.niveisInfantil.length}, etapas ${depoisEscola.etapasOferecidas.join(',')}`,
    tirar.status === 409 && tirarInfantil.status === 409 && quintoAno.status === 400 && nivelAntigo.status === 400 && depoisEscola.niveisInfantil.length === 2 && depoisEscola.etapasOferecidas.length === 2);
}

// Escola antiga ("não informada"): "Sugerir pelas turmas" só marca na tela; cancelar não grava. Nova turma na
// escola antiga continua com o formulário de sempre (Segmento e Nível antigos).
const Y = await abrir();
const p = Y.page;
const modal = () => p.locator('div.fixed.inset-0').last();
await login(p, 'secretaria@escola.gov.br', '12345678');
await p.goto(BASE + '/#/escolas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
await p.getByLabel('Buscar escola').fill('ZZ-HOMOLOG Escola Aurora'); await p.waitForTimeout(300);
await p.locator('tbody tr').first().getByRole('button', { name: 'Editar' }).click(); await p.waitForTimeout(600);
const sugerir = modal().getByRole('button', { name: 'Sugerir pelas turmas' });
const temSugerir = await sugerir.isVisible();
await sugerir.click(); await p.waitForTimeout(300);
const sugerido = await modal().locator('[data-resumo-estrutura]').innerText().catch(() => '');
await foto(p, '79-sugerir-pelas-turmas');
await modal().getByRole('button', { name: 'Cancelar' }).click(); await p.waitForTimeout(500);
const aurora = await prisma.escola.findFirst({ where: { nome: 'ZZ-HOMOLOG Escola Aurora' } });
r('8', 'Escola antiga: "Sugerir pelas turmas" marca na tela pelo que as turmas indicam; "Cancelar" não grava nada', 'botão visível; resumo com as etapas; escola continua sem etapas',
  `botão: ${temSugerir}; "${sugerido}"; gravado: ${aurora.etapasOferecidas.join(',') || '(nada)'}`, temSugerir && sugerido.length > 0 && aurora.etapasOferecidas.length === 0, '79-sugerir-pelas-turmas.png');
await p.goto(BASE + '/#/turmas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
await p.getByRole('button', { name: '+ Nova turma' }).first().click(); await p.waitForTimeout(500);
await modal().getByLabel('Escola').selectOption(String(aurora.id)); await p.waitForTimeout(200);
await modal().getByLabel('Etapa').selectOption('educacao_infantil'); await p.waitForTimeout(200);
const antigo = (await modal().getByLabel('Segmento').count()) === 1 && (await modal().getByLabel('Nível').evaluate(s => [...s.options].map(o => o.text).join(',')));
r('9', 'Escola antiga: Nova turma continua com o formulário de sempre (Segmento + níveis antigos)', 'Segmento; Berçário I, Berçário II…', String(antigo), typeof antigo === 'string' && antigo.startsWith('Berçário I,Berçário II'));
await Y.browser.close();

await limpar();
const depoisTurmas = await fotoTurmas();
const depoisEscolas = await fotoEscolas();
r('10', 'Nenhuma turma nem escola existente mudou (nome, chave, nível, etapas) — foto antes e depois', 'iguais', `turmas iguais: ${antesTurmas === depoisTurmas}; escolas iguais: ${antesEscolas === depoisEscolas}`, antesTurmas === depoisTurmas && antesEscolas === depoisEscolas);
await prisma.$disconnect();

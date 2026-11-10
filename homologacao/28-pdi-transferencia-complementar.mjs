// PDI — testes complementares da transferência (Decisão 9):
//  G1/G2 Gestor e Diretora da NOVA escola (Boa Vista) acessam o histórico da Marina;
//  G3    Gestor da escola ANTERIOR (Aurora) tenta acessar a Marina (já transferida);
//  G4    Secretaria lê fichas antigas pelo fluxo de Correções (caminho de leitura existente?);
//  G5    Secretaria devolve ficha antiga ao professor: o professor consegue corrigir?
//  G6    Pedro volta para a escola de origem: fichas antigas "revivem"? ficha da Boa Vista some?
// Contas de Gestor/Diretora criadas pela API da Secretaria; senha definida no banco LOCAL (declarado).
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { createRequire } from 'node:module';
const bcrypt = createRequire(new URL('../backend/package.json', import.meta.url))('bcryptjs');

const API = 'http://localhost:3340';
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const txt = async (page) => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const MARINA = 2, PEDRO = 3, INGLES = 9, AUR_6M2 = 2;
const SENHA = 'Nexo!Homolog-2026';
const tSec = await token('secretaria@escola.gov.br', '12345678');

// ---------- Preparação: contas ----------
const contas = [['GESTOR', 'gestores', 'gestor.bv@homolog.nexo', [2]], ['DIRETORA', 'diretoras', 'diretora.bv@homolog.nexo', [2]], ['GESTOR', 'gestores', 'gestor.aur@homolog.nexo', [1]]];
for (const [, caminho, email, escolaIds] of contas) {
  if (!(await prisma.pessoa.findUnique({ where: { email } }))) {
    const r = await api(tSec, 'POST', `/api/pessoas/${caminho}`, { nome: email.split('@')[0], email, escolaIds });
    console.log('criar', email, r.status);
  }
  await prisma.pessoa.update({ where: { email }, data: { senhaHash: await bcrypt.hash(SENHA, 10), senhaTemporaria: false } });
}

const fichaMarIngles = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: 1, alunoId: MARINA, disciplinaId: INGLES }, include: { respostas: true } });
const trechoMar = 'Conteúdo ainda não consolidado em Inglês';

// ---------- G1/G2: nova escola ----------
for (const [id, quem, email] of [['PDI-TRF-G1', 'Gestor da Boa Vista (nova escola)', 'gestor.bv@homolog.nexo'], ['PDI-TRF-G2', 'Diretora da Boa Vista (nova escola)', 'diretora.bv@homolog.nexo']]) {
  const X = await abrir();
  await login(X.page, email, SENHA);
  await X.page.goto(`${BASE}/#/pdi/alunos/${MARINA}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  const perfil = await txt(X.page);
  await X.page.goto(`${BASE}/#/pdi/alunos/${MARINA}/ficha-anual`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2200);
  const anual = await txt(X.page);
  const item = X.page.locator('main').getByText('Inglês', { exact: true }).first();
  if (await item.count()) { await item.click().catch(() => {}); await X.page.waitForTimeout(1800); }
  const depois = await txt(X.page);
  const arq = `28-${id}`;
  await foto(X.page, arq);
  const t = await token(email, SENHA);
  const g = await api(t, 'GET', `/api/pdi-fichas/1/${MARINA}/${INGLES}`);
  registrar(id, 'PDI transferência', `${quem} acessa o histórico PDI da Marina feito na Aurora`, 'registrar (regra de leitura a definir)', `perfil aberto: ${perfil.includes('Marina')}; Ficha Anual lista Aurora: ${anual.includes('Aurora')}; conteúdo legível ao clicar: ${depois.includes(trechoMar)}; mensagem: ${(depois.match(/Esta aplicação não pertence[^.]*/) || ['—'])[0]}; API ficha antiga ${g.status}`, 'OBSERVAÇÃO (regra não especificada)', arq + '.png');
  await X.browser.close();
}

// ---------- G3: escola anterior ----------
{
  const X = await abrir();
  await login(X.page, 'gestor.aur@homolog.nexo', SENHA);
  await X.page.goto(`${BASE}/#/pdi/alunos/${MARINA}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  const perfil = await txt(X.page);
  await foto(X.page, '28-PDI-TRF-G3');
  const t = await token('gestor.aur@homolog.nexo', SENHA);
  const a = await api(t, 'GET', `/api/pdi-alunos/${MARINA}`);
  const f = await api(t, 'GET', `/api/pdi-fichas/1/${MARINA}/${INGLES}`);
  registrar('PDI-TRF-G3', 'PDI transferência', 'Gestor da Aurora (escola anterior) tenta ver a Marina e a ficha que a própria escola produziu', 'registrar (regra a definir)', `tela mostra a aluna: ${perfil.includes('Marina')}; API aluno ${a.status}; API ficha ${f.status}`, 'OBSERVAÇÃO (regra não especificada)', '28-PDI-TRF-G3.png');
  await X.browser.close();
}

// ---------- G4: Secretaria pelas Correções ----------
{
  const X = await abrir();
  await login(X.page, 'secretaria@escola.gov.br', '12345678');
  await X.page.goto(`${BASE}/#/correcoes/pdi/${fichaMarIngles.id}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
  const tela = await txt(X.page);
  await foto(X.page, '28-PDI-TRF-G4');
  const lista = await api(tSec, 'GET', `/api/correcoes-pdi?alunoId=${MARINA}`);
  const det = await api(tSec, 'GET', `/api/correcoes-pdi/${fichaMarIngles.id}`);
  registrar('PDI-TRF-G4', 'PDI transferência', 'Secretaria lê a ficha CONCLUÍDA da Marina (Aurora) pelo fluxo de Correções', 'registrar (caminho de leitura existente?)', `lista de correções traz fichas da Marina: ${Array.isArray(lista.json) ? lista.json.length : JSON.stringify(lista.json).slice(0, 60)}; detalhe API ${det.status}; conteúdo na tela: ${tela.includes(trechoMar)}`, 'OBSERVAÇÃO (regra não especificada)', '28-PDI-TRF-G4.png');
  await X.browser.close();
}

// ---------- G5: devolução de ficha antiga ao professor ----------
{
  const d = await api(tSec, 'POST', `/api/correcoes-pdi/${fichaMarIngles.id}/devolver`, { observacao: 'Teste homologação: revisar Inglês (aluna já transferida).' });
  const tP04 = await token('p04@homolog.nexo', 'Nexo!Prof04-2026');
  const g = await api(tP04, 'GET', `/api/pdi-fichas/1/${MARINA}/${INGLES}`);
  const p = await api(tP04, 'PUT', `/api/pdi-fichas/${fichaMarIngles.id}/respostas`, { respostas: fichaMarIngles.respostas.map(x => ({ aplicacaoPerguntaId: x.aplicacaoPerguntaId, valor: x.valor })) });
  const X = await abrir();
  await login(X.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  await X.page.goto(`${BASE}/#/pdi/meus-pdis`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2000);
  const lista = await txt(X.page);
  await foto(X.page, '28-PDI-TRF-G5');
  registrar('PDI-TRF-G5', 'PDI transferência', 'Secretaria devolve ao professor uma ficha concluída de aluna já transferida: a professora consegue corrigir?', 'professora consegue atender a devolução', `devolver ${d.status}; P04 lê ficha ${g.status}; P04 grava ${p.status} ${JSON.stringify(p.json).slice(0, 70)}; aviso de correção na lista: ${/corre|devolvid/i.test(lista)}`, d.status === 201 && g.status !== 200 ? 'REPROVADO' : 'OBSERVAÇÃO (regra não especificada)', '28-PDI-TRF-G5.png', 'Devolução cria prazo de 3 dias para quem não consegue mais abrir a ficha.');
  await X.browser.close();
}

// ---------- G6: Pedro volta para a escola de origem ----------
{
  const indAntes = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  await S.page.goto(`${BASE}/#/pdi/alunos/${PEDRO}`); await S.page.waitForLoadState('networkidle'); await S.page.waitForTimeout(1500);
  await S.page.getByRole('button', { name: 'Editar aluno' }).click(); await S.page.waitForTimeout(600);
  const m = S.page.locator('div.fixed.inset-0');
  await m.locator('select').nth(0).selectOption('1'); await S.page.waitForTimeout(300);
  await m.locator('select').nth(1).selectOption(String(AUR_6M2));
  await m.getByRole('button', { name: 'Salvar' }).click(); await S.page.waitForTimeout(2200);
  await S.browser.close();
  const aluno = await prisma.alunoPdi.findUnique({ where: { id: PEDRO } });
  const tP04 = await token('p04@homolog.nexo', 'Nexo!Prof04-2026');
  const velha = await api(tP04, 'GET', `/api/pdi-fichas/1/${PEDRO}/${INGLES}`);
  const fichaBV = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: 2, alunoId: PEDRO, disciplinaId: INGLES } });
  const nova = await api(tP04, 'GET', `/api/pdi-fichas/2/${PEDRO}/${INGLES}`);
  const X = await abrir();
  await login(X.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  await X.page.goto(`${BASE}/#/pdi/aluno/1/${PEDRO}`); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2200);
  const tas = X.page.locator('main textarea');
  const n = await tas.count();
  const vals = []; for (let i = 0; i < n; i++) vals.push(await tas.nth(i).inputValue());
  const habil = n ? !(await tas.nth(0).isDisabled()) : false;
  await foto(X.page, '28-PDI-TRF-G6');
  await X.browser.close();
  const indDepois = (await api(tSec, 'GET', '/api/pdi-aplicacoes/indicadores')).json;
  const fmt = (l, id) => { const e = l.find(x => x.escolaId === id); return `${e.totalEsperado}/${e.concluidas}/${e.emAndamento}`; };
  registrar('PDI-TRF-G6', 'PDI transferência', 'Pedro volta da Boa Vista para a Aurora (6M2): a ficha antiga da Aurora volta a ficar acessível e editável? a da Boa Vista some?', 'registrar', `turma ${aluno.turmaId}; ficha Aurora GET ${velha.status}, texto da Aurora na tela: ${vals.some(v => v.includes('Aurora'))}, editável: ${habil}; ficha Boa Vista (id ${fichaBV?.id}) GET ${nova.status}; indicadores esp/concl/and Aurora ${fmt(indAntes, 1)} → ${fmt(indDepois, 1)}, Boa Vista ${fmt(indAntes, 2)} → ${fmt(indDepois, 2)}`, 'OBSERVAÇÃO (regra não especificada)', '28-PDI-TRF-G6.png');
}
await prisma.$disconnect();

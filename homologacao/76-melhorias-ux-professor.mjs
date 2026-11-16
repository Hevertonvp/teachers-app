// Melhorias de UX do teste "como usuário" (pedido do usuário, 16/11/2026). Navegador real, banco LOCAL.
// Secretaria no computador, professor no celular (390 px). Limpa o que cria.
//  1. Cadastro: turmas da Educação Infantil numa linha própria.        5. Notificação "Correção pendente no Formulário 1/3".
//  2. Início do professor: bloco do Formulário 1/3 com "Preencher".    6. Tela de correção: um selo, sem prazo do ciclo, sem "Salvar progresso".
//  3. Concluir com semanas vazias: atalhos "Falta preencher".          7. Caixa de notificações dentro da tela no celular.
//  4. Etapas com número e alvo grande.                                 8. Busca por nome/e-mail.  9. Sobreposição de ciclo: mensagem curta.
import { abrir, login, foto, preencherCadastroProfessor, marcarTurma, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`UXPROF-${id}`, 'Melhorias de UX (teste como usuário)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
const email = `assist-ux-${TAG}@homolog.nexo`;
const NOME = `Professor UX ${TAG}`;
const SENHA = 'Senha1234';

async function limpar() {
  const ids = (await prisma.pessoa.findMany({ where: { email: { startsWith: 'assist-ux-' } }, select: { id: true } })).map(p => p.id);
  if (ids.length) {
    const conversas = (await prisma.participanteConversa.findMany({ where: { pessoaId: { in: ids } }, select: { conversaId: true } })).map(c => c.conversaId);
    await prisma.notificacao.deleteMany({ where: { destinatarioId: { in: ids } } });
    await prisma.correcaoEntregaUmTerco.updateMany({ where: { conversaId: { in: conversas } }, data: { conversaId: null } });
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversas } } });
    await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: conversas } } });
    await prisma.conversaMensagem.deleteMany({ where: { id: { in: conversas } } });
  }
  await limparProfessoresDeTeste(['assist-ux-']);
}
await limpar();

// --- Secretaria: cadastro (computador) ---
const S = await abrir();
let p = S.page;
const modal = () => p.locator('div.fixed.inset-0.z-50').last();
await login(p, 'secretaria@escola.gov.br', '12345678');
await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(1000);
await preencherCadastroProfessor(modal(), { email, nome: NOME, escola: 'ZZ-HOMOLOG Escola Aurora', disciplina: 'Literatura', enviar: false });
// 16/11/2026: turmas da Infantil numa aba própria ("Infantil"), separadas das do Fundamental.
const grupoLit = modal().getByRole('group', { name: 'Turmas de Literatura' });
const grupoFund = (await grupoLit.innerText()).replace(/Infantil|Fund. II/g, '');
await grupoLit.getByRole('tab', { name: /^Infantil/ }).click();
const grupoInf = await grupoLit.innerText();
await grupoLit.getByRole('tab', { name: /^Fund. II/ }).click();
await foto(p, '76-cadastro-infantil-separada');
r('1', 'Cadastro: turmas da Educação Infantil numa linha própria (não misturadas com 6M1…)', 'Berçário só no grupo "Educação Infantil"', `fundamental: ${grupoFund.replace(/\n/g, ' ')} | infantil: ${grupoInf.replace(/\n/g, ' ')}`,
  !/Berçário/.test(grupoFund) && /Berçário/.test(grupoInf) && /6M1/.test(grupoFund), '76-cadastro-infantil-separada.png');
await marcarTurma(modal(), 'Literatura — 6M1');
await modal().getByRole('button', { name: 'Cadastrar', exact: true }).click();
await p.getByText('Senha temporária').waitFor({ timeout: 15000 });
const senhaTemp = (await modal().innerText()).match(/SENHA TEMPORÁRIA\s+(\S+)/i)?.[1];
await modal().getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(1200);

// 8. Busca por nome/e-mail.
await p.getByRole('searchbox', { name: /Buscar professores/i }).fill(`ux ${TAG}`); await p.waitForTimeout(400);
const linhas = await p.locator('tbody tr').count();
const achou = await p.getByText(email, { exact: true }).isVisible();
await p.getByRole('searchbox', { name: /Buscar professores/i }).fill('zzz-ninguem'); await p.waitForTimeout(300);
const vazio = await p.getByText('Ninguém encontrado.').isVisible();
r('8', 'Gestão de Pessoas: busca por nome/e-mail (sem acento/maiúscula) acha o professor; termo sem resultado mostra "Ninguém encontrado."', '1 linha; achou; vazio', `${linhas} linha(s); achou: ${achou}; vazio: ${vazio}`, linhas === 1 && achou && vazio);

// 9. Sobreposição: mensagem curta.
await p.goto(BASE + '/#/formulario-um-terco'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
await p.getByRole('button', { name: '+ Novo ciclo' }).first().click(); await p.waitForTimeout(600);
const mc = p.locator('div.fixed.inset-0').last();
await mc.getByLabel('Abertura', { exact: true }).fill('2026-11-16');
await mc.getByLabel('Prazo de entrega', { exact: true }).fill('2026-12-05');
await mc.getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1500);
const msgSobre = await mc.locator('.text-red-800').first().innerText().catch(() => '');
r('9', 'Novo ciclo sobreposto: mensagem curta, sem explicar a regra', '"As datas se sobrepõem ao Formulário 1/3 de 02/11 a 20/11 (todas as escolas)."', msgSobre, msgSobre === 'As datas se sobrepõem ao Formulário 1/3 de 02/11 a 20/11 (todas as escolas).');
await mc.getByRole('button', { name: 'Cancelar' }).click();
await S.browser.close();

// --- Professor (celular) ---
const P = await abrir({ viewport: { width: 390, height: 844 } });
p = P.page;
await p.goto(BASE + '/#/login'); await p.waitForLoadState('networkidle');
await p.locator('input[type=email]').fill(email); await p.locator('input[type=password]').first().fill(senhaTemp);
await p.getByRole('button', { name: /entrar/i }).click(); await p.waitForTimeout(2000);
const pw = p.locator('input[type=password]'); await pw.nth(0).fill(SENHA); await pw.nth(1).fill(SENHA);
await p.getByRole('button', { name: 'Salvar nova senha' }).click(); await p.waitForTimeout(2500);
const bloco = p.locator('[data-folha-inicio]').first();
const textoBloco = (await bloco.innerText().catch(() => '')).replace(/\n/g, ' | ');
const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
await foto(p, '76-inicio-professor');
r('2', 'Início do professor (celular): bloco "Formulário 1/3" com a folha pendente e "Preencher"; sem rolagem lateral', 'Não iniciado; Aurora — Literatura; prazo; Preencher', `${textoBloco}; sem rolagem: ${largura}`,
  /Não iniciado/.test(textoBloco) && /Literatura/.test(textoBloco) && /prazo 20\/11\/2026/.test(textoBloco) && /Preencher/.test(textoBloco) && largura, '76-inicio-professor.png');

// 3 e 4. Preencher pelo início; ir até o fim sem escrever e tocar "Concluir".
await bloco.getByRole('button', { name: 'Preencher' }).click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
const abas = p.getByRole('tablist', { name: 'Semanas' }).getByRole('tab');
const alturas = await abas.evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
const numeros = await abas.allInnerTexts();
r('4', 'Etapas mostram o número da semana e têm alvo de toque grande (≥ 36 px)', '1,2,3,4; altura ≥ 36', `${numeros.join(',')}; alturas ${alturas.join(',')}`, numeros.join(',') === '1,2,3,4' && alturas.every(h => h >= 36));
await p.locator('main textarea').fill('Leitura de contos.'); await p.waitForTimeout(300);
await abas.nth(3).click(); await p.waitForTimeout(500);
await p.locator('main').getByRole('button', { name: 'Concluir' }).click(); await p.waitForTimeout(800);
const falta = p.getByRole('alert').filter({ hasText: 'Falta preencher' });
const atalhos = await falta.getByRole('button').allInnerTexts();
await foto(p, '76-falta-preencher');
await falta.getByRole('button', { name: 'Semana 2' }).click(); await p.waitForTimeout(500);
const etapa = await p.getByText(/Etapa \d de 4/).innerText();
r('3', '"Concluir" com semanas vazias mostra "Falta preencher" com um botão por semana; tocar leva à semana', 'Semana 2, Semana 3, Semana 4; vai para Etapa 2', `${atalhos.join(', ')}; ${etapa}`, atalhos.join(', ') === 'Semana 2, Semana 3, Semana 4' && etapa === 'Etapa 2 de 4', '76-falta-preencher.png');
for (const [i, t] of [[1, 'Elementos da narrativa.'], [2, 'Poesia.'], [3, 'Resenha.']]) {
  await abas.nth(i).click(); await p.waitForTimeout(300);
  await p.locator('main textarea').fill(t); await p.waitForTimeout(300);
  if (i === 2) { const restam = await falta.getByRole('button').allInnerTexts().catch(() => []); r('3b', 'Os atalhos somem conforme as semanas são preenchidas', 'só Semana 4', restam.join(', '), restam.join(', ') === 'Semana 4'); }
}
await p.locator('main').getByRole('button', { name: 'Concluir' }).click();
await p.getByText('Formulário 1/3 concluído').waitFor({ timeout: 15000 });
await P.browser.close();

// --- Secretaria devolve para correção ---
const S2 = await abrir();
p = S2.page;
await login(p, 'secretaria@escola.gov.br', '12345678');
await p.goto(BASE + '/#/formulario-um-terco'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Painel de entregas' }).first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
await p.locator('div.rounded-xl, div.rounded-2xl', { hasText: NOME }).last().getByRole('button', { name: 'Ver' }).click(); await p.waitForTimeout(1000);
await p.getByRole('button', { name: 'Enviar para correção' }).click(); await p.waitForTimeout(600);
const md = p.locator('div.fixed.inset-0').last();
await md.locator('textarea').fill('Detalhe mais a semana 3.');
await md.getByRole('button', { name: 'Enviar para correção' }).last().click(); await p.waitForTimeout(600);
await md.getByRole('button', { name: 'Confirmar envio' }).click(); await p.waitForTimeout(1500);
await S2.browser.close();

// --- Professor vê a correção (celular) ---
const P2 = await abrir({ viewport: { width: 390, height: 844 } });
p = P2.page;
await login(p, email, SENHA); await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'Notificações' }).click(); await p.waitForTimeout(800);
const painel = p.getByRole('menu');
const caixa = await painel.boundingBox();
const textoNotif = (await painel.innerText()).replace(/\n/g, ' | ');
await foto(p, '76-notificacoes-celular');
r('7', 'Caixa de notificações no celular fica inteira dentro da tela', 'x ≥ 0 e direita ≤ 390', `x=${Math.round(caixa?.x)} direita=${Math.round((caixa?.x ?? 0) + (caixa?.width ?? 0))}`, !!caixa && caixa.x >= 0 && caixa.x + caixa.width <= 390, '76-notificacoes-celular.png');
r('5', 'Notificação da correção diz o que é e o prazo', '"Correção pendente no Formulário 1/3" + "Prazo:"', textoNotif.slice(0, 200), /Correção pendente no Formulário 1\/3/.test(textoNotif) && /Prazo: \d{2}\/\d{2}\/\d{4}, às \d{2}h\d{2}\./.test(textoNotif));
await p.keyboard.press('Escape'); await p.mouse.click(200, 700); await p.waitForTimeout(400);
await p.goto(BASE + '/#/'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
const blocoCorr = (await p.locator('[data-folha-inicio]').first().innerText().catch(() => '')).replace(/\n/g, ' | ');
r('2b', 'Início: a folha devolvida aparece com "Correção solicitada", o prazo da correção e "Corrigir"', 'Correção solicitada; corrigir até; Corrigir; sem "Concluído"', blocoCorr,
  /Correção solicitada/.test(blocoCorr) && /corrigir até/.test(blocoCorr) && /Corrigir/.test(blocoCorr) && !/Concluído/.test(blocoCorr));
await p.locator('[data-folha-inicio]').first().getByRole('button', { name: 'Corrigir' }).click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
const main = await p.locator('main').innerText();
const nCorrSolic = (main.match(/Correção solicitada/g) || []).length;
await foto(p, '76-tela-correcao');
r('6', 'Tela de correção: sem "Concluído", sem o prazo do ciclo, sem citar "Salvar progresso"; "Correção solicitada" no selo e no título do quadro (2x, não 3x)', 'sem Concluído; sem "Prazo: 20/11"; sem "Salvar progresso"; 2x',
  `Concluído: ${/Concluído/.test(main)}; prazo ciclo: ${/Prazo: 20\/11\/2026, 18:00/.test(main)}; Salvar progresso: ${/Salvar progresso/.test(main)}; ${nCorrSolic}x`,
  !/Concluído/.test(main) && !/Prazo: 20\/11\/2026, 18:00/.test(main) && !/Salvar progresso/.test(main) && nCorrSolic === 2, '76-tela-correcao.png');
await P2.browser.close();

await limpar();
await prisma.$disconnect();

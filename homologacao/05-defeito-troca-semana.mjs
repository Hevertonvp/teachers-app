// Reprodução controlada: "Próximo" espera o salvamento; digitar nesse intervalo cai na semana ANTERIOR.
import { abrir, login, foto, abrirCartao } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const { browser, page } = await abrir();
await login(page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
await abrirCartao(page, /7º.*Arte/);
const ta = page.locator('#conteudos-semana');
await ta.fill('SEMANA-UM: aquarela e mistura de cores primárias.');
await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(800);
await ta.fill('SEMANA-UM: aquarela e mistura de cores primárias (editado).');

// rede lenta (2,5 s) apenas para o salvamento das respostas
await page.route('**/api/formulario-um-terco/**/respostas', async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
await page.getByRole('button', { name: 'Próximo' }).click();
await page.waitForTimeout(300);
const tituloApos300ms = await page.locator('h2.text-2xl').first().innerText();
await ta.pressSequentially(' DIGITADO-APOS-CLICAR-PROXIMO', { delay: 10 }); // o usuário acha que está na semana 2
await foto(page, '05-defeito-troca-semana-durante-espera');
await page.waitForTimeout(12000);
await page.unroute('**/api/formulario-um-terco/**/respostas');
const tituloAos12s = await page.locator('h2.text-2xl').first().innerText();
await page.getByRole('tab', { name: 'Semana 1' }).click(); await page.waitForTimeout(2500);
const textoSem1Tela = await ta.inputValue();
await page.getByRole('tab', { name: 'Semana 2' }).click(); await page.waitForTimeout(2500);
const tituloFinal = await page.locator('h2.text-2xl').first().innerText();
const textoSem2 = await ta.inputValue();
await foto(page, '05-defeito-troca-semana-depois');

const e = await prisma.entregaUmTerco.findFirst({ where: { professor: { email: 'p04@homolog.nexo' }, anoSerie: 7, disciplina: { nome: 'Arte' } }, include: { respostas: { include: { semana: true }, orderBy: { semana: { numero: 'asc' } } } } });
const s1 = e?.respostas.find(r => r.semana.numero === 1)?.texto ?? '';
console.log('300ms após clicar Próximo a tela ainda mostrava:', tituloApos300ms);
console.log('Aos 12 s a tela mostrava:', tituloAos12s);
console.log('Ao final a tela mostra:', tituloFinal, '| texto visível na semana 2:', JSON.stringify(textoSem2));
console.log('Semana 1 na tela (ao voltar):', JSON.stringify(textoSem1Tela));
console.log('Semana 1 no banco:', JSON.stringify(s1));
const contaminada = s1.includes('DIGITADO') || textoSem1Tela.includes('DIGITADO');
registrar('UT-DEF-01', 'Formulário 1/3', 'Digitar logo após "Próximo" (rede lenta) deve ir para a semana seguinte', 'texto na semana 2; semana 1 intacta', `semana 1 (banco): "${s1.slice(-50)}"; semana 1 (tela): "${textoSem1Tela.slice(-50)}"; semana 2 vazia: ${textoSem2 === ""}`, contaminada ? 'REPROVADO' : 'APROVADO', '05-defeito-troca-semana-durante-espera.png', 'Próximo aguarda o PUT antes de trocar a semana; tela segue editável na semana antiga.');
await browser.close(); await prisma.$disconnect();

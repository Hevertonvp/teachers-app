// Reprodução controlada: "Próximo" espera o salvamento; digitar nesse intervalo NÃO pode cair na semana anterior.
// Reescrito em 12/11/2026 para o 1/3 por cargo (folha do Cargo 2 do P04). Banco LOCAL.
import { abrir, login, foto, abrirCartao } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, resetarFolhas, SENHA } from './cargos-homolog.mjs';

const [, c2] = await cargosDe('p04');
await resetarFolhas('p04', 1);
const { browser, page } = await abrir();
await login(page, 'p04@homolog.nexo', SENHA('p04'));
await abrirCartao(page, /^Cargo 2$/);
const ta = page.locator('#conteudos-semana');
await ta.fill('SEMANA-UM: saudações e apresentação pessoal.');
await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(800);
await ta.fill('SEMANA-UM: saudações e apresentação pessoal (editado).');

// rede lenta (2,5 s) apenas para o salvamento das respostas
await page.route('**/api/formulario-um-terco/**/respostas', async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
await page.getByRole('button', { name: 'Próximo' }).click();
await page.waitForTimeout(300);
await ta.pressSequentially(' DIGITADO-APOS-CLICAR-PROXIMO', { delay: 10 }); // o usuário acha que está na semana 2
await foto(page, '05-defeito-troca-semana-durante-espera');
await page.waitForTimeout(12000);
await page.unroute('**/api/formulario-um-terco/**/respostas');
await page.getByRole('tab', { name: 'Semana 1' }).click(); await page.waitForTimeout(2500);
const textoSem1Tela = await ta.inputValue();
await page.getByRole('tab', { name: 'Semana 2' }).click(); await page.waitForTimeout(2500);
const textoSem2 = await ta.inputValue();
await foto(page, '05-defeito-troca-semana-depois');

const e = await folhaDoCargo(c2);
const s1 = e?.respostas.find(r => r.semana.numero === 1)?.texto ?? '';
const contaminada = s1.includes('DIGITADO') || textoSem1Tela.includes('DIGITADO');
registrar('UT-DEF-01', 'Formulário 1/3', 'Digitar logo após "Próximo" (rede lenta) deve ir para a semana seguinte', 'semana 1 intacta', `semana 1 (banco): "${s1.slice(-50)}"; semana 1 (tela): "${textoSem1Tela.slice(-50)}"; semana 2: "${textoSem2.slice(0, 40)}"`, contaminada ? 'REPROVADO' : 'APROVADO', '05-defeito-troca-semana-durante-espera.png');
await browser.close(); await prisma.$disconnect();

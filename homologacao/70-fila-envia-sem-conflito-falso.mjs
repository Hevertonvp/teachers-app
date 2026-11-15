// DEF-08 (15/11/2026): com a tela ABERTA, a fila offline envia sozinha ao reconectar; depois disso, digitar
// mais e salvar NÃO pode acusar conflito falso (a tela adota a versão nova). Navegador real, banco LOCAL.
import { abrir, login, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, resetarFolhas } from './cargos-homolog.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`FILA-${id}`, 'Fila offline com a tela aberta', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
await prepararCargosHomolog();
const [C1] = await cargosDe('p01');
await resetarFolhas('p01', 1);
const dormir = (ms) => new Promise(res => setTimeout(res, ms));
const { browser, contexto, page } = await abrir();
await login(page, 'p01@homolog.nexo', 'Nexo!Prof01-2026');
await page.goto(`${BASE}/#/formulario-um-terco/1/cargo/${C1}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1200);
const ta = page.locator('#conteudos-semana');
await ta.fill('FILA online: base.'); await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(1500);
await contexto.setOffline(true);
await ta.fill('FILA offline: texto guardado no aparelho.'); await page.getByRole('button', { name: 'Salvar progresso' }).click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(2500);
const filaAntes = (await page.getByText('Salvo só neste aparelho').count()) > 0;
await contexto.setOffline(false);
let enviado = false;
for (let i = 0; i < 40 && !enviado; i++) { await dormir(1500); enviado = ((await folhaDoCargo(C1, 1))?.respostas.find(x => x.semana.numero === 1)?.texto ?? '').includes('FILA offline'); }
await dormir(2500);
const indicador = (await page.locator('body').innerText()).includes('Sincronizado');
r('1', 'Tela aberta: ao reconectar, a fila envia e o indicador passa de "Salvo só neste aparelho" para "Sincronizado"', 'enviado; Sincronizado', `na fila antes: ${filaAntes}; enviado: ${enviado}; Sincronizado: ${indicador}`, filaAntes && enviado && indicador);
await ta.fill('FILA depois: digitado depois do envio automático.'); await page.getByRole('button', { name: 'Salvar progresso' }).click(); await page.waitForTimeout(2500);
const conflito = await page.getByText('Este formulário foi alterado em outra aba ou dispositivo').isVisible().catch(() => false);
const banco = (await folhaDoCargo(C1, 1))?.respostas.find(x => x.semana.numero === 1)?.texto ?? '';
r('2', 'Depois do envio automático, digitar mais e salvar não acusa conflito falso e grava', 'sem aviso de conflito; banco com o texto novo', `aviso: ${conflito}; banco: "${banco}"`, !conflito && banco.includes('FILA depois'));
await browser.close();
await resetarFolhas('p01', 1);
await prisma.$disconnect();

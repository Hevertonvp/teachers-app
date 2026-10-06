import { chromium } from 'playwright';

const FRONT = 'https://localhost:5173';

async function login(page: any) {
  await page.goto(`${FRONT}/#/login`);
  await page.getByPlaceholder('seu.email@escola.gov.br').fill('secretaria@escola.gov.br');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch();

  for (const largura of [360, 375, 390, 414]) {
    const mobile = await browser.newPage({ viewport: { width: largura, height: 700 }, ignoreHTTPSErrors: true, isMobile: true, hasTouch: true });
    await login(mobile);
    await mobile.goto(`${FRONT}/#/dashboard`);
    await mobile.waitForTimeout(1000);
    await mobile.screenshot({ path: `header-mobile-${largura}.png`, clip: { x: 0, y: 0, width: largura, height: 130 } });

    const logoNoHeader = await mobile.locator('header svg[aria-label="Gestão Pedagógica"]').count();
    const infoToggle = await mobile.locator('button[aria-label*="noturno"], button[aria-label*="claro"]').boundingBox();
    const infoBell = await mobile.locator('button[aria-label="Notificações"]').boundingBox();
    const mesmaLinha = infoToggle && infoBell ? Math.abs(infoToggle.y - infoBell.y) < 10 : null;
    console.log(`[${largura}px] logo no header? ${logoNoHeader > 0 ? 'SIM (bug)' : 'não (ok)'} | toggle e sino na mesma linha? ${mesmaLinha}`);
    await mobile.close();
  }

  const mobile = await browser.newPage({ viewport: { width: 375, height: 700 }, ignoreHTTPSErrors: true, isMobile: true, hasTouch: true });
  await login(mobile);
  await mobile.goto(`${FRONT}/#/dashboard`);
  await mobile.waitForTimeout(1000);
  await mobile.getByRole('button', { name: 'Abrir menu' }).click();
  await mobile.waitForTimeout(600);
  await mobile.screenshot({ path: 'sidebar-mobile-com-logo.png' });
  const logoNaSidebar = await mobile.locator('aside svg[aria-label="Gestão Pedagógica"]').count();
  console.log('logo aparece na sidebar (mobile aberto)?', logoNaSidebar > 0 ? 'sim (ok)' : 'NÃO (bug)');
  await mobile.close();

  // Desktop: sidebar sempre visível, logo deve aparecer ali também.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  await login(desktop);
  await desktop.goto(`${FRONT}/#/dashboard`);
  await desktop.waitForTimeout(1000);
  await desktop.screenshot({ path: 'desktop-header-sidebar.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });
  const logoNaSidebarDesktop = await desktop.locator('aside svg[aria-label="Gestão Pedagógica"]').count();
  console.log('logo aparece na sidebar (desktop)?', logoNaSidebarDesktop > 0 ? 'sim (ok)' : 'NÃO (bug)');
  await desktop.close();

  await browser.close();
  console.log('\nconcluído.');
}
main().catch((e) => { console.error(e); process.exit(1); });

import { chromium } from 'playwright';

const FRONT = 'https://localhost:5173';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 700 }, ignoreHTTPSErrors: true, isMobile: true, hasTouch: true });
  await page.goto(`${FRONT}/#/login`);
  await page.getByPlaceholder('seu.email@escola.gov.br').fill('secretaria@escola.gov.br');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(2000);
  await page.goto(`${FRONT}/#/dashboard`);
  await page.waitForTimeout(1000);

  const dados = await page.evaluate(() => {
    const header = document.querySelector('header > div');
    return Array.from(header.children).map((el) => {
      const r = el.getBoundingClientRect();
      return { classes: el.className.slice(0, 50), x: Math.round(r.x), width: Math.round(r.width), right: Math.round(r.x + r.width) };
    });
  });
  console.log(JSON.stringify(dados, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });

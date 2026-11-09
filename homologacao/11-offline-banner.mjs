import { abrir, login, foto, abrirCartao } from './lib.mjs';
import { registrar } from './resultados.mjs';
for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const { browser, contexto, page } = await abrir({ viewport: vp });
  await login(page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  await abrirCartao(page, /9º.*Inglês/);
  await contexto.setOffline(true);
  await page.locator('#conteudos-semana').fill('texto offline para forçar o aviso ' + nome);
  await page.getByRole('button', { name: 'Salvar progresso' }).click().catch(() => {});
  await page.waitForTimeout(6000);
  await foto(page, `11-offline-banner-${nome}`);
  const banner = await page.locator('div.fixed.inset-x-0.bottom-0.z-40').first().innerText().catch(() => '(sem banner)');
  const prox = page.getByRole('button', { name: 'Próximo' });
  const clicavel = await prox.click({ timeout: 4000, trial: true }).then(() => true).catch(() => false);
  console.log(nome, '| banner:', banner.replace(/\s+/g, ' ').slice(0, 160), '| Próximo clicável:', clicavel);
  registrar(`UT-OFF-UX-${nome}`, 'Offline (usabilidade)', `Sem rede, o botão "Próximo" continua clicável (${nome})`, 'clicável', clicavel ? 'clicável' : `BLOQUEADO por aviso fixo: "${banner.replace(/\s+/g, ' ').slice(0, 90)}"`, clicavel ? 'APROVADO' : 'REPROVADO', `11-offline-banner-${nome}.png`);
  await browser.close();
}

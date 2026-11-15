// Correções do PDI só da Secretaria (15/11/2026): endereço direto não abre a tela para os demais perfis
// (antes abria e a API respondia 403). Navegador real, banco LOCAL. Não grava nada.
import { abrir, login, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`CORRPDI-${id}`, 'Correções do PDI (acesso)', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const contas = [
  ['professor', 'p04@homolog.nexo', 'Nexo!Prof04-2026', false],
  ['diretora', 'diretora.aur@homolog.nexo', 'Nexo!Homolog-2026', false],
  ['gestor', 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026', false],
  ['secretaria', 'secretaria@escola.gov.br', '12345678', true],
];
for (const [nome, email, senha, pode] of contas) {
  const X = await abrir();
  const proibidos = [];
  X.page.on('response', (resp) => { if (resp.status() === 403 && resp.url().includes('/api/correcoes-pdi')) proibidos.push(resp.url()); });
  await login(X.page, email, senha);
  for (const rota of ['/correcoes/pdi', '/correcoes/pdi/1']) {
    await X.page.goto(BASE + '/#' + rota); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
  }
  const url = X.page.url().split('#')[1];
  await X.page.goto(BASE + '/#/correcoes/pdi'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(1200);
  const final = X.page.url().split('#')[1];
  r(nome, `${nome}: digitar /correcoes/pdi e /correcoes/pdi/1 direto no endereço`, pode ? 'abre a tela, sem 403' : 'vai para o Dashboard, sem chamada 403',
    `fica em: ${final}; chamadas 403: ${proibidos.length}; último: ${url}`, pode ? final === '/correcoes/pdi' && proibidos.length === 0 : final === '/dashboard' && proibidos.length === 0);
  await X.browser.close();
}

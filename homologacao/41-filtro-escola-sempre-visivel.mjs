// PDI > Alunos: filtro Escola SEMPRE visível — Secretaria em "Todas as escolas" (editável) e Gestor
// (escola definida no topo: mostrada e travada). Navegador real, banco LOCAL.
import { abrir, login, foto, BASE } from './lib.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, evid = '') => registrar(`DEF10B-${id}`, 'PDI Alunos (filtro Escola sempre visível)', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', evid);
for (const [id, quem, email, senha, esperaEditavel] of [['1', 'Secretaria (Todas as escolas)', 'secretaria@escola.gov.br', '123456', true], ['2', 'Gestor (escola definida no topo)', 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026', false], ['3', 'Diretora (escola definida no topo)', 'diretora.bv@homolog.nexo', 'Nexo!Homolog-2026', false]]) {
  for (const [vnome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    await login(X.page, email, senha);
    await X.page.goto(BASE + '/#/pdi/alunos'); await X.page.waitForLoadState('networkidle'); await X.page.waitForTimeout(2500);
    const rotulos = await X.page.locator('main label').allInnerTexts();
    const temEscola = rotulos.some(t => t.trim().startsWith('Escola'));
    const sel = X.page.locator('main select').first();
    const desabilitado = await sel.isDisabled();
    const valor = (await sel.locator('option:checked').innerText().catch(() => '')).trim();
    await foto(X.page, `41-${id}-${vnome}`);
    r(`${id}-${vnome}`, `${quem}, ${vnome}: filtro Escola visível ${esperaEditavel ? 'e editável' : 'mostrando a escola do topo, travado'}`, esperaEditavel ? 'visível, editável' : 'visível, travado, com o nome da escola', `visível: ${temEscola}; travado: ${desabilitado}; mostra: "${valor}"`, temEscola && desabilitado === !esperaEditavel && (esperaEditavel || /ZZ-HOMOLOG/.test(valor)), `41-${id}-${vnome}.png`);
    await X.browser.close();
  }
}

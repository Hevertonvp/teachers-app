// Telas da Supervisora (18/11/2026), banco LOCAL, computador e celular: menu novo; 1/3 só consulta (sem
// "Enviar para correção"); Correções > PDI com "Salvar correção direta"; Professores(as) só consulta; Alunos PDI
// sem "Novo aluno"; Acompanhamento Escolar abre; sino com o ícone novo; sem rolagem lateral nem erro no console.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const INICIO = new Date();
const r = (id, cen, esp, obs, ok) => registrar(`SUPT-${id}`, 'Supervisora — telas', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', '');
const semRolagem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// Um aviso de teste no sino da Supervisora (apagado no fim).
await prisma.notificacao.create({ data: { destinatarioId: 35, tipo: 'ENTREGA_PRAZO_AMANHA', titulo: 'Formulário 1/3: prazo amanhã', corpo: 'ZZ-HOMOLOG Escola Aurora: faltam 2 de 3. Prazo: amanhã.', linkContexto: '/formulario-um-terco/ciclos/1' } });

try {
  for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    const X = await abrir({ viewport: vp });
    const p = X.page;
    await login(p, 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026');
    await p.goto(BASE + '/#/dashboard'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
    if (nome === 'celular') { await p.getByRole('button', { name: 'Abrir menu' }).click(); await p.waitForTimeout(400); }
    const itens = ['Acompanhamento Escolar', 'Formulário 1/3', 'PDI', 'Correções', 'Professores(as)', 'Mensagens', 'Feedback'];
    const vistos = [];
    for (const i of itens) if (await p.getByRole('link', { name: i, exact: true }).count()) vistos.push(i);
    const velho = await p.getByRole('link', { name: 'Gestão de Professores(as)' }).count();
    r(`1-${nome}`, `Menu da Supervisora (${nome})`, 'itens novos; sem "Gestão de Professores(as)"', `${vistos.join(', ')}; antigo: ${velho}`, vistos.length === itens.length && velho === 0);

    // 1/3: lista e painel só leitura
    await p.goto(BASE + '/#/formulario-um-terco'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1000);
    const novoCiclo = await p.getByRole('button', { name: '+ Novo ciclo' }).count();
    await p.getByRole('button', { name: 'Painel de entregas' }).first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
    const titulo = await p.getByRole('heading', { name: 'Painel de entregas' }).count();
    const enviar = await p.getByRole('button', { name: 'Enviar para correção' }).count();
    const rol1 = await semRolagem(p);
    await foto(p, `92-sup-painel-1-3-${nome}`);
    r(`2-${nome}`, `1/3 só consulta (${nome})`, 'sem "+ Novo ciclo"; painel abre; sem "Enviar para correção"; sem rolagem lateral', `novo ${novoCiclo}; painel ${titulo}; enviar ${enviar}; ok rolagem ${rol1}`,
      novoCiclo === 0 && titulo === 1 && enviar === 0 && rol1);

    // Correções > PDI
    await p.goto(BASE + '/#/correcoes/pdi'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
    const linhas = await p.getByText('ZZ-HOMOLOG Escola Aurora').count();
    const ficha = await prisma.fichaPdi.findFirst({ where: { status: 'CONCLUIDA', escolaId: 1 } });
    await p.goto(BASE + `/#/correcoes/pdi/${ficha.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
    const salvar = await p.getByRole('button', { name: 'Salvar correção direta' }).count();
    const rol2 = await semRolagem(p);
    await foto(p, `92-sup-correcao-pdi-${nome}`);
    r(`3-${nome}`, `Correções > PDI da Supervisora (${nome})`, 'lista com a escola dela; detalhe com "Salvar correção direta"', `linhas Aurora ${linhas}; salvar ${salvar}; ok rolagem ${rol2}`, linhas > 0 && salvar === 1 && rol2);

    // Professores e Alunos PDI só consulta
    await p.goto(BASE + '/#/gestao-professores'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
    const profs = await p.getByRole('heading', { name: 'Professores(as)' }).count();
    const busca = await p.getByLabel('Buscar professor').count();
    const cadastrar = await p.getByRole('button', { name: /cadastrar|novo professor/i }).count();
    await p.goto(BASE + '/#/pdi/alunos'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200);
    const novoAluno = await p.getByRole('button', { name: /novo aluno/i }).count();
    r(`4-${nome}`, `Professores e Alunos PDI só consulta (${nome})`, 'lista abre, sem cadastrar; sem "Novo aluno"', `prof ${profs}/${busca}; cadastrar ${cadastrar}; novo aluno ${novoAluno}`, profs === 1 && busca === 1 && cadastrar === 0 && novoAluno === 0);

    // Acompanhamento e sino
    await p.goto(BASE + '/#/acompanhamento-escolar'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
    const acomp = p.url().includes('acompanhamento-escolar');
    await p.getByRole('button', { name: 'Notificações' }).click(); await p.waitForTimeout(1200);
    const aviso = await p.getByText('Formulário 1/3: prazo amanhã').count();
    await foto(p, `92-sup-sino-${nome}`);
    r(`5-${nome}`, `Acompanhamento abre e o aviso aparece no sino (${nome})`, 'fica na tela; aviso visível', `acomp ${acomp}; aviso ${aviso}`, acomp && aviso >= 1);

    const erros = X.erros.filter(e => !/favicon|manifest|service worker|sw\.js/i.test(e));
    r(`6-${nome}`, `Sem erros no console (${nome})`, '0', `${erros.length} ${erros.slice(0, 2).join(' | ')}`, erros.length === 0);
    await X.browser.close();
  }
} finally {
  await prisma.notificacao.deleteMany({ where: { destinatarioId: 35, createdAt: { gte: INICIO } } });
  await prisma.$disconnect();
}

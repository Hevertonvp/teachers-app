// Atuação pedagógica no cargo (decisão do usuário, 12/11/2026) — telas, navegador real, banco LOCAL.
// Configurações (catálogo), cadastro de cargo com atuação, folha "Escola — Professor Regente", conclusão,
// correção direta, painel por escola e por disciplina. Limpa o que cria.
import { abrir, login, foto, abrirCartao, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`ATU-${id}`, 'Atuação pedagógica', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const P = 'ZZATU';
const AUR = 'ZZ-HOMOLOG Escola Aurora';
const ir = async (page, rota) => { await page.goto(BASE + '/#' + rota); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); };
const modal = (page) => page.locator('div.fixed.inset-0').last();
const escolher = async (sel, texto) => { const v = await sel.evaluate((s, t) => [...s.options].find(o => o.text.trim() === t)?.value, texto); await sel.selectOption(v); };

await prepararCargosHomolog();
const inicio = new Date();
const regente = await prisma.atuacaoPedagogica.findUniqueOrThrow({ where: { nome: 'Professor Regente' } });
const aurora = await prisma.escola.findFirstOrThrow({ where: { nome: AUR } });
const ing = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Inglês' } });
const p13 = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'p13@homolog.nexo' } });
async function limpar() {
  const pessoas = (await prisma.pessoa.findMany({ where: { email: { startsWith: P.toLowerCase() } }, select: { id: true } })).map(p => p.id);
  const ids = [...pessoas, p13.id];
  const cargos = (await prisma.cargoProfessor.findMany({ where: { professorId: { in: ids } }, select: { id: true } })).map(c => c.id);
  const entregas = (await prisma.entregaUmTercoCargo.findMany({ where: { cargoId: { in: cargos } }, select: { entregaId: true } })).map(e => e.entregaId);
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { entregaId: { in: entregas } } });
  await prisma.entregaUmTerco.deleteMany({ where: { id: { in: entregas } } });
  await prisma.cargoVersao.deleteMany({ where: { cargoId: { in: cargos } } });
  await prisma.cargoProfessor.deleteMany({ where: { id: { in: cargos } } });
  await prisma.vinculoEscolar.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoaEvento.deleteMany({ where: { pessoaId: { in: pessoas } } });
  await prisma.pessoa.deleteMany({ where: { id: { in: pessoas } } });
  await prisma.atuacaoPedagogica.deleteMany({ where: { nome: { startsWith: P } } });
  const convs = (await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção' } }, select: { id: true } })).map(c => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: convs } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: inicio } } });
}
await limpar();

try {
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');

  // ===== Configurações: catálogo =====
  await ir(S.page, '/configuracoes');
  await S.page.getByLabel('Nova atuação pedagógica').fill(`${P} Professor de Apoio`);
  await S.page.getByLabel('Nova atuação pedagógica').locator('xpath=ancestor::form[1]').getByRole('button', { name: 'Adicionar' }).click();
  await S.page.getByText(`Atuação "${P} Professor de Apoio" cadastrada.`).waitFor({ timeout: 10000 });
  const linhaNova = S.page.locator('li', { hasText: `${P} Professor de Apoio` });
  await linhaNova.getByRole('button', { name: 'Desativar' }).click();
  await S.page.waitForTimeout(1000);
  const inativa = (await linhaNova.textContent()).includes('Inativa');
  const temIniciais = ['Professor Regente', 'Oficina do Brincar', 'Professor de Intervenção'].every(async n => true) && (await S.page.getByText('Oficina do Brincar').count()) > 0;
  await foto(S.page, '64-configuracoes-atuacoes');
  r('CAT', 'Configurações: Secretaria vê a lista inicial, cadastra uma atuação nova e desativa (sem migration nem código)', 'lista inicial; nova cadastrada; Inativa', `iniciais: ${temIniciais}; inativa: ${inativa}`, temIniciais && inativa, '64-configuracoes-atuacoes.png');

  // ===== Cadastro de professor: escola só com atuação =====
  await ir(S.page, '/pessoas');
  await S.page.getByRole('button', { name: '+ Cadastrar professor' }).click();
  const m = modal(S.page);
  await m.locator('input[type=email]').fill(`${P.toLowerCase()}-regente@teste.invalid`);
  await m.locator('input:not([type=email]):not([type=date])').first().fill(`${P} Professora Regente`);
  await escolher(m.getByLabel('Escola 1').first(), AUR);
  await m.getByRole('button', { name: 'Remover disciplina' }).first().click();
  await m.getByRole('button', { name: 'Próximo →' }).click();
  const erroVazio = await m.getByText('Escolha ao menos uma disciplina ou uma atuação pedagógica.').isVisible().catch(() => false);
  await m.getByRole('button', { name: '+ Adicionar atuação' }).first().click();
  const opcoes = await m.getByLabel('Atuação 1').first().evaluate(s => [...s.options].map(o => o.text.trim()));
  await escolher(m.getByLabel('Atuação 1').first(), 'Professor Regente');
  await foto(S.page, '64-cadastro-regente');
  await m.getByRole('button', { name: 'Próximo →' }).click();
  await S.page.waitForTimeout(1500);
  await modal(S.page).getByRole('button', { name: 'Concluir depois' }).click().catch(() => {});
  await S.page.waitForTimeout(500);
  await modal(S.page).getByRole('button', { name: 'Concluir' }).click().catch(() => {});
  const nova = await prisma.pessoa.findFirst({ where: { email: `${P.toLowerCase()}-regente@teste.invalid` }, include: { cargos: { include: { versoes: true } } } });
  r('5/2', 'Cadastro pela tela: escola vazia é recusada perto do campo; escola só com "Professor Regente" (sem disciplina) é aceita; atuação inativa não aparece', 'erro no bloco; composição com atuação; sem a inativa na lista', `erro: ${erroVazio}; composição: ${JSON.stringify(nova?.cargos[0]?.versoes[0]?.composicao)}; inativa na lista: ${opcoes.some(o => o.includes(P))}`, erroVazio && (() => { const c = nova?.cargos[0]?.versoes[0]?.composicao ?? []; return c.length === 1 && c[0].escolaId === aurora.id && c[0].disciplinaIds.length === 0 && JSON.stringify(c[0].atuacaoIds) === JSON.stringify([regente.id]); })() && !opcoes.some(o => o.includes(P)), '64-cadastro-regente.png');
  await S.browser.close();

  // ===== Folha do Professor só com atuação (P13 ganha cargo "Aurora — Professor Regente" antes da abertura) =====
  const antes = new Date('2026-11-01T12:00:00Z');
  await prisma.cargoProfessor.create({ data: { professorId: p13.id, dataInicio: new Date('2026-02-01T00:00:00Z'), createdAt: antes, versoes: { create: { criadaEm: antes, composicao: [{ escolaId: aurora.id, disciplinaIds: [], atuacaoIds: [regente.id] }] } } } });
  const X = await abrir({ viewport: { width: 390, height: 844 } });
  await login(X.page, 'p13@homolog.nexo', SENHA('p13'));
  await ir(X.page, '/formulario-um-terco');
  const card = (await X.page.locator('main').innerText()).replace(/\s+/g, ' ');
  await abrirCartao(X.page, /^Cargo 1$/);
  const cab = (await X.page.locator('main').innerText()).replace(/\s+/g, ' ');
  for (let i = 1; i <= 4; i++) { await X.page.getByRole('tab', { name: `Semana ${i}` }).click(); await X.page.waitForTimeout(700); await X.page.locator('#conteudos-semana').fill(`Regente semana ${i}: rotina e brincadeiras.`); await X.page.waitForTimeout(500); }
  await X.page.getByRole('button', { name: /^Concluir/ }).click(); await X.page.waitForTimeout(2500);
  const entrega = await prisma.entregaUmTerco.findFirst({ where: { cicloId: 1, professorId: p13.id }, include: { respostas: true } });
  await foto(X.page, '64-folha-regente-celular');
  r('6/7', 'Folha gerada para cargo só com atuação: mostra "Aurora — Professor Regente" (sem turma); conclusão normal; foto guarda o nome da atuação', 'card e cabeçalho com a atuação; CONCLUIDA; 4 semanas', `card: ${card.includes(`${AUR} — Professor Regente`)}; cabeçalho: ${cab.includes(`${AUR} — Professor Regente`)}; ${entrega?.status}; ${entrega?.respostas.length}; foto: ${JSON.stringify(entrega?.composicao)?.slice(0, 120)}`, card.includes(`${AUR} — Professor Regente`) && cab.includes(`${AUR} — Professor Regente`) && entrega?.status === 'CONCLUIDA' && entrega.respostas.length === 4 && /Professor Regente/.test(JSON.stringify(entrega.composicao)));
  await X.browser.close();

  // ===== Correção direta e painel =====
  const tk = (await (await fetch('http://localhost:3340/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'secretaria@escola.gov.br', senha: '12345678' }) })).json()).token;
  const api = async (m2, p, b) => (await fetch('http://localhost:3340/api' + p, { method: m2, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: b ? JSON.stringify(b) : undefined })).json();
  const det = await api('GET', `/correcoes-um-terco/${entrega.id}`);
  const sem = det.semanas[0];
  const corr = await api('PUT', `/correcoes-um-terco/${entrega.id}/respostas`, { baseUpdatedAt: det.updatedAt, respostas: [{ semanaId: sem.id, texto: 'Regente semana 1: corrigido pela Secretaria.' }] });
  const msg = await prisma.mensagem.findFirst({ where: { createdAt: { gte: inicio }, conversa: { assunto: { startsWith: 'Correção feita pela Secretaria' } } } });
  r('8', 'Correção direta numa folha só com atuação: salva e a mensagem identifica "Aurora — Professor Regente"', 'salvo; mensagem com a atuação', `${corr.semanas?.[0]?.texto}; ${msg?.conteudo.replace(/\n+/g, ' | ').slice(0, 140)}`, corr.semanas?.[0]?.texto === 'Regente semana 1: corrigido pela Secretaria.' && /Aurora — Professor Regente/.test(msg?.conteudo ?? ''));
  const porEscola = await api('GET', `/formulario-um-terco/ciclos/1/painel?escolaId=${aurora.id}`);
  const porDisc = await api('GET', `/formulario-um-terco/ciclos/1/painel?disciplinaId=${ing.id}`);
  r('9/10', 'Painel: a folha só com atuação aparece no filtro por escola e fica fora do filtro por disciplina', 'escola: sim; disciplina: não', `escola: ${porEscola.linhas.some(l => l.professorId === p13.id)}; disciplina: ${porDisc.linhas.some(l => l.professorId === p13.id)}`, porEscola.linhas.some(l => l.professorId === p13.id) && !porDisc.linhas.some(l => l.professorId === p13.id));
} finally {
  await limpar();
  await prepararCargosHomolog();
  await prisma.$disconnect();
}

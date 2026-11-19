// PDI "em desenvolvimento" para todos menos a Secretaria + telefone opcional no Aluno PDI (19/11/2026), banco LOCAL.
// Rodar com o backend SEM PDI_LIBERADO (padrão de reiniciar-backend.sh). Limpa o que cria.
import { execSync } from 'node:child_process';
import { abrir, login, BASE } from './lib.mjs';
import { prisma, URL_LOCAL } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340';
const INICIO = new Date();
const r = (id, cen, esp, obs, ok) => registrar(`PDISEC-${id}`, 'PDI só Secretaria / telefone opcional', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', '');
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };
const job = (...args) => execSync(`npx tsx ../homologacao/91-avisos-job.mts ${args.join(' ')}`, { cwd: new URL('../backend/', import.meta.url), env: { ...process.env, DATABASE_URL: URL_LOCAL, DIRECT_URL: URL_LOCAL, PDI_LIBERADO: '' }, encoding: 'utf8' }).trim();

const tSec = await token('secretaria@escola.gov.br', '12345678');
const tSup = await token('gestor.aur@homolog.nexo', 'Nexo!Homolog-2026');
const tProf = await token('p04@homolog.nexo', 'Nexo!Prof04-2026');
const sec = await prisma.pessoa.findUnique({ where: { email: 'secretaria@escola.gov.br' } });
const alunosCriados = [];

try {
  // --- Telefone opcional ---------------------------------------------------------------------------------
  const turma = await prisma.turma.findFirst({ where: { escolaId: 1, status: 'ATIVA', tipo: 'REGULAR' } });
  const semTel = await api(tSec, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZTEL sem telefone', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe' });
  if (semTel.json?.id) alunosCriados.push(semTel.json.id);
  const telVazio = await api(tSec, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZTEL vazio', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Pai', responsavelTelefone: '   ' });
  if (telVazio.json?.id) alunosCriados.push(telVazio.json.id);
  const comTel = await api(tSec, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZTEL com telefone', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '(31) 99999-0000' });
  if (comTel.json?.id) alunosCriados.push(comTel.json.id);
  const editar = semTel.json?.id ? await api(tSec, 'PUT', `/api/pdi-alunos/${semTel.json.id}`, { nome: 'Aluno ZZTEL sem telefone', turmaId: turma.id, responsavelNome: 'Resp 2', responsavelParentesco: 'Mãe' }) : { status: 0 };
  const semNomeResp = await api(tSec, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZTEL x', turmaId: turma.id, responsavelNome: '', responsavelParentesco: 'Mãe' });
  r('1', 'Aluno PDI sem telefone: cadastra e edita; com telefone continua igual; nome do responsável segue obrigatório', '201 "" / 201 "" / 201 tel / 200 / 400',
    `${semTel.status} "${semTel.json?.responsavelTelefone}" / ${telVazio.status} "${telVazio.json?.responsavelTelefone}" / ${comTel.status} "${comTel.json?.responsavelTelefone}" / ${editar.status} / ${semNomeResp.status}`,
    semTel.status === 201 && semTel.json.responsavelTelefone === '' && telVazio.status === 201 && telVazio.json.responsavelTelefone === '' && comTel.status === 201 && comTel.json.responsavelTelefone === '(31) 99999-0000' && editar.status === 200 && semNomeResp.status === 400);

  // --- Bloqueio no servidor --------------------------------------------------------------------------------
  const ficha = await prisma.fichaPdi.findFirst({ where: { status: 'CONCLUIDA', escolaId: 1 } });
  const corrSup = await api(tSup, 'PUT', `/api/correcoes-pdi/${ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: 1, valor: { resposta: 'x' } }], baseUpdatedAt: new Date().toISOString() });
  const concluirProf = await api(tProf, 'POST', `/api/pdi-fichas/${ficha.id}/concluir`);
  const lerSup = await api(tSup, 'GET', '/api/correcoes-pdi');
  r('2', 'PDI em desenvolvimento: Supervisora e Professor não gravam nada no PDI (servidor); leitura continua', '403 / 403 / 200', `${corrSup.status} "${corrSup.json?.message}" / ${concluirProf.status} / ${lerSup.status}`,
    corrSup.status === 403 && corrSup.json?.message === 'O PDI está em desenvolvimento.' && concluirProf.status === 403 && lerSup.status === 200);

  const devSec = await api(tSec, 'POST', `/api/correcoes-pdi/${ficha.id}/devolver`, { observacao: 'x' });
  const d = (await api(tSec, 'GET', `/api/correcoes-pdi/${ficha.id}`)).json;
  const resp = new Map(d.respostas.map(x => [x.aplicacaoPerguntaId, x.valor]));
  const p = d.perguntas.find(q => !['ORIENTACAO', 'HABILIDADE_CRMG', 'HABILIDADE_COMPUTACAO'].includes(q.tipoResposta) && resp.get(q.id)?.resposta != null);
  const corrSec = await api(tSec, 'PUT', `/api/correcoes-pdi/${ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: p.id, valor: resp.get(p.id) }], baseUpdatedAt: d.ficha.updatedAt ?? d.ficha.createdAt });
  const avisosSup = await prisma.notificacao.count({ where: { destinatarioId: 35, createdAt: { gte: INICIO } } });
  r('3', 'Secretaria não devolve ao Professor (ele não tem acesso), mas corrige direto — e a Supervisora NÃO é avisada', '403 / 200 / 0 avisos',
    `${devSec.status} "${devSec.json?.message}" / ${corrSec.status} / ${avisosSup}`, devSec.status === 403 && corrSec.status === 200 && avisosSup === 0);

  // --- Avisos do PDI só para a Secretaria ------------------------------------------------------------------
  job('job', '2026-12-14T12:00:00Z');
  const pdiSec = await prisma.notificacao.count({ where: { destinatarioId: sec.id, tipo: 'ENTREGA_PRAZO_AMANHA', titulo: 'PDI: prazo amanhã', createdAt: { gte: INICIO } } });
  const pdiGestao = await prisma.notificacao.count({ where: { destinatarioId: { in: [35, 36] }, createdAt: { gte: INICIO } } });
  r('4', 'Véspera do prazo do PDI: só a Secretaria é avisada (Diretora e Supervisora não)', '1 / 0', `${pdiSec} / ${pdiGestao}`, pdiSec === 1 && pdiGestao === 0);

  // --- Telas ---------------------------------------------------------------------------------------------
  for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
    for (const [quem, email, senha] of [['professor', 'p04@homolog.nexo', 'Nexo!Prof04-2026'], ['supervisora', 'gestor.aur@homolog.nexo', 'Nexo!Homolog-2026']]) {
      const X = await abrir({ viewport: vp }); const pg = X.page;
      await login(pg, email, senha);
      await pg.goto(BASE + '/#/pdi'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1000);
      const desenv = await pg.getByRole('heading', { name: 'PDI em desenvolvimento' }).count();
      await pg.goto(BASE + '/#/correcoes/pdi'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(800);
      const desenvCorr = await pg.getByRole('heading', { name: 'PDI em desenvolvimento' }).count();
      await pg.goto(BASE + '/#/dashboard'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1000);
      if (nome === 'celular') { await pg.getByRole('button', { name: 'Abrir menu' }).click(); await pg.waitForTimeout(400); }
      const selo = await pg.getByText('Em desenvolvimento').count();
      const erros = X.erros.filter(e => !/favicon|manifest|service worker|sw\.js|403/i.test(e));
      r(`5-${quem}-${nome}`, `${quem} (${nome}): /pdi e /correcoes/pdi mostram "PDI em desenvolvimento"; selo no menu/dashboard; sem erro no console`, '1 / 1 / selo ≥1 / 0 erros',
        `${desenv} / ${desenvCorr} / ${selo} / ${erros.length} ${erros.slice(0, 1).join('')}`, desenv === 1 && desenvCorr === 1 && selo >= 1 && erros.length === 0);
      await X.browser.close();
    }
    const X = await abrir({ viewport: vp }); const pg = X.page;
    await login(pg, 'secretaria@escola.gov.br', '12345678');
    await pg.goto(BASE + '/#/pdi'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1000);
    const normal = await pg.getByText('Plano de Desenvolvimento Individual').count();
    const desenv = await pg.getByRole('heading', { name: 'PDI em desenvolvimento' }).count();
    await pg.goto(BASE + '/#/pdi/alunos'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1200);
    // "Novo aluno PDI" exige uma escola específica no seletor do topo (regra antiga).
    await pg.locator('button[aria-haspopup="listbox"]').first().click();
    await pg.getByRole('listbox').getByRole('option', { name: 'ZZ-HOMOLOG Escola Aurora', exact: true }).click();
    await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(800);
    await pg.getByRole('button', { name: 'Novo aluno PDI' }).click(); await pg.waitForTimeout(500);
    const opcional = await pg.getByText('Telefone principal (opcional)').count();
    const rolagem = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    r(`6-secretaria-${nome}`, `Secretaria (${nome}): PDI normal; cadastro de aluno com "Telefone principal (opcional)"`, 'PDI 1 / dev 0 / opcional 1', `${normal} / ${desenv} / ${opcional} / rolagem ok ${rolagem}`, normal >= 1 && desenv === 0 && opcional === 1 && rolagem);
    await X.browser.close();
  }
} finally {
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: INICIO } } });
  await prisma.historicoCorrecaoResposta.deleteMany({ where: { alteradoEm: { gte: INICIO } } });
  await prisma.movimentacaoAlunoPdi.deleteMany({ where: { alunoId: { in: alunosCriados } } });
  await prisma.alunoPdi.deleteMany({ where: { id: { in: alunosCriados } } });
  await prisma.$disconnect();
}

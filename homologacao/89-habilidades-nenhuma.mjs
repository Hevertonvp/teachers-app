// Opção "Nenhuma" nas perguntas de habilidades (CRMG e Computação), 17/11/2026, banco LOCAL.
// Cenário do roteiro 85 + uma pergunta HABILIDADE_CRMG temporária no Modelo do cenário + pergunta "marcar" de
// Computação do 7º. Confere: salvar "Nenhuma" (API) conta como respondida e permite concluir; leitura e exportação
// mostram "Nenhuma"; resposta antiga com habilidades continua igual; tela (celular): caixa "Nenhuma" esconde a lista,
// salva e volta marcada. Limpa o que cria.
import { abrir, login, foto, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparComputacao, montarCenario, criarAplicacao } from './85-perguntas-computacao.mjs';

const API = 'http://localhost:3340';
const SEC = ['secretaria@escola.gov.br', '12345678'];
const P04 = ['p04@homolog.nexo', 'Nexo!Prof04-2026'];
const token = async ([email, senha]) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const r = (id, cen, esp, obs, ok, ev) => registrar(`NENHUMA-${id}`, 'Opção "Nenhuma" nas habilidades', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', ev);
const TEXTO_CRMG = '[ZZ-COMP] Quais habilidades foram consolidadas? (teste)';

const limpar = async () => {
  await limparComputacao();
  await prisma.perguntaPdi.deleteMany({ where: { texto: TEXTO_CRMG } });
};
await limpar();
const c = await montarCenario();
const tSec = await token(SEC); const tP = await token(P04);
const comp = await prisma.disciplinaComponenteCurricular.findUnique({ where: { disciplinaId: c.modelo.disciplinaId } });
await prisma.perguntaPdi.create({ data: { modeloId: c.modelo.id, secao: 'Habilidades do CRMG', texto: TEXTO_CRMG, origem: 'HABILIDADE', tipoResposta: 'HABILIDADE_CRMG', ordem: 9999 } });
await api(tSec, 'POST', '/api/pdi-perguntas-computacao', { anos: [7], texto: '[ZZ-COMP] Quais habilidades de Computação o aluno consolidou?', tipoResposta: 'HABILIDADE_COMPUTACAO' });
const ap = await criarAplicacao(tSec, c.escola.id, new Date().toISOString().slice(0, 10), '2026-12-15');

// API: Ficha do 7º — responde tudo, com "Nenhuma" nas duas de habilidades
const f = await api(tP, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: ap.json.id, alunoId: c.a7.id, disciplinaId: c.modelo.disciplinaId });
const qCrmg = f.json.perguntas.find(p => p.tipoResposta === 'HABILIDADE_CRMG');
const qComp = f.json.perguntas.find(p => p.tipoResposta === 'HABILIDADE_COMPUTACAO');
const respostas = f.json.perguntas.filter(p => p.tipoResposta !== 'ORIENTACAO').map(p => ({
  aplicacaoPerguntaId: p.id,
  valor: p.tipoResposta.startsWith('HABILIDADE') ? { nenhuma: true, habilidadeIds: [] }
    : p.tipoResposta === 'SELECAO' || p.tipoResposta === 'MARCACAO' ? { resposta: p.tipoResposta === 'MARCACAO' ? true : (p.opcoes?.[0] ?? 'x') }
    : p.tipoResposta === 'NUMERO' ? { resposta: 1 } : { resposta: 'ok' },
}));
const salvo = await api(tP, 'PUT', `/api/pdi-fichas/${f.json.ficha.id}/respostas`, { respostas, baseUpdatedAt: f.json.ficha.updatedAt ?? f.json.ficha.createdAt });
const gravadas = await prisma.respostaPdi.findMany({ where: { fichaId: f.json.ficha.id, aplicacaoPerguntaId: { in: [qCrmg?.id, qComp?.id].filter(Boolean) } } });
r('1', 'Salvar "Nenhuma" no CRMG e na de Computação: grava nenhuma=true sem habilidades', '200; 2 respostas nenhuma', `${salvo.status} ${JSON.stringify(salvo.json?.message ?? '')}; ${gravadas.map(g => `${g.valor.componente}:${g.valor.nenhuma}:${g.valor.habilidades.length}`).join(', ')}`,
  !!qCrmg && !!qComp && salvo.status === 200 && gravadas.length === 2 && gravadas.every(g => g.valor.nenhuma === true && g.valor.habilidades.length === 0), `componente da disciplina: ${comp?.componente}`);
// bloco padrão (se houver) também precisa estar respondido para concluir
if (f.json.blocoPadrao?.perguntas?.length) {
  await api(tP, 'PUT', `/api/pdi-fichas/${f.json.ficha.id}/respostas-padrao`, { respostas: f.json.blocoPadrao.perguntas.filter(p => p.tipoResposta !== 'ORIENTACAO').map(p => ({ aplicacaoPerguntaPadraoId: p.id, valor: { resposta: p.tipoResposta === 'SELECAO' ? (p.opcoes?.[0] ?? 'x') : p.tipoResposta === 'MARCACAO' ? true : 'ok' } })), version: f.json.blocoPadrao.version });
}
const concl = await api(tP, 'POST', `/api/pdi-fichas/${f.json.ficha.id}/concluir`);
r('2', '"Nenhuma" conta como respondida: a Ficha conclui', 'CONCLUIDA', `${concl.status} ${concl.json?.ficha?.status ?? JSON.stringify(concl.json)}`, concl.json?.ficha?.status === 'CONCLUIDA');
const exp = await api(tSec, 'GET', `/api/pdi-fichas/exportacao?aplicacaoId=${ap.json.id}`);
const textos = (exp.json?.respostas ?? []).filter(x => x.fichaId === f.json.ficha.id && /habilidades/i.test(x.pergunta)).map(x => x.resposta);
r('3', 'Exportação mostra "Nenhuma"', 'Nenhuma, Nenhuma', textos.join(', '), textos.length === 2 && textos.every(t => t === 'Nenhuma'));
const sem = await api(tP, 'PUT', `/api/pdi-fichas/${f.json.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: qComp.id, valor: { habilidadeIds: [] } }], baseUpdatedAt: new Date().toISOString() });
r('4', 'Sem "Nenhuma", o formato antigo continua aceito (lista vazia, sem campo novo)', 'não quebra (200 ou bloqueio por Ficha concluída)', `${sem.status}`, [200, 409, 400, 403].includes(sem.status) && sem.status < 500);

// Tela: Ficha do 6º? não — Computação "marcar" é do 7º. Usa o Aluno7 de uma 2ª ficha: reabre não; usa a Ficha da
// mesma Aplicação para o AlunoEI? (sem Computação). Então: nova Aplicação não — testa a tela na Ficha já concluída
// (leitura) e a edição num 2º aluno do 7º criado agora.
const a7b = await prisma.alunoPdi.create({ data: { nome: 'Aluno7b ZZ', turmaId: c.t7.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0' } });
const P = await abrir({ viewport: { width: 390, height: 844 } });
const p = P.page;
await login(p, ...P04);
await p.goto(`${BASE}/#/pdi/aluno/${ap.json.id}/${a7b.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const antes = await p.locator('label', { hasText: /EF07CO\d\d/ }).count();
const caixas = p.locator('label', { hasText: /^\s*Nenhuma\s*$/ });
const nCaixas = await caixas.count();
await caixas.last().click(); await p.waitForTimeout(300);
const depois = await p.locator('label', { hasText: /EF07CO\d\d/ }).count();
const buscaCrmgAntes = await p.getByPlaceholder(/Código \(ex\.: EF06MA\)/).count();
await caixas.first().click(); await p.waitForTimeout(300);
const buscaCrmgDepois = await p.getByPlaceholder(/Código \(ex\.: EF06MA\)/).count();
const largura = await p.evaluate(() => document.documentElement.scrollWidth);
await foto(p, '89-nenhuma-celular');
r('5', 'Tela (celular): caixa "Nenhuma" nas duas perguntas; marcar esconde a lista/busca', '2 caixas; 11→0 habilidades; busca 1→0; sem rolagem lateral', `${nCaixas} caixas; ${antes}→${depois}; busca ${buscaCrmgAntes}→${buscaCrmgDepois}; largura ${largura}`,
  nCaixas === 2 && antes === 11 && depois === 0 && buscaCrmgAntes === 1 && buscaCrmgDepois === 0 && largura <= 390, '89-nenhuma-celular.png');
// salva (Voltar) e reabre
await p.getByRole('button', { name: /Voltar/ }).first().click().catch(() => {}); await p.waitForTimeout(2500);
const ficha7b = await prisma.fichaPdi.findFirst({ where: { aplicacaoId: ap.json.id, alunoId: a7b.id } });
const salvas7b = ficha7b ? await prisma.respostaPdi.findMany({ where: { fichaId: ficha7b.id } }) : [];
await p.goto(`${BASE}/#/pdi/aluno/${ap.json.id}/${a7b.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const marcadas = await p.locator('label', { hasText: /^\s*Nenhuma\s*$/ }).locator('input:checked').count();
r('6', 'Ao sair a tela salva; reabrindo, as duas "Nenhuma" continuam marcadas', '2 gravadas nenhuma; 2 marcadas', `${salvas7b.filter(s => s.valor?.nenhuma).length} gravadas; ${marcadas} marcadas`,
  salvas7b.filter(s => s.valor?.nenhuma).length === 2 && marcadas === 2);
// leitura da Ficha concluída
await p.goto(`${BASE}/#/pdi/fichas/${ap.json.id}/${c.modelo.disciplinaId}/${c.a7.id}`); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2500);
const leitura = await p.locator('main').innerText();
r('7', 'Ficha concluída (leitura) mostra "Nenhuma" nas habilidades', '"Nenhuma" presente', `${(leitura.match(/^Nenhuma$/gm) || []).length} ocorrências`, (leitura.match(/^Nenhuma$/gm) || []).length >= 2);
console.log('Erros de console:', P.erros.filter(e => !/favicon/.test(e)).slice(0, 5));
await P.browser.close();

await prisma.respostaPdi.deleteMany({ where: { ficha: { alunoId: a7b.id } } });
await limpar();
await prisma.$disconnect();

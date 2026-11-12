// Fluxo de correções para professores (10/11/2026) — PDI. Banco LOCAL. (A parte do 1/3 foi para o teste 59, 1/3 por cargo.)
// PREPARAÇÃO DIRETA NO BANCO: os alunos com Fichas concluídas do P04 foram transferidos por testes
// antigos, então o teste marca como CONCLUIDA as Fichas 10, 11 (aluna 4) e 12 (aluno 3) e desfaz no fim.
// Reenvia as MESMAS respostas (nenhum texto muda) e, no fim, apaga só o que o teste criou (correções,
// mensagens, notificações, histórico) e devolve as datas que mexeu (Aplicação 1 e ciclo 1).
import { abrir, login, BASE, foto } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`COR-${id}`, 'Correções para professores', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO', ev);
const API = 'http://localhost:3340';
const req = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo === undefined ? undefined : JSON.stringify(corpo) }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const H72 = 72 * 3600 * 1000;

const inicio = new Date();
const FICHA = 11; // Aplicação 1, aluna 4 (turma 5), Arte (P04)
const FICHA_OUTRA = 10; // mesma aluna, Inglês (P04)
const FICHA_TELA = 12; // aluno 3 (turma 2), Inglês (P04)
const FICHA_TRANSFERIDO = 6; // aluno 2, transferido para outra escola por testes antigos
const aplic1 = await prisma.aplicacaoPdi.findUniqueOrThrow({ where: { id: 1 } });
const ciclo1 = await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: 1 } });
const fichasOriginais = await prisma.fichaPdi.findMany({ where: { id: { in: [FICHA, FICHA_OUTRA, FICHA_TELA] } }, select: { id: true, status: true, concluidaEm: true, concluidaPor: true } });
await prisma.fichaPdi.updateMany({ where: { id: { in: [FICHA, FICHA_OUTRA, FICHA_TELA] } }, data: { status: 'CONCLUIDA', concluidaEm: new Date(), concluidaPor: '14' } });

try {
  const tkS = await token('secretaria@escola.gov.br', '12345678');
  const tkP = await token('p04@homolog.nexo', 'Nexo!Prof04-2026');
  const tkO = await token('p01@homolog.nexo', 'Nexo!Prof01-2026');

  // ===== PDI =====
  const vazio = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver`, { observacao: '   ' });
  r('1', 'Orientações obrigatórias: devolver com texto vazio é recusado', '400', vazio.status, vazio.status === 400);

  const [d1, d2] = await Promise.all([
    req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver`, { observacao: 'Revisar a seção de objetivos (orientação 1).' }),
    req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver`, { observacao: 'Revisar a seção de objetivos (orientação 1).' }),
  ]);
  const criadasPdi = await prisma.correcaoFichaPdi.findMany({ where: { fichaId: FICHA, criadaEm: { gte: inicio } } });
  const c1 = criadasPdi[0];
  const prazoOk = c1 && c1.prazoAte.getTime() - c1.criadaEm.getTime() === H72;
  r('2', 'Duplo clique em "Enviar para correção": só UMA devolução; prazo = exatamente 72 h depois', '1 criada (201 + 409); 72 h', `${[d1.status, d2.status].sort().join('+')}; ${criadasPdi.length} criada(s); prazo ${c1 ? (c1.prazoAte - c1.criadaEm) / 3600000 : '?'} h`, criadasPdi.length === 1 && [d1.status, d2.status].sort().join('+') === '201+409' && prazoOk);

  const convP = (await req(tkP, 'GET', '/api/mensagens/conversas')).json;
  const conversa = (Array.isArray(convP) ? convP : convP.conversas ?? []).find((c) => /Correção pendente · PDI/.test(c.assunto));
  const thread = conversa ? (await req(tkP, 'GET', `/api/mensagens/conversas/${conversa.id}`)).json : null;
  const msg = thread?.mensagens?.[0];
  const okMsg = msg && msg.conteudo.includes('orientação 1') && /Prazo: \d{2}\/\d{2}\/\d{4}, às \d{2}h\d{2}/.test(msg.conteudo) && msg.conteudo.includes('Disciplina: Arte') && msg.linkFormulario === '/pdi/aluno/1/4';
  r('3', 'Professor recebe a mensagem na caixa: orientações, prazo, escola/turma/disciplina e link do formulário', 'tudo presente; link /pdi/aluno/1/4', msg ? `${msg.linkFormulario}; ${msg.conteudo.split('\n').slice(0, 6).join(' | ')}` : 'mensagem não encontrada', !!okMsg);

  const outro = conversa ? await req(tkO, 'GET', `/api/mensagens/conversas/${conversa.id}`) : { status: 'sem conversa' };
  r('4', 'Outro professor não abre a mensagem de correção do P04', '403', outro.status, outro.status === 403);

  const meus = (await req(tkP, 'GET', '/api/pdi-fichas/meus-pdis')).json;
  const linhaFicha = meus.find((l) => l.fichaId === FICHA); const linhaOutra = meus.find((l) => l.fichaId === FICHA_OUTRA);
  r('5', 'Meus PDIs: "Correção solicitada" só na disciplina devolvida (não na outra do mesmo aluno)', 'Arte sim; Inglês não', `Arte ${linhaFicha?.correcaoSolicitada}; Inglês ${linhaOutra?.correcaoSolicitada}`, linhaFicha?.correcaoSolicitada === true && linhaOutra?.correcaoSolicitada === false);

  // Rascunho (salvar) NÃO envia; reenvia as mesmas respostas, sem mudar texto.
  const fichaP = (await req(tkP, 'GET', '/api/pdi-fichas/1/4/3')).json;
  const respostaTexto = fichaP.respostas[0];
  const salvar = await req(tkP, 'PUT', `/api/pdi-fichas/${FICHA}/respostas`, { respostas: [{ aplicacaoPerguntaId: respostaTexto.aplicacaoPerguntaId, valor: respostaTexto.valor }], baseUpdatedAt: fichaP.ficha.updatedAt });
  const aposSalvar = await prisma.correcaoFichaPdi.findUnique({ where: { id: c1.id } });
  r('6', 'Professor vê as orientações no formulário; salvar rascunho NÃO envia a correção', 'correcao.ficha solicitada; continua ABERTA', `situação ${fichaP.correcao?.ficha?.situacao}; salvar ${salvar.status}; status ${aposSalvar.status}`, fichaP.correcao?.ficha?.situacao === 'solicitada' && salvar.status === 200 && aposSalvar.status === 'ABERTA');

  const [e1, e2] = await Promise.all([req(tkP, 'POST', `/api/pdi-fichas/${FICHA}/concluir`), req(tkP, 'POST', `/api/pdi-fichas/${FICHA}/concluir`)]);
  const enviada = await prisma.correcaoFichaPdi.findUnique({ where: { id: c1.id } });
  r('7', '"Enviar correção" (com clique duplo): correção vira recebida uma vez só', 'RESOLVIDA, concluidaEm preenchido', `${e1.status}/${e2.status}; ${enviada.status}; ${enviada.concluidaEm ? 'enviada' : 'sem data'}`, enviada.status === 'RESOLVIDA' && !!enviada.concluidaEm && e1.status === 200);

  const lista = (await req(tkS, 'GET', '/api/correcoes-pdi?correcao=em_andamento')).json;
  const det = (await req(tkS, 'GET', `/api/correcoes-pdi/${FICHA}`)).json;
  r('8', 'Secretaria vê "Correção recebida" (lista filtrada e detalhe)', 'recebida nos dois', `lista ${lista.find((x) => x.id === FICHA)?.indicadorCorrecao}; detalhe ${det.correcoes?.[0]?.situacao}`, lista.find((x) => x.id === FICHA)?.indicadorCorrecao === 'recebida' && det.correcoes?.[0]?.situacao === 'recebida');

  const ac1 = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/aceitar`);
  const ac2 = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/aceitar`);
  r('9', 'Secretaria aceita a correção; aceitar de novo é recusado', '200 aceita; 409', `${ac1.status} ${ac1.json.situacao}; ${ac2.status}`, ac1.status === 200 && ac1.json.situacao === 'aceita' && ac2.status === 409);

  // Nova devolução, prazo vencido, envio fora do prazo, devolução de novo (histórico preservado).
  const nova = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver`, { observacao: 'Complementar as atividades (orientação 2).' });
  await prisma.correcaoFichaPdi.update({ where: { id: nova.json.id }, data: { prazoAte: new Date(Date.now() - 60000) } });
  const detVencida = (await req(tkS, 'GET', `/api/correcoes-pdi/${FICHA}`)).json;
  const fichaP2 = (await req(tkP, 'GET', '/api/pdi-fichas/1/4/3')).json;
  const salvarVencida = await req(tkP, 'PUT', `/api/pdi-fichas/${FICHA}/respostas`, { respostas: [{ aplicacaoPerguntaId: respostaTexto.aplicacaoPerguntaId, valor: respostaTexto.valor }], baseUpdatedAt: fichaP2.ficha.updatedAt });
  await req(tkP, 'POST', `/api/pdi-fichas/${FICHA}/concluir`);
  const detFora = (await req(tkS, 'GET', `/api/correcoes-pdi/${FICHA}`)).json;
  r('10', 'Prazo de 3 dias vencido: aparece como encerrado, professor NÃO é bloqueado e o envio fica "fora do prazo"', 'prazo_encerrado; salvar 200; recebida + fora do prazo', `${detVencida.correcoes[0].situacao}; salvar ${salvarVencida.status}; ${detFora.correcoes[0].situacao}, fora ${detFora.correcoes[0].enviadaForaDoPrazo}`, detVencida.correcoes[0].situacao === 'prazo_encerrado' && salvarVencida.status === 200 && detFora.correcoes[0].situacao === 'recebida' && detFora.correcoes[0].enviadaForaDoPrazo === true);

  const terceira = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver`, { observacao: 'Ajuste final (orientação 3).' });
  const hist = (await req(tkS, 'GET', `/api/correcoes-pdi/${FICHA}`)).json.correcoes;
  const msgsP = (await prisma.mensagem.count({ where: { createdAt: { gte: inicio }, conversa: { assunto: { startsWith: 'Correção pendente · PDI' }, participantes: { some: { pessoaId: 14 } } } } }));
  r('11', 'Devolver de novo: novas orientações, novo prazo, nova mensagem; histórico completo preservado', '3 no histórico (solicitada, devolvida, aceita); 3 mensagens', `${terceira.status}; ${hist.map((c) => c.situacao).join(', ')}; ${msgsP} mensagens; prazo novo ${terceira.json.prazoAte && new Date(terceira.json.prazoAte) - new Date(terceira.json.criadaEm) === H72}`, terceira.status === 201 && hist.map((c) => c.situacao).join(',') === 'solicitada,devolvida,aceita' && msgsP === 3);

  // Período original encerrado: só a Ficha devolvida fica editável; a outra do mesmo aluno não.
  await prisma.aplicacaoPdi.update({ where: { id: 1 }, data: { dataFim: new Date(Date.now() - 2 * 86400000) } });
  const fP = (await req(tkP, 'GET', '/api/pdi-fichas/1/4/3')).json;
  const fO = (await req(tkP, 'GET', '/api/pdi-fichas/1/4/9')).json;
  const putP = await req(tkP, 'PUT', `/api/pdi-fichas/${FICHA}/respostas`, { respostas: [{ aplicacaoPerguntaId: respostaTexto.aplicacaoPerguntaId, valor: respostaTexto.valor }], baseUpdatedAt: fP.ficha.updatedAt });
  const perguntaO = fO.perguntas?.find((p) => p.tipoResposta !== 'ORIENTACAO');
  const valorO = fO.respostas?.find((x) => x.aplicacaoPerguntaId === perguntaO?.id)?.valor ?? { resposta: 'não deve gravar' };
  const putO = perguntaO ? await req(tkP, 'PUT', `/api/pdi-fichas/${FICHA_OUTRA}/respostas`, { respostas: [{ aplicacaoPerguntaId: perguntaO.id, valor: valorO }], baseUpdatedAt: fO.ficha.updatedAt }) : { status: 'sem pergunta' };
  await prisma.aplicacaoPdi.update({ where: { id: 1 }, data: { dataFim: aplic1.dataFim } });
  r('12', 'Aplicação encerrada: a Ficha devolvida continua editável; a outra disciplina do mesmo aluno não é liberada', 'devolvida 200; outra recusada (400)', `devolvida ${fP.editavelAgora}/${putP.status}; outra ${fO.editavelAgora}/${putO.status}`, fP.editavelAgora === true && putP.status === 200 && fO.editavelAgora === false && putO.status === 400);
  await req(tkP, 'POST', `/api/pdi-fichas/${FICHA}/concluir`);

  // Bloco comum: salvar não envia; "Enviar correção" em OUTRA disciplina do aluno envia.
  const comBloco = fP.blocoPadrao?.perguntas?.some((p) => p.tipoResposta !== 'ORIENTACAO') ? fP : null;
  if (comBloco) {
    const db = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA}/devolver-padrao`, { observacao: 'Rever as perguntas comuns.' });
    const fb = (await req(tkP, 'GET', '/api/pdi-fichas/1/4/3')).json;
    const pb = fb.blocoPadrao.perguntas.find((p) => p.tipoResposta !== 'ORIENTACAO');
    const rb = fb.blocoPadrao.respostas.find((x) => x.aplicacaoPerguntaPadraoId === pb.id) ?? { aplicacaoPerguntaPadraoId: pb.id, valor: { resposta: pb.opcoes?.[0] ?? 'Teste de correção' } };
    const sb = await req(tkP, 'PUT', `/api/pdi-fichas/${FICHA}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: rb.aplicacaoPerguntaPadraoId, valor: rb.valor }], version: fb.blocoPadrao.version });
    const depoisSalvar = await prisma.correcaoBlocoPadraoPdi.findUnique({ where: { id: db.json.id } });
    await req(tkP, 'POST', `/api/pdi-fichas/${FICHA_OUTRA}/concluir`);
    const depoisEnviar = await prisma.correcaoBlocoPadraoPdi.findUnique({ where: { id: db.json.id } });
    r('13', 'Perguntas comuns: salvar não envia; "Enviar correção" em outra disciplina do aluno envia', 'ABERTA após salvar; RESOLVIDA após enviar', `${db.status}; salvar ${sb.status} ${depoisSalvar.status}; enviar ${depoisEnviar.status}`, db.status === 201 && sb.status === 200 && depoisSalvar.status === 'ABERTA' && depoisEnviar.status === 'RESOLVIDA');
  } else {
    registrar('COR-13', 'Correções para professores', 'Perguntas comuns (bloco)', 'executa', 'esta Aplicação não tem perguntas comuns no banco local', 'NAO_EXECUTADO');
  }

  const transf = await req(tkS, 'POST', `/api/correcoes-pdi/${FICHA_TRANSFERIDO}/devolver`, { observacao: 'teste transferido' });
  r('13b', 'Aluno transferido para outra escola: devolução recusada com explicação (ninguém conseguiria editar a Ficha antiga)', '400 + "transferido"', `${transf.status} ${transf.json.message ?? ''}`, transf.status === 400 && /transferido/.test(transf.json.message ?? ''));

  // ===== Formulário 1/3: coberto pelo teste 59-correcao-um-terco-por-cargo.mjs (1/3 por cargo, 12/11/2026). =====
  const p01Aceita = await req(tkO, 'POST', `/api/correcoes-pdi/${FICHA}/aceitar`);
  r('18', 'Professor não aceita correções do PDI (só a Secretaria)', '403', `${p01Aceita.status}`, p01Aceita.status === 403);

  // ===== Tela =====
  // Secretaria devolve pela tela (orientações + confirmação) a Ficha de Arte do aluno 5 (ficha 14).
  const S = await abrir();
  await login(S.page, 'secretaria@escola.gov.br', '12345678');
  await S.page.goto(BASE + `/#/correcoes/pdi/${FICHA_TELA}`); await S.page.waitForLoadState('networkidle');
  await S.page.getByRole('button', { name: 'Enviar para correção' }).first().click();
  const confirmarDesabilitado = await S.page.getByRole('button', { name: 'Enviar para correção' }).last().isDisabled();
  await S.page.getByLabel('O que precisa ser corrigido?').fill('Detalhar as estratégias usadas em Inglês.');
  await S.page.getByRole('button', { name: 'Enviar para correção' }).last().click();
  await S.page.getByRole('button', { name: 'Confirmar envio' }).click();
  await S.page.getByText('Correção enviada. O professor recebeu').waitFor({ timeout: 10000 });
  await foto(S.page, '51-secretaria-devolveu');
  r('19', 'Tela da Secretaria: botão desabilitado sem orientações; confirmar envia e mostra "Correção solicitada"', 'desabilitado; enviado', `desabilitado ${confirmarDesabilitado}; ${await S.page.getByText('Correção solicitada').count() > 0 ? 'selo visível' : 'sem selo'}`, confirmarDesabilitado && await S.page.getByText('Correção solicitada').count() > 0, '51-secretaria-devolveu.png');

  // Professor: abre pela mensagem, vê orientações, recarrega, envia.
  const P = await abrir({ viewport: { width: 390, height: 844 } });
  await login(P.page, 'p04@homolog.nexo', 'Nexo!Prof04-2026');
  await P.page.goto(BASE + '/#/mensagens'); await P.page.waitForLoadState('networkidle');
  const aluno3 = (await prisma.alunoPdi.findUniqueOrThrow({ where: { id: 3 } })).nome;
  await P.page.getByText(`Correção pendente · PDI · ${aluno3} · Inglês`).first().click();
  await P.page.getByRole('link', { name: 'Abrir formulário' }).first().click();
  await P.page.waitForURL(/pdi\/aluno\/1\/3/, { timeout: 10000 });
  await P.page.getByText('Detalhar as estratégias usadas em Inglês.').waitFor({ timeout: 15000 });
  await P.page.reload(); await P.page.waitForLoadState('networkidle');
  const aposRecarregar = await P.page.getByText('Detalhar as estratégias usadas em Inglês.').count();
  await foto(P.page, '51-professor-formulario-celular');
  // As respostas desta Ficha (preparada no banco) não estão completas: o botão aparece, mas fica
  // desabilitado até tudo estar respondido (regra de sempre). O envio é feito pela API.
  const botaoEnviar = await P.page.getByRole('button', { name: /Enviar correção · Inglês/ }).count();
  await req(tkP, 'POST', `/api/pdi-fichas/${FICHA_TELA}/concluir`);
  const rolagem = await P.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  r('20', 'Professor (celular): mensagem → "Abrir formulário" → orientações no formulário, mesmo após recarregar → "Enviar correção"', 'abre o formulário certo; orientações visíveis; botão "Enviar correção"; sem rolagem lateral', `${P.page.url().split('#')[1]}; após recarregar ${aposRecarregar}; botão ${botaoEnviar}; sobra ${rolagem}px`, aposRecarregar > 0 && botaoEnviar === 1 && rolagem <= 0, '51-professor-formulario-celular.png');

  await S.page.reload(); await S.page.waitForLoadState('networkidle');
  await S.page.getByRole('button', { name: 'Aceitar correção' }).click();
  await S.page.getByText('Correção aceita.').waitFor({ timeout: 10000 });
  await foto(S.page, '51-secretaria-aceitou');
  r('21', 'Secretaria vê "Correção recebida" e aceita pela tela', 'aceita', 'aceita', true, '51-secretaria-aceitou.png');

  const erros = [...S.erros, ...P.erros].filter((e) => !/favicon|40[0134]/.test(e));
  await S.browser.close(); await P.browser.close();
  r('23', 'Sem erros no console nem respostas 5xx nas telas', 'nenhum', erros.join(' | ') || 'nenhum', erros.length === 0);
} finally {
  // Limpeza: só o que este teste criou.
  for (const o of fichasOriginais) await prisma.fichaPdi.update({ where: { id: o.id }, data: { status: o.status, concluidaEm: o.concluidaEm, concluidaPor: o.concluidaPor } });
  await prisma.respostaPadraoPdi.deleteMany({ where: { createdAt: { gte: inicio } } });
  await prisma.aplicacaoPdi.update({ where: { id: 1 }, data: { dataFim: aplic1.dataFim } });
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: ciclo1.prazoEm } });
  const convs = await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção pendente' } }, select: { id: true } });
  const ids = convs.map((c) => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: ids } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: ids } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: ids } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: inicio }, chaveIdempotencia: { startsWith: 'correcao-' } } });
  await prisma.correcaoFichaPdi.deleteMany({ where: { criadaEm: { gte: inicio } } });
  await prisma.correcaoBlocoPadraoPdi.deleteMany({ where: { criadaEm: { gte: inicio } } });
  await prisma.correcaoEntregaUmTerco.deleteMany({ where: { criadaEm: { gte: inicio } } });
  await prisma.historicoCorrecaoResposta.deleteMany({ where: { alteradoEm: { gte: inicio } } });
  await prisma.historicoCorrecaoRespostaPadrao.deleteMany({ where: { alteradoEm: { gte: inicio } } });
  await prisma.$disconnect();
}

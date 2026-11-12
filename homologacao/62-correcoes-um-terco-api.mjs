// Correções → Formulário 1/3 (decisões do usuário, 12/11/2026) — regras pela API, banco LOCAL.
// Intervenções declaradas: o prazo das correções e o prazo do ciclo #1 são movidos direto no banco para
// simular "3 dias depois" e "ciclo encerrado"; tudo é devolvido no fim. Usa os cargos de teste.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, prepararCargosHomolog, SENHA } from './cargos-homolog.mjs';
const r = (id, cen, esp, obs, ok) => registrar(`CORR13-${id}`, 'Correções do 1/3 (API)', cen, esp, String(obs).slice(0, 300), ok ? 'APROVADO' : 'REPROVADO');
const API = 'http://localhost:3340/api';
const req = async (tk, metodo, p, corpo) => { const res = await fetch(API + p, { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: corpo === undefined ? undefined : JSON.stringify(corpo) }); return { status: res.status, json: await res.json().catch(() => ({})) }; };
const token = async (email, senha) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const H = 3600000;
const AUR = 'ZZ-HOMOLOG Escola Aurora'; const BV = 'ZZ-HOMOLOG Escola Boa Vista';

await prepararCargosHomolog();
const inicio = new Date();
const ciclo1 = await prisma.cicloUmTerco.findUniqueOrThrow({ where: { id: 1 }, include: { semanas: { orderBy: { numero: 'asc' } } } });
const sem = ciclo1.semanas;
const reaberturasAntes = await prisma.reaberturaUmTerco.count({ where: { cicloId: 1 } });
const tkS = await token('secretaria@escola.gov.br', '12345678');
const sec = await prisma.pessoa.findUniqueOrThrow({ where: { email: 'secretaria@escola.gov.br' } });
const tk = {}; const cargo = {}; const pid = {};
for (const c of ['p01', 'p04', 'p05', 'p07', 'p15']) { tk[c] = await token(`${c}@homolog.nexo`, SENHA(c)); cargo[c] = (await cargosDe(c))[0]; pid[c] = (await prisma.pessoa.findUnique({ where: { email: `${c}@homolog.nexo` } })).id; }
const rotaP = (c) => `/formulario-um-terco/ciclos/1/cargos/${cargo[c]}`;
const concluirFolha = async (c) => {
  const s = await req(tk[c], 'PUT', `${rotaP(c)}/respostas`, { baseUpdatedAt: null, respostas: sem.map(x => ({ semanaId: x.id, texto: `${c.toUpperCase()} semana ${x.numero}: texto original.` })) });
  await req(tk[c], 'POST', `${rotaP(c)}/concluir`, { baseUpdatedAt: s.json.updatedAt });
  return (await folhaDoCargo(cargo[c])).id;
};
const lista = async (q = '') => (await req(tkS, 'GET', `/correcoes-um-terco${q}`)).json;
const det = async (id) => (await req(tkS, 'GET', `/correcoes-um-terco/${id}`)).json;

try {
  const e01 = await concluirFolha('p01'); const e05 = await concluirFolha('p05'); const e07 = await concluirFolha('p07'); const e15 = await concluirFolha('p15');
  // P04 Cargo 1 em andamento (não concluída): não entra em Correções.
  await req(tk.p04, 'PUT', `${rotaP('p04')}/respostas`, { baseUpdatedAt: null, respostas: [{ semanaId: sem[0].id, texto: 'P04 ainda preenchendo.' }] });
  const aur = (await prisma.escola.findFirst({ where: { nome: AUR } })).id; const bv = (await prisma.escola.findFirst({ where: { nome: BV } })).id;

  // ===== Lista e filtros =====
  const todas = await lista();
  const ids = todas.itens.map(i => i.entregaId);
  r('01', 'Lista: só folhas concluídas, cada uma uma vez (folha em andamento fora)', '4 concluídas (P01, P05, P07, P15); sem P04', `${todas.total} folhas; únicas ${new Set(ids).size}; P04 presente: ${todas.itens.some(i => i.professorId === pid.p04)}`, [e01, e05, e07, e15].every(id => ids.includes(id)) && new Set(ids).size === ids.length && !todas.itens.some(i => i.professorId === pid.p04));
  const busca = await lista('?busca=boa%20vista%20matem');
  r('02', 'Busca textual (escola + disciplina, sem acento): encontra a folha do P15', 'P15', busca.itens.map(i => i.professorNome).join(', '), busca.itens.length >= 1 && busca.itens.every(i => i.composicao.some(p => p.escolaNome === BV)) && busca.itens.some(i => i.entregaId === e15));
  const fAur = await lista(`?escolaId=${aur}`); const fBv = await lista(`?escolaId=${bv}`);
  const tem = (l, id) => l.itens.some(i => i.entregaId === id);
  r('03/05', 'Filtro por escola: a folha de 2 escolas (P05) aparece nos dois filtros; total geral sem duplicar', 'P05 em Aurora e em Boa Vista; total geral = soma única', `Aurora: ${fAur.total} (P05 ${tem(fAur, e05)}); Boa Vista: ${fBv.total} (P05 ${tem(fBv, e05)}); geral ${todas.total}`, tem(fAur, e05) && tem(fBv, e05) && !tem(fBv, e01) && fAur.total + fBv.total > todas.total);
  const fProf = await lista(`?professorId=${pid.p05}`);
  r('04', 'Filtro por Professor', 'só P05', fProf.itens.map(i => i.professorNome).join(', '), fProf.total === 1 && fProf.itens[0].entregaId === e05);

  // ===== Correção direta =====
  const d0 = await det(e01);
  const semCorr = sem[1];
  const cd = await req(tkS, 'PUT', `/correcoes-um-terco/${e01}/respostas`, { baseUpdatedAt: d0.updatedAt, respostas: [{ semanaId: semCorr.id, texto: 'P01 semana 2: CORRIGIDO pela Secretaria.' }] });
  const textoBanco = (await folhaDoCargo(cargo.p01)).respostas.find(x => x.semanaId === semCorr.id)?.texto;
  r('06/07', 'Secretaria corrige diretamente: conteúdo alterado fica salvo', 'texto novo no banco', `${cd.status}; "${textoBanco}"`, cd.status === 200 && textoBanco === 'P01 semana 2: CORRIGIDO pela Secretaria.');
  const msgDireta = await prisma.mensagem.findFirst({ where: { createdAt: { gte: inicio }, conversa: { assunto: { startsWith: 'Correção feita pela Secretaria · Formulário 1/3' }, participantes: { some: { pessoaId: pid.p01 } } } }, include: { conversa: true } });
  r('08', 'Professor recebe mensagem da correção direta (Formulário 1/3, ciclo, folha, semana alterada, feita pela Secretaria)', 'mensagem com ciclo, Cargo 1, Aurora — Matemática, Semana 2', msgDireta ? msgDireta.conteudo.replace(/\n+/g, ' | ').slice(0, 200) : 'sem mensagem', !!msgDireta && /Secretaria fez uma correção/.test(msgDireta.conteudo) && msgDireta.conteudo.includes(ciclo1.titulo) && /Cargo 1/.test(msgDireta.conteudo) && /Aurora — Matemática/.test(msgDireta.conteudo) && /Semana 2/.test(msgDireta.conteudo));
  const d1 = await det(e01);
  const minhas01 = (await req(tk.p01, 'GET', '/formulario-um-terco/minhas')).json.find(i => i.ciclo.id === 1);
  r('26', 'Correção direta NÃO abre janela nem coloca o Professor em modo de correção', 'sem correção; Professor sem "Correção solicitada"', `correções ${d1.correcoes.length}; situação ${d1.situacao}; correcaoSolicitada ${minhas01.correcaoSolicitada}`, d1.correcoes.length === 0 && d1.situacao === 'nenhuma' && minhas01.correcaoSolicitada === false);
  const h = d1.historicoValores[0];
  r('23', 'Histórico com valor anterior e novo, quem e origem', 'antes "texto original"; depois "CORRIGIDO"; Secretaria; SECRETARIA_DIRETA', h ? `${h.valorAnterior} → ${h.valorNovo}; ${h.alteradoPorNome}; ${h.origem}` : 'sem histórico', !!h && /texto original/.test(h.valorAnterior) && /CORRIGIDO/.test(h.valorNovo) && h.alteradoPor === String(sec.id) && h.origem === 'SECRETARIA_DIRETA');

  // ===== Concorrência (409) =====
  const velho = await req(tkS, 'PUT', `/correcoes-um-terco/${e01}/respostas`, { baseUpdatedAt: d0.updatedAt, respostas: [{ semanaId: sem[0].id, texto: 'Secretaria com versão antiga.' }] });
  const s1 = (await folhaDoCargo(cargo.p01)).respostas.find(x => x.semanaId === sem[0].id)?.texto;
  r('28', 'Concorrência: correção com versão antiga recebe 409 com a versão atual e nada é sobrescrito', '409; CONFLITO_VERSAO; semana 1 intacta', `${velho.status}; ${velho.json.codigo}; "${s1}"`, velho.status === 409 && velho.json.codigo === 'CONFLITO_VERSAO' && !!velho.json.dadosAtuais?.semanas && s1 === 'P01 semana 1: texto original.');

  // ===== Enviar para correção =====
  const vazia = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e01}/devolver`, { observacao: '  ' });
  r('10', 'Mensagem obrigatória ao enviar para correção', '400', vazia.status, vazia.status === 400);
  const dev1 = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e01}/devolver`, { observacao: 'Revise a Semana 3 e detalhe o que foi trabalhado.' });
  const c1 = await prisma.correcaoEntregaUmTerco.findUnique({ where: { id: dev1.json.id } });
  r('09/12', 'Enviar para correção abre 3 dias exatos a partir da devolução', '201; prazo = criada + 72 h', `${dev1.status}; ${(c1.prazoAte - c1.criadaEm) / H} h`, dev1.status === 201 && c1.prazoAte - c1.criadaEm === 72 * H);
  const msgDev = await prisma.mensagem.findFirst({ where: { conversaId: c1.conversaId ?? -1 } });
  r('11', 'Professor recebe a mensagem com as orientações e o prazo (conversa guardada na correção)', 'mensagem na conversa da devolução', msgDev ? msgDev.conteudo.replace(/\n+/g, ' | ').slice(0, 160) : 'sem mensagem', !!msgDev && /Revise a Semana 3/.test(msgDev.conteudo) && /Prazo:/.test(msgDev.conteudo));

  // Professor: folha inteira editável, depois do prazo do ciclo (ciclo não reaberto).
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: new Date(Date.now() - H) } });
  const detP = (await req(tk.p01, 'GET', rotaP('p01'))).json;
  const editaTudo = await req(tk.p01, 'PUT', `${rotaP('p01')}/respostas`, { baseUpdatedAt: detP.updatedAt, respostas: sem.map(x => ({ semanaId: x.id, texto: `P01 semana ${x.numero}: REVISADO pelo professor.` })) });
  const outraFolha = (await req(tk.p15, 'GET', rotaP('p15'))).json;
  const putOutra = await req(tk.p15, 'PUT', `${rotaP('p15')}/respostas`, { baseUpdatedAt: outraFolha.updatedAt, respostas: [{ semanaId: sem[0].id, texto: 'não pode' }] });
  const ciclo = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { reaberturas: true } });
  r('13/24/25', 'Com o ciclo encerrado: a folha devolvida aceita alteração em TODAS as semanas; outra folha continua bloqueada; o ciclo não é reaberto', `editável; ${sem.length} semanas gravadas; outra 400; reaberturas iguais`, `editável ${detP.editavelAgora}; PUT ${editaTudo.status}; outra ${outraFolha.editavelAgora}/${putOutra.status}; reaberturas ${reaberturasAntes} → ${ciclo.reaberturas.length}`, ciclo.reaberturas.length === reaberturasAntes && detP.editavelAgora === true && editaTudo.status === 200 && outraFolha.editavelAgora === false && putOutra.status === 400);
  const histProf = await prisma.historicoCorrecaoSemanaUmTerco.count({ where: { entregaId: e01, origem: 'PROFESSOR_POS_DEVOLUCAO' } });
  r('22a', 'Alterações do Professor durante a correção entram no histórico (valor anterior/novo)', `${sem.length} linhas PROFESSOR_POS_DEVOLUCAO`, histProf, histProf === sem.length);

  // Reenvio: exige todas as semanas; registra; avisa quem devolveu na mesma conversa + sininho.
  const comVazia = await req(tk.p01, 'PUT', `${rotaP('p01')}/respostas`, { baseUpdatedAt: editaTudo.json.updatedAt, respostas: [{ semanaId: sem[3].id, texto: '' }] });
  const reenvioVazio = await req(tk.p01, 'POST', `${rotaP('p01')}/concluir`, { baseUpdatedAt: comVazia.json.updatedAt });
  const deVolta = await req(tk.p01, 'PUT', `${rotaP('p01')}/respostas`, { baseUpdatedAt: comVazia.json.updatedAt, respostas: [{ semanaId: sem[3].id, texto: 'P01 semana 4: REVISADO pelo professor.' }] });
  const [re1, re2] = await Promise.all([req(tk.p01, 'POST', `${rotaP('p01')}/concluir`, { baseUpdatedAt: deVolta.json.updatedAt }), req(tk.p01, 'POST', `${rotaP('p01')}/concluir`, { baseUpdatedAt: deVolta.json.updatedAt })]);
  const c1b = await prisma.correcaoEntregaUmTerco.findUnique({ where: { id: c1.id } });
  const avisoReenvio = await prisma.mensagem.findMany({ where: { conversaId: c1.conversaId, remetenteId: pid.p01 } });
  const sininho = await prisma.notificacao.count({ where: { destinatarioId: sec.id, chaveIdempotencia: `reenvio-um-terco-${c1.id}` } });
  r('14', 'Reenvio: semana em branco recusada; depois reenvia (clique duplo = 1 vez), registra e avisa quem devolveu na conversa da devolução + sininho', '400; RESOLVIDA; 1 mensagem do professor; 1 notificação', `${reenvioVazio.status}; ${re1.status}/${re2.status}; ${c1b.status}; mensagens ${avisoReenvio.length}; sininho ${sininho}`, reenvioVazio.status === 400 && c1b.status === 'RESOLVIDA' && avisoReenvio.length === 1 && sininho === 1);
  const d2 = await det(e01);
  const reenviadas = await lista('?situacao=recebida');
  r('15', 'Secretaria vê a correção reenviada (detalhe e filtro por situação)', 'recebida; na lista "recebida"; pode considerar resolvida', `${d2.situacao}; na lista ${tem(reenviadas, e01)}; podeConsiderarResolvida ${d2.podeConsiderarResolvida}`, d2.situacao === 'recebida' && tem(reenviadas, e01) && d2.podeConsiderarResolvida);
  const pAposReenvio = (await req(tk.p01, 'GET', rotaP('p01'))).json;
  r('15b', 'Depois do reenvio, com o ciclo encerrado, a folha volta a ser só leitura para o Professor', 'editável false', String(pAposReenvio.editavelAgora), pAposReenvio.editavelAgora === false);

  // ===== Rodadas: segunda e terceira devolução (sem limite), cada uma com 3 dias novos =====
  const rodadas = [];
  for (let i = 2; i <= 4; i++) {
    const dv = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e01}/devolver`, { observacao: `Rodada ${i}: ajuste a Semana ${i - 1}.` });
    const c = await prisma.correcaoEntregaUmTerco.findUnique({ where: { id: dv.json.id } });
    const atual = (await req(tk.p01, 'GET', rotaP('p01'))).json;
    await req(tk.p01, 'PUT', `${rotaP('p01')}/respostas`, { baseUpdatedAt: atual.updatedAt, respostas: [{ semanaId: sem[i - 2].id, texto: `P01 semana ${i - 1}: ajustada na rodada ${i}.` }] });
    const atual2 = (await req(tk.p01, 'GET', rotaP('p01'))).json;
    await req(tk.p01, 'POST', `${rotaP('p01')}/concluir`, { baseUpdatedAt: atual2.updatedAt });
    rodadas.push({ status: dv.status, horas: (c.prazoAte - c.criadaEm) / H, novo: c.prazoAte > c1.prazoAte });
  }
  const todasCorr = await prisma.correcaoEntregaUmTerco.findMany({ where: { entregaId: e01 }, orderBy: { criadaEm: 'asc' } });
  r('16/17/18/19', 'Segunda, terceira e quarta devoluções: cada uma com 3 dias NOVOS, sem limite de rodadas; anteriores ficam "devolvida"', '3× 201, 72 h, prazos novos; 4 correções', `${rodadas.map(x => `${x.status}/${x.horas}h/${x.novo ? 'novo' : 'velho'}`).join(' ')}; ${todasCorr.length} correções: ${todasCorr.map(c => c.conferencia ?? c.status).join(',')}`, rodadas.every(x => x.status === 201 && x.horas === 72 && x.novo) && todasCorr.length === 4 && todasCorr.slice(0, 3).every(c => c.conferencia === 'DEVOLVIDA'));
  const resolver = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e01}/aceitar`);
  r('11b', 'Secretaria considera resolvida', '200; situação aceita', `${resolver.status}; ${(await det(e01)).situacao}`, resolver.status === 200 && (await det(e01)).situacao === 'aceita');

  // ===== Expiração (3 dias sem reenvio) e nova correção depois =====
  const dvE = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e15}/devolver`, { observacao: 'Complete a semana 2.' });
  await prisma.correcaoEntregaUmTerco.update({ where: { id: dvE.json.id }, data: { prazoAte: new Date(Date.now() - 60000) } });
  const p15 = (await req(tk.p15, 'GET', rotaP('p15'))).json;
  const putExp = await req(tk.p15, 'PUT', `${rotaP('p15')}/respostas`, { baseUpdatedAt: p15.updatedAt, respostas: [{ semanaId: sem[1].id, texto: 'depois de expirar' }] });
  const reenvExp = await req(tk.p15, 'POST', `${rotaP('p15')}/concluir`, { baseUpdatedAt: p15.updatedAt });
  const cE = await prisma.correcaoEntregaUmTerco.findUnique({ where: { id: dvE.json.id } });
  const dE = await det(e15);
  r('20', 'Expirada: folha volta a só leitura (ciclo encerrado), nada é apagado, reenvio não acontece; Secretaria vê "expirada"', 'situação expirada; editável false; PUT 400; correção continua ABERTA (sem RESOLVIDA)', `prof ${p15.correcao?.situacao}/${p15.editavelAgora}; PUT ${putExp.status}; reenvio ${reenvExp.status}; banco ${cE.status}; Secretaria ${dE.situacao}; semanas ${dE.semanas.filter(s => s.texto).length}`, p15.correcao?.situacao === 'expirada' && p15.editavelAgora === false && putExp.status === 400 && cE.status === 'ABERTA' && dE.situacao === 'expirada' && dE.semanas.every(s => s.texto));
  const dvNova = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e15}/devolver`, { observacao: 'Nova correção depois de expirada.' });
  const cN = await prisma.correcaoEntregaUmTerco.findUnique({ where: { id: dvNova.json.id } });
  const p15b = (await req(tk.p15, 'GET', rotaP('p15'))).json;
  r('21', 'Nova correção depois de expirada: 3 dias novos e a folha volta a ser editável', '201; 72 h; editável', `${dvNova.status}; ${(cN.prazoAte - cN.criadaEm) / H} h; editável ${p15b.editavelAgora}`, dvNova.status === 201 && cN.prazoAte - cN.criadaEm === 72 * H && p15b.editavelAgora === true);

  // ===== Folha compartilhada (P07, cargos iguais): uma correção para a folha =====
  const dv07 = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e07}/devolver`, { observacao: 'Revise a semana 1.' });
  const d07 = await det(e07);
  const corr07 = await prisma.correcaoEntregaUmTerco.count({ where: { entregaId: e07 } });
  const minhas07 = (await req(tk.p07, 'GET', '/formulario-um-terco/minhas')).json.filter(i => i.ciclo.id === 1);
  r('27', 'Folha compartilhada (2 cargos iguais): uma correção da folha, cabeçalho com o aviso dos dois cargos', '1 correção; compartilhada; aviso; 1 card com correção', `${dv07.status}; correções ${corr07}; compartilhada ${d07.compartilhada}; aviso ${!!d07.avisoCompartilhada}; cards ${minhas07.length} (${minhas07.map(i => i.correcaoSolicitada).join(',')})`, dv07.status === 201 && corr07 === 1 && d07.compartilhada && !!d07.avisoCompartilhada && minhas07.length === 1 && minhas07[0].correcaoSolicitada);

  // ===== Cargo encerrado: só consulta =====
  const [c05] = await cargosDe('p05');
  await req(tkS, 'POST', `/pessoas/professores/${pid.p05}/cargos/${c05}/encerrar`, { dataFim: new Date(Date.now() - 3 * H).toISOString().slice(0, 10) });
  const d05 = await det(e05);
  const corr05 = await req(tkS, 'PUT', `/correcoes-um-terco/${e05}/respostas`, { baseUpdatedAt: d05.updatedAt, respostas: [{ semanaId: sem[0].id, texto: 'x' }] });
  const dev05 = await req(tkS, 'POST', `/formulario-um-terco/entregas/${e05}/devolver`, { observacao: 'x' });
  r('C-ENC', 'Folha de cargo encerrado: Secretaria consulta (detalhe e histórico), mas não corrige nem devolve', 'detalhe 200 só consulta; 400 e 400', `consulta ${d05.somenteConsulta}; corrigir ${corr05.status}; devolver ${dev05.status}`, d05.somenteConsulta === true && corr05.status === 400 && dev05.status === 400);

  const linha = (await det(e01)).linhaDoTempo.map(e => e.texto.split(' (')[0].split(' ·')[0]);
  const espera = ['Professor concluiu a folha', 'Secretaria corrigiu diretamente', 'Secretaria solicitou correção', 'Professor alterou durante a correção', 'Professor reenviou a correção', 'Secretaria devolveu novamente', 'Secretaria considerou resolvida'];
  r('22', 'Linha do tempo completa da folha', espera.join(' / '), [...new Set(linha)].join(' / '), espera.every(t => linha.includes(t)));

  const perm = await req(tk.p01, 'GET', '/correcoes-um-terco');
  r('PERM', 'Professor não acessa Correções → 1/3', '403', perm.status, perm.status === 403);
} finally {
  await prisma.cicloUmTerco.update({ where: { id: 1 }, data: { prazoEm: ciclo1.prazoEm } });
  const convs = (await prisma.conversaMensagem.findMany({ where: { createdAt: { gte: inicio }, assunto: { startsWith: 'Correção' } }, select: { id: true } })).map(c => c.id);
  await prisma.mensagem.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.participanteConversa.deleteMany({ where: { conversaId: { in: convs } } });
  await prisma.conversaMensagem.deleteMany({ where: { id: { in: convs } } });
  await prisma.notificacao.deleteMany({ where: { createdAt: { gte: inicio } } });
  await prepararCargosHomolog(); // apaga as folhas por cargo (e correções/histórico ligados) e recria os cargos de teste
  await prisma.$disconnect();
}

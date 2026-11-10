// DEF-14 — verificações complementares depois da correção (API + banco local):
//  C1 Correções da Secretaria continuam mostrando o bloco ORIGINAL (fotografia) da ficha concluída;
//  C2 turma sem professor responsável na disciplina: bloco só leitura e gravação recusada (Gestor);
//  C3 o comportamento QUE-03 (novo professor edita respostas de disciplina de ficha concluída) NÃO foi alterado.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340';
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const tSec = await token('secretaria@escola.gov.br', '12345678');
const tGes = await token('gestor.aur@homolog.nexo', 'Nexo!Homolog-2026');
const tP10 = await token('p10@homolog.nexo', 'Nexo!Prof10-2026');

// C1 — ficha de Arte concluída pela P04 da última "DEF14 Ana" (hoje transferida para a Boa Vista).
const ana = await prisma.alunoPdi.findFirst({ where: { nome: { startsWith: 'DEF14 Ana' } }, orderBy: { id: 'desc' } });
const fArte = await prisma.fichaPdi.findFirst({ where: { alunoId: ana.id, aplicacaoId: 1, disciplinaId: 3 } });
const det = await api(tSec, 'GET', `/api/correcoes-pdi/${fArte.id}`);
const blocoTxt = JSON.stringify(det.json?.blocoPadrao?.respostas ?? det.json?.ficha?.blocoPadrao?.respostas ?? det.json);
registrar('DEF14-DEPOIS-C1', 'PDI bloco comum (DEF-14)', 'Correções da Secretaria mostram as perguntas comuns ORIGINAIS da professora que concluiu (P04), não as do novo professor', 'texto da P04', `HTTP ${det.status}; contém P04: ${blocoTxt.includes('P04 simultâneo')}; contém P10: ${blocoTxt.includes('P10 escreveu')}`, det.status === 200 && blocoTxt.includes('P04 simultâneo') && !blocoTxt.includes('P10 escreveu') ? 'APROVADO' : 'REPROVADO');

// C2 — Lucas está na 6M3, que não tem professor de Inglês: ficha de Inglês (criada pela P04 na 6M1).
const fIng = await prisma.fichaPdi.findFirst({ where: { alunoId: 1, aplicacaoId: 1, disciplinaId: 9 } });
const blocoP04Antes = JSON.stringify((await prisma.respostaPadraoPdi.findMany({ where: { bloco: { alunoId: 1, turmaId: 1, professorId: 14, aplicacaoId: 1 } } })).map(r => r.valor));
const g = await api(tGes, 'GET', `/api/pdi-fichas/1/1/9`);
const perg = g.json?.blocoPadrao?.perguntas?.find(p => p.tipoResposta !== 'ORIENTACAO');
const put = perg ? await api(tGes, 'PUT', `/api/pdi-fichas/${fIng.id}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: perg.id, valor: { resposta: 'GESTOR tentou gravar no bloco da P04', complementarTexto: '' } }], version: g.json.blocoPadrao.version }) : { status: 'sem pergunta' };
const blocoP04Depois = JSON.stringify((await prisma.respostaPadraoPdi.findMany({ where: { bloco: { alunoId: 1, turmaId: 1, professorId: 14, aplicacaoId: 1 } } })).map(r => r.valor));
registrar('DEF14-DEPOIS-C2', 'PDI bloco comum (DEF-14)', 'Turma sem professor responsável na disciplina: Gestor vê as perguntas comuns só para leitura e não grava no bloco da professora que saiu', 'editavelAgora=false; gravação 403; bloco da P04 intacto', `GET ${g.status}; editavelAgora ${g.json?.blocoPadrao?.editavelAgora}; PUT ${put.status} ${JSON.stringify(put.json ?? '').slice(0, 80)}; bloco P04 intacto: ${blocoP04Antes === blocoP04Depois}`, g.status === 200 && g.json?.blocoPadrao?.editavelAgora === false && put.status === 403 && blocoP04Antes === blocoP04Depois ? 'APROVADO' : 'REPROVADO');

// C3 — QUE-03 continua como antes (regra pendente da Secretaria): P10 continua podendo gravar respostas
// de disciplina na ficha de Arte criada pela P04 (Lucas, hoje na 6M3, onde Arte = P10). A edição de
// ficha CONCLUÍDA por outro professor já foi comprovada em PDI-TRF-T9; aqui só se confirma que a
// correção do DEF-14 não mudou esse comportamento.
const fArteLucas = await prisma.fichaPdi.findFirst({ where: { alunoId: 1, aplicacaoId: 1, disciplinaId: 3 }, include: { respostas: true } });
const c3 = await api(tP10, 'PUT', `/api/pdi-fichas/${fArteLucas.id}/respostas`, { respostas: fArteLucas.respostas.map(x => ({ aplicacaoPerguntaId: x.aplicacaoPerguntaId, valor: x.valor })), baseUpdatedAt: (fArteLucas.updatedAt ?? fArteLucas.createdAt).toISOString() });
registrar('DEF14-DEPOIS-C3', 'PDI bloco comum (DEF-14)', 'QUE-03 inalterado de propósito: novo professor (P10) ainda pode gravar respostas de disciplina na ficha de outro professor (regra pendente da Secretaria)', 'comportamento anterior preservado (200)', `PUT ${c3.status} (mesmos valores, nada alterado de conteúdo); status da ficha ${fArteLucas.status}`, c3.status === 200 ? 'APROVADO' : 'REPROVADO', '', 'Não é aprovação da regra: só confirma que a correção do DEF-14 não decidiu o QUE-03.');
await prisma.$disconnect();

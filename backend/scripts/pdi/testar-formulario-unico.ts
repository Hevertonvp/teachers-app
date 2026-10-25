// Teste de integração (API real via createApp) do formulário único do aluno: pergunta padrão
// compartilhada x por disciplina, bloco comum salvo uma vez, Fichas separadas por disciplina,
// CRMG isolado, conclusão por Ficha, Correções e Ficha Anual — exatamente a sequência de chamadas
// que FormularioPdiAlunoPage.jsx faz. CRIA dados de teste: só roda contra banco descartável
// (localhost, ou host confirmado em CONFIRMAR_BANCO_TESTE — ver scripts/trimestres/testar-calendario.ts).
// Pré-requisito: calendário de trimestres do ano atual completo e contendo hoje.
//
// Uso: npx tsx scripts/pdi/testar-formulario-unico.ts
import 'dotenv/config';
import type { AddressInfo } from 'node:net';

const url = process.env.DATABASE_URL ?? '';
const host = url.match(/@([^/:?]+)/)?.[1] ?? '';
if (!/^(localhost|127\.0\.0\.1)$/.test(host) && process.env.CONFIRMAR_BANCO_TESTE !== host) {
  console.error(`Recusado: este teste cria dados. Confirme o host do banco descartável em CONFIRMAR_BANCO_TESTE (host atual: "${host}").`);
  process.exit(1);
}

const { createApp } = await import('../../src/api/app.js');
const { assinarToken } = await import('../../src/api/middleware/auth.js');
const { prisma } = await import('../../src/lib/prisma.js');

let falhas = 0;
let total = 0;
const ok = (cond: unknown, nome: string, detalhe?: unknown) => {
  total++;
  if (cond) console.log(`  ✔ ${nome}`);
  else { falhas++; console.log(`  ✘ ${nome}${detalhe !== undefined ? ` — ${JSON.stringify(detalhe).slice(0, 500)}` : ''}`); }
};
const secao = (t: string) => console.log(`\n${t}`);

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
type Resp = { status: number; data: any };
const api = async (token: string, method: string, path: string, body?: unknown): Promise<Resp> => {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const hoje = new Date().toISOString().slice(0, 10);
const ano = Number(hoje.slice(0, 4));

const aplicacoesAntigas = await prisma.aplicacaoPdi.findMany({ select: { id: true } });
const foto = async () => JSON.stringify({
  perguntas: await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId: { in: aplicacoesAntigas.map((a) => a.id) } } }, orderBy: { id: 'asc' } }),
  padrao: await prisma.aplicacaoPerguntaPadraoPdi.findMany({ where: { aplicacaoId: { in: aplicacoesAntigas.map((a) => a.id) } }, orderBy: { id: 'asc' } }),
});
const antes = await foto();

// --- Fixtures ----------------------------------------------------------------------------------
const sufixo = Date.now();
const escola = await prisma.escola.create({ data: { nome: `ESCOLA TESTE FORM UNICO ${sufixo}` } });
await prisma.escolaModulo.create({ data: { escolaId: escola.id, modulo: 'PDI' } });
const turma = await prisma.turma.create({ data: { escolaId: escola.id, anoLetivo: ano, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 92, nome: '6º Teste Único', identidadeChave: `teste-form-unico-${sufixo}` } });
const secretaria = await prisma.pessoa.create({ data: { nome: 'Secretaria Teste Único', email: `sec-unico-${sufixo}@teste.local`, perfil: 'SECRETARIA' } });
const professor = await prisma.pessoa.create({ data: { nome: 'Professor Teste Único', email: `prof-unico-${sufixo}@teste.local`, perfil: 'PROFESSOR' } });
await prisma.vinculoEscolar.create({ data: { escolaId: escola.id, pessoaId: professor.id, dataInicio: new Date() } });
const aluno = await prisma.alunoPdi.create({ data: { nome: 'Aluno Teste Único', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0000' } });
const tSec = assinarToken(secretaria);
const tProf = assinarToken(professor);

// Duas disciplinas de teste (nunca colidem com os Modelos ativos reais), mapeadas pra componentes
// curriculares DIFERENTES — exercita o isolamento do CRMG entre as duas Fichas.
const discA = await prisma.disciplina.create({ data: { nome: `Teste Único A ${sufixo}` } });
const discB = await prisma.disciplina.create({ data: { nome: `Teste Único B ${sufixo}` } });
await prisma.disciplinaComponenteCurricular.create({ data: { disciplinaId: discA.id, componente: 'MATEMATICA' } });
await prisma.disciplinaComponenteCurricular.create({ data: { disciplinaId: discB.id, componente: 'LINGUA_INGLESA' } });
for (const d of [discA, discB]) await prisma.professorTurmaDisciplina.create({ data: { turmaId: turma.id, professorId: professor.id, disciplinaId: d.id, dataInicio: new Date() } });

// Perguntas padrão de teste (INATIVAS: nunca entram em Modelos reais criados durante o teste).
const novoPadrao = (dados: { texto: string; tipoResposta: any; origem: any; compartilhada: boolean; trimestre?: number | null; opcoes?: string[]; ordem: number }) =>
  prisma.perguntaPdiPadrao.create({ data: { secao: dados.compartilhada ? 'Comum' : 'Disciplina', texto: `${dados.texto} ${sufixo}`, tipoResposta: dados.tipoResposta, origem: dados.origem, compartilhada: dados.compartilhada, trimestre: dados.trimestre ?? null, opcoes: dados.opcoes ?? [], ordem: 910000 + dados.ordem, status: 'INATIVA' } });
const pAdapt = await novoPadrao({ texto: 'Adaptação?', tipoResposta: 'SELECAO', origem: 'ESTRUTURADA', compartilhada: true, opcoes: ['Sim', 'Não'], ordem: 1 });
const pObjetivo = await novoPadrao({ texto: 'Objetivo comum (orientação)', tipoResposta: 'ORIENTACAO', origem: 'ORIENTACAO', compartilhada: true, ordem: 2 });
const pNota = await novoPadrao({ texto: 'Nota do trimestre', tipoResposta: 'NUMERO', origem: 'ESTRUTURADA', compartilhada: false, ordem: 3 });
const pCrmg = await novoPadrao({ texto: 'Habilidades consolidadas', tipoResposta: 'HABILIDADE_CRMG', origem: 'HABILIDADE', compartilhada: false, ordem: 4 });
const pT1 = await novoPadrao({ texto: 'Pergunta do 1º trimestre', tipoResposta: 'TEXTO', origem: 'QUALITATIVA', compartilhada: false, trimestre: 1, ordem: 5 });
const pT2 = await novoPadrao({ texto: 'Pergunta do 2º trimestre', tipoResposta: 'TEXTO', origem: 'QUALITATIVA', compartilhada: false, trimestre: 2, ordem: 6 });
const pT3 = await novoPadrao({ texto: 'Pergunta do 3º trimestre', tipoResposta: 'TEXTO', origem: 'QUALITATIVA', compartilhada: false, trimestre: 3, ordem: 7 });
const padroes = [pAdapt, pObjetivo, pNota, pCrmg, pT1, pT2, pT3];

// Modelos montados como pdiModelos.ts monta (cópia vinculada por padraoOriginalId), um por disciplina.
const novoModelo = (disciplinaId: number) => prisma.modeloPdi.create({
  data: {
    nome: `Modelo Teste Único ${disciplinaId}`, disciplinaId,
    perguntas: { create: padroes.map((p, i) => ({ secao: p.secao, texto: p.texto, origem: p.origem, tipoResposta: p.tipoResposta, opcoes: p.opcoes ?? [], trimestre: p.trimestre, ordem: i + 1, padraoOriginalId: p.id })) },
  },
});
const modeloA = await novoModelo(discA.id);
const modeloB = await novoModelo(discB.id);

try {
  const periodos = await prisma.periodoTrimestre.findMany({ where: { ano } });
  const triHoje = periodos.find((p) => p.dataInicio.toISOString().slice(0, 10) <= hoje && hoje <= p.dataFim.toISOString().slice(0, 10))?.trimestre;
  if (periodos.length !== 3 || !triHoje) throw new Error(`Pré-requisito: calendário de ${ano} completo contendo hoje (tem ${periodos.length} trimestres).`);
  const fimTri = periodos.find((p) => p.trimestre === triHoje)!.dataFim.toISOString().slice(0, 10);
  const pTri = { 1: pT1, 2: pT2, 3: pT3 }[triHoje as 1 | 2 | 3]!;

  secao('1. Pergunta padrão: compartilhada x por disciplina (API)');
  const crmgComp = await api(tSec, 'POST', '/api/pdi-perguntas-padrao', { secao: 'x', texto: 'CRMG compartilhada?', tipoResposta: 'HABILIDADE_CRMG', compartilhada: true });
  ok(crmgComp.status === 400, 'CRMG com resposta compartilhada → 400', crmgComp);
  const crmgPorDisc = await api(tSec, 'POST', '/api/pdi-perguntas-padrao', { secao: 'x', texto: `CRMG por disciplina ${sufixo}`, tipoResposta: 'HABILIDADE_CRMG', compartilhada: false });
  ok(crmgPorDisc.status === 201 && crmgPorDisc.data.compartilhada === false, 'CRMG como pergunta padrão por disciplina → 201', crmgPorDisc);
  const semCampo = await api(tSec, 'POST', '/api/pdi-perguntas-padrao', { secao: 'x', texto: `Sem campo ${sufixo}`, tipoResposta: 'TEXTO' });
  ok(semCampo.status === 201 && semCampo.data.compartilhada === true, 'sem informar → compartilhada (comportamento de sempre)');
  const porDisc = await api(tSec, 'PUT', `/api/pdi-perguntas-padrao/${semCampo.data.id}`, { secao: 'x', texto: `Sem campo ${sufixo}`, tipoResposta: 'TEXTO', compartilhada: false });
  const mantem = await api(tSec, 'PUT', `/api/pdi-perguntas-padrao/${semCampo.data.id}`, { secao: 'x', texto: `Sem campo editado ${sufixo}`, tipoResposta: 'TEXTO' });
  ok(porDisc.data.compartilhada === false && mantem.status === 200 && mantem.data.compartilhada === false, 'editar sem mandar o campo mantém "por disciplina" (nunca reclassifica em silêncio)');
  const viraCrmgComp = await api(tSec, 'PUT', `/api/pdi-perguntas-padrao/${crmgPorDisc.data.id}`, { secao: 'x', texto: 'CRMG', tipoResposta: 'HABILIDADE_CRMG', compartilhada: true });
  ok(viraCrmgComp.status === 400, 'CRMG não pode passar a compartilhada → 400');
  const profPadrao = await api(tProf, 'POST', '/api/pdi-perguntas-padrao', { secao: 'x', texto: 'y', tipoResposta: 'TEXTO' });
  ok(profPadrao.status === 403, 'Professor não gerencia perguntas padrão (403)');
  const banco = await prisma.perguntaPdiPadrao.update({ where: { id: crmgPorDisc.data.id }, data: { compartilhada: true } }).then(() => 'gravou', () => 'recusado');
  ok(banco === 'recusado', 'banco recusa CRMG compartilhada (CHECK)');
  for (const id of [crmgPorDisc.data.id, semCampo.data.id]) await api(tSec, 'DELETE', `/api/pdi-perguntas-padrao/${id}`);

  secao('2. Snapshot: bloco comum só com as compartilhadas; nota/CRMG/trimestre por disciplina');
  const aplic = await api(tSec, 'POST', '/api/pdi-aplicacoes', { escolaId: escola.id, dataInicio: hoje, dataFim: fimTri, modeloIds: [modeloA.id, modeloB.id] });
  ok(aplic.status === 201 && aplic.data.trimestre === triHoje, `Aplicação criada (${triHoje}º trimestre)`, aplic);
  const aplicacaoId = aplic.data.id;
  const [fA, fB] = await Promise.all([discA, discB].map((d) => api(tProf, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId, alunoId: aluno.id, disciplinaId: d.id })));
  ok(fA.status === 200 && fB.status === 200 && fA.data.ficha.id !== fB.data.ficha.id, 'duas Fichas distintas (uma por disciplina), abertas em paralelo');
  const textosBloco = fA.data.blocoPadrao.perguntas.map((p: any) => p.texto);
  ok(JSON.stringify(textosBloco) === JSON.stringify([pAdapt.texto, pObjetivo.texto]), 'bloco comum = só as compartilhadas (adaptação + orientação)', textosBloco);
  ok(JSON.stringify(fB.data.blocoPadrao.perguntas.map((p: any) => p.id)) === JSON.stringify(fA.data.blocoPadrao.perguntas.map((p: any) => p.id)), 'as duas Fichas apontam para o MESMO snapshot do bloco');
  ok(fA.data.blocoPadrao.compartilhadoCom.some((c: any) => c.disciplinaId === discB.id), 'bloco da Ficha A informa que é compartilhado com B');
  const textosA = fA.data.perguntas.map((p: any) => p.texto);
  ok(JSON.stringify(textosA) === JSON.stringify([pNota.texto, pCrmg.texto, pTri.texto]), `Ficha A tem nota, CRMG e SÓ a pergunta do ${triHoje}º trimestre`, textosA);
  const idsA = new Set(fA.data.perguntas.map((p: any) => p.id));
  ok(fB.data.perguntas.length === 3 && fB.data.perguntas.every((p: any) => !idsA.has(p.id)), 'perguntas específicas de B são outras linhas (nunca as de A)');

  secao('3. Bloco comum salvo uma vez — fonte única para as duas disciplinas');
  const pergAdapt = fA.data.blocoPadrao.perguntas.find((p: any) => p.tipoResposta === 'SELECAO');
  const sb = await api(tProf, 'PUT', `/api/pdi-fichas/${fA.data.ficha.id}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: pergAdapt.id, valor: { resposta: 'Sim' } }], version: 0 });
  ok(sb.status === 200 && sb.data.blocoPadrao.version === 1, 'bloco salvo pela Ficha A (versão 0 → 1)', sb);
  const relB = await api(tProf, 'GET', `/api/pdi-fichas/${aplicacaoId}/${aluno.id}/${discB.id}`);
  ok(relB.data.blocoPadrao.version === 1 && relB.data.blocoPadrao.respostas.some((r: any) => r.aplicacaoPerguntaPadraoId === pergAdapt.id && r.valor.resposta === 'Sim'), 'Ficha B enxerga a mesma resposta comum, sem cópia');
  ok((await prisma.respostaPadraoPdi.count({ where: { bloco: { aplicacaoId } } })) === 1, 'uma única linha de resposta comum no banco');
  const velho = await api(tProf, 'PUT', `/api/pdi-fichas/${fB.data.ficha.id}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: pergAdapt.id, valor: { resposta: 'Não' } }], version: 0 });
  ok(velho.status === 409 && velho.data?.codigo === 'CONFLITO_VERSAO', 'salvar o bloco com versão antiga (outra aba) → 409, nunca sobrescreve');

  secao('4. Cada disciplina salva a sua Ficha; falha numa não afeta a outra');
  const habMat = await prisma.habilidadeCurricular.findFirst({ where: { componente: 'MATEMATICA', ativa: true } });
  const habIng = await prisma.habilidadeCurricular.findFirst({ where: { componente: 'LINGUA_INGLESA', ativa: true } });
  const q = (f: Resp, texto: string) => f.data.perguntas.find((p: any) => p.texto === texto);
  const respA = [
    { aplicacaoPerguntaId: q(fA, pNota.texto).id, valor: { resposta: 8 } },
    { aplicacaoPerguntaId: q(fA, pCrmg.texto).id, valor: { habilidadeIds: habMat ? [habMat.id] : [], todas: !habMat } },
    { aplicacaoPerguntaId: q(fA, pTri.texto).id, valor: { resposta: 'Texto de A' } },
  ];
  const sA = await api(tProf, 'PUT', `/api/pdi-fichas/${fA.data.ficha.id}/respostas`, { respostas: respA, baseUpdatedAt: fA.data.ficha.updatedAt ?? fA.data.ficha.createdAt });
  ok(sA.status === 200 && sA.data.ficha.status === 'EM_ANDAMENTO', 'Ficha A salva (nota, CRMG de Matemática, pergunta do trimestre)', sA);
  if (habMat) {
    const errado = await api(tProf, 'PUT', `/api/pdi-fichas/${fB.data.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: q(fB, pCrmg.texto).id, valor: { habilidadeIds: [habMat.id] } }], baseUpdatedAt: fB.data.ficha.updatedAt ?? fB.data.ficha.createdAt });
    ok(errado.status === 400, 'Ficha B (Inglês) recusa habilidade de Matemática → 400 (CRMG isolado)', errado);
  }
  const cruzado = await api(tProf, 'PUT', `/api/pdi-fichas/${fB.data.ficha.id}/respostas`, { respostas: [{ aplicacaoPerguntaId: q(fA, pNota.texto).id, valor: { resposta: 3 } }], baseUpdatedAt: fB.data.ficha.updatedAt ?? fB.data.ficha.createdAt });
  ok(cruzado.status === 400, 'pergunta da Ficha A enviada na Ficha B → 400 (Matemática nunca recebe resposta de Inglês)');
  const aDepois = await api(tProf, 'GET', `/api/pdi-fichas/${aplicacaoId}/${aluno.id}/${discA.id}`);
  ok(aDepois.data.respostas.length === 3 && aDepois.data.ficha.status === 'EM_ANDAMENTO', 'falhas em B não desfizeram nada de A');
  const bAtual = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fB.data.ficha.id } });
  ok(bAtual.status === 'PENDENTE', 'Ficha B continua PENDENTE após as falhas (nada gravado pela metade)');
  const respB = [
    { aplicacaoPerguntaId: q(fB, pNota.texto).id, valor: { resposta: 5 } },
    { aplicacaoPerguntaId: q(fB, pCrmg.texto).id, valor: { habilidadeIds: habIng ? [habIng.id] : [], todas: !habIng } },
    { aplicacaoPerguntaId: q(fB, pTri.texto).id, valor: { resposta: 'Texto de B' } },
  ];
  const sB = await api(tProf, 'PUT', `/api/pdi-fichas/${fB.data.ficha.id}/respostas`, { respostas: respB, baseUpdatedAt: (bAtual.updatedAt ?? bAtual.createdAt).toISOString() });
  ok(sB.status === 200, 'reenvio da Ficha B corrigida funciona', sB);
  const notas = await prisma.respostaPdi.findMany({ where: { fichaId: { in: [fA.data.ficha.id, fB.data.ficha.id] }, aplicacaoPergunta: { tipoResposta: 'NUMERO' } }, select: { fichaId: true, valor: true } });
  ok(notas.length === 2 && (notas.find((n) => n.fichaId === fA.data.ficha.id)?.valor as any)?.resposta === 8 && (notas.find((n) => n.fichaId === fB.data.ficha.id)?.valor as any)?.resposta === 5, 'nota é por disciplina: A = 8, B = 5');

  secao('5. Conclusão por Ficha (orientação no bloco nunca impede concluir)');
  const cA = await api(tProf, 'POST', `/api/pdi-fichas/${fA.data.ficha.id}/concluir`);
  ok(cA.status === 200 && cA.data.ficha.status === 'CONCLUIDA', 'concluir A (bloco tem ORIENTACAO sem resposta — não conta)', cA);
  const bAinda = await prisma.fichaPdi.findUniqueOrThrow({ where: { id: fB.data.ficha.id } });
  ok(bAinda.status === 'EM_ANDAMENTO', 'concluir A não conclui B');
  const cB = await api(tProf, 'POST', `/api/pdi-fichas/${fB.data.ficha.id}/concluir`);
  ok(cB.status === 200 && cB.data.ficha.status === 'CONCLUIDA', 'concluir B');

  secao('6. Correções, Ficha Anual, Meus PDIs');
  const devPadrao = await api(tSec, 'POST', `/api/correcoes-pdi/${fA.data.ficha.id}/devolver-padrao`, { observacao: 'rever adaptação' });
  ok(devPadrao.status === 200 || devPadrao.status === 201, 'devolver o bloco comum (uma vez, vale pras duas)', devPadrao);
  const relA = await api(tProf, 'GET', `/api/pdi-fichas/${aplicacaoId}/${aluno.id}/${discA.id}`);
  const relB2 = await api(tProf, 'GET', `/api/pdi-fichas/${aplicacaoId}/${aluno.id}/${discB.id}`);
  ok(relA.data.blocoPadrao.editavelAgora && relB2.data.blocoPadrao.editavelAgora, 'bloco devolvido fica editável a partir das duas Fichas');
  const corrige = await api(tProf, 'PUT', `/api/pdi-fichas/${fB.data.ficha.id}/respostas-padrao`, { respostas: [{ aplicacaoPerguntaPadraoId: pergAdapt.id, valor: { resposta: 'Não' } }], version: relB2.data.blocoPadrao.version });
  ok(corrige.status === 200, 'Professor corrige o bloco uma vez (pela Ficha B)', corrige);
  const corrBloco = await prisma.correcaoBlocoPadraoPdi.findFirst({ where: { bloco: { aplicacaoId } }, orderBy: { id: 'desc' } });
  ok(corrBloco?.status === 'RESOLVIDA', 'correção do bloco resolvida pra todas as disciplinas');
  const hist = await prisma.historicoCorrecaoRespostaPadrao.findFirst({ where: { bloco: { aplicacaoId } }, orderBy: { id: 'desc' } });
  ok((hist?.valorAnterior as any)?.resposta === 'Sim' && (hist?.valorNovo as any)?.resposta === 'Não', 'histórico/auditoria do bloco com valor anterior e novo');
  const anual = await api(tSec, 'GET', `/api/pdi-ficha-anual/${aluno.id}/${ano}`);
  const fichasAnual = anual.data?.periodos?.find((p: any) => p.aplicacaoId === aplicacaoId)?.fichas ?? [];
  ok(anual.status === 200 && fichasAnual.length === 2, 'Ficha Anual mostra as duas Fichas separadas', fichasAnual);
  const meus = await api(tProf, 'GET', '/api/pdi-fichas/meus-pdis');
  const doAluno = meus.data.filter((l: any) => l.aplicacaoId === aplicacaoId && l.alunoId === aluno.id);
  ok(doAluno.length === 2 && doAluno.every((l: any) => l.existeFicha), 'Meus PDIs devolve as 2 disciplinas do aluno (a tela agrupa numa linha só)');

  secao('7. Dados antigos');
  ok((await foto()) === antes, 'snapshots de Aplicações pré-existentes intactos');
} finally {
  server.close();
  await prisma.$disconnect();
  console.log(`\n${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  if (falhas) process.exitCode = 1;
}

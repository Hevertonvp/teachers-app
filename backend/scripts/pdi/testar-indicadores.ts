// Teste de integração (API real via createApp) dos indicadores do PDI: GET /api/pdi-indicadores/
// alunos/:id (perfil do aluno) e os campos novos de GET /api/pdi-aplicacoes/indicadores (página
// principal). Cenário: 1 aluno, 2 disciplinas com PROFESSORES DIFERENTES (média do bloco comum),
// 2 períodos (evolução). CRIA dados de teste: só roda contra banco descartável (localhost, ou host
// confirmado em CONFIRMAR_BANCO_TESTE). Pré-requisito: calendário do ano atual completo contendo hoje.
//
// Uso: npx tsx scripts/pdi/testar-indicadores.ts
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
  else { falhas++; console.log(`  ✘ ${nome}${detalhe !== undefined ? ` — ${JSON.stringify(detalhe).slice(0, 600)}` : ''}`); }
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
const sufixo = Date.now();

// --- Fixtures ----------------------------------------------------------------------------------
const escola = await prisma.escola.create({ data: { nome: `ESCOLA TESTE INDICADORES ${sufixo}` } });
await prisma.escolaModulo.create({ data: { escolaId: escola.id, modulo: 'PDI' } });
const outraEscola = await prisma.escola.create({ data: { nome: `ESCOLA TESTE INDICADORES OUTRA ${sufixo}` } });
const turma = await prisma.turma.create({ data: { escolaId: escola.id, anoLetivo: ano, etapa: 'FUNDAMENTAL', anoSerie: 7, turno: 'MANHA', identificador: 93, nome: '7º Teste Ind', identidadeChave: `teste-ind-${sufixo}` } });
const pessoa = (perfil: any, nome: string) => prisma.pessoa.create({ data: { nome, email: `${nome.replace(/\s/g, '').toLowerCase()}-${sufixo}@teste.local`, perfil } });
const sec = await pessoa('SECRETARIA', 'Sec Ind');
const profA = await pessoa('PROFESSOR', 'Prof A Ind');
const profB = await pessoa('PROFESSOR', 'Prof B Ind');
const gestor = await pessoa('GESTOR', 'Gestor Ind');
const gestorFora = await pessoa('GESTOR', 'Gestor Fora Ind');
const diretora = await pessoa('DIRETORA', 'Diretora Ind');
const auxiliar = await pessoa('AUXILIAR', 'Aux Ind');
const suporte = await pessoa('SUPORTE_SISTEMA', 'Suporte Ind');
for (const p of [profA, profB, gestor, diretora, auxiliar]) await prisma.vinculoEscolar.create({ data: { escolaId: escola.id, pessoaId: p.id, dataInicio: new Date() } });
await prisma.vinculoEscolar.create({ data: { escolaId: outraEscola.id, pessoaId: gestorFora.id, dataInicio: new Date() } });
const t = Object.fromEntries(Object.entries({ sec, profA, profB, gestor, gestorFora, diretora, auxiliar, suporte }).map(([k, p]) => [k, assinarToken(p)])) as Record<string, string>;

const discA = await prisma.disciplina.create({ data: { nome: `Ind A ${sufixo}` } });
const discB = await prisma.disciplina.create({ data: { nome: `Ind B ${sufixo}` } });
await prisma.disciplinaComponenteCurricular.create({ data: { disciplinaId: discA.id, componente: 'MATEMATICA' } });
await prisma.disciplinaComponenteCurricular.create({ data: { disciplinaId: discB.id, componente: 'LINGUA_INGLESA' } });
await prisma.professorTurmaDisciplina.create({ data: { turmaId: turma.id, professorId: profA.id, disciplinaId: discA.id, dataInicio: new Date() } });
await prisma.professorTurmaDisciplina.create({ data: { turmaId: turma.id, professorId: profB.id, disciplinaId: discB.id, dataInicio: new Date() } });
const aluno = await prisma.alunoPdi.create({ data: { nome: 'Aluno Teste Ind', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0000' } });

const OPCOES = ['Autônomo', 'Pouca mediação', 'Mediação frequente', 'Mediação constante'];
const padrao = (dados: any, ordem: number) => prisma.perguntaPdiPadrao.create({ data: { secao: 'Teste', opcoes: [], status: 'INATIVA', ...dados, texto: `${dados.texto} ${sufixo}`, ordem: 920000 + ordem } });
const pAdapt = await padrao({ texto: 'Adaptação', tipoResposta: 'SELECAO', origem: 'ESTRUTURADA', compartilhada: true, opcoes: OPCOES }, 1);
const pPart = await padrao({ texto: 'Participação', tipoResposta: 'SELECAO', origem: 'ESTRUTURADA', compartilhada: true, opcoes: OPCOES }, 2);
const pNota = await padrao({ texto: 'Nota', tipoResposta: 'NUMERO', origem: 'ESTRUTURADA', compartilhada: false }, 3);
const pCons = await padrao({ texto: 'Consolidadas', tipoResposta: 'HABILIDADE_CRMG', origem: 'HABILIDADE', compartilhada: false }, 4);
const pTexto = await padrao({ texto: 'Registro do trimestre', tipoResposta: 'TEXTO', origem: 'QUALITATIVA', compartilhada: false }, 5);
const padroes = [pAdapt, pPart, pNota, pCons, pTexto];
const novoModelo = (disciplinaId: number) => prisma.modeloPdi.create({ data: { nome: `Modelo Ind ${disciplinaId}`, disciplinaId, perguntas: { create: padroes.map((p, i) => ({ secao: p.secao, texto: p.texto, origem: p.origem, tipoResposta: p.tipoResposta, opcoes: p.opcoes ?? [], ordem: i + 1, padraoOriginalId: p.id })) } } });
const modeloA = await novoModelo(discA.id);
const modeloB = await novoModelo(discB.id);

// Preenche as duas Fichas de UMA Aplicação, cada uma pelo seu professor.
const preencher = async (aplicacaoId: number, cfg: { disc: number; token: string; adapt: string; part: string; nota: number; habs: number[] | 'todas'; texto: string; concluir: boolean }) => {
  const f = await api(cfg.token, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId, alunoId: aluno.id, disciplinaId: cfg.disc });
  const q = (txt: string) => f.data.perguntas.find((p: any) => p.texto === txt);
  const qp = (txt: string) => f.data.blocoPadrao.perguntas.find((p: any) => p.texto === txt);
  await api(cfg.token, 'PUT', `/api/pdi-fichas/${f.data.ficha.id}/respostas-padrao`, { version: f.data.blocoPadrao.version, respostas: [
    { aplicacaoPerguntaPadraoId: qp(pAdapt.texto).id, valor: { resposta: cfg.adapt } },
    { aplicacaoPerguntaPadraoId: qp(pPart.texto).id, valor: { resposta: cfg.part } },
  ] });
  const s = await api(cfg.token, 'PUT', `/api/pdi-fichas/${f.data.ficha.id}/respostas`, { baseUpdatedAt: f.data.ficha.updatedAt ?? f.data.ficha.createdAt, respostas: [
    { aplicacaoPerguntaId: q(pNota.texto).id, valor: { resposta: cfg.nota } },
    { aplicacaoPerguntaId: q(pCons.texto).id, valor: cfg.habs === 'todas' ? { todas: true, habilidadeIds: [] } : { habilidadeIds: cfg.habs } },
    { aplicacaoPerguntaId: q(pTexto.texto).id, valor: { resposta: cfg.texto } },
  ] });
  if (s.status !== 200) throw new Error(`falha ao salvar ficha: ${JSON.stringify(s.data)}`);
  if (cfg.concluir) await api(cfg.token, 'POST', `/api/pdi-fichas/${f.data.ficha.id}/concluir`);
  return f.data.ficha.id;
};

try {
  const periodos = await prisma.periodoTrimestre.findMany({ where: { ano } });
  const triHoje = periodos.find((p) => p.dataInicio.toISOString().slice(0, 10) <= hoje && hoje <= p.dataFim.toISOString().slice(0, 10))?.trimestre;
  if (periodos.length !== 3 || !triHoje) throw new Error(`Pré-requisito: calendário de ${ano} completo contendo hoje.`);
  const fimTri = periodos.find((p) => p.trimestre === triHoje)!.dataFim.toISOString().slice(0, 10);
  const mat = await prisma.habilidadeCurricular.findMany({ where: { componente: 'MATEMATICA', ativa: true }, take: 3, select: { id: true } });
  const ing = await prisma.habilidadeCurricular.findMany({ where: { componente: 'LINGUA_INGLESA', ativa: true }, take: 1, select: { id: true } });

  secao('0. Sem Fichas ainda');
  const vazio = await api(t.sec, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`);
  ok(vazio.status === 200 && vazio.data.fichas.total === 0 && vazio.data.disciplinas.length === 0, 'aluno sem Fichas → payload vazio, sem erro', vazio);

  // Período 1: criado hoje, preenchido, depois "empurrado" para o passado (simula o período anterior).
  const ap1 = await api(t.sec, 'POST', '/api/pdi-aplicacoes', { escolaId: escola.id, dataInicio: hoje, dataFim: fimTri, modeloIds: [modeloA.id, modeloB.id] });
  if (ap1.status !== 201) throw new Error(`ap1: ${JSON.stringify(ap1.data)}`);
  await preencher(ap1.data.id, { disc: discA.id, token: t.profA, adapt: OPCOES[2], part: OPCOES[1], nota: 6, habs: mat.slice(0, 1).map((h) => h.id), texto: 'Período 1 A', concluir: true });
  await preencher(ap1.data.id, { disc: discB.id, token: t.profB, adapt: OPCOES[3], part: OPCOES[3], nota: 4, habs: ing.map((h) => h.id), texto: 'Período 1 B', concluir: true });

  secao('1. Página principal — GET /api/pdi-aplicacoes/indicadores (campos novos)');
  const ind1 = await api(t.sec, 'GET', '/api/pdi-aplicacoes/indicadores');
  const linha = ind1.data.find((l: any) => l.escolaId === escola.id);
  ok(ind1.status === 200 && linha && linha.totalEsperado === 2 && linha.concluidas === 2 && linha.emAndamento === 0, 'escola com Aplicação vigente: 2 esperadas, 2 concluídas, 0 em andamento', linha);
  ok(linha && linha.aplicacaoDataFim && linha.aplicacaoDataInicio && 'aplicacaoNome' in linha, 'traz as datas da Aplicação vigente (campos antigos preservados)');
  const semAp = ind1.data.find((l: any) => l.escolaId === outraEscola.id);
  ok(semAp && semAp.aplicacaoId === null && semAp.emAndamento === 0 && semAp.aplicacaoDataFim === null, 'escola sem Aplicação vigente: zeros e datas null');
  const indGestor = await api(t.gestor, 'GET', '/api/pdi-aplicacoes/indicadores');
  ok(indGestor.status === 200 && indGestor.data.every((l: any) => l.escolaId === escola.id), 'Gestor só vê as escolas do seu vínculo');

  // Empurra o período 1 para o passado e abre o período 2.
  await prisma.aplicacaoPdi.update({ where: { id: ap1.data.id }, data: { dataInicio: new Date(`${ano - 1}-03-01`), dataFim: new Date(`${ano - 1}-03-20`), trimestre: 1 } });
  const ap2 = await api(t.sec, 'POST', '/api/pdi-aplicacoes', { escolaId: escola.id, dataInicio: hoje, dataFim: fimTri, modeloIds: [modeloA.id, modeloB.id] });
  if (ap2.status !== 201) throw new Error(`ap2: ${JSON.stringify(ap2.data)}`);
  await preencher(ap2.data.id, { disc: discA.id, token: t.profA, adapt: OPCOES[0], part: OPCOES[0], nota: 8.5, habs: mat.map((h) => h.id), texto: 'Período 2 A', concluir: true });
  await preencher(ap2.data.id, { disc: discB.id, token: t.profB, adapt: OPCOES[2], part: OPCOES[1], nota: 5, habs: 'todas', texto: 'Período 2 B', concluir: false });

  const ind2 = await api(t.sec, 'GET', '/api/pdi-aplicacoes/indicadores');
  const linha2 = ind2.data.find((l: any) => l.escolaId === escola.id);
  ok(linha2.aplicacaoId === ap2.data.id && linha2.totalEsperado === 2 && linha2.concluidas === 1 && linha2.emAndamento === 1, 'período 2: 1 concluída + 1 em andamento (só a Aplicação vigente conta)', linha2);

  secao('2. Indicadores do aluno — visão geral');
  const r = await api(t.sec, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`);
  const d = r.data;
  ok(r.status === 200, 'Secretaria → 200', r);
  ok(d.aplicacoes.length === 2 && d.aplicacoes[0].id === ap1.data.id && d.aplicacoes[1].id === ap2.data.id, 'períodos em ordem cronológica');
  ok(d.escalaMax === 4, 'escala de 4 níveis (4 alternativas)');
  ok(JSON.stringify(d.perguntasComuns.map((p: any) => p.id)) === JSON.stringify([pAdapt.id, pPart.id]), 'perguntas comuns de SELEÇÃO (adaptação, participação), na ordem do padrão');
  const v1 = d.visaoGeral[0].valores; const v2 = d.visaoGeral[1].valores;
  ok(v1[pAdapt.id].media === 1.5 && v1[pAdapt.id].professores === 2, 'período 1 adaptação: média de 2 professores = (2 + 1) / 2 = 1,5', v1);
  ok(v2[pAdapt.id].media === 3 && v2[pPart.id].media === 3.5, 'período 2: adaptação (4+2)/2 = 3; participação (4+3)/2 = 3,5', v2);
  ok(d.fichas.total === 4 && d.fichas.concluidas === 3 && d.fichas.emAndamento === 1 && d.fichas.pendentes === 0, 'contagem de Fichas: 4 (3 concluídas, 1 em andamento)', d.fichas);

  secao('3. Indicadores do aluno — por disciplina');
  const A = d.disciplinas.find((x: any) => x.disciplinaId === discA.id);
  const B = d.disciplinas.find((x: any) => x.disciplinaId === discB.id);
  ok(A && B && A.pontos.length === 2 && B.pontos.length === 2, 'uma série por disciplina, um ponto por período');
  ok(A.pontos[0].nota === 6 && A.pontos[1].nota === 8.5 && B.pontos[1].nota === 5, 'nota por disciplina e por período (A: 6 → 8,5; B: 5)');
  ok(A.pontos[1].crmg[0].quantidade === mat.length && !A.pontos[1].crmg[0].todas, `CRMG: quantidade de habilidades marcadas (A período 2 = ${mat.length})`);
  ok(B.pontos[1].crmg[0].todas === true, 'CRMG "todas as habilidades" sinalizado, sem inventar quantidade');
  ok(A.pontos[1].comuns[pAdapt.id].nivel === 4 && B.pontos[1].comuns[pAdapt.id].nivel === 2 && B.pontos[1].comuns[pAdapt.id].opcao === OPCOES[2], 'cada disciplina mostra o bloco do SEU professor (A = 4, B = 2, com a alternativa)');
  ok(A.pontos[1].registros.some((x: any) => x.texto === 'Período 2 A') && B.pontos[0].registros.some((x: any) => x.texto === 'Período 1 B'), 'registros escritos por período');
  ok(A.pontos[1].professorNome === 'Prof A Ind' && B.pontos[1].status === 'EM_ANDAMENTO', 'professor e status de cada Ficha');

  secao('4. Permissões');
  ok((await api(t.gestor, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`)).status === 200, 'Gestor da escola → 200');
  ok((await api(t.diretora, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`)).status === 200, 'Diretora da escola → 200');
  ok((await api(t.gestorFora, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`)).status === 403, 'Gestor de outra escola → 403');
  ok((await api(t.auxiliar, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`)).status === 403, 'Auxiliar sem vínculo com a turma → 403');
  ok((await api(t.suporte, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`)).status === 403, 'Suporte do sistema → 403');
  const rProf = await api(t.profA, 'GET', `/api/pdi-indicadores/alunos/${aluno.id}`);
  ok(rProf.status === 200 && rProf.data.disciplinas.length === 1 && rProf.data.disciplinas[0].disciplinaId === discA.id, 'Professor A só enxerga a própria disciplina');
  ok(rProf.data.visaoGeral[1].valores[pAdapt.id].media === 4 && rProf.data.visaoGeral[1].valores[pAdapt.id].professores === 1, 'Professor A: média só do próprio bloco (nunca a resposta do Professor B)');
  ok((await api(t.sec, 'GET', '/api/pdi-indicadores/alunos/999999999')).status === 404, 'aluno inexistente → 404');
  ok((await api(t.sec, 'GET', '/api/pdi-indicadores/alunos/abc')).status === 400, 'id inválido → 400');
} finally {
  server.close();
  await prisma.$disconnect();
  console.log(`\n${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  if (falhas) process.exitCode = 1;
}

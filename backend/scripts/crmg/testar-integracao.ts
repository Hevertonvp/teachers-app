// Teste de integração ponta a ponta (API real via createApp) do tipo "Habilidades do CRMG", das
// perguntas padrão 2027 e do trimestre por Aplicação, contra um banco LOCAL descartável (ex.:
// restauração do backup) já com as migrations, o catálogo (crmg:importar) e as perguntas padrão
// 2027 (scripts/pdi/perguntas-padrao-2027.ts). CRIA dados de teste — por isso se recusa a rodar
// fora de localhost.
//
// Uso: DATABASE_URL=postgresql://...@localhost:.../banco npx tsx scripts/crmg/testar-integracao.ts
import 'dotenv/config';
import type { AddressInfo } from 'node:net';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Recusado: este teste cria dados e só roda contra um banco local (DATABASE_URL em localhost).');
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
  else { falhas++; console.log(`  ✘ ${nome}${detalhe !== undefined ? ` — ${JSON.stringify(detalhe).slice(0, 400)}` : ''}`); }
};
const secao = (t: string) => console.log(`\n${t}`);

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
type Resp = { status: number; data: any };
const api = async (token: string, method: string, path: string, body?: unknown): Promise<Resp> => {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoje = iso(new Date());
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// --- Fotografia dos dados antigos para comparar no fim (só linhas que já existiam) -------------
const idsAntigos = {
  perguntas: (await prisma.perguntaPdi.findMany({ select: { id: true } })).map((x) => x.id),
  snapshots: (await prisma.aplicacaoPerguntaPdi.findMany({ select: { id: true } })).map((x) => x.id),
  respostas: (await prisma.respostaPdi.findMany({ select: { id: true } })).map((x) => x.id),
};
const fotoAntiga = async () => JSON.stringify({
  perguntas: await prisma.perguntaPdi.findMany({ where: { id: { in: idsAntigos.perguntas } }, orderBy: { id: 'asc' } }),
  snapshots: await prisma.aplicacaoPerguntaPdi.findMany({ where: { id: { in: idsAntigos.snapshots } }, orderBy: { id: 'asc' } }),
  respostas: await prisma.respostaPdi.findMany({ where: { id: { in: idsAntigos.respostas } }, orderBy: { id: 'asc' } }),
});
const antes = await fotoAntiga();
console.log(`Base: ${idsAntigos.perguntas.length} perguntas, ${idsAntigos.snapshots.length} snapshots, ${idsAntigos.respostas.length} respostas pré-existentes`);

// --- Fixtures ----------------------------------------------------------------------------------
const sufixo = Date.now();
const novaEscola = async (n: number) => {
  const escola = await prisma.escola.create({ data: { nome: `ESCOLA TESTE CRMG ${n} ${sufixo}` } });
  await prisma.escolaModulo.create({ data: { escolaId: escola.id, modulo: 'PDI' } });
  const turma = await prisma.turma.create({ data: { escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 90 + n, nome: `6º Teste ${n}`, identidadeChave: `teste-crmg-${sufixo}-${n}` } });
  return { escola, turma };
};
const { escola, turma } = await novaEscola(1);
const { escola: escola2 } = await novaEscola(2);
const secretaria = await prisma.pessoa.create({ data: { nome: 'Secretaria Teste CRMG', email: `sec-crmg-${sufixo}@teste.local`, perfil: 'SECRETARIA' } });
const professor = await prisma.pessoa.create({ data: { nome: 'Professor Teste CRMG', email: `prof-crmg-${sufixo}@teste.local`, perfil: 'PROFESSOR' } });
await prisma.vinculoEscolar.create({ data: { escolaId: escola.id, pessoaId: professor.id, dataInicio: new Date() } });
const ingles = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Inglês' } });
const matematica = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Matemática' } });
const redacao = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Redação' } });
const portugues = await prisma.disciplina.findUniqueOrThrow({ where: { nome: 'Língua Portuguesa' } });
for (const d of [ingles, matematica]) await prisma.professorTurmaDisciplina.create({ data: { turmaId: turma.id, professorId: professor.id, disciplinaId: d.id, dataInicio: new Date() } });
const aluno = await prisma.alunoPdi.create({ data: { nome: 'Aluno Teste CRMG', turmaId: turma.id, responsavelNome: 'Resp', responsavelParentesco: 'Mãe', responsavelTelefone: '0000' } });
const tSec = assinarToken(secretaria);
const tProf = assinarToken(professor);

const hMA6 = await prisma.habilidadeCurricular.findFirstOrThrow({ where: { componente: 'MATEMATICA', codigo: { startsWith: 'EF06MA' } } });
const hMA9 = await prisma.habilidadeCurricular.findFirstOrThrow({ where: { componente: 'MATEMATICA', codigo: { startsWith: 'EF09MA' } } });
const hLI = await prisma.habilidadeCurricular.findFirstOrThrow({ where: { codigo: 'EF06LI11' } });
const periodosOriginais = await prisma.periodoTrimestre.findMany({ orderBy: { trimestre: 'asc' } });

try {
  secao('1. Busca de habilidades — isolamento por disciplina, código, texto, acentos, limite');
  const bLi = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${ingles.id}&q=verbo`);
  ok(bLi.status === 200 && bLi.data.resultados.length > 0 && bLi.data.resultados.every((h: any) => h.componente === 'LINGUA_INGLESA'), 'Inglês + "verbo": só Língua Inglesa');
  const bMa = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${matematica.id}&q=verbo`);
  ok(bMa.data.resultados.every((h: any) => h.componente === 'MATEMATICA'), 'Matemática + "verbo": nenhuma de Inglês');
  const bComum = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${matematica.id}&q=de`);
  ok(bComum.data.resultados.length > 0 && bComum.data.resultados.length <= 20 && bComum.data.resultados.every((h: any) => h.componente === 'MATEMATICA'), `termo comum "de": ≤ 20 resultados, só Matemática (${bComum.data.resultados.length})`);
  const bParcial = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${ingles.id}&q=EF06LI`);
  ok(bParcial.data.resultados.length > 0 && bParcial.data.resultados.every((h: any) => h.codigo.startsWith('EF06LI')), 'código parcial "EF06LI"');
  const bCompleto = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${ingles.id}&q=ef06li11`);
  ok(bCompleto.data.resultados[0]?.codigo === 'EF06LI11', 'código completo (minúsculo) aparece em 1º');
  const bOutroAno = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${matematica.id}&q=EF09MA`);
  ok(bOutroAno.data.resultados.length > 0, 'qualquer ano da disciplina (EF09MA) aparece — sem filtro por série');
  const bCodOutro = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${ingles.id}&q=EF06MA`);
  ok(bCodOutro.data.resultados.length === 0, 'código de Matemática numa disciplina de Inglês: nenhum resultado');
  const bAcento = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${portugues.id}&q=educacao`);
  const bMaiusc = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${portugues.id}&q=EDUCAÇÃO`);
  ok(bAcento.data.resultados.length > 0 && JSON.stringify(bAcento.data.resultados.map((h: any) => h.id)) === JSON.stringify(bMaiusc.data.resultados.map((h: any) => h.id)), '"educacao" e "EDUCAÇÃO" retornam o mesmo conjunto');
  const bMulti = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${ingles.id}&q=textos lingua inglesa`);
  ok(bMulti.data.resultados.length > 0 && bMulti.data.resultados.every((h: any) => ['textos', 'lingua', 'inglesa'].every((t) => normal(h.codigo + ' ' + h.descricaoOficial).includes(t))), 'múltiplos termos: todos presentes');
  const bRed = await api(tSec, 'GET', `/api/habilidades-curriculares?disciplinaId=${redacao.id}&q=EF06LP`);
  ok(bRed.data.componente === 'LINGUA_PORTUGUESA' && bRed.data.resultados.length > 0, 'Redação usa habilidades de Língua Portuguesa');
  ok(bParcial.data.resultados.every((h: any) => !('anosEscolares' in h) && !('anoOuBloco' in h)), 'sugestões não trazem ano/série');
  const bProf = await api(tProf, 'GET', `/api/habilidades-curriculares?disciplinaId=${matematica.id}&q=EF06MA`);
  ok(bProf.status === 200 && bProf.data.resultados.length > 0, 'Professor também busca (preenche a Ficha)');

  secao('2. Construtor — tipo novo junto com os tipos de sempre');
  const modeloIngles = await prisma.modeloPdi.findFirstOrThrow({ where: { disciplinaId: ingles.id, status: 'ATIVA' } });
  const pCrmg = await api(tSec, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'Habilidades', tipoResposta: 'HABILIDADE_CRMG', texto: 'Quais habilidades o aluno trabalhou?' });
  ok(pCrmg.status === 201 && pCrmg.data.texto === 'Quais habilidades o aluno trabalhou?' && pCrmg.data.tipoResposta === 'HABILIDADE_CRMG', 'cria pergunta "Habilidades do CRMG" com texto escrito pela Secretaria', pCrmg.data);
  const semTexto = await api(tSec, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'x', tipoResposta: 'HABILIDADE_CRMG', texto: '' });
  ok(semTexto.status === 400, 'sem texto → 400 (mesma regra dos outros tipos)');
  const editada = await api(tSec, 'PUT', `/api/pdi-perguntas/${pCrmg.data.id}`, { secao: 'Habilidades', tipoResposta: 'HABILIDADE_CRMG', texto: 'Quais habilidades foram trabalhadas?', trimestre: 2 });
  ok(editada.status === 200 && editada.data.texto === 'Quais habilidades foram trabalhadas?' && editada.data.trimestre === 2, 'edita texto e restringe ao 2º trimestre');
  const deVolta = await api(tSec, 'PUT', `/api/pdi-perguntas/${pCrmg.data.id}`, { secao: 'Habilidades', tipoResposta: 'HABILIDADE_CRMG', texto: 'Quais habilidades foram trabalhadas?', trimestre: null });
  ok(deVolta.data.trimestre === null, 'volta para "todos os trimestres"');
  const pTexto = await api(tSec, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'Registro', tipoResposta: 'TEXTO', texto: 'Observações gerais' });
  ok(pTexto.status === 201 && pTexto.data.trimestre === null, 'tipo TEXTO continua igual (sem trimestre = todos)');
  const pSel = await api(tSec, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'Registro', tipoResposta: 'SELECAO', texto: 'Nível', opcoes: ['A', 'B'], complementar: { gatilho: 'B', label: 'Como?' } });
  ok(pSel.status === 201 && JSON.stringify(pSel.data.opcoes) === '["A","B"]' && pSel.data.complementar?.gatilho === 'B', 'tipo SELEÇÃO com complementar continua igual');
  const trimInvalido = await api(tSec, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'x', tipoResposta: 'TEXTO', texto: 'y', trimestre: 4 });
  ok(trimInvalido.status === 400, 'trimestre inválido (4) → 400');
  const profCria = await api(tProf, 'POST', `/api/pdi-modelos/${modeloIngles.id}/perguntas`, { secao: 'x', tipoResposta: 'HABILIDADE_CRMG', texto: 'y' });
  ok(profCria.status === 403, 'Professor não cria pergunta (403)');

  secao('3. Perguntas padrão 2027 e Modelo criado automaticamente');
  const padrao = await api(tSec, 'GET', '/api/pdi-perguntas-padrao');
  const ativas = padrao.data.filter((p: any) => p.status === 'ATIVA');
  const inativas = padrao.data.filter((p: any) => p.status === 'INATIVA');
  ok(ativas.length === 12, `12 perguntas padrão ativas (planilha 2027) — ${ativas.length}`);
  ok(inativas.length >= 24, `perguntas padrão anteriores preservadas como inativas (${inativas.length})`);
  ok(ativas.filter((p: any) => p.tipoResposta === 'HABILIDADE_CRMG').length === 2, '2 perguntas "Habilidades do CRMG" (consolidadas / não consolidadas)');
  ok([1, 2, 3].every((t) => ativas.filter((p: any) => p.trimestre === t).length === 2), 'cada trimestre tem seu "Objetivo" + discursiva');
  const padraoCrmg = await api(tSec, 'POST', '/api/pdi-perguntas-padrao', { secao: 'x', texto: 'Habilidades extras?', tipoResposta: 'HABILIDADE_CRMG' });
  ok(padraoCrmg.status === 201, 'pergunta padrão aceita o tipo novo');
  await api(tSec, 'DELETE', `/api/pdi-perguntas-padrao/${padraoCrmg.data.id}`);
  const modeloMat = await api(tSec, 'POST', '/api/pdi-modelos', { nome: `PDI Matemática teste ${sufixo}`, disciplinaId: matematica.id, carregarPerguntasPadrao: true });
  ok(modeloMat.status === 201 && modeloMat.data.perguntas.length === 12, `Modelo novo nasce com as 12 perguntas da planilha (${modeloMat.data.perguntas?.length})`);
  ok(JSON.stringify(modeloMat.data.perguntas.map((p: any) => [p.texto, p.tipoResposta, p.trimestre])) === JSON.stringify(ativas.map((p: any) => [p.texto, p.tipoResposta, p.trimestre])), 'perguntas do Modelo = perguntas padrão (texto, tipo, trimestre)');
  const vazio = await api(tSec, 'POST', '/api/pdi-modelos', { nome: 'vazio', disciplinaId: redacao.id, carregarPerguntasPadrao: false });
  ok(vazio.status === 201 && vazio.data.perguntas.length === 0, 'sem "carregar perguntas padrão": Modelo vazio, como antes');
  await api(tSec, 'DELETE', `/api/pdi-modelos/${vazio.data.id}`);

  secao('4. Trimestre — configurado em Configurações, aplicado na geração do formulário');
  const tri = await api(tProf, 'GET', '/api/trimestres');
  ok(tri.status === 200 && tri.data.length === 3, 'calendário de trimestres disponível');
  const profAltera = await api(tProf, 'PUT', '/api/trimestres/1', { dataInicio: '2026-01-01' });
  ok(profAltera.status === 403, 'Professor não altera o calendário (403)');
  const triAtual = tri.data.find((p: any) => p.dataInicio <= hoje && hoje <= p.dataFim)?.trimestre ?? null;
  const aplic = await api(tSec, 'POST', '/api/pdi-aplicacoes', { escolaId: escola.id, dataInicio: hoje, dataFim: '2026-12-31', modeloIds: [modeloIngles.id, modeloMat.data.id] });
  ok(aplic.status === 201 && aplic.data.trimestre === triAtual, `Aplicação criada hoje recebe o trimestre do calendário (${triAtual}º)`, aplic.data);
  const snapMat = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId: aplic.data.id, disciplinaId: matematica.id } }, include: { perguntaOriginal: true } });
  ok(snapMat.length === 8 && snapMat.every((s) => s.perguntaOriginal.trimestre === null || s.perguntaOriginal.trimestre === triAtual), `snapshot: 6 perguntas gerais + "Objetivo" e discursiva só do ${triAtual}º trimestre (${snapMat.length})`);
  // Outra configuração: hoje dentro do 1º trimestre → a Aplicação seguinte recebe as do 1º.
  await api(tSec, 'PUT', '/api/trimestres/1', { dataInicio: '2026-01-01', dataFim: '2026-12-31' });
  for (const t of [2, 3]) await api(tSec, 'PUT', `/api/trimestres/${t}`, { dataInicio: '2027-01-01', dataFim: '2027-01-02' });
  const aplic2 = await api(tSec, 'POST', '/api/pdi-aplicacoes', { escolaId: escola2.id, dataInicio: hoje, dataFim: '2026-12-31', modeloIds: [modeloMat.data.id] });
  const snap2 = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId: aplic2.data.id } }, include: { perguntaOriginal: true } });
  ok(aplic2.data.trimestre === 1 && snap2.length === 8 && snap2.filter((s) => s.perguntaOriginal.trimestre !== null).every((s) => s.perguntaOriginal.trimestre === 1), 'após mudar o calendário, nova Aplicação recebe as perguntas do 1º trimestre');
  for (const p of periodosOriginais) await prisma.periodoTrimestre.update({ where: { trimestre: p.trimestre }, data: { dataInicio: p.dataInicio, dataFim: p.dataFim } });
  const snapIng = await prisma.aplicacaoPerguntaPdi.findMany({ where: { aplicacaoModelo: { aplicacaoId: aplic.data.id, disciplinaId: ingles.id } } });
  ok(snapIng.some((s) => s.perguntaIdOriginal === pCrmg.data.id && s.tipoResposta === 'HABILIDADE_CRMG' && s.texto === 'Quais habilidades foram trabalhadas?'), 'Modelo antigo de Inglês: pergunta nova entra no snapshot normalmente');

  secao('5. Ficha — Professor marca habilidades; validação no servidor');
  const ficha = await api(tProf, 'POST', '/api/pdi-fichas/obter-ou-criar', { aplicacaoId: aplic.data.id, alunoId: aluno.id, disciplinaId: matematica.id });
  ok(ficha.status === 200 || ficha.status === 201, 'Professor abre a Ficha de Matemática', ficha.data);
  const fichaId = ficha.data.ficha.id;
  const [pConsol, pNaoConsol] = ficha.data.perguntas.filter((p: any) => p.tipoResposta === 'HABILIDADE_CRMG');
  const cruzada = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: pConsol.id, valor: { habilidadeIds: [hMA6.id, hLI.id] } }] });
  ok(cruzada.status === 400, 'manipulado: habilidade de Inglês numa Ficha de Matemática → 400', cruzada.data);
  const inexistente = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: pConsol.id, valor: { habilidadeIds: [99999999] } }] });
  ok(inexistente.status === 400, 'habilidade inexistente → 400');
  const marcadas = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: [
    { aplicacaoPerguntaId: pConsol.id, valor: { habilidadeIds: [hMA9.id, hMA6.id, hMA6.id], resposta: 'ignorado', codigo: 'FALSO' } },
    { aplicacaoPerguntaId: pNaoConsol.id, valor: { todas: true } },
  ] });
  ok(marcadas.status === 200, 'marca várias habilidades (de anos diferentes) e "Todas" na outra pergunta');
  const rC = marcadas.data.respostas.find((r: any) => r.aplicacaoPerguntaId === pConsol.id)?.valor;
  ok(rC?.todas === false && rC.habilidades.length === 2 && rC.habilidades.every((h: any) => [hMA6.id, hMA9.id].includes(h.id)), 'repetidas viram uma só; valor guarda as 2 marcadas');
  ok(rC.habilidades.find((h: any) => h.id === hMA6.id)?.descricaoOficial === hMA6.descricaoOficial && rC.componente === 'MATEMATICA' && rC.versaoNome === 'CRMG – Versão atualizada', 'código/descrição/componente/versão vêm do catálogo');
  ok(!('resposta' in rC) && !('codigo' in rC), 'campos enviados pelo cliente fora do formato são descartados');
  const rN = marcadas.data.respostas.find((r: any) => r.aplicacaoPerguntaId === pNaoConsol.id)?.valor;
  ok(rN?.todas === true && rN.habilidades.length === 0 && rN.componente === 'MATEMATICA', '"Todas as habilidades" salvo');
  const preencher = (p: any) => ({
    aplicacaoPerguntaId: p.id,
    valor: p.tipoResposta === 'SELECAO' ? { resposta: p.opcoes[0], complementarTexto: '' } : p.tipoResposta === 'MARCACAO' ? { resposta: true } : p.tipoResposta === 'NUMERO' ? { resposta: 7.5 } : { resposta: 'Texto de teste' },
  });
  const outras = ficha.data.perguntas.filter((p: any) => !['ORIENTACAO', 'HABILIDADE_CRMG'].includes(p.tipoResposta)).map(preencher);
  const salvasOutras = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: outras.map((o: any) => ({ ...o, valor: { ...o.valor, habilidadeIds: [hMA6.id], todas: true } })) });
  const valoresOutras = salvasOutras.data.respostas.filter((r: any) => outras.some((o: any) => o.aplicacaoPerguntaId === r.aplicacaoPerguntaId));
  ok(valoresOutras.length === outras.length && valoresOutras.every((r: any) => Object.keys(r.valor).every((k) => ['resposta', 'complementarTexto'].includes(k))), 'tipos de sempre gravam exatamente { resposta, complementarTexto } — nada novo vaza');
  const concluida = await api(tProf, 'POST', `/api/pdi-fichas/${fichaId}/concluir`);
  ok(concluida.status === 200 && concluida.data.ficha.status === 'CONCLUIDA', 'conclui a Ficha (regra de conclusão de sempre)', concluida.data);
  const recarregada = await api(tProf, 'GET', `/api/pdi-fichas/${aplic.data.id}/${aluno.id}/${matematica.id}`);
  ok(JSON.stringify(recarregada.data.respostas.find((r: any) => r.aplicacaoPerguntaId === pConsol.id)?.valor) === JSON.stringify(rC), 'após recarregar: habilidades marcadas preservadas');

  secao('6. Histórico imutável (catálogo alterado depois)');
  const descOriginal = hMA6.descricaoOficial;
  await prisma.habilidadeCurricular.update({ where: { id: hMA6.id }, data: { descricaoOficial: 'TEXTO ALTERADO NO CATÁLOGO (teste)' } });
  const depois = await api(tProf, 'GET', `/api/pdi-fichas/${aplic.data.id}/${aluno.id}/${matematica.id}`);
  ok(depois.data.respostas.find((r: any) => r.aplicacaoPerguntaId === pConsol.id)?.valor.habilidades.find((h: any) => h.id === hMA6.id)?.descricaoOficial === descOriginal, 'Ficha antiga continua com a descrição de quando foi respondida');
  await prisma.habilidadeCurricular.update({ where: { id: hMA6.id }, data: { descricaoOficial: descOriginal } });

  secao('7. Prazos — fora da vigência o Professor não edita');
  const aplicReg = await prisma.aplicacaoPdi.findUniqueOrThrow({ where: { id: aplic.data.id } });
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  await prisma.aplicacaoPdi.update({ where: { id: aplic.data.id }, data: { dataInicio: new Date('2026-01-01'), dataFim: ontem } });
  const foraPrazo = await api(tProf, 'PUT', `/api/pdi-fichas/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: pConsol.id, valor: { habilidadeIds: [hMA6.id] } }] });
  ok(foraPrazo.status === 400, 'Aplicação encerrada: salvar → 400 (regra de vigência intacta)');

  secao('8. Correções (Secretaria), com a Aplicação encerrada');
  const det = await api(tSec, 'GET', `/api/correcoes-pdi/${fichaId}`);
  ok(det.status === 200 && det.data.respostas.some((r: any) => r.valor?.habilidades?.length === 2), 'detalhe de Correções traz as habilidades marcadas');
  const corrCruzada = await api(tSec, 'PUT', `/api/correcoes-pdi/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: pConsol.id, valor: { habilidadeIds: [hLI.id] } }] });
  ok(corrCruzada.status === 400, 'correção com habilidade de outro componente → 400');
  const pNumero = ficha.data.perguntas.find((p: any) => p.tipoResposta === 'NUMERO');
  const corr = await api(tSec, 'PUT', `/api/correcoes-pdi/${fichaId}/respostas`, { respostas: [{ aplicacaoPerguntaId: pNumero.id, valor: { resposta: 9, complementarTexto: '' } }] });
  const hist = await prisma.historicoCorrecaoResposta.findFirst({ where: { fichaId, aplicacaoPerguntaId: pNumero.id }, orderBy: { id: 'desc' } });
  ok(corr.status === 200 && (hist?.valorAnterior as any)?.resposta === 7.5 && (hist?.valorNovo as any)?.resposta === 9, 'correção direta de um tipo de sempre continua igual, com histórico');
  await prisma.aplicacaoPdi.update({ where: { id: aplic.data.id }, data: { dataInicio: aplicReg.dataInicio, dataFim: aplicReg.dataFim } });

  secao('9. Ficha Anual');
  const anual = await api(tSec, 'GET', `/api/pdi-ficha-anual/${aluno.id}/${new Date().getFullYear()}`);
  ok(anual.status === 200 && JSON.stringify(anual.data).includes(`"aplicacaoId":${aplic.data.id}`), 'Ficha Anual lista a Aplicação');

  secao('10. Dados que já existiam continuam iguais');
  ok((await fotoAntiga()) === antes, 'perguntas, snapshots e respostas pré-existentes byte a byte iguais');
} finally {
  for (const p of periodosOriginais) await prisma.periodoTrimestre.update({ where: { trimestre: p.trimestre }, data: { dataInicio: p.dataInicio, dataFim: p.dataFim } }).catch(() => {});
  server.close();
  await prisma.$disconnect();
  console.log(`\n${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  if (falhas) process.exitCode = 1;
}

// Integridade do banco LOCAL (somente leitura): nenhuma duplicação ou mistura de respostas.
// Uso: node 36-integridade.mjs <rótulo>
import { sql, prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const ROT = (process.argv[2] || 'final').toUpperCase();
const checagens = [
  // 1/3 POR CARGO (12/11/2026): uma folha por ciclo+professor+cargos; um cargo em no máximo uma folha por ciclo; toda folha nova
  // tem cargos ligados e a foto da composição; nenhum cargo com mais de 2 ativos por professor. O modelo antigo continua conferido.
  ['1/3 (modelo antigo): uma entrega por ciclo+professor+ano/série+disciplina', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM entregas_um_terco WHERE "chaveCargos" IS NULL GROUP BY "cicloId","professorId","anoSerie","disciplinaId" HAVING count(*) > 1) x`],
  ['1/3 por cargo: uma folha por ciclo+professor+cargos', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM entregas_um_terco WHERE "chaveCargos" IS NOT NULL GROUP BY "cicloId","professorId","chaveCargos" HAVING count(*) > 1) x`],
  ['1/3 por cargo: um cargo aparece em no máximo uma folha por ciclo', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM entregas_um_terco_cargos ec JOIN entregas_um_terco e ON e.id = ec."entregaId" GROUP BY e."cicloId", ec."cargoId" HAVING count(*) > 1) x`],
  ['1/3 por cargo: toda folha nova tem cargos ligados (iguais à chave) e foto da composição', sql`SELECT count(*)::int AS n FROM entregas_um_terco e WHERE e."chaveCargos" IS NOT NULL AND (e.composicao IS NULL OR e."chaveCargos" <> (SELECT string_agg(ec."cargoId"::text, ',' ORDER BY ec."cargoId") FROM entregas_um_terco_cargos ec WHERE ec."entregaId" = e.id))`],
  ['1/3 por cargo: folha só de cargos do próprio professor', sql`SELECT count(*)::int AS n FROM entregas_um_terco_cargos ec JOIN entregas_um_terco e ON e.id = ec."entregaId" JOIN cargos_professor c ON c.id = ec."cargoId" WHERE c."professorId" <> e."professorId"`],
  ['Cargos: no máximo 2 ativos por professor', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM cargos_professor WHERE status = 'ATIVO' GROUP BY "professorId" HAVING count(*) > 2) x`],
  ['Cargos: todo cargo tem ao menos uma versão de composição', sql`SELECT count(*)::int AS n FROM cargos_professor c WHERE NOT EXISTS (SELECT 1 FROM cargo_versoes v WHERE v."cargoId" = c.id)`],
  ['1/3: uma resposta por entrega+semana', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM respostas_semana_um_terco GROUP BY "entregaId","semanaId" HAVING count(*) > 1) x`],
  ['1/3: resposta sempre de semana do MESMO ciclo da entrega (sem mistura entre ciclos)', sql`SELECT count(*)::int AS n FROM respostas_semana_um_terco r JOIN entregas_um_terco e ON e.id = r."entregaId" JOIN semanas_um_terco s ON s.id = r."semanaId" WHERE s."cicloId" <> e."cicloId"`],
  ['PDI: uma ficha por Aplicação+aluno+disciplina', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM fichas_pdi GROUP BY "aplicacaoId","alunoId","disciplinaId" HAVING count(*) > 1) x`],
  ['PDI: uma resposta por ficha+pergunta', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM respostas_pdi GROUP BY "fichaId","aplicacaoPerguntaId" HAVING count(*) > 1) x`],
  ['PDI: resposta sempre de pergunta do modelo da PRÓPRIA ficha (sem mistura entre disciplinas)', sql`SELECT count(*)::int AS n FROM respostas_pdi r JOIN fichas_pdi f ON f.id = r."fichaId" JOIN aplicacao_perguntas_pdi p ON p.id = r."aplicacaoPerguntaId" WHERE p."aplicacaoModeloId" <> f."aplicacaoModeloId"`],
  ['PDI: um bloco comum por Aplicação+aluno+turma+professor', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM blocos_respostas_padrao_pdi GROUP BY "aplicacaoId","alunoId","turmaId","professorId" HAVING count(*) > 1) x`],
  ['PDI: uma resposta por bloco+pergunta padrão', sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM respostas_padrao_pdi GROUP BY "blocoId","aplicacaoPerguntaPadraoId" HAVING count(*) > 1) x`],
];
let falhas = 0;
for (const [nome, q] of checagens) {
  let n;
  try { n = (await q)[0].n; } catch (e) { n = `erro: ${e.message.slice(0, 80)}`; }
  const ok = n === 0;
  if (!ok) falhas++;
  registrar(`INTEG-${ROT}-${checagens.findIndex(c => c[0] === nome) + 1}`, 'Integridade do banco', nome, '0 ocorrências', String(n), ok ? 'APROVADO' : 'REPROVADO');
}
console.log(`integridade ${ROT}: ${checagens.length - falhas}/${checagens.length}`);
await prisma.$disconnect();

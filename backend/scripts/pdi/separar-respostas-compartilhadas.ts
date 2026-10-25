// Aplica a regra "padrão ≠ compartilhada" às perguntas padrão ATIVAS do Modelo PDI 2027:
//
// - nota (NUMERO) e as perguntas por trimestre (discursiva + "Objetivo") passam a ser
//   NÃO compartilhadas: continuam nascendo em todo Modelo, mas cada disciplina responde a sua;
// - cria as duas perguntas padrão de Habilidades do CRMG (consolidadas / não consolidadas), sempre
//   não compartilhadas, logo depois da nota (ordem da planilha: 1-4, CRMG 5-6, depois a do trimestre);
// - adaptação, participação e interação continuam compartilhadas (bloco comum).
//
// Nada é apagado e nenhum Modelo/Aplicação/Ficha existente é tocado: a separação vale a partir da
// próxima Aplicação criada (o snapshot decide bloco comum x disciplina, inclusive para Modelos que
// já existiam). Idempotente.
//
// Uso: npx tsx scripts/pdi/separar-respostas-compartilhadas.ts            (só mostra o que faria)
//      npx tsx scripts/pdi/separar-respostas-compartilhadas.ts --aplicar  (grava)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const AUTOR = 'script:separar-respostas-compartilhadas';
const aplicar = process.argv.includes('--aplicar');

const CRMG = [
  'Quais habilidades foram consolidadas pelo(a) aluno(a) durante o trimestre?',
  'Quais habilidades ainda não foram consolidadas?',
];

async function main() {
  const ativas = await prisma.perguntaPdiPadrao.findMany({ where: { status: 'ATIVA' }, orderBy: { ordem: 'asc' } });
  const naoCompartilhar = ativas.filter((p) => p.compartilhada && (p.tipoResposta === 'NUMERO' || p.trimestre !== null));
  const crmgFaltando = CRMG.filter((texto) => !ativas.some((p) => p.tipoResposta === 'HABILIDADE_CRMG' && p.texto === texto));
  const nota = ativas.find((p) => p.tipoResposta === 'NUMERO');

  console.log(`Perguntas padrão ativas: ${ativas.length}`);
  console.log('Passam a NÃO compartilhadas:');
  naoCompartilhar.forEach((p) => console.log(`  #${p.id} [${p.tipoResposta}${p.trimestre ? ` · ${p.trimestre}º tri` : ''}] ${p.texto.slice(0, 70)}`));
  console.log('Continuam compartilhadas (bloco comum):');
  ativas.filter((p) => p.compartilhada && !naoCompartilhar.includes(p)).forEach((p) => console.log(`  #${p.id} [${p.tipoResposta}] ${p.texto.slice(0, 70)}`));
  console.log(`CRMG padrão a criar: ${crmgFaltando.length ? crmgFaltando.join(' | ') : 'nenhuma (já existem)'}`);

  if (!aplicar) {
    console.log('\nNada gravado (rode com --aplicar para gravar).');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (naoCompartilhar.length > 0) {
      await tx.perguntaPdiPadrao.updateMany({ where: { id: { in: naoCompartilhar.map((p) => p.id) } }, data: { compartilhada: false, updatedBy: AUTOR } });
    }
    if (crmgFaltando.length > 0) {
      // Abre espaço logo depois da nota (ou no fim, se não houver nota ativa).
      const depoisDe = nota?.ordem ?? Math.max(0, ...ativas.map((p) => p.ordem));
      const aDeslocar = ativas.filter((p) => p.ordem > depoisDe).sort((a, b) => b.ordem - a.ordem);
      for (const p of aDeslocar) {
        await tx.perguntaPdiPadrao.update({ where: { id: p.id }, data: { ordem: p.ordem + crmgFaltando.length, updatedBy: AUTOR } });
      }
      for (const [i, texto] of crmgFaltando.entries()) {
        await tx.perguntaPdiPadrao.create({
          data: {
            secao: 'Habilidades do CRMG', texto, origem: 'HABILIDADE', tipoResposta: 'HABILIDADE_CRMG',
            opcoes: [], trimestre: null, compartilhada: false, ordem: depoisDe + i + 1, status: 'ATIVA', createdBy: AUTOR,
          },
        });
      }
    }
  });
  console.log('\nGravado.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

// Cria as turmas padrão de Ensino Fundamental (1º ao 9º ano, 3 turmas de manhã + 3 de tarde,
// ano letivo 2026) em todas as escolas "EM ..." ATIVAS — exclui educação infantil (CRECHE/CMEI/
// PEM) e a única "EM" inativa (id 6). Via API real, autenticado como a Secretaria de verdade.
import 'dotenv/config';
import type { AddressInfo } from 'node:net';

const { createApp } = await import('../src/api/app.js');
const { assinarToken } = await import('../src/api/middleware/auth.js');
const { prisma } = await import('../src/lib/prisma.js');

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const api = async (token: string, body: unknown) => {
  const r = await fetch(`${base}/api/turmas`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const secretaria = await prisma.pessoa.findFirstOrThrow({ where: { perfil: 'SECRETARIA' } });
const token = assinarToken(secretaria);

const escolas = await prisma.escola.findMany({
  where: { status: 'ATIVA', nome: { startsWith: 'EM ' } },
  orderBy: { nome: 'asc' },
});
console.log(`${escolas.length} escolas de Ensino Fundamental ATIVAS encontradas.`);

const ANO_LETIVO = 2026;
let criadas = 0;
let falhas = 0;

for (const escola of escolas) {
  for (let anoSerie = 1; anoSerie <= 9; anoSerie++) {
    for (const turno of ['MANHA', 'TARDE'] as const) {
      for (let identificador = 1; identificador <= 3; identificador++) {
        const r = await api(token, { escolaId: escola.id, anoLetivo: ANO_LETIVO, etapa: 'FUNDAMENTAL', anoSerie, turno, identificador });
        if (r.status === 201) {
          criadas++;
        } else {
          falhas++;
          console.error('FALHOU:', escola.nome, anoSerie, turno, identificador, '=>', r.status, JSON.stringify(r.data));
        }
      }
    }
  }
  console.log(`OK: ${escola.nome} (escolaId ${escola.id}) — 54 turmas`);
}

console.log(`\n${criadas} turmas criadas, ${falhas} falhas, em ${escolas.length} escolas.`);
server.close();
await prisma.$disconnect();
process.exitCode = falhas > 0 ? 1 : 0;

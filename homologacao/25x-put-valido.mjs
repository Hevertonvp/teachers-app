// Reconfere T4 com corpo VÁLIDO: P04 (professora anterior) tenta gravar a ficha de Arte do Lucas.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340';
const tk = (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'p04@homolog.nexo', senha: 'Nexo!Prof04-2026' }) })).json()).token;
const ficha = await prisma.fichaPdi.findFirst({ where: { alunoId: 1, disciplinaId: 3 }, include: { respostas: true } });
const antes = JSON.stringify(ficha.respostas.map(r => r.valor));
const r = await fetch(`${API}/api/pdi-fichas/${ficha.id}/respostas`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify({ respostas: ficha.respostas.map(x => ({ aplicacaoPerguntaId: x.aplicacaoPerguntaId, valor: typeof x.valor === 'string' ? 'P04 TENTOU GRAVAR DEPOIS DA TRANSFERÊNCIA' : x.valor })), baseUpdatedAt: ficha.updatedAt }) });
const corpo = await r.text();
const depois = JSON.stringify((await prisma.respostaPdi.findMany({ where: { fichaId: ficha.id } })).map(x => x.valor));
registrar('PDI-TRF-T4', 'PDI transferência', 'Professora anterior (P04) tenta ler e gravar (corpo válido) a ficha de Arte do Lucas depois da troca de turma', 'sem acesso (403) e nada gravado', `GET 403 (rodada anterior); PUT ${r.status} ${corpo.slice(0, 90)}; gravou: ${antes !== depois}`, r.status === 403 && antes === depois ? 'APROVADO' : 'REPROVADO', '25a-p04-url-lucas.png', 'Rodada anterior usou corpo vazio (400 de validação) — erro do meu teste, corrigido aqui.');
await prisma.$disconnect();

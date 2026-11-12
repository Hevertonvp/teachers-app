// Segurança: P01 tenta LER, GRAVAR e CONCLUIR a folha de um cargo do P04 com corpo válido (semanaId real).
// API direta, declarado. Reescrito em 12/11/2026 para o 1/3 por cargo. Banco LOCAL.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { cargosDe, folhaDoCargo, SENHA } from './cargos-homolog.mjs';
const API = 'http://localhost:3340/api';
const req = async (m, c, t, b) => { const r = await fetch(API + c, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const login = async (e, s) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, senha: s }) })).json()).token;
const p01 = await login('p01@homolog.nexo', SENHA('p01'));

const ciclo = await prisma.cicloUmTerco.findUnique({ where: { id: 1 }, include: { semanas: true } });
const [c1] = await cargosDe('p04');
const antes = JSON.stringify((await folhaDoCargo(c1))?.respostas.map(r => r.texto) ?? []);

const get = await req('GET', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${c1}`, p01);
const put = await req('PUT', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${c1}/respostas`, p01, { baseUpdatedAt: null, respostas: ciclo.semanas.map(s => ({ semanaId: s.id, texto: 'INVASAO-DO-P01' })) });
const concluir = await req('POST', `/formulario-um-terco/ciclos/${ciclo.id}/cargos/${c1}/concluir`, p01, {});
const depois = JSON.stringify((await folhaDoCargo(c1))?.respostas.map(r => r.texto) ?? []);
const invasao = await prisma.respostaSemanaUmTerco.count({ where: { texto: 'INVASAO-DO-P01' } });
const ok = [403, 404].includes(get.status) && [403, 404].includes(put.status) && [403, 404].includes(concluir.status) && antes === depois && invasao === 0;
registrar('UT-PERM-P10b', 'Formulário 1/3 (permissões)', 'P01 lê, grava e conclui a folha de um cargo do P04', 'HTTP 403/404 nas três e nenhum dado alterado', `GET ${get.status}; PUT ${put.status}; concluir ${concluir.status}; dados do P04 alterados: ${antes !== depois}; textos INVASAO: ${invasao}`, ok ? 'APROVADO' : 'REPROVADO');
await prisma.$disconnect();

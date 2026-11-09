// Segurança: P01 tenta GRAVAR e CONCLUIR no formulário do P04 com corpo válido (semanaId real). API direta, declarado.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
const API = 'http://localhost:3340/api';
const req = async (m, c, t, b) => { const r = await fetch(API + c, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const login = async (e, s) => (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, senha: s }) })).json()).token;
const p01 = await login('p01@homolog.nexo', 'Nexo!Prof01-2026');

const ciclo = await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } }, include: { semanas: true } });
const arte = await prisma.disciplina.findUnique({ where: { nome: 'Arte' } });
const antes = await prisma.respostaSemanaUmTerco.findMany({ where: { entrega: { cicloId: ciclo.id, anoSerie: 7, disciplinaId: arte.id } }, orderBy: { id: 'asc' } });
const baseUpdatedAt = (await prisma.entregaUmTerco.findFirst({ where: { cicloId: ciclo.id, anoSerie: 7, disciplinaId: arte.id } }))?.updatedAt?.toISOString() ?? null;

const put = await req('PUT', `/formulario-um-terco/ciclos/${ciclo.id}/formularios/7/${arte.id}/respostas`, p01, { baseUpdatedAt, respostas: ciclo.semanas.map(s => ({ semanaId: s.id, texto: 'INVASAO-DO-P01' })) });
const depois = await prisma.respostaSemanaUmTerco.findMany({ where: { entrega: { cicloId: ciclo.id, anoSerie: 7, disciplinaId: arte.id } }, orderBy: { id: 'asc' } });
const alterou = JSON.stringify(antes.map(r => r.texto)) !== JSON.stringify(depois.map(r => r.texto)) || depois.some(r => r.texto.includes('INVASAO'));
const entregasP01 = await prisma.entregaUmTerco.count({ where: { cicloId: ciclo.id, professor: { email: 'p01@homolog.nexo' }, anoSerie: 7 } });
registrar('UT-PERM-P10b', 'Formulário 1/3 (permissões)', 'P01 grava respostas (corpo válido) em formulário que não é dele', 'HTTP 403/404 e nenhum dado alterado', `HTTP ${put.status} (${(put.json?.message ?? '').slice(0, 80)}); dados do P04 alterados: ${alterou}; entregas criadas p/ P01 no 7º ano: ${entregasP01}`, [403, 404].includes(put.status) && !alterou && entregasP01 === 0 ? 'APROVADO' : 'REPROVADO');
await prisma.$disconnect();

// Fase 6/9 — proteções DO SERVIDOR (independentes da tela), permissões e concorrência entre administradores.
// INTERVENÇÃO DECLARADA: usa chamadas diretas à API (não a interface), só para provar que o backend protege a regra
// mesmo quando a tela não bloqueia. Banco: somente o local de homologação.
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';

const API = 'http://localhost:3340/api';
const FUT = `${API}/formulario-um-terco`;
async function req(metodo, caminho, token, corpo) {
  const r = await fetch(API + caminho, { method: metodo, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  let json = null; try { json = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, json };
}
const entrar = async (email, senha) => (await req('POST', '/auth/login', null, { email, senha })).json.token;
const sec = await entrar('secretaria@escola.gov.br', '123456');
const p01 = await entrar('p01@homolog.nexo', 'Nexo!Prof01-2026');
const p04 = await entrar('p04@homolog.nexo', 'Nexo!Prof04-2026');
const TAG = Date.now().toString(36).slice(-4);
const S3 = [{ dataInicio: '2026-11-02', dataFim: '2026-11-06' }, { dataInicio: '2026-11-09', dataFim: '2026-11-13' }];
const corpo = (extra) => ({ anoLetivo: 2026, trimestre: 3, titulo: `ZZ-API-${TAG}`, abreEm: '2026-12-01T08:00', prazoEm: '2026-12-03T18:00', semanas: S3, ...extra });
const A = (await prisma.cicloUmTerco.findFirst({ where: { titulo: { contains: 'Nov/2026 (homolog)' } } })).id;
const criados = [];
const criar = async (extra) => { const r = await req('POST', '/formulario-um-terco/ciclos', sec, corpo(extra)); if (r.status < 300 && r.json?.id) criados.push(r.json.id); return r; };

// ---- 1. Validação no servidor (mesmas regras que a tela, sem a tela) ----
const invalidos = [
  ['A01', 'trimestre 4', { trimestre: 4 }, [400]],
  ['A02', 'ano letivo 1999', { anoLetivo: 1999 }, [400]],
  ['A03', 'abertura ausente', { abreEm: undefined }, [400]],
  ['A04', 'abertura "abc"', { abreEm: 'abc' }, [400]],
  ['A05', 'lista de semanas vazia', { semanas: [] }, [400]],
  ['A06', '31 semanas', { semanas: Array.from({ length: 31 }, () => S3[0]) }, [400]],
  ['A07', 'semana com início depois do fim', { semanas: [{ dataInicio: '2026-11-09', dataFim: '2026-11-02' }] }, [400]],
  ['A08', 'semana fora do trimestre (15/08)', { semanas: [{ dataInicio: '2026-08-10', dataFim: '2026-08-15' }] }, [400]],
  ['A09', 'título com 201 caracteres', { titulo: 'x'.repeat(201) }, [400]],
  ['A10', 'prazo fora do trimestre (20/12)', { prazoEm: '2026-12-20T10:00' }, [400]],
  ['A11', 'semana com data inexistente 31/11', { semanas: [{ dataInicio: '2026-11-31', dataFim: '2026-11-31' }] }, [400]],
  ['A12', 'sobreposição (começa no prazo de A, 20/11 18:00)', { abreEm: '2026-11-20T18:00', prazoEm: '2026-11-25T18:00' }, [409]],
  ['A13', 'ano letivo sem calendário (2030)', { anoLetivo: 2030, semanas: [{ dataInicio: '2030-02-01', dataFim: '2030-02-05' }], abreEm: '2030-02-01T08:00', prazoEm: '2030-02-05T18:00' }, [400, 409]],
];
for (const [id, desc, extra, ok] of invalidos) {
  const r = await criar(extra);
  registrar(`UT-SRV-${id}`, 'Formulário 1/3 (servidor)', `API recusa: ${desc}`, `HTTP ${ok.join('/')}`, `HTTP ${r.status}: ${(r.json?.message ?? r.json?.erro ?? JSON.stringify(r.json) ?? '').toString().slice(0, 110)}`, ok.includes(r.status) ? 'APROVADO' : 'REPROVADO');
}

// ---- 2. Permissões ----
const perm = [
  ['P01', 'Professor tenta criar ciclo', () => req('POST', '/formulario-um-terco/ciclos', p01, corpo({ titulo: `ZZ-PERM-${TAG}` })), [403]],
  ['P02', 'Professor tenta editar ciclo', () => req('PUT', `/formulario-um-terco/ciclos/${A}`, p01, corpo({ abreEm: '2026-11-02T08:00', prazoEm: '2026-11-20T18:00', semanas: [] })), [403]],
  ['P03', 'Professor tenta reabrir ciclo', () => req('POST', `/formulario-um-terco/ciclos/${A}/reaberturas`, p01, { inicioEm: '2026-11-21T08:00', fimEm: '2026-11-22T08:00' }), [403]],
  ['P04', 'Professor tenta ver o painel administrativo', () => req('GET', `/formulario-um-terco/ciclos/${A}/painel`, p01), [403]],
  ['P05', 'Professor tenta inativar ciclo', () => req('POST', `/formulario-um-terco/ciclos/${A}/inativar`, p01), [403]],
  ['P06', 'Secretaria tenta usar rota de preenchimento do professor (/minhas)', () => req('GET', '/formulario-um-terco/minhas', sec), [403]],
  ['P07', 'Sem token: lista de ciclos', () => req('GET', '/formulario-um-terco/ciclos', null), [401]],
  ['P08', 'Token inválido', () => req('GET', '/formulario-um-terco/minhas', 'token.invalido.x'), [401]],
  ['P09', 'P01 (só 6º Matemática) abre formulário 7º Arte que é do P04', async () => { const d = await prisma.disciplina.findUnique({ where: { nome: 'Arte' } }); return req('GET', `/formulario-um-terco/ciclos/${A}/formularios/7/${d.id}`, p01); }, [403, 404]],
  ['P10', 'P01 tenta gravar respostas num formulário que não é dele', async () => { const d = await prisma.disciplina.findUnique({ where: { nome: 'Arte' } }); return req('PUT', `/formulario-um-terco/ciclos/${A}/formularios/7/${d.id}/respostas`, p01, { baseUpdatedAt: null, respostas: [] }); }, [403, 404]],
  ['P11', 'P01 tenta concluir formulário que não é dele', async () => { const d = await prisma.disciplina.findUnique({ where: { nome: 'Arte' } }); return req('POST', `/formulario-um-terco/ciclos/${A}/formularios/7/${d.id}/concluir`, p01, {}); }, [403, 404]],
  ['P12', 'P01 tenta ler entrega do P04 pela rota administrativa', async () => { const p = await prisma.pessoa.findUnique({ where: { email: 'p04@homolog.nexo' } }); const d = await prisma.disciplina.findUnique({ where: { nome: 'Arte' } }); return req('GET', `/formulario-um-terco/ciclos/${A}/entregas/${p.id}/7/${d.id}`, p01); }, [403]],
];
for (const [id, desc, fn, ok] of perm) {
  const r = await fn();
  registrar(`UT-PERM-${id}`, 'Formulário 1/3 (permissões)', desc, `HTTP ${ok.join('/')}`, `HTTP ${r.status}`, ok.includes(r.status) ? 'APROVADO' : 'REPROVADO');
}
// vazamento: P01 não pode ver, na sua lista, formulários de outro professor
const minhasP01 = await req('GET', '/formulario-um-terco/minhas', p01);
const rot = JSON.stringify(minhasP01.json);
registrar('UT-PERM-P13', 'Formulário 1/3 (permissões)', 'Lista do P01 só tem o formulário dele (6º Matemática)', '1 item, sem Arte/Inglês', `${(minhasP01.json?.itens ?? minhasP01.json ?? []).length ?? '?'} item(ns); contém "Inglês": ${/Inglês/.test(rot)}`, !/Inglês|Arte/.test(rot) ? 'APROVADO' : 'REPROVADO');

// ---- 3. Concorrência entre administradores (disparos simultâneos) ----
const cenarios = [
  ['C01', 'duas criações parcialmente sobrepostas ao mesmo tempo', [{ abreEm: '2026-12-01T09:00', prazoEm: '2026-12-03T18:00' }, { abreEm: '2026-12-02T09:00', prazoEm: '2026-12-04T18:00' }], 1],
  ['C02', 'duas criações IDÊNTICAS ao mesmo tempo', [{ abreEm: '2026-12-07T09:00', prazoEm: '2026-12-08T18:00' }, { abreEm: '2026-12-07T09:00', prazoEm: '2026-12-08T18:00' }], 1],
  ['C03', 'duas criações que dividem a fronteira (prazo de uma = abertura da outra)', [{ abreEm: '2026-12-09T09:00', prazoEm: '2026-12-10T09:00' }, { abreEm: '2026-12-10T09:00', prazoEm: '2026-12-11T09:00' }], 1],
  ['C04', 'cinco criações idênticas ao mesmo tempo', Array.from({ length: 5 }, () => ({ abreEm: '2026-12-14T09:00', prazoEm: '2026-12-15T18:00' })), 1],
  ['C05', 'duas criações disjuntas ao mesmo tempo (ambas devem passar)', [{ abreEm: '2026-12-16T09:00', prazoEm: '2026-12-16T12:00' }, { abreEm: '2026-12-17T09:00', prazoEm: '2026-12-17T12:00' }], 2],
];
for (const [id, desc, janelas, esperadas] of cenarios) {
  const respostas = await Promise.all(janelas.map(j => criar({ ...j, titulo: `ZZ-API-${id}-${TAG}` })));
  const status = respostas.map(r => r.status).sort().join(',');
  const noBanco = await prisma.cicloUmTerco.count({ where: { titulo: `ZZ-API-${id}-${TAG}`, status: 'ATIVA' } });
  registrar(`UT-CONC-${id}`, 'Formulário 1/3 (concorrência)', desc, `${esperadas} criada(s), as demais 409`, `status ${status}; ATIVAS no banco: ${noBanco}`, noBanco === esperadas && respostas.filter(r => r.status === 409).length === janelas.length - esperadas && !respostas.some(r => r.status >= 500) ? 'APROVADO' : 'REPROVADO');
}
const pares = await prisma.$queryRawUnsafe(`SELECT a.id AS a, b.id AS b FROM ciclos_um_terco a JOIN ciclos_um_terco b ON a.id < b.id WHERE a.status = 'ATIVA' AND b.status = 'ATIVA' AND a."abreEm" <= b."prazoEm" AND a."prazoEm" >= b."abreEm"`);
registrar('UT-CONC-INV', 'Formulário 1/3 (concorrência)', 'Invariante após a concorrência: nenhum par de ATIVOS sobrepostos', '0 pares', `${pares.length} pares`, pares.length === 0 ? 'APROVADO' : 'REPROVADO');

// ---- 4. Edição, reativação e reabertura ----
const X = (await criar({ titulo: `ZZ-API-X-${TAG}`, abreEm: '2026-12-18T09:00', prazoEm: '2026-12-18T12:00' })).json?.id;
const ed1 = await req('PUT', `/formulario-um-terco/ciclos/${X}`, sec, corpo({ titulo: `ZZ-API-X-${TAG}`, abreEm: '2026-11-10T08:00', prazoEm: '2026-11-12T08:00' }));
registrar('UT-ED-01', 'Formulário 1/3 (edição)', 'Editar ciclo para uma janela que sobrepõe o ciclo A', 'HTTP 409', `HTTP ${ed1.status}`, ed1.status === 409 ? 'APROVADO' : 'REPROVADO');
await req('POST', `/formulario-um-terco/ciclos/${X}/inativar`, sec);
const Y = (await criar({ titulo: `ZZ-API-Y-${TAG}`, abreEm: '2026-12-18T09:00', prazoEm: '2026-12-18T12:00' })).json?.id;
const rea = await req('POST', `/formulario-um-terco/ciclos/${X}/reativar`, sec);
registrar('UT-ED-02', 'Formulário 1/3 (edição)', 'Reativar ciclo inativo cuja janela agora colide com outro ciclo ativo', 'HTTP 409', `HTTP ${rea.status}`, rea.status === 409 ? 'APROVADO' : 'REPROVADO');
const edA = await req('PUT', `/formulario-um-terco/ciclos/${A}`, sec, corpo({ titulo: 'Formulário 1/3 — Nov/2026 (homolog)', trimestre: 2 }));
registrar('UT-ED-03', 'Formulário 1/3 (edição)', 'Mudar trimestre de ciclo que já tem entregas', 'HTTP 409 (travado)', `HTTP ${edA.status}`, edA.status === 409 ? 'APROVADO' : 'REPROVADO');
const ina = await req('POST', `/formulario-um-terco/ciclos/${A}/inativar`, sec);
registrar('UT-ED-04', 'Formulário 1/3 (edição)', 'Inativar ciclo que já tem preenchimentos', 'HTTP 409', `HTTP ${ina.status}`, ina.status === 409 ? 'APROVADO' : 'REPROVADO');
const inexistente = await req('DELETE', `/formulario-um-terco/ciclos/${A}`, sec);
registrar('UT-ED-05', 'Formulário 1/3 (edição)', 'Excluir ciclo (não há rota de exclusão; só inativar)', 'HTTP 404 (sem exclusão)', `HTTP ${inexistente.status}`, [404, 405].includes(inexistente.status) ? 'OBSERVAÇÃO (regra não especificada)' : 'REPROVADO', '', 'Pedido de homologação lista "excluir ciclo com/sem entregas": só existe Inativar.');

// Reabertura (comportamento atual; regra oficial não definida)
const r1 = await req('POST', `/formulario-um-terco/ciclos/${Y}/reaberturas`, sec, { inicioEm: '2026-12-19T08:00', fimEm: '2026-12-19T12:00', motivo: 'homologação' });
registrar('UT-REA-01', 'Formulário 1/3 (reabertura)', 'Reabrir ciclo (janela fora do prazo original)', 'aceita', `HTTP ${r1.status}`, r1.status < 300 ? 'APROVADO' : 'REPROVADO');
const r2 = await req('POST', `/formulario-um-terco/ciclos/${Y}/reaberturas`, sec, { inicioEm: '2026-12-19T10:00', fimEm: '2026-12-19T14:00' });
registrar('UT-REA-02', 'Formulário 1/3 (reabertura)', 'Segunda reabertura com período sobreposto à primeira', 'HTTP 400', `HTTP ${r2.status}`, r2.status === 400 ? 'APROVADO' : 'REPROVADO');
const r3 = await req('POST', `/formulario-um-terco/ciclos/${Y}/reaberturas`, sec, { inicioEm: '2026-11-05T08:00', fimEm: '2026-11-06T08:00' });
registrar('UT-REA-03', 'Formulário 1/3 (reabertura)', 'Reabertura cuja janela cai DENTRO do período aberto do ciclo A (colide com outro ciclo)', 'regra NÃO definida (ambiguidade conhecida)', `HTTP ${r3.status}`, 'OBSERVAÇÃO (regra não especificada)', '', r3.status < 300 ? 'ACEITA: dois formulários podem ficar editáveis ao mesmo tempo via reabertura.' : 'Recusada.');
const r4 = await req('POST', `/formulario-um-terco/ciclos/${Y}/reaberturas`, sec, { inicioEm: '2026-12-25T10:00', fimEm: '2026-12-25T09:00' });
registrar('UT-REA-04', 'Formulário 1/3 (reabertura)', 'Reabertura com fim antes do início', 'HTTP 400', `HTTP ${r4.status}`, r4.status === 400 ? 'APROVADO' : 'REPROVADO');
const r5 = await req('POST', `/formulario-um-terco/ciclos/${Y}/reaberturas`, sec, { inicioEm: '2027-03-01T08:00', fimEm: '2027-03-02T08:00' });
registrar('UT-REA-05', 'Formulário 1/3 (reabertura)', 'Reabertura em data de outro ano letivo/trimestre (mar/2027)', 'regra NÃO definida', `HTTP ${r5.status}`, 'OBSERVAÇÃO (regra não especificada)');

// ---- Limpeza dos ciclos de teste desta rotina (inativação via API; só os que criei) ----
for (const id of criados) await req('POST', `/formulario-um-terco/ciclos/${id}/inativar`, sec);
console.log('Ciclos criados e inativados nesta rotina:', criados.length);
await prisma.$disconnect();

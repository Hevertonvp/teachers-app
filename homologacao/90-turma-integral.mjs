// Turma INTEGRAL (17/11/2026), banco LOCAL: tipo Regular/Integral, nome livre, sem ano/série; vínculo normal com
// Professor (Cargos e escolas); PDI não recebe aluno em turma Integral; turma regular continua igual. Limpa o que cria.
import { abrir, login, foto, marcarTurma, preencherCadastroProfessor, BASE } from './lib.mjs';
import { prisma } from './db.mjs';
import { registrar } from './resultados.mjs';
import { limparProfessoresDeTeste } from './limpar-professores-teste.mjs';

const API = 'http://localhost:3340';
const TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const r = (id, cen, esp, obs, ok, ev = '') => registrar(`INTEGRAL-${id}`, 'Turma Integral', cen, esp, obs, ok ? 'APROVADO' : 'REPROVADO', ev);
const token = async (email, senha) => (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, senha }) })).json()).token;
const api = async (t, method, path, body) => { const x = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, json: j }; };

const limpar = async () => {
  const turmas = (await prisma.turma.findMany({ where: { nome: { contains: 'ZZINT' } }, select: { id: true } })).map(t => t.id);
  await prisma.professorTurmaDisciplina.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.professorTurmaAtuacao.deleteMany({ where: { turmaId: { in: turmas } } });
  await prisma.turma.deleteMany({ where: { id: { in: turmas } } });
  await limparProfessoresDeTeste(['integral-']);
};
await limpar();
const escola = await prisma.escola.findFirst({ where: { nome: 'ZZ-HOMOLOG Escola Aurora' } });
const mat = await prisma.disciplina.findFirst({ where: { nome: 'Matemática' } });
const p04 = await prisma.pessoa.findUnique({ where: { email: 'p04@homolog.nexo' } });
const tSec = await token('secretaria@escola.gov.br', '12345678');
const NOME = `Grupo Girassol ZZINT${TAG}`;

// 1–4: API
const c1 = await api(tSec, 'POST', '/api/turmas', { tipo: 'INTEGRAL', escolaId: escola.id, anoLetivo: 2026, nome: `  ${NOME}  `, turno: 'TARDE' });
r('1', 'Criar turma Integral com nome livre, sem etapa/ano/série/número', '201; INTEGRAL; nome igual; etapa/ano nulos', `${c1.status}; ${c1.json?.tipo}; "${c1.json?.nome}"; etapa ${c1.json?.etapa}, ano ${c1.json?.anoSerie}, nº ${c1.json?.identificador}`,
  c1.status === 201 && c1.json.tipo === 'INTEGRAL' && c1.json.nome === NOME && c1.json.etapa === null && c1.json.anoSerie === null && c1.json.identificador === null);
const dup = await api(tSec, 'POST', '/api/turmas', { tipo: 'INTEGRAL', escolaId: escola.id, anoLetivo: 2026, nome: NOME.toLowerCase().replace('Girassol', 'GIRASSÓL'), turno: 'MANHA' });
const semNome = await api(tSec, 'POST', '/api/turmas', { tipo: 'INTEGRAL', escolaId: escola.id, anoLetivo: 2026, nome: '  ', turno: 'MANHA' });
const regularSemEtapa = await api(tSec, 'POST', '/api/turmas', { escolaId: escola.id, anoLetivo: 2026, turno: 'MANHA', identificador: 1 });
r('2', 'Mesmo nome (maiúscula/acento) na escola e ano: recusa; sem nome: recusa; Regular continua exigindo etapa', '409 / 400 / 400', `${dup.status} ${dup.json?.message ?? ''} / ${semNome.status} / ${regularSemEtapa.status}`,
  dup.status === 409 && semNome.status === 400 && regularSemEtapa.status === 400);
const virarRegular = await api(tSec, 'PUT', `/api/turmas/${c1.json.id}`, { tipo: 'REGULAR', escolaId: escola.id, anoLetivo: 2026, etapa: 'FUNDAMENTAL', anoSerie: 6, turno: 'MANHA', identificador: 9 });
const renomear = await api(tSec, 'PUT', `/api/turmas/${c1.json.id}`, { escolaId: escola.id, anoLetivo: 2026, nome: `${NOME} B`, turno: 'MANHA' });
const inat = await api(tSec, 'POST', `/api/turmas/${c1.json.id}/inativar`);
const reat = await api(tSec, 'POST', `/api/turmas/${c1.json.id}/reativar`);
r('3', 'Editar: tipo não muda; renomear Integral funciona; inativar/reativar funciona', '400 / 200 "… B" / 200 / 200', `${virarRegular.status} / ${renomear.status} "${renomear.json?.nome}" / ${inat.status} / ${reat.status}`,
  virarRegular.status === 400 && renomear.status === 200 && renomear.json.nome === `${NOME} B` && renomear.json.tipo === 'INTEGRAL' && inat.status === 200 && reat.status === 200);
await api(tSec, 'PUT', `/api/turmas/${c1.json.id}`, { escolaId: escola.id, anoLetivo: 2026, nome: NOME, turno: 'TARDE' });
const v = await api(tSec, 'POST', '/api/professor-turma-disciplina', { turmaId: c1.json.id, professorId: p04.id, disciplinaId: mat.id });
const aluno = await api(tSec, 'POST', '/api/pdi-alunos', { nome: 'Aluno ZZINT', turmaId: c1.json.id, responsavelNome: 'R', responsavelParentesco: 'Mãe', responsavelTelefone: '0' });
r('4', 'Professor liga normalmente na turma Integral; aluno do PDI não pode ser colocado nela', '201 / 400', `${v.status} / ${aluno.status} ${aluno.json?.message ?? ''}`, v.status === 201 && aluno.status === 400);
await prisma.professorTurmaDisciplina.deleteMany({ where: { turmaId: c1.json.id } });

// 5–6: telas (computador e celular)
for (const [nome, vp] of [['desktop', { width: 1280, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  const X = await abrir({ viewport: vp });
  const p = X.page;
  const modal = () => p.locator('div.fixed.inset-0.z-50').last();
  await login(p, 'secretaria@escola.gov.br', '12345678');
  await p.goto(BASE + '/#/turmas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Nova turma' }).first().click(); await p.waitForTimeout(600);
  const camposRegular = await modal().getByText('Ano/série', { exact: true }).count();
  await modal().getByRole('radio', { name: 'Integral' }).click(); await p.waitForTimeout(300);
  const camposIntegral = { ano: await modal().getByText('Ano/série', { exact: true }).count(), etapa: await modal().getByText('Etapa', { exact: true }).count(), nome: await modal().getByText('Nome da turma', { exact: true }).count() };
  const sel = modal().locator('select').first();
  await sel.selectOption(await sel.evaluate((s) => [...s.options].find(o => o.text.trim() === 'ZZ-HOMOLOG Escola Aurora').value));
  const nomeTela = `Integral ${nome} ZZINT${TAG}`;
  await modal().getByPlaceholder(/Integral A/).fill(nomeTela);
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await foto(p, `90-nova-integral-${nome}`);
  await modal().getByRole('button', { name: 'Salvar' }).click(); await p.waitForTimeout(1500);
  const criada = await prisma.turma.findFirst({ where: { nome: nomeTela } });
  await p.getByRole('combobox').nth(2).selectOption('integral').catch(() => {}); await p.waitForTimeout(500);
  const lista = await p.locator('main').innerText();
  r(`5-${nome}`, `${nome}: Nova turma → Integral mostra só Nome/Ano letivo/Turno (sem Etapa e Ano/série); salva; lista mostra etiqueta Integral; sem rolagem lateral`, 'Regular com Ano/série; Integral sem; gravada INTEGRAL; etiqueta',
    `Regular ano/série ${camposRegular}; Integral ano ${camposIntegral.ano}, etapa ${camposIntegral.etapa}, nome ${camposIntegral.nome}; gravada ${criada?.tipo}; lista ${lista.includes(nomeTela) && /Integral/.test(lista)}; sem rolagem ${largura}`,
    camposRegular === 1 && camposIntegral.ano === 0 && camposIntegral.etapa === 0 && camposIntegral.nome === 1 && criada?.tipo === 'INTEGRAL' && criada.etapa === null && lista.includes(nomeTela) && largura, `90-nova-integral-${nome}.png`);

  // Cadastro de professor: a turma Integral aparece na aba "Integral" da escola e é gravada.
  const email = `integral-${nome}-${TAG}@homolog.nexo`;
  await p.goto(BASE + '/#/pessoas'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '+ Cadastrar professor' }).click(); await p.waitForTimeout(1000);
  await preencherCadastroProfessor(modal(), { email, nome: `Professor Integral ${nome} ${TAG}`, escola: 'ZZ-HOMOLOG Escola Aurora', disciplina: 'Matemática', turmas: [`Matemática — ${NOME}`], enviar: false });
  const abas = await modal().getByRole('tab').allInnerTexts().catch(() => []);
  await foto(p, `90-cargo-integral-${nome}`);
  await modal().getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await p.getByText('Senha temporária').waitFor({ timeout: 15000 }).catch(() => {});
  const gravado = await prisma.professorTurmaDisciplina.findFirst({ where: { professor: { email }, turmaId: c1.json.id, status: 'ATIVO' } });
  r(`6-${nome}`, `${nome}: no cadastro do Professor (cargo), a turma Integral aparece numa aba "Integral" e o vínculo é gravado`, 'aba Integral; vínculo gravado', `abas: ${abas.join(' | ')}; vínculo ${!!gravado}`,
    abas.some(a => a.startsWith('Integral')) && !!gravado, `90-cargo-integral-${nome}.png`);
  console.log('Erros de console:', X.erros.filter(e => !/favicon/.test(e)).slice(0, 5));
  await X.browser.close();
}

await limpar();
await prisma.$disconnect();

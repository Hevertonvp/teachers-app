// Testes das regras puras do Formulário 1/3 (sem banco). Rodar: npx tsx scripts/umTerco/testar-dominio.ts
import assert from 'node:assert/strict';
import { cicloEditavelAgora, statusDoCiclo, validarCiclo, validarReabertura } from '../../src/domain/umTerco.js';

let ok = 0;
const caso = (nome: string, fn: () => void) => { try { fn(); ok += 1; console.log(`  ok  ${nome}`); } catch (e) { console.error(`FALHOU ${nome}\n  ${(e as Error).message}`); process.exitCode = 1; } };
const falha = (fn: () => unknown, trecho: RegExp) => assert.throws(fn, (e: Error) => trecho.test(e.message));

const janela = { dataInicio: '2026-10-05', dataFim: '2026-12-18' }; // 4º... qualquer trimestre
const base = {
  anoLetivo: 2026, trimestre: 3, abreEm: '2026-10-19T08:00', prazoEm: '2026-11-20T23:59',
  semanas: [
    { dataInicio: '2026-10-19', dataFim: '2026-10-23' }, { dataInicio: '2026-10-26', dataFim: '2026-10-30' },
    { dataInicio: '2026-11-03', dataFim: '2026-11-06' }, { dataInicio: '2026-11-09', dataFim: '2026-11-13' },
  ],
};

caso('ciclo válido gera Semana 1..4 automaticamente', () => {
  const v = validarCiclo(base, janela);
  assert.deepEqual(v.semanas.map((s) => s.numero), [1, 2, 3, 4]);
  assert.equal(v.titulo, 'Formulário 1/3');
});
caso('09: datas dentro do trimestre passam (bordas inclusas)', () => {
  validarCiclo({ ...base, abreEm: '2026-10-05T00:00', prazoEm: '2026-12-18T23:59', semanas: [{ dataInicio: '2026-10-05', dataFim: '2026-12-18' }] }, janela);
});
caso('10: abertura fora do trimestre bloqueia', () => falha(() => validarCiclo({ ...base, abreEm: '2026-10-04T23:59' }, janela), /abertura .* fora/i));
caso('10: prazo fora do trimestre bloqueia', () => falha(() => validarCiclo({ ...base, prazoEm: '2026-12-19T08:00' }, janela), /prazo .* fora/i));
caso('10: semana fora do trimestre bloqueia', () => falha(() => validarCiclo({ ...base, semanas: [{ dataInicio: '2026-12-17', dataFim: '2026-12-21' }] }, janela), /Semana 1 .* fora/i));
caso('11: semana com início depois do fim', () => falha(() => validarCiclo({ ...base, semanas: [{ dataInicio: '2026-10-23', dataFim: '2026-10-19' }] }, janela), /Semana 1: o início/i));
caso('11: semana com data inexistente (30/02)', () => falha(() => validarCiclo({ ...base, semanas: [{ dataInicio: '2026-02-30', dataFim: '2026-03-02' }] }, janela), /Semana 1: data de início inválida/i));
caso('12: prazo anterior à abertura', () => falha(() => validarCiclo({ ...base, prazoEm: '2026-10-19T07:59' }, janela), /depois da abertura/i));
caso('12: prazo igual à abertura', () => falha(() => validarCiclo({ ...base, prazoEm: '2026-10-19T08:00' }, janela), /depois da abertura/i));
caso('trimestre sem calendário configurado', () => falha(() => validarCiclo(base, null), /não está configurado/i));
caso('sem semanas', () => falha(() => validarCiclo({ ...base, semanas: [] }, janela), /ao menos uma semana/i));
caso('fuso: 23:30 de Brasília do último dia ainda conta como dentro', () => {
  validarCiclo({ ...base, prazoEm: '2026-12-18T23:30' }, janela);
});
caso('fuso: 00:30 de Brasília do dia seguinte já é fora (UTC não engana)', () => falha(() => validarCiclo({ ...base, prazoEm: '2026-12-19T00:30' }, janela), /prazo .* fora/i));

const ciclo = { abreEm: new Date('2026-10-19T11:00:00Z'), prazoEm: new Date('2026-11-21T02:59:00Z') };
caso('status agendado/aberto/encerrado', () => {
  assert.equal(statusDoCiclo(ciclo, new Date('2026-10-19T10:59:00Z')), 'agendado');
  assert.equal(statusDoCiclo(ciclo, new Date('2026-10-20T00:00:00Z')), 'aberto');
  assert.equal(statusDoCiclo(ciclo, new Date('2026-11-21T03:00:00Z')), 'encerrado');
});
caso('18: editável dentro do prazo (mesmo já concluído)', () => assert.equal(cicloEditavelAgora(ciclo, [], new Date('2026-11-01T12:00:00Z')), true));
caso('19: bloqueado após o prazo sem reabertura', () => assert.equal(cicloEditavelAgora(ciclo, [], new Date('2026-11-25T12:00:00Z')), false));
caso('20: reabertura libera e não altera o prazo original', () => {
  const r = [{ inicioEm: new Date('2026-11-24T00:00:00Z'), fimEm: new Date('2026-11-27T00:00:00Z') }];
  assert.equal(cicloEditavelAgora(ciclo, r, new Date('2026-11-25T12:00:00Z')), true);
  assert.equal(cicloEditavelAgora(ciclo, r, new Date('2026-11-28T12:00:00Z')), false);
  assert.equal(statusDoCiclo(ciclo, new Date('2026-11-25T12:00:00Z')), 'encerrado');
});
caso('reabertura: fim antes do início', () => falha(() => validarReabertura({ inicioEm: '2026-11-25T10:00', fimEm: '2026-11-25T09:00' }, []), /depois do início/i));
caso('reabertura: sobreposta', () => {
  const ex = [{ inicioEm: new Date('2026-11-24T10:00:00Z'), fimEm: new Date('2026-11-27T10:00:00Z') }];
  falha(() => validarReabertura({ inicioEm: '2026-11-26T08:00', fimEm: '2026-11-30T08:00' }, ex), /sobreposto/i);
});
caso('reabertura: períodos vizinhos sem sobrepor passam', () => {
  const ex = [{ inicioEm: new Date('2026-11-24T10:00:00Z'), fimEm: new Date('2026-11-27T10:00:00Z') }];
  validarReabertura({ inicioEm: '2026-11-28T08:00', fimEm: '2026-11-30T08:00' }, ex);
});

console.log(`\n${ok} casos ok`);

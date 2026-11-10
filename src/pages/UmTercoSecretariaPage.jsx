import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormField, LoadingBlock, Modal } from '../components/Common';
import { MainLayout } from '../layouts/Layouts';
import { BotaoExportarExcel } from '../components/BotaoExportarExcel';
import { useAuth } from '../context/AuthContext';
import { exportarUmTerco } from '../utils/exportarUmTerco';
import { useData } from '../context/DataContext';
import {
  atualizarCicloUmTerco, criarCicloUmTerco, criarReaberturaUmTerco, inativarCicloUmTerco, listarCiclosUmTerco, reativarCicloUmTerco,
} from '../services/formularioUmTerco';
import { inputClass } from '../utils/display';
import { trimestres } from '../utils/trimestres';
import { formatarDataHora, formatarDiaMes, formatarPeriodo, paraInputDataHora, STATUS_PRAZO } from '../utils/umTerco';

const SEMANA_VAZIA = { dataInicio: '', dataFim: '' };

const dataFmt = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const fracao = (iso, ini, fim) => {
  const total = Date.parse(fim) - Date.parse(ini);
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, (Date.parse(iso) - Date.parse(ini)) / total));
};

// Faixa visual do trimestre com cada semana posicionada — vermelho = fora da janela global.
const LinhaDoTempo = ({ janela, semanas }) => {
  if (!janela) return null;
  return (
    <div>
      <div className="relative h-8 rounded-lg bg-slate-100">
        {semanas.map((semana, indice) => {
          if (!semana.dataInicio || !semana.dataFim || semana.dataFim < semana.dataInicio) return null;
          const fora = semana.dataInicio < janela.startDate || semana.dataFim > janela.endDate;
          const esquerda = fracao(semana.dataInicio, janela.startDate, janela.endDate) * 100;
          const largura = Math.max(1.5, (fracao(semana.dataFim, janela.startDate, janela.endDate) - fracao(semana.dataInicio, janela.startDate, janela.endDate)) * 100);
          return (
            <div
              key={indice}
              className={`absolute top-1 bottom-1 grid place-items-center rounded text-[10px] font-bold text-white ${fora ? 'bg-red-500' : 'bg-teal-600'}`}
              style={{ left: `${esquerda}%`, width: `${largura}%` }}
              title={`Semana ${indice + 1}: ${formatarPeriodo(semana.dataInicio, semana.dataFim)}`}
            >
              {indice + 1}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{dataFmt(janela.startDate)}</span><span>{dataFmt(janela.endDate)}</span></div>
    </div>
  );
};

const TITULO_PADRAO = 'Formulário 1/3';
// Cartão do ciclo: só a data quando a hora é a padrão (abre 00:00, prazo 23:59); ciclos antigos com
// hora própria continuam mostrando a hora.
const dataSemHoraPadrao = (iso, horaPadrao) => {
  const local = paraInputDataHora(iso);
  return local.slice(11, 16) === horaPadrao ? dataFmt(local.slice(0, 10)) : formatarDataHora(iso);
};
const SEMANAS_PADRAO = 4;

// Data 'YYYY-MM-DD' <-> dia inteiro (UTC), para dividir o período sem efeito de fuso.
const paraDia = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const deDia = (dia) => new Date(dia * 86400000).toISOString().slice(0, 10);

// Divide [inicio, fim] (inclusivo) em n períodos consecutivos o mais iguais possível.
// Ex.: 02/11–27/11 em 4 → 02–07, 08–14, 15–20, 21–27. Devolve null se houver menos dias que semanas.
const dividirPeriodo = (inicio, fim, n) => {
  if (!inicio || !fim || n < 1) return null;
  const a = paraDia(inicio);
  const total = paraDia(fim) - a + 1;
  if (total < n) return null;
  return Array.from({ length: n }, (_, i) => ({
    dataInicio: deDia(a + Math.floor((i * total) / n)),
    dataFim: deDia(a + Math.floor(((i + 1) * total) / n) - 1),
  }));
};

const CicloFormModal = ({ ciclo, janelas, onClose, onSalvo }) => {
  const editando = !!ciclo;
  const travado = editando && ciclo.entregasIniciadas > 0;
  // Abertura e prazo são escolhidos só por DATA (pedido do usuário, 10/11/2026): abre às 00:00 e o
  // prazo vale até 23:59 do dia (horário de São Paulo). Ciclo antigo com hora própria (ex.: prazo
  // 18:00) mantém essa hora enquanto a data não for alterada — editar não muda o prazo sem querer.
  const abreOriginal = paraInputDataHora(ciclo?.abreEm);
  const prazoOriginal = paraInputDataHora(ciclo?.prazoEm);
  const [abreEm, setAbreEm] = useState(abreOriginal.slice(0, 10));
  const [prazoEm, setPrazoEm] = useState(prazoOriginal.slice(0, 10));
  const [semanas, setSemanas] = useState(ciclo ? ciclo.semanas.map(s => ({ dataInicio: s.dataInicio, dataFim: s.dataFim })) : Array.from({ length: SEMANAS_PADRAO }, () => ({ ...SEMANA_VAZIA })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Ano e trimestre não são escolhidos: saem da data de ABERTURA (o trimestre do calendário que a
  // contém). Na prática é o trimestre vigente, e ainda permite preparar o próximo com antecedência.
  // Edição de ciclo cuja abertura não cai em trimestre configurado: mantém o ano/trimestre que já tem.
  const diaAbertura = abreEm ? abreEm.slice(0, 10) : '';
  const diaPrazo = prazoEm ? prazoEm.slice(0, 10) : '';
  const janelaPelaAbertura = diaAbertura ? janelas.find(p => p.startDate <= diaAbertura && diaAbertura <= p.endDate) ?? null : null;
  const janela = janelaPelaAbertura ?? (editando ? janelas.find(p => p.ano === ciclo.anoLetivo && p.trimestre === trimestres[ciclo.trimestre - 1]) ?? null : null);
  const trimestreNumero = janela ? trimestres.indexOf(janela.trimestre) + 1 : null;

  // Divide a janela abertura → prazo nas semanas. Novo ciclo: automático ao mudar abertura, prazo ou
  // quantidade. Ciclo existente: só pelo botão "Redividir" (mudar o prazo de um ciclo em andamento
  // não pode mexer sozinho nas semanas que os professores já estão preenchendo).
  const periodoCurto = !!diaAbertura && !!diaPrazo && diaPrazo >= diaAbertura && !dividirPeriodo(diaAbertura, diaPrazo, semanas.length);
  const redividir = (n = semanas.length, inicio = diaAbertura, fim = diaPrazo) => {
    const divisao = inicio && fim && fim >= inicio ? dividirPeriodo(inicio, fim, n) : null;
    setSemanas(prev => divisao ?? Array.from({ length: n }, (_, i) => prev[i] ?? { ...SEMANA_VAZIA }));
  };
  const mudarAbertura = (valor) => { setAbreEm(valor); if (!editando) redividir(semanas.length, valor.slice(0, 10), diaPrazo); };
  const mudarPrazo = (valor) => { setPrazoEm(valor); if (!editando) redividir(semanas.length, diaAbertura, valor.slice(0, 10)); };
  const mudarQuantidade = (valor) => {
    const n = Math.max(1, Math.min(30, Number(valor) || 1));
    if (!editando) redividir(n);
    else setSemanas(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { ...SEMANA_VAZIA }));
  };
  const mudarSemana = (indice, campo, valor) => setSemanas(prev => prev.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)));

  const salvar = async (event) => {
    event.preventDefault();
    setErro('');
    if (!janela) { setErro('A data de abertura não está dentro de nenhum trimestre do calendário (Configurações › Trimestres).'); return; }
    setSalvando(true);
    // Título sempre "Formulário 1/3" (ciclos antigos mantêm o título que já têm).
    const corpo = { anoLetivo: janela.ano, trimestre: trimestreNumero, titulo: editando ? ciclo.titulo : TITULO_PADRAO,
      abreEm: editando && abreEm === abreOriginal.slice(0, 10) ? abreOriginal : `${abreEm}T00:00`,
      prazoEm: editando && prazoEm === prazoOriginal.slice(0, 10) ? prazoOriginal : `${prazoEm}T23:59`,
      semanas };
    try {
      if (editando) await atualizarCicloUmTerco(ciclo.id, corpo);
      else await criarCicloUmTerco(corpo);
      onSalvo();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title={editando ? 'Editar Formulário 1/3' : 'Novo Formulário 1/3'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {travado && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Já há Professores preenchendo: o trimestre e a quantidade de semanas não podem mudar. Datas e prazo continuam editáveis.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Abertura"><input type="date" className={inputClass} value={abreEm} onChange={e => mudarAbertura(e.target.value)} required /></FormField>
          <FormField label="Prazo de entrega"><input type="date" className={inputClass} value={prazoEm} onChange={e => mudarPrazo(e.target.value)} required /></FormField>
        </div>

        {janela
          ? <p className="text-xs font-semibold text-slate-600">{janela.trimestre} de {janela.ano} ({dataFmt(janela.startDate)} a {dataFmt(janela.endDate)}), identificado pela abertura. Todas as datas precisam estar dentro dele.</p>
          : diaAbertura
            ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">A abertura ({dataFmt(diaAbertura)}) não está dentro de nenhum trimestre do calendário. Configure em Configurações › Trimestres.</p>
            : <p className="text-xs text-slate-500">Escolha a abertura e o prazo: o trimestre é identificado pela abertura e as semanas são divididas automaticamente.</p>}

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Semanas <span className="font-normal text-slate-500">(divididas dentro do período; podem ser editadas)</span></p>
            <div className="flex items-end gap-2">
              <FormField label="Quantidade de semanas"><input type="number" min={1} max={30} className={`${inputClass} w-24`} value={semanas.length} onChange={e => mudarQuantidade(e.target.value)} disabled={travado} /></FormField>
              {editando && <Button type="button" size="sm" variant="outline" onClick={() => redividir()} disabled={!diaAbertura || !diaPrazo || diaPrazo < diaAbertura}>Redividir pelo período</Button>}
            </div>
          </div>
          {periodoCurto && <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">O período tem menos dias que a quantidade de semanas: preencha as datas manualmente ou diminua a quantidade.</p>}
          <LinhaDoTempo janela={janela} semanas={semanas} />
          <div className="mt-3 space-y-2">
            {semanas.map((semana, indice) => (
              <div key={indice} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[5.5rem_1fr_1fr]">
                <span className="col-span-2 text-sm font-bold text-slate-800 sm:col-span-1">Semana {indice + 1}</span>
                <input type="date" aria-label={`Semana ${indice + 1}: início`} className={`${inputClass} min-w-0`} value={semana.dataInicio} min={janela?.startDate} max={janela?.endDate} onChange={e => mudarSemana(indice, 'dataInicio', e.target.value)} required />
                <input type="date" aria-label={`Semana ${indice + 1}: fim`} className={`${inputClass} min-w-0`} value={semana.dataFim} min={janela?.startDate} max={janela?.endDate} onChange={e => mudarSemana(indice, 'dataFim', e.target.value)} required />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={salvando} disabled={!janela}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const ReaberturaModal = ({ ciclo, onClose, onSalvo }) => {
  const [inicioEm, setInicioEm] = useState('');
  const [fimEm, setFimEm] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await criarReaberturaUmTerco(ciclo.id, { inicioEm, fimEm, motivo });
      onSalvo();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title={`Reabrir — ${ciclo.titulo} (${ciclo.trimestre}º tri)`} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-slate-600">A reabertura libera a edição para todos os Professores deste ciclo no período abaixo. O prazo original não é alterado e a reabertura fica registrada.</p>
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {ciclo.reaberturas.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {ciclo.reaberturas.map(r => <li key={r.id}>{formatarDataHora(r.inicioEm)} → {formatarDataHora(r.fimEm)}{r.motivo ? ` — ${r.motivo}` : ''}</li>)}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Início"><input type="datetime-local" className={inputClass} value={inicioEm} onChange={e => setInicioEm(e.target.value)} required /></FormField>
          <FormField label="Fim"><input type="datetime-local" className={inputClass} value={fimEm} onChange={e => setFimEm(e.target.value)} required /></FormField>
        </div>
        <FormField label="Motivo (opcional)"><input className={inputClass} value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} /></FormField>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={salvando}>{salvando ? 'Salvando...' : 'Reabrir'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const UmTercoSecretariaPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trimestrePeriods } = useData();
  const [ciclos, setCiclos] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [formAberto, setFormAberto] = useState(null); // null | 'novo' | ciclo
  const [reabrindo, setReabrindo] = useState(null);
  const [inativando, setInativando] = useState(null);

  const carregar = () => {
    setErro('');
    listarCiclosUmTerco().then(setCiclos).catch(e => setErro(e.message));
  };
  useEffect(carregar, []);

  const janelas = useMemo(() => trimestrePeriods ?? [], [trimestrePeriods]);

  // Inativos ficam numa tela separada (pedido do usuário, 10/11/2026: "se cada inativo ficar ali vai
  // virar uma bagunça"). Mesma página, endereço próprio (?ver=inativos) para o Voltar do navegador funcionar.
  const [params] = useSearchParams();
  const verInativos = params.get('ver') === 'inativos';
  const ativos = (ciclos || []).filter(c => c.statusRegistro !== 'inativa');
  const inativos = (ciclos || []).filter(c => c.statusRegistro === 'inativa');
  const lista = verInativos ? inativos : ativos;

  const acao = async (fn, sucesso) => {
    setMensagem('');
    try {
      await fn();
      setMensagem(sucesso);
      carregar();
    } catch (error) {
      setMensagem(error.message);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {verInativos ? (
          <div>
            <Link to="/formulario-um-terco" className="text-sm font-semibold text-teal-700 hover:underline">← Voltar aos ciclos ativos</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">Formulário 1/3 — Inativos</h1>
            <p className="mt-2 text-slate-600">Ciclos inativados não aparecem para os Professores. Podem ser reativados.</p>
          </div>
        ) : (
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 — Conteúdos</h1>
              <p className="mt-2 text-slate-600">Crie o ciclo do trimestre, defina as semanas e o prazo, e acompanhe as entregas.</p>
              {ciclos && <Link to="/formulario-um-terco?ver=inativos" className="mt-2 inline-block text-sm font-semibold text-teal-700 hover:underline">Ver inativos ({inativos.length}) →</Link>}
            </div>
            <Button onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
          </div>
        )}

        {mensagem && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}
        {ciclos === null && !erro && <LoadingBlock text="Carregando ciclos..." />}
        {ciclos && lista.length === 0 && (verInativos
          ? <EmptyState title="Nenhum ciclo inativo" description="Os ciclos inativados aparecem aqui." />
          : (
            <EmptyState title={inativos.length ? 'Nenhum ciclo ativo' : 'Nenhum ciclo criado'} description="Crie um Formulário 1/3 com a abertura, o prazo e as semanas.">
              <Button size="sm" onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
            </EmptyState>
          ))}

        <div className="grid gap-4 lg:grid-cols-2">
          {lista.map(ciclo => {
            const prazo = STATUS_PRAZO[ciclo.statusPrazo];
            const inativo = ciclo.statusRegistro === 'inativa';
            return (
              <Card key={ciclo.id} className={inativo ? 'opacity-70' : ''}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={prazo.variant}>{prazo.label}</Badge>
                  {inativo && <Badge variant="gray">Inativo</Badge>}
                  {ciclo.editavelAgora && ciclo.statusPrazo === 'encerrado' && <Badge variant="blue">Reaberto</Badge>}
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{ciclo.titulo} — {ciclo.trimestre}º trimestre de {ciclo.anoLetivo}</h2>
                <p className="mt-1 text-sm text-slate-600">Abre {dataSemHoraPadrao(ciclo.abreEm, '00:00')} · prazo {dataSemHoraPadrao(ciclo.prazoEm, '23:59')}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ciclo.semanas.map(s => <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{s.rotulo}: {formatarDiaMes(s.dataInicio)}–{formatarDiaMes(s.dataFim)}</span>)}
                </div>
                <p className="mt-3 text-xs text-slate-500">{ciclo.entregasIniciadas} preenchimento(s) iniciado(s) · {ciclo.reaberturas.length} reabertura(s)</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate(`/formulario-um-terco/ciclos/${ciclo.id}`)}>Painel de entregas</Button>
                  <BotaoExportarExcel gerar={() => exportarUmTerco({ cicloId: ciclo.id, usuario: user?.nome })} />
                  {!inativo && <Button size="sm" variant="outline" onClick={() => setFormAberto(ciclo)}>Editar</Button>}
                  {!inativo && <Button size="sm" variant="outline" onClick={() => setReabrindo(ciclo)}>Reabrir</Button>}
                  {!inativo && ciclo.entregasIniciadas === 0 && <Button size="sm" variant="danger" onClick={() => setInativando(ciclo)}>Inativar</Button>}
                  {inativo && <Button size="sm" variant="outline" onClick={() => acao(() => reativarCicloUmTerco(ciclo.id), 'Ciclo reativado. Ele voltou para a lista de ciclos ativos.')}>Reativar</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {formAberto && (
        <CicloFormModal
          ciclo={formAberto === 'novo' ? null : formAberto}
          janelas={janelas}
          onClose={() => setFormAberto(null)}
          onSalvo={() => { setFormAberto(null); setMensagem('Ciclo salvo.'); carregar(); }}
        />
      )}
      {reabrindo && <ReaberturaModal ciclo={reabrindo} onClose={() => setReabrindo(null)} onSalvo={() => { setReabrindo(null); setMensagem('Reabertura registrada.'); carregar(); }} />}
      {inativando && (
        <ConfirmDialog
          title="Inativar ciclo"
          message={`Inativar "${inativando.titulo}" do ${inativando.trimestre}º trimestre? Nenhum Professor começou a preencher, então nada se perde; dá para reativar depois.`}
          confirmLabel="Inativar"
          onCancel={() => setInativando(null)}
          onConfirm={() => { const alvo = inativando; setInativando(null); acao(() => inativarCicloUmTerco(alvo.id), 'Ciclo inativado. Ele fica em "Ver inativos".'); }}
        />
      )}
    </MainLayout>
  );
};

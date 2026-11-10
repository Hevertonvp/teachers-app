import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const diaSeguinte = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const maior = (...datas) => datas.filter(Boolean).sort().at(-1);
const menor = (...datas) => datas.filter(Boolean).sort()[0];
const comErro = (erro) => (erro ? `${inputClass} min-w-0 border-red-400 bg-red-50` : `${inputClass} min-w-0`);
const MsgErro = ({ children }) => (children ? <p role="alert" className="text-xs font-semibold text-red-700">{children}</p> : null);

// Validação das datas, NA HORA (regras de 10/11/2026, decididas pelo usuário; o backend valida as mesmas):
// - abertura nunca no passado (hoje ou depois) — em ciclo existente, só se a data da abertura mudar;
// - prazo não antes da abertura; abertura, prazo e semanas dentro do trimestre (identificado pela abertura);
// - cada semana: fim não antes do início; começa depois do fim da anterior (em ordem, sem sobreposição;
//   buracos entre semanas são permitidos, tamanho livre); nenhuma termina depois do prazo.
// As semanas são o período de REFERÊNCIA do conteúdo, independentes da janela de preenchimento.
const validarDatasCiclo = ({ abertura, prazo, semanas, janela, hoje, aberturaMudou }) => {
  const erros = { abertura: '', prazo: '', semanas: semanas.map(() => ({ inicio: '', fim: '' })) };
  if (abertura && aberturaMudou && abertura < hoje) erros.abertura = 'A abertura não pode ser no passado: escolha hoje ou uma data futura.';
  if (abertura && prazo && prazo < abertura) erros.prazo = 'O prazo não pode ser antes da abertura.';
  else if (prazo && janela && (prazo < janela.startDate || prazo > janela.endDate)) erros.prazo = `O prazo precisa estar dentro do ${janela.trimestre} (até ${dataFmt(janela.endDate)}).`;
  semanas.forEach((s, i) => {
    const e = erros.semanas[i];
    const anterior = semanas[i - 1];
    if (s.dataInicio && janela && (s.dataInicio < janela.startDate || s.dataInicio > janela.endDate)) e.inicio = 'Início fora do trimestre.';
    else if (s.dataInicio && anterior?.dataFim && s.dataInicio <= anterior.dataFim) e.inicio = `Precisa começar depois do fim da Semana ${i} (${dataFmt(anterior.dataFim)}).`;
    if (s.dataInicio && s.dataFim && s.dataFim < s.dataInicio) e.fim = 'O fim não pode ser antes do início.';
    else if (s.dataFim && prazo && s.dataFim > prazo) e.fim = `Termina depois do prazo de entrega (${dataFmt(prazo)}).`;
    else if (s.dataFim && janela && s.dataFim > janela.endDate) e.fim = 'Fim fora do trimestre.';
  });
  const temErro = !!(erros.abertura || erros.prazo || erros.semanas.some(e => e.inicio || e.fim));
  return { ...erros, temErro };
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
  const janelaPelaAbertura = abreEm ? janelas.find(p => p.startDate <= abreEm && abreEm <= p.endDate) ?? null : null;
  const janela = janelaPelaAbertura ?? (editando ? janelas.find(p => p.ano === ciclo.anoLetivo && p.trimestre === trimestres[ciclo.trimestre - 1]) ?? null : null);
  const trimestreNumero = janela ? trimestres.indexOf(janela.trimestre) + 1 : null;

  const hoje = paraInputDataHora(new Date().toISOString()).slice(0, 10);
  const aberturaMudou = !editando || abreEm !== abreOriginal.slice(0, 10);
  const v = validarDatasCiclo({ abertura: abreEm, prazo: prazoEm, semanas, janela, hoje, aberturaMudou });

  const mudarQuantidade = (valor) => {
    const n = Math.max(1, Math.min(30, Number(valor) || 1));
    setSemanas(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { ...SEMANA_VAZIA }));
  };
  const mudarSemana = (indice, campo, valor) => setSemanas(prev => prev.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)));

  const salvar = async (event) => {
    event.preventDefault();
    setErro('');
    if (!janela) { setErro('A data de abertura não está dentro de nenhum trimestre do calendário (Configurações › Trimestres).'); return; }
    if (v.temErro) { setErro('Corrija as datas marcadas em vermelho.'); return; }
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
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{erro}</div>}
        {travado && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Já há Professores preenchendo: o trimestre e a quantidade de semanas não podem mudar. Datas e prazo continuam editáveis.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <FormField label="Abertura"><input type="date" className={comErro(v.abertura)} value={abreEm} min={aberturaMudou ? hoje : undefined} onChange={e => setAbreEm(e.target.value)} required /></FormField>
            <MsgErro>{v.abertura}</MsgErro>
          </div>
          <div className="space-y-1">
            <FormField label="Prazo de entrega"><input type="date" className={comErro(v.prazo)} value={prazoEm} min={maior(abreEm, janela?.startDate)} max={janela?.endDate} onChange={e => setPrazoEm(e.target.value)} required /></FormField>
            <MsgErro>{v.prazo}</MsgErro>
          </div>
        </div>

        {janela
          ? <p className="text-xs font-semibold text-slate-600">{janela.trimestre} de {janela.ano} ({dataFmt(janela.startDate)} a {dataFmt(janela.endDate)}), identificado pela abertura. Todas as datas precisam estar dentro dele.</p>
          : abreEm
            ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">A abertura ({dataFmt(abreEm)}) não está dentro de nenhum trimestre do calendário. Configure em Configurações › Trimestres.</p>
            : <p className="text-xs text-slate-500">Escolha a abertura e o prazo de entrega: o trimestre é identificado pela abertura.</p>}

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <p className="max-w-sm text-sm font-semibold text-slate-700">Semanas <span className="font-normal text-slate-500">(período do conteúdo: em ordem, sem se sobrepor e terminando até o prazo)</span></p>
            <FormField label="Quantidade de semanas"><input type="number" min={1} max={30} className={`${inputClass} w-24`} value={semanas.length} onChange={e => mudarQuantidade(e.target.value)} disabled={travado} /></FormField>
          </div>
          <LinhaDoTempo janela={janela} semanas={semanas} />
          <div className="mt-3 space-y-3">
            {semanas.map((semana, indice) => {
              const e = v.semanas[indice];
              const fimAnterior = semanas[indice - 1]?.dataFim;
              return (
                <div key={indice}>
                  <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[5.5rem_1fr_1fr]">
                    <span className="col-span-2 text-sm font-bold text-slate-800 sm:col-span-1">Semana {indice + 1}</span>
                    <input type="date" aria-label={`Semana ${indice + 1}: início`} aria-invalid={!!e.inicio} className={comErro(e.inicio)} value={semana.dataInicio}
                      min={maior(janela?.startDate, fimAnterior && diaSeguinte(fimAnterior))} max={menor(janela?.endDate, prazoEm)}
                      onChange={ev => mudarSemana(indice, 'dataInicio', ev.target.value)} required />
                    <input type="date" aria-label={`Semana ${indice + 1}: fim`} aria-invalid={!!e.fim} className={comErro(e.fim)} value={semana.dataFim}
                      min={maior(janela?.startDate, semana.dataInicio)} max={menor(janela?.endDate, prazoEm)}
                      onChange={ev => mudarSemana(indice, 'dataFim', ev.target.value)} required />
                  </div>
                  {(e.inicio || e.fim) && <div className="mt-1 space-y-0.5 sm:pl-[6rem]"><MsgErro>{e.inicio}</MsgErro><MsgErro>{e.fim}</MsgErro></div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={salvando} disabled={!janela || v.temErro}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
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
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Formulário 1/3 — Conteúdos</h1>
            <p className="mt-2 text-slate-600">Crie o ciclo do trimestre, defina as semanas e o prazo, e acompanhe as entregas.</p>
          </div>
          <Button onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
        </div>

        {mensagem && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">{mensagem}</div>}
        {erro && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <span>Não foi possível carregar: {erro}</span>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar novamente</Button>
          </div>
        )}
        {ciclos === null && !erro && <LoadingBlock text="Carregando ciclos..." />}
        {ciclos && ciclos.length === 0 && (
          <EmptyState title="Nenhum ciclo criado" description="Crie o primeiro Formulário 1/3 escolhendo o trimestre e as semanas.">
            <Button size="sm" onClick={() => setFormAberto('novo')}>+ Novo ciclo</Button>
          </EmptyState>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {(ciclos || []).map(ciclo => {
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
                  {inativo && <Button size="sm" variant="outline" onClick={() => acao(() => reativarCicloUmTerco(ciclo.id), 'Ciclo reativado.')}>Reativar</Button>}
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
          onConfirm={() => { const alvo = inativando; setInativando(null); acao(() => inativarCicloUmTerco(alvo.id), 'Ciclo inativado.'); }}
        />
      )}
    </MainLayout>
  );
};

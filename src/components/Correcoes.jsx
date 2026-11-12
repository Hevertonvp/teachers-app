import { useState } from 'react';
import { Badge, Button, Card, FormField, Modal } from './Common';
import { inputClass } from '../utils/display';
import { agoraServidor } from '../utils/horaServidor';

// Fluxo de correções (PDI e Formulário 1/3), decisões do usuário em 10/11/2026. Peças comuns às
// telas da Secretaria e do Professor. Linguagem discreta, sem tom de cobrança.

export const SITUACAO_CORRECAO = {
  solicitada: { rotulo: 'Correção solicitada', variant: 'yellow' },
  prazo_encerrado: { rotulo: 'Prazo de correção encerrado', variant: 'gray' },
  recebida: { rotulo: 'Correção recebida', variant: 'blue' },
  aceita: { rotulo: 'Correção aceita', variant: 'green' },
  devolvida: { rotulo: 'Devolvida novamente', variant: 'gray' },
  // 1/3 (12/11/2026): a correção expira depois dos 3 dias sem reenvio (no PDI não existe esta situação).
  expirada: { rotulo: 'Correção expirada', variant: 'gray' },
};

// Rótulos da área Correções → Formulário 1/3 (estados pedidos pelo usuário em 12/11/2026).
export const SITUACAO_CORRECAO_UM_TERCO = {
  nenhuma: { rotulo: 'Sem correção', variant: 'gray' },
  solicitada: { rotulo: 'Aguardando o Professor', variant: 'yellow' },
  recebida: { rotulo: 'Reenviada · aguardando a Secretaria', variant: 'blue' },
  aceita: { rotulo: 'Resolvida', variant: 'green' },
  devolvida: { rotulo: 'Devolvida novamente', variant: 'gray' },
  expirada: { rotulo: 'Expirada', variant: 'gray' },
};

export const PRAZO_CORRECAO_DIAS = 3;

// "13/11/2026, às 14h30" no horário oficial (São Paulo).
export function formatarPrazoCorrecao(iso) {
  if (!iso) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}, às ${p.hour}h${p.minute}`;
}

export const SeloCorrecao = ({ situacao, mapa = SITUACAO_CORRECAO }) => (mapa[situacao] ? <Badge variant={mapa[situacao].variant}>{mapa[situacao].rotulo}</Badge> : null);

// Uma correção ainda nas mãos do Professor (pode corrigir e enviar).
export const correcaoPendente = (c) => !!c && (c.situacao === 'solicitada' || c.situacao === 'prazo_encerrado');

// Modal da Secretaria: "O que precisa ser corrigido?" (obrigatório) + confirmação antes de enviar.
// O prazo é sempre de 3 dias corridos a partir da confirmação; aqui só é mostrado.
export const ModalEnviarParaCorrecao = ({ titulo = 'Enviar para correção', descricao, onConfirmar, onFechar }) => (
  <Modal title={titulo} onClose={onFechar}>
    <FormEnviarParaCorrecao descricao={descricao} onConfirmar={onConfirmar} onFechar={onFechar} />
  </Modal>
);

// O mesmo formulário sem moldura (para usar dentro de um modal que já existe, como no 1/3).
export const FormEnviarParaCorrecao = ({ descricao, onConfirmar, onFechar }) => {
  const [texto, setTexto] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const prazoPrevisto = new Date(agoraServidor().getTime() + PRAZO_CORRECAO_DIAS * 86400000).toISOString();
  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true); setErro('');
    try { await onConfirmar(texto.trim()); } catch (e) { setErro(e.message); setConfirmando(false); } finally { setEnviando(false); }
  };
  return (
    <div className="space-y-4">
        {descricao && <p className="text-sm text-slate-600">{descricao}</p>}
        <FormField label="O que precisa ser corrigido?">
          <textarea className={inputClass} rows="5" maxLength={2000} value={texto} disabled={confirmando}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: Revisar os conteúdos registrados na segunda semana e complementar as informações sobre as atividades desenvolvidas." />
        </FormField>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{erro}</p>}
        {confirmando ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>O professor receberá estas orientações na caixa de mensagens, com prazo até <strong>{formatarPrazoCorrecao(prazoPrevisto)}</strong> (3 dias corridos).</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmando(false)} disabled={enviando}>Voltar</Button>
              <Button onClick={enviar} loading={enviando} disabled={enviando}>Confirmar envio</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
            <Button onClick={() => setConfirmando(true)} disabled={!texto.trim()}>Enviar para correção</Button>
          </div>
        )}
    </div>
  );
};

// Histórico completo das devoluções (mais recente primeiro): quem pediu, quando, orientações, prazo,
// quando o Professor enviou (e se foi fora do prazo) e o resultado da conferência.
export const HistoricoCorrecoes = ({ correcoes, titulo = 'Histórico de correções' }) => (!correcoes?.length ? null : (
  <Card>
    <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{titulo}</p>
    <ul className="mt-3 space-y-3">
      {correcoes.map((c) => (
        <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SeloCorrecao situacao={c.situacao} />
            <span className="text-xs text-slate-500">Prazo: {formatarPrazoCorrecao(c.prazoAte)}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-slate-700">{c.observacao}</p>
          <p className="mt-2 text-xs text-slate-500">
            Solicitada{c.criadaPorNome ? ` por ${c.criadaPorNome}` : ''} em {formatarPrazoCorrecao(c.criadaEm)}
            {c.concluidaEm && <> · Enviada pelo professor em {formatarPrazoCorrecao(c.concluidaEm)}{c.enviadaForaDoPrazo ? ' (fora do prazo)' : ''}</>}
            {c.conferidaEm && <> · {c.conferencia === 'ACEITA' ? 'Aceita' : 'Devolvida novamente'}{c.conferidaPorNome ? ` por ${c.conferidaPorNome}` : ''} em {formatarPrazoCorrecao(c.conferidaEm)}</>}
          </p>
        </li>
      ))}
    </ul>
  </Card>
));

// Aviso para o Professor dentro do formulário: orientações, prazo e situação, sem precisar voltar
// à caixa de mensagens. `itens`: [{ chave, titulo, correcao }]. `reenvio` (1/3, 12/11/2026): textos de
// "Reenviar correção" e a situação "expirada".
export const AvisoCorrecaoProfessor = ({ itens, reenvio = false }) => {
  const visiveis = itens.filter((i) => i.correcao && ['solicitada', 'prazo_encerrado', 'recebida', ...(reenvio ? ['expirada'] : [])].includes(i.correcao.situacao));
  if (!visiveis.length) return null;
  return (
    <div className="space-y-3">
      {visiveis.map(({ chave, titulo, correcao }) => (correcao.situacao === 'recebida' ? (
        <div key={chave} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {reenvio
            ? <><strong>Correção reenviada — aguardando revisão da Secretaria.</strong> Enviada em {formatarPrazoCorrecao(correcao.concluidaEm)}.</>
            : <>{titulo ? `${titulo}: ` : ''}correção enviada em {formatarPrazoCorrecao(correcao.concluidaEm)}. Aguardando a conferência da Secretaria.</>}
        </div>
      ) : correcao.situacao === 'expirada' ? (
        <div key={chave} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <strong>Correção expirada.</strong> O prazo de 3 dias terminou em {formatarPrazoCorrecao(correcao.prazoAte)} sem reenvio. O que você escreveu continua guardado; se precisar, a Secretaria pode abrir uma nova correção.
        </div>
      ) : (
        <div key={chave} className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{titulo ? `Correção solicitada · ${titulo}` : 'Correção solicitada'}</p>
            <SeloCorrecao situacao={correcao.situacao} />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Orientações</p>
          <p className="mt-1 whitespace-pre-line">{correcao.observacao}</p>
          <p className="mt-2 text-slate-600">
            Prazo: <strong>{formatarPrazoCorrecao(correcao.prazoAte)}</strong>
            {correcao.situacao === 'prazo_encerrado' && ' · você ainda pode fazer os ajustes e enviar.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">{reenvio ? 'Você pode alterar qualquer semana. "Salvar progresso" guarda o rascunho; quando terminar, use "Reenviar correção".' : 'Salvar guarda o rascunho. Quando terminar, use "Enviar correção".'}</p>
        </div>
      )))}
    </div>
  );
};

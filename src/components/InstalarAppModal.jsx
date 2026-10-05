import { Modal, Button } from './Common';
import { useInstallPrompt } from '../pwa/useInstallPrompt';
import { usePushNotifications } from '../pwa/usePushNotifications';

const ROTULO_ESTADO_PUSH = {
  'nao-suportado': 'Notificações não são suportadas neste navegador.',
  bloqueada: 'Você bloqueou as notificações para este site. Para ativar, libere nas configurações do navegador.',
  disponivel: null,
  ativada: 'Notificações ativadas neste dispositivo.',
  verificando: null,
};

// Único ponto de entrada pra "Instalar aplicativo" (seção 4 do pedido) + ativar/desativar Push
// neste dispositivo (seção 14/15) — cabem juntos num modal compacto sem precisar de tela própria.
export const InstalarAppModal = ({ onClose }) => {
  const { podeInstalarComPrompt, instalado, ehIOS, promptInstall } = useInstallPrompt();
  const { estado, erro, ativar, desativar } = usePushNotifications();

  // Fecha sozinho só quando a ativação realmente deu certo — se falhar (ou o usuário negar a
  // permissão nativa), o modal continua aberto mostrando o motivo.
  const handleAtivar = async () => {
    const sucesso = await ativar();
    if (sucesso) onClose();
  };

  return (
    <Modal title="Instalar aplicativo" onClose={onClose}>
      <div className="space-y-6 break-words">
        <section>
          <h3 className="text-sm font-bold text-slate-900">Instalar na tela inicial</h3>
          {instalado ? (
            <p className="mt-2 text-sm text-slate-600">O aplicativo já está instalado neste dispositivo. ✓</p>
          ) : podeInstalarComPrompt ? (
            <>
              <p className="mt-2 text-sm text-slate-600">Instale o aplicativo para acessar mais rápido e receber notificações neste dispositivo.</p>
              <div className="mt-3 flex gap-2">
                <Button onClick={async () => { await promptInstall(); onClose(); }}>Instalar</Button>
                <Button variant="secondary" onClick={onClose}>Agora não</Button>
              </div>
            </>
          ) : ehIOS ? (
            <p className="mt-2 text-sm text-slate-600">
              No iPhone/iPad: toque no botão <strong>Compartilhar</strong> (o quadrado com uma seta para cima) na barra do
              Safari e depois em <strong>“Adicionar à Tela de Início”</strong>.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Procure a opção <strong>“Instalar aplicativo”</strong> ou <strong>“Adicionar à tela inicial”</strong> no menu do
              seu navegador.
            </p>
          )}
        </section>

        <section className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-900">Notificações neste dispositivo</h3>
          <p className="mt-2 text-sm text-slate-600">Receba avisos de novas mensagens e prazos importantes do PDI.</p>
          {ROTULO_ESTADO_PUSH[estado] && <p className="mt-2 text-sm font-medium text-slate-700">{ROTULO_ESTADO_PUSH[estado]}</p>}
          {erro && <p className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
          <div className="mt-3">
            {estado === 'ativada' ? (
              <Button variant="secondary" onClick={desativar}>Desativar notificações</Button>
            ) : estado === 'disponivel' ? (
              <Button onClick={handleAtivar}>Ativar notificações</Button>
            ) : null}
          </div>
        </section>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
};

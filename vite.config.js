import { networkInterfaces } from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import selfsigned from 'selfsigned'

// Testar PWA/Push num celular pela rede local exige HTTPS: Service Worker e a instalação do app
// só funcionam em "contexto seguro" (https://, ou localhost — que o celular não é ao acessar pelo
// IP da máquina). `@vitejs/plugin-basic-ssl` foi tentado primeiro, mas gera um certificado que só
// cobre localhost/127.0.0.1 — acessando pelo IP da rede (ex.: 192.168.x.x), o navegador rejeita o
// certificado por host incompatível e o Service Worker se recusa a registrar mesmo depois de
// aceitar o aviso de "conexão não seguro". Por isso geramos um certificado próprio, incluindo
// TODOS os IPv4 da rede local da máquina (além de localhost/127.0.0.1) no campo subjectAltName.
// A v5 do pacote "selfsigned" gera o certificado de forma assíncrona (Promise) — por isso o
// config inteiro precisa virar uma função async (Vite aceita UserConfig | Promise<UserConfig>).
async function gerarCertificadoDev() {
  const ips = ['127.0.0.1']
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address)
    }
  }
  const altNames = [
    { type: 2, value: 'localhost' }, // type 2 = DNS
    ...ips.map((ip) => ({ type: 7, ip })), // type 7 = IP
  ]
  const { private: key, cert } = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 365,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames }],
  })
  return { key, cert }
}

export default defineConfig(async ({ command }) => ({
  base: './',
  plugins: [react()],
  server: {
    host: true, // acessível por https://<ip-da-rede>:5173, não só localhost
    https: command === 'serve' ? await gerarCertificadoDev() : undefined,
  },
}))

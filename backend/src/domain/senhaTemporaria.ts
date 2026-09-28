import { randomInt } from 'node:crypto';

// Sem 0/O/1/l/I (ambíguos ao repassar por telefone/WhatsApp). Aleatoriedade criptográfica
// (crypto.randomInt), nunca Math.random.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function gerarSenhaTemporaria(tamanho = 10): string {
  let senha = '';
  for (let i = 0; i < tamanho; i++) senha += CHARSET[randomInt(CHARSET.length)];
  return senha;
}

export const SENHA_TEMPORARIA_VALIDADE_HORAS = 48;

export function calcularExpiracaoSenhaTemporaria(): Date {
  return new Date(Date.now() + SENHA_TEMPORARIA_VALIDADE_HORAS * 60 * 60 * 1000);
}

// Provisiona a conta inicial de SUPORTE_SISTEMA (seção 24 do pedido de Feedback do Sistema) —
// administrativo, nunca por tela pública. Idempotente: se já existir uma Pessoa com este e-mail,
// só confirma o perfil e sai, nunca gera senha nova nem reseta a existente à toa.
//
// Uso: npx tsx scripts/provisionar-suporte-sistema.ts <email> "<Nome>"
// A senha temporária gerada é IMPRESSA UMA VEZ no terminal (nunca gravada em código/arquivo) —
// repasse ao responsável pelo suporte, que troca no primeiro acesso (mesmo fluxo de qualquer
// conta nova, ver POST /api/auth/trocar-senha).
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { calcularExpiracaoSenhaTemporaria, gerarSenhaTemporaria } from '../src/domain/senhaTemporaria.js';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const nome = process.argv[3]?.trim();
  if (!email || !nome) {
    console.error('Uso: npx tsx scripts/provisionar-suporte-sistema.ts <email> "<Nome>"');
    process.exit(1);
  }

  const existente = await prisma.pessoa.findUnique({ where: { email } });
  if (existente) {
    if (existente.perfil !== 'SUPORTE_SISTEMA') {
      console.error(`Já existe uma Pessoa com este e-mail, mas com perfil ${existente.perfil} — nada foi alterado.`);
      process.exit(1);
    }
    console.log(`Conta de Suporte do Sistema já existe (id ${existente.id}, ${existente.email}). Nada foi alterado.`);
    return;
  }

  const senhaTemporariaTexto = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemporariaTexto, 10);
  const senhaTemporariaExpiraEm = calcularExpiracaoSenhaTemporaria();

  const criada = await prisma.pessoa.create({
    data: {
      nome,
      email,
      perfil: 'SUPORTE_SISTEMA',
      status: 'ATIVO',
      senhaHash,
      senhaTemporaria: true,
      senhaTemporariaExpiraEm,
      createdBy: 'provisionar-suporte-sistema.ts',
    },
  });
  await prisma.pessoaEvento.create({ data: { pessoaId: criada.id, tipo: 'CRIACAO', autorId: criada.id, detalhe: 'Provisionamento inicial de Suporte do Sistema' } });

  console.log(`Conta de Suporte do Sistema criada: id ${criada.id}, ${criada.email}`);
  console.log(`Senha temporária (repasse com segurança, troca obrigatória no primeiro acesso): ${senhaTemporariaTexto}`);
}

main().finally(() => prisma.$disconnect());

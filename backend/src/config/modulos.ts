// Módulos ligados/desligados no SERVIDOR (19/11/2026, decisão do usuário).
//
// PDI em desenvolvimento para todos os perfis MENOS a Secretaria: enquanto `PDI_LIBERADO` não for "true" no
// ambiente (Render), a API recusa qualquer gravação do PDI que não venha da Secretaria, a Secretaria não
// devolve Ficha ao Professor (ele ainda não tem acesso) e os avisos do PDI para os outros perfis ficam em
// silêncio. Leituras continuam (a tela é que mostra "PDI em desenvolvimento" — ver src/config/modulos.js).
// Para lançar o PDI: PDI_LIBERADO=true no Render E trocar MODO_PDI_DEMAIS para 'ativo' no frontend.
// Lido a cada chamada (não no boot) para os testes poderem alternar.
export const pdiSoSecretaria = (): boolean => process.env.PDI_LIBERADO !== 'true';

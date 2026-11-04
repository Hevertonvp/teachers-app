# CLAUDE.md

Este arquivo contém instruções permanentes para o Claude Code ao trabalhar neste repositório.

## Separação entre frontend e backend

O frontend React (`teachers-app`) e o backend ASP.NET Core são projetos/camadas **independentes**, mesmo que futuramente convivam no mesmo workspace do VS Code. Essa separação vale mesmo antes de o backend existir fisicamente no repositório.

- Nunca assumir que uma alteração em uma camada exige alteração na outra.
- Antes de implementar qualquer mudança, analisar quais camadas são realmente afetadas.
- Alterações exclusivamente visuais ou de UX no React não devem modificar o backend.
- Alterações internas do backend que não alterem o contrato ou o comportamento consumido pelo frontend não devem modificar o React.
- Alterações em entidades, banco de dados, regras de negócio, permissões ou contratos da API devem ter seu impacto analisado nas duas camadas.
- Quando uma mudança realmente exigir alterações em frontend e backend, implementar ambas de forma consistente.
- O backend não pode depender de componentes, estado, rotas ou estruturas internas do React.
- O React é apenas um cliente da API. Outros clientes (Android, iOS, outro frontend web) devem poder consumir a mesma API sem depender do React atual.
- Não modificar código da outra camada apenas por conveniência ou para "manter tudo parecido".
- Sempre informar no plano da tarefa quais camadas serão alteradas antes de executar mudanças que envolvam mais de uma camada.

## Contexto mestre do projeto

Antes de qualquer alteração relevante, leia `CLAUDE_CONTEXT.md` (decisões de negócio, arquitetura, regras do PDI e do Formulário 1/3, histórico e pendências). Em caso de dúvida de regra de negócio, pare e pergunte antes de implementar.

**Regra permanente (decisão do usuário):** toda alteração de código, de regra de negócio, de banco/migration, de teste ou de decisão deve ser registrada em `CLAUDE_CONTEXT.md`, na seção "Registro de alterações" (no fim do arquivo), na mesma tarefa em que a alteração é feita — não depois e não "se der tempo". Cada entrada: data, o que mudou, camadas afetadas (frontend/backend/banco), arquivos principais, commit (se houver) e o que foi ou não testado. Se uma seção antiga do arquivo ficar desatualizada, corrigi-la ou anotar que mudou. Esse arquivo é a memória do projeto para qualquer máquina ou sessão nova; por isso ele deve ser commitado junto com o código.

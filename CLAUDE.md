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

# Proposta — Acompanhamento Escolar (NEXO)

> **Situação: IMPLEMENTADA em 10/11/2026, por autorização do usuário, com todas as etapas, inclusive a 7 (foto do PDI).**
> O que mudou em relação a esta proposta está na seção 11, no fim. As regras ficaram em `REGRAS_DE_NEGOCIO_NEXO.md` (seção 22, ACP-01 a ACP-09).
> Os limiares numéricos marcados com **[decidir]** são sugestões que precisam de aprovação do usuário.

---

## 0. Resumo em 10 linhas

1. A nova aba é uma tela de leitura para a **Secretaria**. Ela responde a três perguntas: *como está a rede agora*, *o que vence em breve* e *onde vale oferecer apoio*.
2. Ela usa só os dados que o NEXO já guarda: Aplicações e Fichas do PDI, ciclos e entregas do 1/3, turmas, vínculos e alunos com PDI.
3. **As unidades são as mesmas das telas atuais**, para os números baterem com elas. No PDI, a unidade é a **Ficha** (aluno × disciplina). No 1/3, é a **entrega** (professor × ano/série × disciplina). Uma entrega do 1/3 nunca é multiplicada por escola.
4. A principal limitação é que **o "esperado" do PDI é recalculado com os vínculos de hoje**. Por isso a taxa de conclusão de Aplicações já encerradas não é confiável. A proposta usa taxa só no período vigente e números absolutos no histórico.
5. **O "esperado" do 1/3 é estável no tempo**, porque usa as datas dos vínculos. Comparações entre ciclos do 1/3 são seguras.
6. Depois do prazo, o professor **não consegue** preencher sem reabertura. Então o que sobra não é "atrasado": é "não concluído no prazo". A linguagem da tela segue isso.
7. A tela não mostra nomes de professores nem de alunos, nem ranking de escolas. O detalhe nominal continua nos painéis que já existem.
8. Os gráficos seriam feitos em SVG próprio, sem biblioteca nova. A tela tem identidade visual própria, mas usa os tokens de tema do NEXO e tem modo noturno.
9. Os dados viriam de **um endpoint novo, só de leitura e agregado**, com poucas consultas em lote. O endpoint não muda regras nem tabelas.
10. A implementação seria em 6 etapas pequenas. Uma 7ª etapa opcional, a "fotografia do esperado no prazo" do PDI, exigiria migration e só seria feita com autorização.

---

## 1. Conceito da tela

**Função.** É um painel de leitura que mostra o andamento da rede em três camadas:

| Camada | Pergunta que responde | O que aparece |
|---|---|---|
| **Rede** | Como a rede está agora? | Cartões-resumo, mapa das escolas e ritmo de preenchimento |
| **Prazos** | O que vence em breve e o que encerrou com pendências? | Linha do tempo de prazos e a lista "Entregas que merecem acompanhamento" |
| **Escola** | Como está esta escola em particular? | A mesma leitura recortada para uma escola, por disciplina e ano/série, com o histórico dos seus períodos |

**Navegação.**
- A tela abre na visão da **rede**.
- Clicar numa escola (no mapa, na lista ou no seletor) abre a **visão da escola** na mesma página, com um botão "← Rede".
- O seletor de escola do topo, que já existe, também leva direto à visão da escola. Assim a aba se comporta como as outras telas da Secretaria.
- Quando for preciso agir sobre um caso, um link leva ao painel que **já existe**: o painel de entregas do 1/3 ou as Aplicações do PDI. A aba não duplica essas telas e não tem ações. Ela só lê e encaminha.

**Para quem.** Decidido pelo usuário em 10/11/2026:
- A **Secretaria** vê a rede inteira, com filtros.
- A **Diretora** vê só a visão "Escola" da própria escola, sem a camada "Rede", pelo escopo `escolasPermitidas`.
- Gestor e outros perfis ficam de fora, por enquanto.

---

## 2. Estrutura visual

### Visão da rede, no computador, de cima para baixo

```
┌───────────────────────────────────────────────────────────────────────┐
│ Acompanhamento Escolar                    [Ano letivo ▾] [PDI|1/3|Ambos] │
│ Rede municipal · atualizado às 14:32                                    │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   ← 4 cartões    │
│ │ PDI      │ │ 1/3      │ │ Prazos   │ │ Merecem  │                   │
│ │ 62%      │ │ 48%      │ │ 3 em 7d  │ │ acompan. │                   │
│ │ 812/1310 │ │ 96/200   │ │          │ │ 4 itens  │                   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
├──────────────────────────────────┬────────────────────────────────────┤
│ Ritmo de preenchimento            │ Próximos prazos (linha do tempo)   │
│ (curva acumulada no período)      │ ── hoje ──|──────────── 30 dias    │
├──────────────────────────────────┴────────────────────────────────────┤
│ Mapa da rede: uma linha por escola, colunas PDI e 1/3                  │
├───────────────────────────────────────────────────────────────────────┤
│ Entregas que merecem acompanhamento (lista discreta, com link)         │
├───────────────────────────────────────────────────────────────────────┤
│ Estrutura da rede (turmas · professores · alunos com PDI) — recolhido  │
└───────────────────────────────────────────────────────────────────────┘
```

- **Tablet:** os cartões ficam 2 × 2; "Ritmo" e "Prazos" ficam um embaixo do outro.
- **Celular:**
  - os cartões aparecem em coluna, ou num carrossel horizontal com *snap*;
  - o mapa da rede vira uma lista de escolas, com uma barrinha de PDI e uma de 1/3 em cada linha;
  - a linha do tempo vira uma lista de datas.
- Nenhuma parte pode gerar rolagem horizontal da página. Ver a memória "sempre responsivo" e a nota sobre `max-w-*`.

### Visão da escola

- O cabeçalho mostra o nome da escola, "← Rede" e o mesmo seletor de formulário.
- Os mesmos 4 cartões aparecem, com números só da escola.
- Seções:
  - **PDI por disciplina:** barras empilhadas.
  - **1/3 por ano/série e disciplina:** matriz pequena.
  - **Histórico da escola:** os períodos anteriores do PDI e do 1/3, em números absolutos (ver §8.4).
  - **Estrutura:** turmas por etapa e turno, professores distintos e alunos com PDI.

---

## 3. Indicadores recomendados

Cada indicador traz o que mede, para que serve, de onde vem e o cuidado necessário. Só ficaram os que dão para calcular **com segurança**.

### 3.1 PDI — conclusão das Fichas no período vigente
- **Mede:** Fichas concluídas, Fichas em preenchimento e Fichas não iniciadas, sobre as Fichas esperadas das Aplicações **vigentes** (`statusVigencia = active`) de cada escola.
- **Para que serve:** mostra quanto do PDI do período já foi feito.
- **Origem:** é o mesmo cálculo de `GET /api/pdi-aplicacoes/indicadores` (`backend/src/api/routes/pdiAplicacoes.ts`).
  - O esperado vem de `ProfessorTurmaDisciplina` ATIVO, nas disciplinas da Aplicação, vezes `AlunoPdi` ATIVO da turma.
  - O resultado é um par aluno × disciplina único. Uma Ficha ainda não criada conta como "não iniciada".
- **Cuidado:**
  - Uma escola com Aplicação, mas com esperado zero, **não** é "0%". Ela aparece como "sem professor/aluno vinculado", como o painel atual já faz.
  - Uma escola sem Aplicação vigente aparece como "sem Aplicação no período". É uma situação neutra.

### 3.2 1/3 — conclusão das entregas do ciclo
- **Mede:** entregas concluídas, em andamento e não iniciadas, sobre o esperado do ciclo selecionado. Por padrão, é o ciclo aberto ou o último encerrado.
- **Para que serve:** mostra o andamento do 1/3 na rede e em cada escola.
- **Origem:** `montarPainel` em `backend/src/api/routes/formularioUmTerco.ts`. A unidade é professor × ano/série × disciplina. O esperado sai de `vinculosElegiveis`, que considera o vínculo dentro da janela, as escolas do ciclo e as turmas do Fundamental.
- **Cuidado:**
  - No total da rede, cada entrega conta **uma vez**.
  - No recorte por escola, uma entrega aparece em cada escola que cobre. É uma **visão de cobertura**, e a soma das escolas é maior que o total da rede. A tela precisa dizer isso: "uma entrega pode valer para mais de uma escola".
  - Uma escola fora de um ciclo que não é "Todas" **não entra** nesse ciclo. Não é "0%".

### 3.3 Prazos próximos
- **Mede:** quantas Aplicações do PDI e quantos ciclos do 1/3 têm prazo nos próximos N dias e ainda têm itens não concluídos. Sugestão: N = 7 **[decidir]**.
- **Origem:**
  - PDI: `AplicacaoPdi.dataFim`.
  - 1/3: `CicloUmTerco.prazoEm`, no fuso de São Paulo.
  - A reabertura que estiver vigente também conta como prazo: `ReaberturaPdi.dataFim` e `ReaberturaUmTerco.fimEm`.

### 3.4 Entregas que merecem acompanhamento
É uma contagem de **situações**, não de pessoas. Os critérios estão em §6.

### 3.5 Ritmo de preenchimento (evolução no período)
- **PDI:** curva acumulada de `FichaPdi.concluidaEm` ao longo da vigência da Aplicação.
  - Uma Ficha concluída não volta atrás sozinha.
  - Uma devolução em Correções **não** muda o status da Ficha (conferido em `correcoesPdi.ts`). Então a curva é estável.
- **1/3:** curva acumulada a partir de `HistoricoEntregaUmTerco`, com os eventos `INICIADA`, `SALVA` e `CONCLUIDA` e o campo `quando`. Esse histórico permite desenhar duas curvas, "iniciadas" e "concluídas".
- **Para que serve:** mostra se o preenchimento está acontecendo ao longo do período ou se fica concentrado no fim.
- **Cuidado:**
  - Não desenhar uma "linha ideal" reta. Não existe ritmo esperado definido pela rede, e uma linha reta faria parecer atraso o que é só o costume de preencher perto do prazo.
  - No PDI **não há histórico de "em preenchimento"** ao longo do tempo. Existe só o status atual e as datas `createdAt`/`concluidaEm`. Por isso a curva do PDI mostra só "concluídas".

### 3.6 Comparativo entre períodos
- **1/3: seguro.** Compara o percentual concluído no prazo entre ciclos, na rede e por escola.
  - A comparação usa o mesmo "dia relativo do período", por exemplo "no 5º dia, o ciclo atual tinha X%, o anterior tinha Y%".
  - O esperado de ciclos passados é reconstruído pelas datas dos vínculos (§68 do contexto).
- **PDI: só números absolutos.** Mostra Fichas concluídas por Aplicação ou trimestre, sem percentual. Ver §8.4.

### 3.7 Estrutura da rede
- **Mede:**
  - turmas ATIVAS do ano letivo, por escola, etapa e turno;
  - **professores distintos** com vínculo ATIVO;
  - **alunos com PDI** ATIVOS.
- **Para que serve:** dá o tamanho de cada escola e o contexto para ler os percentuais. Um "50%" de 4 Fichas é muito diferente de um "50%" de 400.
- **Cuidado:**
  - `AlunoPdi` **não é o total de alunos matriculados**. São só os alunos com PDI. O rótulo tem de ser sempre "alunos com PDI".
  - Professor com várias escolas: ver §8.3.

### Indicadores analisados e **descartados**, ou adiados

| Indicador | Por que não |
|---|---|
| Percentual de conclusão de Aplicações PDI **encerradas** | O esperado é recalculado com os vínculos de hoje. Alunos transferidos e professores trocados distorcem o número (§8.4). |
| Ranking de escolas, do "melhor" ao "pior" | Tem cara de fiscalização. Com denominadores muito diferentes, também engana. |
| Desempenho ou entrega **por professor** na visão da rede | Expõe pessoas. O nominal já existe no painel do 1/3, com o devido contexto. |
| Média de "tempo até concluir" | Pune quem concluiu cedo e reabriu para editar. No 1/3, editar depois de concluir é permitido até o prazo. |
| Qualidade, notas ou indicadores pedagógicos dos alunos | Fora do escopo de acompanhamento de entregas, e são dados sensíveis de alunos. |
| "Em preenchimento" ao longo do tempo no PDI | Não existe histórico desse status. |
| Total de alunos da rede | O sistema não guarda matrícula geral, só os alunos com PDI. |
| Correções abertas por escola | É possível calcular (`CorrecaoFichaPdi` ABERTA). Mas pode soar como apontar erro. Fica como **opcional**, só agregado e sem destaque **[decidir]**. |

---

## 4. Gráficos recomendados

Cada gráfico responde a uma pergunta. Se não responde, não entra.

| # | Gráfico | Pergunta que responde | Tipo e interação |
|---|---|---|---|
| G1 | **Cartões-resumo** (4) | Como a rede está agora? | Número grande com a fração absoluta logo abaixo ("812 de 1.310 Fichas"). Uma barra fina segmentada mostra concluída, em andamento e não iniciada. Não é um gráfico. |
| G2 | **Ritmo de preenchimento** | O preenchimento está acontecendo ou fica tudo para o fim? | Linha acumulada (área suave) com o eixo do dia da janela até o prazo, e uma linha vertical marcando "hoje". No 1/3, duas séries: iniciadas e concluídas. A cruz de leitura (*crosshair*) mostra a data e os valores. Pode mostrar o ciclo anterior em cinza tracejado (§3.6). |
| G3 | **Linha do tempo de prazos** | O que vence nas próximas semanas? | Barras horizontais tipo Gantt: Aplicações do PDI por escola e ciclos do 1/3. A reabertura aparece hachurada e "hoje" é uma linha vertical. A janela é de 30 dias, com rolagem para trás e para frente. Passar o mouse mostra as datas e o andamento. |
| G4 | **Mapa da rede** | Como cada escola está em cada formulário? | Tabela-gráfico: uma linha por escola. Em cada coluna (PDI vigente e 1/3 do ciclo), uma barra empilhada fina com concluída, em andamento e não iniciada, e o número absoluto ao lado. A ordem padrão é **alfabética**. Uma opção permite ordenar por percentual, sem destaque de "pior". Clicar na linha abre a visão da escola. Um selo discreto marca a situação, por exemplo "sem Aplicação no período" ou "prazo em 3 dias". |
| G5 | **Por disciplina** (escola) | Em qual disciplina o PDI desta escola anda mais devagar? | Barras horizontais empilhadas, uma por disciplina da Aplicação. |
| G6 | **Matriz ano/série × disciplina** (1/3, escola) | Quais combinações ainda não começaram? | Grade pequena. Cada célula é uma entrega ou um grupo de entregas, com cor de situação, ícone e texto. Ao passar o mouse aparece "3 de 4 concluídas". Clicar leva ao painel do 1/3 já filtrado. |
| G7 | **Histórico de períodos** | Como esta escola, ou a rede, vem se saindo de um período para outro? | 1/3: percentual concluído no prazo por ciclo, em barras ou pontos ligados. PDI: Fichas concluídas por Aplicação, em números absolutos. Os dois ficam em **gráficos separados**, nunca com dois eixos. |

**Regras de acabamento**, do método de visualização do projeto:
- Marcas finas e barras com ponta arredondada de 4 px.
- Separação de 2 px entre segmentos.
- Grade e eixos discretos.
- Legenda sempre presente quando há duas séries ou mais.
- Rótulos diretos só onde ajudam.
- Todo gráfico tem uma "ver como tabela" acessível.
- A cor nunca é a única pista: situação sempre leva ícone e texto.

---

## 5. Filtros

Poucos, e no topo, numa única linha.

**Indispensáveis**
1. **Ano letivo.** O padrão é o ano corrente.
2. **Formulário:** PDI, 1/3 ou Ambos, em botões segmentados. O padrão é Ambos.
3. **Escola.** É o seletor do topo que já existe, mais o clique no mapa (G4). Na prática, a escola é a navegação "rede → escola", não um filtro a mais.

**Opcionais**, só onde fazem sentido:
4. **Período:**
   - no 1/3, um seletor de ciclo; o padrão é o aberto, ou o último encerrado;
   - no PDI, o trimestre (`AplicacaoPdi.trimestre`); o padrão é o vigente.
   - Só aparece quando o formulário escolhido é PDI ou 1/3, não em "Ambos".
5. **Situação:** concluída, em andamento ou não iniciada. Só aparece na lista "merecem acompanhamento" e nas matrizes da escola.
6. **Comparar com o período anterior:** um interruptor simples que liga a série cinza no G2 e no G7.

**Não entram na visão da rede:**
- **Turma e disciplina:** aparecem só dentro da visão da escola, como agrupamentos (G5 e G6), não como filtros.
- **Professor:** não entra (§3, descartados).

**Filtros combinados:** o estado dos filtros vai na URL (`?ano=2026&form=1-3&escola=12`). Assim dá para compartilhar o link e o botão "voltar" do navegador funciona.

---

## 6. Acompanhamento de prazos

### 6.1 As situações, por formulário, seguindo as regras reais

**Situação do período.** Serve para os dois formulários:

| Situação | PDI (Aplicação) | 1/3 (ciclo) |
|---|---|---|
| **Agendado** | `hoje < dataInicio` | `agora < abreEm` |
| **Aberto** | dentro de `dataInicio..dataFim` | dentro de `abreEm..prazoEm` |
| **Em reabertura** | encerrado, mas com `ReaberturaPdi` vigente | encerrado, mas com `ReaberturaUmTerco` vigente |
| **Encerrado** | `hoje > dataFim`, sem reabertura vigente | `agora > prazoEm`, sem reabertura vigente |

**Situação de cada item.** No PDI o item é a Ficha; no 1/3, a entrega.

| Situação | Quando |
|---|---|
| **Concluída** | status CONCLUIDA. No 1/3, continua concluída mesmo se for editada até o prazo, porque a regra permite. |
| **Em andamento** | já existe, mas não foi concluída |
| **Não iniciada** | é esperada, mas ainda não existe |
| **Não concluída no prazo** | período **encerrado** e o item não está concluído |

> **Por que não "atrasada".** Depois do prazo, o professor não consegue mais preencher, nem no PDI nem no 1/3. Só a Secretaria reabre. O item não está "atrasado esperando o professor". Ele **ficou sem conclusão naquele período**, e a decisão de reabrir é da Secretaria. Chamar de "atraso" sugere culpa e uma ação que a pessoa nem pode tomar.

**O que nunca entra como pendência:**
- período agendado;
- escola fora de um ciclo do 1/3 que atende escolas específicas;
- escola sem Aplicação do PDI no período;
- Aplicação ou ciclo INATIVO (removido);
- Aplicação com esperado zero.

### 6.2 "Entregas que merecem acompanhamento": critérios propostos [decidir]

A lista mostra **escola × formulário × período**, nunca pessoas. Um item entra se cumprir uma destas condições:

1. **Prazo próximo com pouco andamento:** o período está aberto, faltam no máximo 7 dias para o prazo e menos de 50% está concluído.
2. **Encerrado com pendências:** o período encerrou nos últimos 30 dias, sem reabertura, e restaram itens não concluídos. Esse é o caso em que a Secretaria decide se reabre.
3. **Sem movimento:** o período está aberto há mais de 7 dias e nenhum item foi iniciado na escola.

Para não dar destaque a casos pequenos, a regra 1 só vale com **pelo menos 5 itens esperados** **[decidir]**. Abaixo disso, o item aparece na lista sem o percentual.

**Como cada item aparece.** Exemplo:
> **E.M. Exemplo · 1/3 — Ciclo de novembro**
> Prazo em 3 dias · 12 de 30 entregas concluídas
> [Ver painel de entregas →]

Linguagem e tom:
- Textos de apoio: "Prazo se aproximando", "Período encerrado com entregas em aberto", "Ainda sem início de preenchimento".
- Nunca usar "atraso grave", "crítico", "irregular", vermelho forte ou ícone de alerta piscando.
- A ordem da lista é **pela data do prazo**, a mais próxima primeiro. Nunca pelo "pior percentual".

### 6.3 Evolução das pendências
- No G2, a diferença entre o esperado e a curva de concluídas *é* a pendência ao longo do tempo. Não precisa de outro gráfico.
- Na visão da escola, o G7 mostra se os períodos têm terminado com mais ou menos itens em aberto. O 1/3 usa percentual; o PDI, números absolutos.

---

## 7. Identidade visual

**Ideia geral:** um *observatório*. É sereno, com bastante respiro e números grandes e legíveis. A cor é usada só para dar sentido. Fica diferente das telas de cadastro, que são densas, mas a tela continua sendo NEXO: mesma barra lateral, mesmo topo e mesma fonte.

**Paleta proposta.** São valores iniciais, a validar com o script do método antes de implementar.

| Papel | Modo claro | Modo noturno | Uso |
|---|---|---|---|
| Superfície da aba | `#F6F7FB` (gelo azulado) | `#0F1729` | fundo próprio da aba, diferente do `slate-100` das outras telas |
| Faixa de cabeçalho | gradiente `#1E2A4A → #2B3D6B` (índigo profundo) | `#141E38 → #1B2A4D` | título, filtros e hora da atualização |
| Concluída | `#2F7F78` (verde-água sóbrio) | `#5FA8A0` | sem verde fluorescente (decisão de 10/11/2026) |
| Em andamento | `#C08A3E` (âmbar areia) | `#D6A75F` | |
| Não iniciada | `#B8BFCC` (cinza neutro) | `#4A5568` | o "vazio" fica neutro, não alarmante |
| Merece acompanhamento | `#B5654A` (terracota suave) | `#D58A6E` | **nunca** vermelho puro; sempre com ícone e texto |
| Reabertura | hachura diagonal na cor do período | idem | textura, não cor nova |
| Destaque e interação | `#4F5BD5` (índigo) | `#8C95F0` | foco, seleção e links |

**Tipografia:**
- Continua a Aptos do sistema.
- Números grandes em **Aptos Display**, com algarismos tabulares (`font-variant-numeric: tabular-nums`), para os números não "dançarem".
- Hierarquia:
  - número do cartão: 40 a 48 px;
  - título de seção: 18 px, semibold;
  - rótulos: 13 px, cinza médio.

**Componentes:**
- Cartões com cantos de 16 px, sombra muito leve e borda de 1 px.
- No topo de cada cartão, uma barra fina segmentada.
- A dica de leitura (*tooltip*) é um cartão escuro translúcido.
- Os segmentados de filtro têm o mesmo raio dos cartões.

**Movimento:**
- As barras crescem da base em 300 ms e as curvas são desenhadas da esquerda para a direita, só na primeira carga.
- Trocar de filtro faz uma transição curta, sem pulos de layout.
- Quem tem `prefers-reduced-motion` ligado não vê animação.

**Acessibilidade:**
- Contraste AA nos textos.
- Situação sempre com ícone e texto, além da cor.
- Cada gráfico tem "ver como tabela".
- Navegação por teclado no mapa da rede, com Enter para abrir a escola.
- `aria-label` nos gráficos com o resumo em uma frase.

**Modo noturno:** os tons são escolhidos para o escuro, não invertidos automaticamente, e validados contra a superfície escura.

**Sem bibliotecas novas:**
- Os gráficos são SVG desenhado pelo próprio componente. São poucas formas: barra, área, linha, Gantt e grade.
- Isso mantém o pacote leve, que já tem o aviso de bloco grande no build, e dá controle total do visual.
- Se mais tarde for preciso algo complexo, a escolha de uma biblioteca vira uma decisão à parte.

---

## 8. Viabilidade técnica

### 8.1 O que já existe e pode ser usado

| Fonte | Modelos e rotas | Serve para |
|---|---|---|
| Escolas e estrutura | `Escola`, `Turma` (anoLetivo, etapa, anoSerie, turno), `ProfessorTurmaDisciplina` (com datas), `VinculoEscolar`, `AlunoPdi` | estrutura da rede (G4, §3.7) e esperado |
| PDI | `AplicacaoPdi` (escola, dataInicio, dataFim, trimestre, status), `AplicacaoModeloPdi` (disciplinas), `FichaPdi` (status, concluidaEm, snapshots), `ReaberturaPdi` | §3.1, G2, G3, G5 e G7 |
| PDI: cálculo pronto | `GET /api/pdi-aplicacoes/indicadores` (lote, 4 consultas) | base do cálculo do PDI vigente |
| 1/3 | `CicloUmTerco` (abreEm, prazoEm, todasEscolas), `CicloUmTercoEscola`, `SemanaUmTerco`, `EntregaUmTerco` (status, concluidaEm), `CoberturaEntregaUmTerco`, `ReaberturaUmTerco`, `HistoricoEntregaUmTerco` | §3.2, G2, G3, G6 e G7 |
| 1/3: cálculo pronto | `montarPainel` e `vinculosElegiveis` em `formularioUmTerco.ts` | base do cálculo do 1/3 |
| Correções | `CorrecaoFichaPdi` | opcional (§3, descartados) |
| Permissões | `escolasPermitidas(actor)` em `pessoas.ts` (Secretaria = todas) | escopo |

### 8.2 Calculável já ou dependente de dados novos

- **Calculável já, sem mudar banco:** §3.1 a §3.5, o comparativo do 1/3 (§3.6), a estrutura da rede (§3.7) e todos os gráficos G1 a G7, com o PDI histórico em números absolutos.
- **Depende de algo que não existe:**
  - Percentual de conclusão de Aplicações PDI **já encerradas**: precisaria de uma "fotografia" do esperado no prazo.
  - "Em preenchimento" ao longo do tempo no PDI: precisaria de eventos de Ficha, como os do 1/3.
  - Total de alunos matriculados: o sistema não tem.

  Os dois primeiros pedem migration e ficam como etapa futura, opcional. O terceiro está fora do escopo.

### 8.3 Contagens duplicadas: como evitar

| Risco | Regra |
|---|---|
| Professor em várias escolas, turmas ou disciplinas | Na **rede**, contar `professorId` distinto. Na **escola**, contar o professor uma vez por escola em que tem vínculo. A soma das escolas pode ser maior que o total da rede, e a tela diz isso. |
| Entrega do 1/3 que cobre várias turmas ou escolas | O total usa a entrega única. O recorte por escola é cobertura, com o aviso "uma entrega pode valer para mais de uma escola", exatamente como `montarPainel` já faz. |
| Ficha do PDI | A chave é `aplicacaoId + alunoId + disciplinaId`, já única no banco. O esperado usa um `Set` de pares aluno × disciplina, como em `/indicadores`. |
| Aluno com PDI em turma com dois professores da mesma disciplina | O par aluno × disciplina conta uma vez, porque é um `Set`. |
| Bloco de respostas padrão | **Não** é contado como entrega. Ele é parte da Ficha, não um item a mais. |

### 8.4 Transferências de alunos e histórico do PDI
- Na Ficha **criada**, `escolaId`, `turmaId` e os nomes ficam congelados (`*Snapshot`). Ela sempre conta para a escola onde nasceu, e isso é o certo para o histórico.
- O **esperado** usa `AlunoPdi.turmaId` atual. Um aluno transferido no meio da Aplicação passa a ser "esperado" na nova escola, se ela tiver Aplicação vigente, e deixa de ser esperado na antiga.
  - No período **vigente** isso é correto, porque é a responsabilidade real de hoje.
  - Num período **passado**, isso distorce o percentual.
- **Decisão desta proposta:**
  - percentual do PDI só no período vigente;
  - histórico do PDI em **números absolutos de Fichas concluídas**, com base nos snapshots;
  - o rótulo deixa claro: "Fichas concluídas na Aplicação", não "taxa".
- `MovimentacaoAlunoPdi` permite, no futuro, reconstruir onde o aluno estava em cada data. Seria uma forma mais exata do esperado histórico, sem migration, mas com cálculo mais pesado. Fica registrada como alternativa à "fotografia".

### 8.5 Ciclos do 1/3 para escolas específicas
- Usar `escolasDoCiclo(ciclo)`: `todasEscolas = true` significa todas, inclusive as criadas depois; `false` significa só as de `CicloUmTercoEscola`.
- Uma escola fora do ciclo **não aparece** na coluna 1/3 daquele ciclo. Ela aparece como "—", não como 0%.
- Escolas diferentes podem ter ciclos próprios ao mesmo tempo, porque a sobreposição só é proibida quando há escola em comum. Por isso, na visão da rede, a coluna "1/3" mostra **o ciclo aberto de cada escola** (ou o último encerrado), não um único ciclo para todos. O seletor de ciclo (§5) serve para escolher um ciclo específico.

### 8.6 Atraso de verdade ou só um formulário que não pede entrega
Ver §6.1. Na prática:
- Só gera pendência o que tem **esperado maior que zero**, num **período encerrado**, de uma **Aplicação ou ciclo ATIVO**, numa **escola atendida**.
- O 1/3 só vale para turmas do Fundamental com ano/série; Educação Infantil nunca entra.
- No PDI, só contam as disciplinas que estão nos Modelos da Aplicação.

### 8.7 Desempenho
- Fazer **um endpoint agregado só de leitura**, por exemplo `GET /api/acompanhamento/rede?ano=2026` e `GET /api/acompanhamento/escola/:id?ano=2026`.
  - As consultas são feitas em lote, sem consulta por escola. É o padrão de `/indicadores`, cuja primeira versão, com consultas por escola, levava cerca de 5 a 6 s até o Neon.
  - As consultas independentes rodam em paralelo (`Promise.all`).
- A resposta traz **só números**: nenhum nome de aluno e nenhum texto de resposta.
  - Com cerca de 35 escolas, a resposta fica em poucos KB.
  - Os filtros de situação e ordenação rodam no navegador, sem nova chamada.
- **Cache no servidor** de 60 segundos por chave (ano e escopo), para várias pessoas da Secretaria não repetirem o mesmo cálculo. A tela mostra "atualizado às HH:MM", com um botão para atualizar.
- O histórico do 1/3 (`HistoricoEntregaUmTerco`) só é lido quando o G2 ou o G7 estão visíveis, numa segunda chamada leve.
- Os índices existentes atendem: `turmas(escolaId, anoLetivo, status)`, `fichas_pdi` pela chave única e `historico_entrega_um_terco(entregaId, quando)`. **Não precisa de índice novo**; confirmar com o tempo medido na implementação.

### 8.8 Permissões e proteção de dados
- O backend checa o perfil, em vez de só esconder o menu: `exigirSecretaria` na v1.
- Se Diretora e Gestor ganharem acesso depois, o escopo é sempre `escolasPermitidas(actor)`, e a visão da rede fica só com as escolas deles.
- Sem nome de aluno, nem de professor, na aba. O detalhe nominal fica nas telas que já existem e já são protegidas: o painel de entregas do 1/3 e as Aplicações do PDI.
- A tela não guarda nada no `localStorage` além de preferências de visualização, como o último filtro.
- **Offline:** a aba é só leitura e depende de dados vivos. Sem conexão, mostra a última leitura com o aviso "sem conexão; dados de HH:MM". Não entra na fila offline.

---

## 9. Ordem sugerida de implementação

Cada etapa é pequena, publicável e testada no banco local antes da próxima. **Nenhuma está autorizada.**

| Etapa | O quê | Camadas | Banco |
|---|---|---|---|
| 0 | Usuário decide os pontos **[decidir]**: limiares do §6.2, quem acessa (só Secretaria?), Correções sim ou não | — | — |
| 1 | Endpoint agregado da rede (PDI vigente, 1/3 por escola, prazos, estrutura) + teste de homologação comparando com `/indicadores` e com o painel do 1/3: os números precisam bater | backend | sem migration |
| 2 | Aba nova no menu da Secretaria: cabeçalho, filtros, cartões (G1) e mapa da rede (G4), com modo claro, noturno e celular | frontend | — |
| 3 | Prazos: linha do tempo (G3) e "merecem acompanhamento" (§6.2) | frontend (e backend, se faltar campo) | — |
| 4 | Ritmo de preenchimento (G2): PDI pelo `concluidaEm`, 1/3 pelo histórico | backend + frontend | — |
| 5 | Visão da escola (G5, G6, G7) e links para os painéis existentes | backend + frontend | — |
| 6 | Comparativo com o período anterior (interruptor) | frontend | — |
| 7 *(opcional, futuro)* | "Fotografia do esperado no prazo" do PDI, para ter percentual histórico confiável | backend | **migration aditiva**, só com autorização |

---

## 10. Decisões do usuário (10/11/2026)

Estas respostas valem sobre o que estiver escrito acima.

1. **Limiares aprovados:** prazo próximo em 7 dias; pouco andamento abaixo de 50%; percentual só a partir de 5 itens esperados; "sem movimento" depois de 7 dias.
2. **Quem acessa:**
   - **Secretaria:** a rede inteira, com filtros bem definidos.
   - **Diretora:** só a própria escola. Ela não vê a camada "Rede". O escopo vem de `escolasPermitidas(actor)`; se tiver mais de uma escola, vê só as suas.
   - **Ninguém mais**, por enquanto. Gestor fica de fora.
3. **Correções abertas: entram, só como informação.** A aba não cria, não altera e não apaga nada, nem correções nem qualquer outro registro.
4. **Visual:** liberdade criativa, com padrões modernos. A paleta do §7 é o ponto de partida e será validada (contraste e daltonismo) na implementação.
5. **Percentual histórico do PDI (etapa 7):** a explicação foi pedida e entregue. Ainda falta a decisão. Até lá, o histórico do PDI fica em números absolutos.

A implementação foi autorizada logo depois, com todas as etapas, inclusive a 7. O usuário pediu para não poluir a tela e usar paginação quando precisar.

---

## 11. O que foi implementado (10/11/2026)

- **Backend (só leitura):** `GET /api/acompanhamento/rede` e `GET /api/acompanhamento/escola/:id`, em `backend/src/api/routes/acompanhamento.ts`. Os parâmetros são `ano`, `trimestre` (PDI), `cicloId` (1/3) e `atualizar=1`. A resposta fica em cache por 60 s.
  - As regras puras estão em `backend/src/domain/acompanhamento.ts`.
  - A contagem de Fichas em lote está em `backend/src/lib/contagemFichasPdi.ts`. É a mesma regra de `/indicadores`, que não foi alterado.
  - O 1/3 reaproveita `montarPainel`, que só passou a ser exportado.
- **Foto do PDI (etapa 7):**
  - tabela `fotografias_aplicacao_pdi`, criada pela migration aditiva `20261111120000_fotografia_aplicacao_pdi`;
  - job `backend/src/jobs/fotografiaPdiJob.ts`, que roda às 08:30 e também na subida do servidor.
- **Frontend:**
  - `src/pages/AcompanhamentoEscolarPage.jsx`, `src/components/acompanhamento/Graficos.jsx`, `src/styles/acompanhamento.css` e `src/services/acompanhamento.js`;
  - item de menu para a Diretora; a rota `/acompanhamento-escolar`, que antes era "em construção", agora abre esta tela.
- **Diferenças em relação à proposta:**
  - Paginação: mapa com 8 escolas por página, lista com 5 situações e prazos com 6.
  - Ordem padrão do mapa: "com atividade, A–Z". Escolas sem nada para mostrar vão para o fim.
  - Aplicações do PDI com as mesmas datas viram uma barra só na linha do tempo ("N escolas").
  - Cores de situação ajustadas para passar no validador: claro `#008A7A` e `#B0731A`; noturno `#14A090` e `#B47C24`.
- **Teste:** `homologacao/50-acompanhamento-escolar.mjs`, com 10 casos.

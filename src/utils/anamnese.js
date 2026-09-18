// Configuração da Anamnese (perfil inicial estruturado do aluno), fiel ao formulário real
// (PDI - Fundamental II). Cada aspecto estruturado tem uma chave própria e estável
// (snake_case), para permitir comparação/indicadores futuros sem depender do texto exibido
// na tela. Nenhuma pontuação numérica é atribuída às respostas aqui — essa decisão
// pedagógica não foi definida e não deve ser assumida pelo sistema.

export const OPCOES_SIM_NAO = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];

// "Possui laudo?" tem uma terceira opção no formulário original.
export const OPCOES_SIM_NAO_INVESTIGACAO = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'em_investigacao', label: 'Em investigação' },
];

// Aspectos comportamentais usam esta escala de 3 no formulário original (não é binária).
export const OPCOES_SIM_NAO_AS_VEZES = [
  { value: 'sim', label: 'Sim' },
  { value: 'as_vezes', label: 'Às vezes' },
  { value: 'nao', label: 'Não' },
];

// Escala usada em todos os aspectos psicomotores e pedagógicos/cognitivos.
export const ESCALA_ASPECTO = [
  { value: 'apresenta', label: 'Apresenta' },
  { value: 'apresenta_com_ajuda', label: 'Com ajuda' },
  { value: 'em_parte', label: 'Em parte' },
  { value: 'nao_apresenta', label: 'Não apresenta' },
  { value: 'nao_observado', label: 'Não observado' },
];

// Cargos padrão que aparecem no formulário real para "Responsáveis pela elaboração/
// atualização do PDI" — cargo e nome são editáveis, e a lista pode ser ampliada.
export const RESPONSAVEIS_PDI_PADRAO = [
  'Supervisora Pedagógica',
  'Professor de Língua Portuguesa',
  'Professor de Matemática',
  'Professor de Geografia',
  'Professor de Educação Física',
  'Professor de Ciências',
  'Professor de Ensino Religioso',
  'Professor de Inglês',
  'Professor de História',
  'Auxiliar de Aprendizagem',
];

// Cargos que já têm disciplina real no mock (ver src/data/mockData.js) — para estes, o nome é
// derivado automaticamente de turmaProfessores/professores (turma do aluno), sem digitação
// manual. Os cargos fora deste mapa (Supervisora Pedagógica, Educação Física, Ensino
// Religioso, Inglês, Auxiliar de Aprendizagem) não têm disciplina/entidade correspondente
// hoje — continuam com nome digitado manualmente até essa lacuna ser resolvida (não decidir
// isso automaticamente: ver relatório).
export const CARGO_DISCIPLINA_MAP = {
  'Professor de Língua Portuguesa': 1,
  'Professor de Matemática': 2,
  'Professor de Ciências': 3,
  'Professor de História': 4,
  'Professor de Geografia': 5,
};

export const ESPECIALIDADES_ACOMPANHAMENTO = [
  { key: 'psicologo', label: 'Psicólogo' },
  { key: 'psiquiatra', label: 'Psiquiatra' },
  { key: 'terapia_ocupacional', label: 'Terapia ocupacional' },
  { key: 'fonoaudiologo', label: 'Fonoaudiólogo' },
  { key: 'neuropediatria', label: 'Neuropediatria' },
  { key: 'sala_recurso', label: 'Sala de recurso' },
  { key: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { key: 'outro', label: 'Outro' },
];

export const ASPECTOS_COMPORTAMENTAIS = [
  { key: 'autoagressividade', label: 'Autoagressividade' },
  { key: 'indisciplina', label: 'Indisciplina' },
  { key: 'heteroagressividade', label: 'Heteroagressividade' },
  { key: 'desobediencia_regras', label: 'Desobediência às regras e/ou combinados' },
  { key: 'apatia', label: 'Apatia' },
];

// Explicações copiadas literalmente do formulário original — não remover, não resumir.
export const ASPECTOS_PSICOMOTORES = [
  { key: 'esquema_corporal', label: 'Esquema corporal', explicacao: 'Conhece as partes e funções do corpo? Nomeia as partes do corpo?' },
  { key: 'consciencia_corporal', label: 'Consciência corporal', explicacao: 'Sabe do uso específico de cada membro do corpo para a realização de atividades, mesmo nos casos em que haja limitações de movimento.' },
  { key: 'expressao_corporal', label: 'Expressão corporal', explicacao: 'Realizar gestos expressivos (susto, grito, tristeza, raiva)?' },
  { key: 'imagem_corporal', label: 'Imagem corporal', explicacao: 'Relação do próprio corpo com o espaço e as pessoas. Ex.: olhar no espelho e perceber o contorno do corpo.' },
  { key: 'tonus_hipertonico', label: 'Tônus hipertônico', explicacao: 'Apresenta rigidez muscular elevada?' },
  { key: 'tonus_hipotonico', label: 'Tônus hipotônico', explicacao: 'Apresenta flacidez muscular elevada?' },
  { key: 'coordenacao_motora_ampla', label: 'Coordenação motora ampla', explicacao: 'Controla os movimentos amplos do corpo? Ex.: correr, andar, rolar, pular, engatinhar, agachar.' },
  { key: 'coordenacao_motora_fina', label: 'Coordenação motora fina', explicacao: 'Controla os pequenos músculos para exercícios refinados? Ex.: recortar, colar, encaixar, pintar, pentear, jogar bola.' },
  { key: 'equilibrio_dinamico', label: 'Equilíbrio dinâmico', explicacao: 'Ex.: andar na ponta dos pés, correr com copo cheio de água na mão, andar de joelhos.' },
  { key: 'equilibrio_estatico', label: 'Equilíbrio estático', explicacao: 'Sustenta-se em diferentes situações? Ex.: ficar em pé parado com os olhos fechados, ficar em pé sobre um pé, ficar de cócoras.' },
  { key: 'lateralidade', label: 'Lateralidade', explicacao: 'Tem capacidade motora de percepção integrada dos dois lados do corpo (direito e esquerdo)?' },
  { key: 'percepcao_gustativa', label: 'Percepção gustativa', explicacao: 'Tem a capacidade de distinguir sabores? Ex.: reconhecer alimentos pelo gosto, distingue e expressa do que determinado alimento é feito.' },
  { key: 'percepcao_olfativa', label: 'Percepção olfativa', explicacao: 'Tem a capacidade de distinguir odores? Ex.: discriminação de duas frutas ou mais, identificar odores agradáveis e desagradáveis.' },
  { key: 'percepcao_tatil_motor', label: 'Percepção tátil', explicacao: 'Sente as variações de pressão, temperatura, noções de peso, sem a ajuda da visão? Ex.: reconhecer diferentes texturas, identificar formas.' },
  { key: 'percepcao_visual_motor', label: 'Percepção visual', explicacao: 'Identifica formas geométricas, junta objetos iguais, compara objetos, monta cenas, diz o que falta em desenhos, realiza sequências?' },
  { key: 'postura', label: 'Postura', explicacao: 'Posição ou atitude do corpo ligada ao movimento. Ex.: sentar, deitar, ficar de pé.' },
];

export const ASPECTOS_COGNITIVOS = [
  { key: 'memoria_curto_prazo', label: 'Memória de curto prazo', explicacao: 'Lembra-se de acontecimentos cotidianos ocorridos num período de até 6 horas?' },
  { key: 'memoria_longo_prazo', label: 'Memória de longo prazo', explicacao: 'Lembra-se de fatos ocorridos ao longo da vida e os utiliza no cotidiano? Ex.: reconhecer letras e números, pessoas.' },
  { key: 'memoria_auditiva', label: 'Memória auditiva', explicacao: 'Memoriza o que escuta?' },
  { key: 'memoria_visual', label: 'Memória visual', explicacao: 'Memoriza o que vê?' },
  { key: 'percepcao_auditiva', label: 'Percepção auditiva', explicacao: 'Escuta e interpreta os estímulos sonoros?' },
  { key: 'percepcao_corporal', label: 'Percepção corporal', explicacao: 'Tem consciência do próprio corpo?' },
  { key: 'percepcao_espacial', label: 'Percepção espacial', explicacao: 'Compreende as dimensões do entorno e dos objetos?' },
  { key: 'percepcao_tatil_cognitivo', label: 'Percepção tátil', explicacao: 'Reconhece formas, texturas, tamanhos pelo tato?' },
  { key: 'percepcao_temporal', label: 'Percepção temporal', explicacao: 'Tem a capacidade de situar-se em função da sucessão dos acontecimentos? Ex.: ontem, hoje, amanhã, antes, durante, após, hora, semana.' },
  { key: 'percepcao_visual_cognitivo', label: 'Percepção visual', explicacao: 'Enxerga e interpreta os estímulos visuais (claro, escuro, cores, formas, objetos)?' },
  { key: 'atencao_alerta', label: 'Atenção alerta', explicacao: 'Responde imediatamente a um estímulo apresentado?' },
  { key: 'atencao_alternada', label: 'Atenção alternada', explicacao: 'Realiza atividade proposta e conversa ao mesmo tempo?' },
  { key: 'atencao_seletiva', label: 'Atenção seletiva', explicacao: 'Concentra-se em uma atividade ignorando os demais estímulos?' },
  { key: 'atencao_sustentada', label: 'Atenção sustentada', explicacao: 'Concentra-se por um longo período de tempo na atividade proposta?' },
  { key: 'raciocinio_abdutivo', label: 'Raciocínio lógico abdutivo', explicacao: 'Busca novas ideias e conhecimentos que possam validar uma conclusão? Ex.: Pela manhã observo o telhado e ele está molhado.' },
  { key: 'raciocinio_dedutivo', label: 'Raciocínio lógico dedutivo', explicacao: 'Parte de um fato geral para um particular, concluindo-o? Ex.: Todas as maçãs daquela caixa são verdes. Essas maçãs são daquela caixa.' },
  { key: 'raciocinio_intuitivo', label: 'Raciocínio lógico intuitivo', explicacao: 'Parte de um fato específico para o geral, concluindo-o? A conclusão nem sempre será verdadeira. Ex.: Klaus é alemão de olhos azuis.' },
  { key: 'pensamento_analitico', label: 'Pensamento analítico', explicacao: 'Separa o todo em partes com as mesmas características? Ex.: Em uma caixa de brinquedos separa bolas, bonecas e carrinhos.' },
  { key: 'pensamento_criativo', label: 'Pensamento criativo', explicacao: 'Baseado em seus conhecimentos cria ou modifica algo existente?' },
  { key: 'pensamento_critico', label: 'Pensamento crítico', explicacao: 'Examina, analisa ou avalia?' },
  { key: 'pensamento_sintese', label: 'Pensamento de síntese', explicacao: 'Sintetiza, resume histórias ou fatos em poucas palavras?' },
  { key: 'pensamento_questionador', label: 'Pensamento questionador', explicacao: 'Propõe perguntas e busca respondê-las?' },
  { key: 'pensamento_sistemico', label: 'Pensamento sistêmico', explicacao: 'Considera vários elementos e os relaciona? Ex.: Separa o material escolar do material de higiene pessoal.' },
  { key: 'compreende_ordens_simples', label: 'Compreende ordens simples', explicacao: 'Ex.: Sentar, levantar, sair, entrar.' },
  { key: 'compreende_ordens_complexas', label: 'Compreende ordens complexas', explicacao: 'Ex.: Transmitir um recado a alguém.' },
  { key: 'relata_situacoes_vividas', label: 'Relata situações vividas' },
];

export const COMO_SE_COMUNICA_OPCOES = [
  { key: 'verbaliza', label: 'Verbaliza' },
  { key: 'gesticula', label: 'Gesticula' },
];

export const COMUNICACAO_FINALIDADES = [
  { key: 'fazer_comentarios', label: 'Fazer comentários' },
  { key: 'fazer_solicitacoes', label: 'Fazer solicitações' },
  { key: 'expressar_necessidades_basicas', label: 'Expressar necessidades básicas' },
  { key: 'obter_atencao', label: 'Obter atenção' },
  { key: 'realizar_escolhas', label: 'Realizar escolhas' },
  { key: 'realizar_pequenas_narrativas', label: 'Realizar pequenas narrativas' },
];

// "Não faz uso" é incompatível com as demais opções (ver regra de exclusão em AnamnesePage).
export const RECURSOS_COMUNICACAO_ALTERNATIVA = [
  { key: 'alfabeto_movel', label: 'Alfabeto móvel' },
  { key: 'alta_tecnologia', label: 'Alta tecnologia' },
  { key: 'baixa_tecnologia', label: 'Baixa tecnologia' },
  { key: 'figuras', label: 'Figuras' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'numerais', label: 'Numerais' },
  { key: 'pictograma', label: 'Pictograma' },
  { key: 'prancha_comunicacao', label: 'Prancha de comunicação' },
  { key: 'prancha_tematica', label: 'Prancha temática' },
  { key: 'nao_faz_uso', label: 'Não faz uso' },
];

export const EXPRESSA_SE_OPCOES = [
  { key: 'gestos_caseiros', label: 'Gestos caseiros' },
  { key: 'libras', label: 'LIBRAS' },
  { key: 'palavras', label: 'Palavras' },
  { key: 'sons', label: 'Sons' },
  { key: 'timidez', label: 'Timidez' },
  { key: 'descreve_gravuras', label: 'Descreve gravuras' },
  { key: 'ecolalia', label: 'Ecolalia' },
  { key: 'expressa_se_com_clareza', label: 'Expressa-se com clareza' },
  { key: 'expressa_se_muito_rapido', label: 'Expressa-se muito rápido' },
  { key: 'som_final_das_palavras', label: 'Som final das palavras' },
  { key: 'frases_completas', label: 'Frases completas' },
  { key: 'frases_curtas', label: 'Frases curtas' },
  { key: 'gagueira', label: 'Gagueira' },
  { key: 'lentidao_na_fala', label: 'Lentidão na fala' },
  { key: 'nomeia_objetos', label: 'Nomeia objetos' },
  { key: 'omite_fonemas', label: 'Omite fonemas' },
  { key: 'troca_fonemas', label: 'Troca fonemas' },
  { key: 'distorce_fonemas', label: 'Distorce fonemas' },
  { key: 'conversa_espontanea', label: 'Conversa espontânea' },
  { key: 'reconta_historias', label: 'Reconta histórias' },
  { key: 'repete_fala_dos_adultos', label: 'Repete fala dos adultos' },
  { key: 'demonstra_entender_proposto', label: 'Demonstra entender o que é proposto' },
  { key: 'tom_de_voz_baixo', label: 'Tom de voz baixo' },
  { key: 'tom_de_voz_alto', label: 'Tom de voz alto' },
];

// Escrita: a planilha mistura estágio (seleção única) com características observadas
// (múltipla seleção) — por isso são dois grupos separados, nunca um campo de texto livre.
export const ESCRITA_NIVEL_OPCOES = [
  { value: 'garatujas', label: 'Garatujas' },
  { value: 'escrita_silabica', label: 'Escrita silábica' },
  { value: 'escrita_silabica_alfabetica', label: 'Escrita silábica-alfabética' },
  { value: 'escrita_alfabetica', label: 'Escrita alfabética' },
  { value: 'diferencia_desenho_escrita_numeros', label: 'Diferencia desenho da escrita e dos números' },
  { value: 'identifica_rotulos', label: 'Identifica rótulos' },
  { value: 'conhece_algumas_letras', label: 'Conhece algumas letras' },
  { value: 'conhece_todas_letras', label: 'Conhece todas as letras' },
  { value: 'identifica_letras_iguais', label: 'Identifica letras iguais' },
  { value: 'reconhece_letra_inicial_proprio_nome', label: 'Reconhece a letra inicial do próprio nome' },
  { value: 'reconhece_proprio_nome_em_frases', label: 'Reconhece o próprio nome em frases' },
  { value: 'reconhece_nomes_pais_colegas', label: 'Reconhece nomes de pais/colegas' },
];

export const ESCRITA_CARACTERISTICAS_OPCOES = [
  { key: 'escreve_nome_familiares_amigos', label: 'Escreve nome de familiares e amigos' },
  { key: 'observa_relaciona_partes_nomes', label: 'Observa e relaciona partes dos nomes' },
  { key: 'procura_formar_palavras_tenta_ler', label: 'Procura formar palavras e tenta ler' },
  { key: 'escreve_frases_com_ajuda', label: 'Escreve frases com ajuda' },
  { key: 'escreve_textos', label: 'Escreve textos' },
  { key: 'letra_cursiva', label: 'Letra cursiva' },
  { key: 'letra_imprensa', label: 'Letra imprensa' },
  { key: 'letra_legivel', label: 'Letra legível' },
  { key: 'relaciona_letras_tipos_tamanhos', label: 'Relaciona letras de vários tipos e tamanhos' },
  { key: 'tenta_atribuir_sentido_texto_pistas', label: 'Tenta atribuir sentido ao texto por pistas' },
  { key: 'escreve_com_apoio_adaptacao', label: 'Escreve com apoio/adaptação' },
  { key: 'recusa_escrever_nao_sabe', label: 'Recusa escrever dizendo que não sabe' },
];

// Leitura: seleção única representando a condição predominante atual do aluno.
export const LEITURA_NIVEL_OPCOES = [
  { value: 'nao_le', label: 'Não lê' },
  { value: 'le_palavras', label: 'Lê palavras' },
  { value: 'le_frases_com_ajuda', label: 'Lê frases com ajuda' },
  { value: 'le_textos', label: 'Lê textos' },
  { value: 'leitura_global_compreensao_inferencia_comparacao', label: 'Leitura global — compreensão, inferência e comparação' },
  { value: 'leitura_fonetica_silabada_dificuldade_entendimento', label: 'Leitura fonética/silabada com dificuldade de entendimento' },
  { value: 'imita_leitura_texto_conhecido_oralmente', label: 'Imita leitura a partir de texto conhecido oralmente' },
];

const grupoVazio = (itens) => Object.fromEntries(itens.map(item => [item.key, { resposta: null, observacao: '' }]));

export const criarAnamneseVazia = (alunoId) => ({
  alunoId,

  // Nome do responsável, parentesco e telefones agora são obrigatórios no cadastro do aluno
  // (pdiAlunos.responsavelNome/responsavelParentesco/responsavelTelefone1/2) — a Anamnese só
  // exibe esses dados (somente leitura), sem duplicar o campo aqui.
  anoEscolaridade: '',
  possuiLaudo: null,
  cid: '',

  // Responsáveis pela elaboração/atualização do PDI
  responsaveisPdi: RESPONSAVEIS_PDI_PADRAO.map(cargo => ({ cargo, nome: '' })),

  // Informações gerais e acompanhamento
  acompanhadoForaDaEscola: null,
  especialidadesAcompanhamento: [],
  especialidadeOutroTexto: '',
  usoContinuoMedicamento: null,
  medicamentoQual: '',
  medicamentoPrescritoPor: '',
  medicamentoQuando: '',
  medicamentoParaQue: '',
  medicamentoEfeitosColaterais: null,
  medicamentoEfeitosQuais: '',
  comoGostaDeSeDivertir: '',
  idadeInicioEscola: '',
  ondeComecou: '',
  percursoEscolar: '',
  frequentaSalaRecursos: null,
  frequenciaAtendimento: '',

  comportamentais: grupoVazio(ASPECTOS_COMPORTAMENTAIS),
  psicomotores: grupoVazio(ASPECTOS_PSICOMOTORES),
  cognitivos: grupoVazio(ASPECTOS_COGNITIVOS),

  // Comunicação e linguagem
  apresentaIntencaoComunicativa: null,
  comoSeComunica: [],
  utilizaComunicacaoPara: [],
  recursosComunicacaoAlternativa: [],
  expressaSePor: [],

  // Escrita: estágio (seleção única) + características observadas (múltipla seleção)
  escritaNivel: null,
  escritaCaracteristicas: [],
  escritaObservacao: '',

  // Leitura: condição predominante atual (seleção única)
  leituraNivel: null,
  leituraObservacao: '',
});

const contarGrupo = (grupo) => {
  const valores = Object.values(grupo);
  return { total: valores.length, respondidos: valores.filter(item => item.resposta !== null).length };
};

// Progresso de PREENCHIMENTO (não é indicador de desenvolvimento/desempenho). Conta apenas
// respostas estruturadas de escolha única — múltipla escolha e texto livre são opcionais por
// natureza e não entram nessa contagem.
export const calcularProgressoAnamnese = (anamnese) => {
  if (!anamnese) {
    const grupos = [ASPECTOS_COMPORTAMENTAIS, ASPECTOS_PSICOMOTORES, ASPECTOS_COGNITIVOS];
    const totalGrupos = grupos.reduce((total, lista) => total + lista.length, 0);
    return { respondidos: 0, total: totalGrupos + 8 };
  }

  const grupos = [contarGrupo(anamnese.comportamentais), contarGrupo(anamnese.psicomotores), contarGrupo(anamnese.cognitivos)];
  const binarios = [
    anamnese.possuiLaudo,
    anamnese.acompanhadoForaDaEscola,
    anamnese.usoContinuoMedicamento,
    anamnese.medicamentoEfeitosColaterais,
    anamnese.frequentaSalaRecursos,
    anamnese.apresentaIntencaoComunicativa,
    anamnese.escritaNivel,
    anamnese.leituraNivel,
  ];

  const respondidos = grupos.reduce((total, item) => total + item.respondidos, 0) + binarios.filter(item => item !== null).length;
  const total = grupos.reduce((total, item) => total + item.total, 0) + binarios.length;
  return { respondidos, total };
};

// Estado derivado do progresso — apenas para exibição, não é workflow/aprovação.
export const calcularEstadoAnamnese = (progresso) => {
  if (progresso.respondidos === 0) return 'nao_iniciada';
  if (progresso.respondidos >= progresso.total) return 'preenchida';
  return 'em_preenchimento';
};

export const ESTADO_ANAMNESE_LABEL = {
  nao_iniciada: 'Não iniciada',
  em_preenchimento: 'Em preenchimento',
  preenchida: 'Preenchida',
};

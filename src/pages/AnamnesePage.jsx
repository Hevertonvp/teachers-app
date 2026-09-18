import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField } from '../components/Common';
import { AccordionSection, AspectoItem, CheckboxGroup, ObservacaoField, SegmentedToggle } from '../components/AnamneseFields';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { inputClass, turmaName } from '../utils/display';
import { vinculoAtivoDoAluno } from '../utils/auxiliares';
import { professoresDaTurma } from '../utils/escolas';
import { isCadastroBasicoCompleto, parentescoOptions } from '../utils/pdi';
import { isSecretaria } from '../utils/roles';
import {
  ASPECTOS_COGNITIVOS,
  ASPECTOS_COMPORTAMENTAIS,
  ASPECTOS_PSICOMOTORES,
  CARGO_DISCIPLINA_MAP,
  COMO_SE_COMUNICA_OPCOES,
  COMUNICACAO_FINALIDADES,
  ESCALA_ASPECTO,
  ESCRITA_CARACTERISTICAS_OPCOES,
  ESCRITA_NIVEL_OPCOES,
  ESPECIALIDADES_ACOMPANHAMENTO,
  ESTADO_ANAMNESE_LABEL,
  EXPRESSA_SE_OPCOES,
  LEITURA_NIVEL_OPCOES,
  OPCOES_SIM_NAO,
  OPCOES_SIM_NAO_AS_VEZES,
  OPCOES_SIM_NAO_INVESTIGACAO,
  RECURSOS_COMUNICACAO_ALTERNATIVA,
  calcularEstadoAnamnese,
  calcularProgressoAnamnese,
  criarAnamneseVazia,
} from '../utils/anamnese';
import { MainLayout } from '../layouts/Layouts';

const progressoBadge = (grupo, itens) => {
  const total = itens.length;
  const respondidos = itens.filter(item => grupo[item.key].resposta !== null).length;
  return <Badge variant={respondidos === total ? 'green' : respondidos > 0 ? 'blue' : 'gray'}>{respondidos}/{total}</Badge>;
};

const ESTADO_BADGE_VARIANT = { nao_iniciada: 'gray', em_preenchimento: 'blue', preenchida: 'green' };

const NAO_FAZ_USO = 'nao_faz_uso';

export const AnamnesePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pdiAlunos, pdiAnamneses, savePdiAnamnese, turmas, turmaProfessores, professores, disciplinas, escolas, diretores, vinculosEscolares, auxiliares, pdiAuxiliaresVinculos } = useData();
  const [message, setMessage] = useState('');

  const aluno = pdiAlunos.find(item => item.id === Number(id));
  // A Anamnese é exclusiva da Secretaria de Educação — Diretora, Gestor/Supervisor e
  // Professora não acessam esta tela (nem para leitura), independente da escola.
  const podeAcessar = isSecretaria(user);

  const anamneseSalva = aluno ? pdiAnamneses.find(item => item.alunoId === aluno.id) : null;
  const [form, setForm] = useState(() => anamneseSalva || criarAnamneseVazia(aluno?.id));

  if (!podeAcessar || !aluno) {
    return (
      <MainLayout>
        <Card className="py-12 text-center">
          <p className="font-semibold text-slate-800">{aluno ? 'Acesso restrito à Secretaria de Educação' : 'Aluno não encontrado'}</p>
          <Button className="mt-4" onClick={() => navigate('/pdi/alunos')}>Voltar para alunos</Button>
        </Card>
      </MainLayout>
    );
  }

  const escola = escolas.find(item => item.id === aluno.escolaId);
  const vinculoDiretora = vinculosEscolares.find(item => item.usuarioTipo === 'diretora' && item.escolaId === aluno.escolaId && item.status === 'ativo');
  const diretorEscola = vinculoDiretora ? diretores.find(item => item.id === vinculoDiretora.usuarioId) : null;

  const progresso = calcularProgressoAnamnese(form);
  const percentual = progresso.total ? Math.round((progresso.respondidos / progresso.total) * 100) : 0;
  const estado = calcularEstadoAnamnese(progresso);
  // Cadastro mínimo (nome, escola, turma, responsável legal) é uma coisa; preenchimento da
  // Anamnese (opcional, os 55 campos estruturados acima) é outra — não podem ser confundidos.
  const cadastroCompleto = isCadastroBasicoCompleto(aluno);
  const professoresDaTurmaDoAluno = professoresDaTurma(turmaProfessores, professores, disciplinas, aluno.turmaId);
  const professorPorDisciplina = (disciplinaId) => professoresDaTurmaDoAluno.find(vinculo => vinculo.disciplinaId === disciplinaId)?.professor;
  const vinculoAuxiliarAtivo = vinculoAtivoDoAluno(pdiAuxiliaresVinculos, aluno.id);

  const update = (payload) => setForm(prev => ({ ...prev, ...payload }));
  const updateAspecto = (grupo, chave, campo, valor) => setForm(prev => ({
    ...prev,
    [grupo]: { ...prev[grupo], [chave]: { ...prev[grupo][chave], [campo]: valor } },
  }));

  const updateResponsavel = (index, campo, valor) => setForm(prev => ({
    ...prev,
    responsaveisPdi: prev.responsaveisPdi.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)),
  }));
  const addResponsavel = () => setForm(prev => ({ ...prev, responsaveisPdi: [...prev.responsaveisPdi, { cargo: '', nome: '' }] }));
  const removeResponsavel = (index) => setForm(prev => ({ ...prev, responsaveisPdi: prev.responsaveisPdi.filter((_, i) => i !== index) }));

  // "Não faz uso" é incompatível com qualquer outro recurso de Comunicação Suplementar
  // Alternativa: marcar um lado limpa o outro (regra explícita do formulário original).
  const handleRecursosCSA = (novaLista) => {
    const tinhaNaoFazUso = form.recursosComunicacaoAlternativa.includes(NAO_FAZ_USO);
    const temNaoFazUso = novaLista.includes(NAO_FAZ_USO);
    if (temNaoFazUso && !tinhaNaoFazUso) {
      update({ recursosComunicacaoAlternativa: [NAO_FAZ_USO] });
    } else if (novaLista.some(item => item !== NAO_FAZ_USO)) {
      update({ recursosComunicacaoAlternativa: novaLista.filter(item => item !== NAO_FAZ_USO) });
    } else {
      update({ recursosComunicacaoAlternativa: novaLista });
    }
  };

  const handleSalvar = (event) => {
    event.preventDefault();
    savePdiAnamnese(aluno.id, form);
    setMessage('Anamnese salva com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link to={`/pdi/alunos/${aluno.id}`} className="text-sm font-semibold text-teal-700 hover:underline">← Voltar para aluno</Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Anamnese</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-600">
            <span>{aluno.nome} · {turmaName(turmas, aluno.turmaId)}{form.anoEscolaridade ? ` · ${form.anoEscolaridade}` : ''}</span>
            <Badge variant={cadastroCompleto ? 'green' : 'red'}>{cadastroCompleto ? 'Cadastro básico completo' : 'Cadastro básico incompleto'}</Badge>
            <Badge variant={ESTADO_BADGE_VARIANT[estado]}>Anamnese: {ESTADO_ANAMNESE_LABEL[estado]}</Badge>
          </p>
          {!cadastroCompleto && <p className="mt-1 text-xs text-red-700">Faltam dados mínimos no cadastro do aluno (nome, escola, turma ou responsável legal). Use "Editar aluno" no perfil para completar.</p>}
        </div>

        <Card>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-700">Preenchimento da anamnese</p>
              <p className="mt-1 text-xs text-slate-500">Indica só o quanto já foi preenchido — não é uma nota de desenvolvimento ou desempenho do aluno.</p>
            </div>
            <p className="shrink-0 text-lg font-bold text-slate-900">{progresso.respondidos} de {progresso.total} itens respondidos</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${percentual}%` }} />
          </div>
        </Card>

        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <form onSubmit={handleSalvar} className="space-y-4">
          <AccordionSection title="1. Dados do estudante" subtitle="Identificação e contato." defaultOpen>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nome completo"><input className={inputClass} value={aluno.nome} disabled /></FormField>
              <FormField label="Data de nascimento"><input className={inputClass} type="date" value={aluno.dataNascimento} disabled /></FormField>
              <FormField label="Turma"><input className={inputClass} value={turmaName(turmas, aluno.turmaId)} disabled /></FormField>
              <FormField label="Condição informada"><input className={inputClass} value={aluno.condicaoInformada || 'Não informada'} disabled /></FormField>
              <FormField label="Ano de escolaridade"><input className={inputClass} value={form.anoEscolaridade} onChange={event => update({ anoEscolaridade: event.target.value })} /></FormField>
              <FormField label="Responsável pelo estudante"><input className={inputClass} value={aluno.responsavelNome || 'Não informado'} disabled /></FormField>
              <FormField label="Parentesco"><input className={inputClass} value={parentescoOptions.find(item => item.value === aluno.responsavelParentesco)?.label || 'Não informado'} disabled /></FormField>
              <FormField label="Telefone 1"><input className={inputClass} value={aluno.responsavelTelefone1 || 'Não informado'} disabled /></FormField>
              <FormField label="Telefone 2"><input className={inputClass} value={aluno.responsavelTelefone2 || 'Não informado'} disabled /></FormField>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Possui laudo?</p>
              <SegmentedToggle value={form.possuiLaudo} onChange={value => update({ possuiLaudo: value })} options={OPCOES_SIM_NAO_INVESTIGACAO} />
            </div>
            {form.possuiLaudo === 'sim' && (
              <FormField label="CID"><input className={inputClass} value={form.cid} onChange={event => update({ cid: event.target.value })} /></FormField>
            )}
            <p className="text-xs text-slate-500">Nome, data de nascimento, turma, condição informada e responsável legal vêm do cadastro do aluno — para alterá-los, use "Editar aluno" no perfil.</p>
          </AccordionSection>

          <AccordionSection title="2. Dados da escola" subtitle="Informações institucionais já cadastradas — não são preenchidas aqui.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nome da escola"><input className={inputClass} value={escola?.nome || 'Não cadastrado'} disabled /></FormField>
              <FormField label="Endereço"><input className={inputClass} value={escola?.endereco || 'Não cadastrado'} disabled /></FormField>
              <FormField label="Diretor(a)"><input className={inputClass} value={diretorEscola?.nome || 'Não cadastrado'} disabled /></FormField>
              <FormField label="Vice-diretor(a)"><input className={inputClass} value="Não cadastrado" disabled /></FormField>
              <FormField label="Etapas da educação básica oferecidas"><input className={inputClass} value="Não cadastrado" disabled /></FormField>
              <FormField label="Acessibilidade física"><input className={inputClass} value="Não cadastrado" disabled /></FormField>
              <FormField label="Sala de recursos"><input className={inputClass} value="Não cadastrado" disabled /></FormField>
            </div>
          </AccordionSection>

          <AccordionSection title="3. Responsáveis pela elaboração/atualização do PDI" subtitle="Professores de disciplina são identificados automaticamente pela turma do aluno.">
            <div className="space-y-3">
              {form.responsaveisPdi.map((item, index) => {
                const disciplinaId = CARGO_DISCIPLINA_MAP[item.cargo];
                if (disciplinaId) {
                  const professor = professorPorDisciplina(disciplinaId);
                  return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-end">
                      <FormField label="Cargo"><input className={inputClass} value={item.cargo} disabled /></FormField>
                      <FormField label="Nome"><input className={inputClass} value={professor?.nome || 'Nenhum professor vinculado a esta disciplina na turma'} disabled /></FormField>
                    </div>
                  );
                }
                if (item.cargo === 'Auxiliar de Aprendizagem') {
                  const auxiliar = vinculoAuxiliarAtivo ? auxiliares.find(a => a.id === vinculoAuxiliarAtivo.auxiliarId) : null;
                  return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-end">
                      <FormField label="Cargo"><input className={inputClass} value={item.cargo} disabled /></FormField>
                      <FormField label="Nome"><input className={inputClass} value={auxiliar?.nome || 'Nenhum auxiliar vinculado atualmente'} disabled /></FormField>
                    </div>
                  );
                }
                return (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <FormField label="Cargo"><input className={inputClass} value={item.cargo} onChange={event => updateResponsavel(index, 'cargo', event.target.value)} /></FormField>
                    <FormField label="Nome"><input className={inputClass} value={item.nome} onChange={event => updateResponsavel(index, 'nome', event.target.value)} placeholder="Nome do profissional" /></FormField>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeResponsavel(index)}>Remover</Button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addResponsavel}>+ Adicionar responsável</Button>
              <p className="text-xs text-slate-500">Supervisora Pedagógica, Educação Física, Ensino Religioso e Inglês ainda não têm disciplina/entidade correspondente no sistema — continuam com nome digitado manualmente até essa definição.</p>
            </div>
          </AccordionSection>

          <AccordionSection title="4. Informações gerais e acompanhamento">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">É acompanhado por profissional fora da escola?</p>
              <SegmentedToggle value={form.acompanhadoForaDaEscola} onChange={value => update({ acompanhadoForaDaEscola: value })} options={OPCOES_SIM_NAO} />
              {form.acompanhadoForaDaEscola === 'sim' && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Especialidade(s)</p>
                  <CheckboxGroup value={form.especialidadesAcompanhamento} onChange={value => update({ especialidadesAcompanhamento: value })} options={ESPECIALIDADES_ACOMPANHAMENTO} />
                  {form.especialidadesAcompanhamento.includes('outro') && (
                    <FormField label="Qual?"><input className={inputClass} value={form.especialidadeOutroTexto} onChange={event => update({ especialidadeOutroTexto: event.target.value })} /></FormField>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Faz uso contínuo de medicamento?</p>
              <SegmentedToggle value={form.usoContinuoMedicamento} onChange={value => update({ usoContinuoMedicamento: value })} options={OPCOES_SIM_NAO} />
              {form.usoContinuoMedicamento === 'sim' && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <FormField label="Qual medicamento?"><input className={inputClass} value={form.medicamentoQual} onChange={event => update({ medicamentoQual: event.target.value })} /></FormField>
                  <FormField label="Quem prescreveu?"><input className={inputClass} value={form.medicamentoPrescritoPor} onChange={event => update({ medicamentoPrescritoPor: event.target.value })} /></FormField>
                  <FormField label="Quando?"><input className={inputClass} value={form.medicamentoQuando} onChange={event => update({ medicamentoQuando: event.target.value })} /></FormField>
                  <FormField label="Para quê?"><input className={inputClass} value={form.medicamentoParaQue} onChange={event => update({ medicamentoParaQue: event.target.value })} /></FormField>
                  <div className="sm:col-span-2">
                    <p className="mb-1.5 text-sm font-semibold text-slate-700">Causa efeitos colaterais?</p>
                    <SegmentedToggle value={form.medicamentoEfeitosColaterais} onChange={value => update({ medicamentoEfeitosColaterais: value })} options={OPCOES_SIM_NAO} />
                    {form.medicamentoEfeitosColaterais === 'sim' && (
                      <div className="mt-3"><FormField label="Quais?"><input className={inputClass} value={form.medicamentoEfeitosQuais} onChange={event => update({ medicamentoEfeitosQuais: event.target.value })} /></FormField></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Como gosta de se divertir?"><input className={inputClass} value={form.comoGostaDeSeDivertir} onChange={event => update({ comoGostaDeSeDivertir: event.target.value })} /></FormField>
              <FormField label="Com que idade começou a frequentar a escola?"><input className={inputClass} value={form.idadeInicioEscola} onChange={event => update({ idadeInicioEscola: event.target.value })} /></FormField>
              <FormField label="Onde começou?"><input className={inputClass} value={form.ondeComecou} onChange={event => update({ ondeComecou: event.target.value })} /></FormField>
            </div>
            <FormField label="Como foi o percurso escolar?"><textarea className={inputClass} rows="3" value={form.percursoEscolar} onChange={event => update({ percursoEscolar: event.target.value })} /></FormField>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Frequenta sala de recursos?</p>
              <SegmentedToggle value={form.frequentaSalaRecursos} onChange={value => update({ frequentaSalaRecursos: value })} options={OPCOES_SIM_NAO} />
              {form.frequentaSalaRecursos === 'sim' && (
                <div className="mt-3"><FormField label="Frequência do atendimento"><input className={inputClass} value={form.frequenciaAtendimento} onChange={event => update({ frequenciaAtendimento: event.target.value })} /></FormField></div>
              )}
            </div>
          </AccordionSection>

          <AccordionSection title="5. Aspectos comportamentais" badge={progressoBadge(form.comportamentais, ASPECTOS_COMPORTAMENTAIS)}>
            <div>
              {ASPECTOS_COMPORTAMENTAIS.map(item => (
                <AspectoItem
                  key={item.key}
                  item={item}
                  opcoes={OPCOES_SIM_NAO_AS_VEZES}
                  value={form.comportamentais[item.key]}
                  onChangeResposta={value => updateAspecto('comportamentais', item.key, 'resposta', value)}
                  onChangeObservacao={value => updateAspecto('comportamentais', item.key, 'observacao', value)}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="6. Aspectos psicomotores" badge={progressoBadge(form.psicomotores, ASPECTOS_PSICOMOTORES)}>
            <div>
              {ASPECTOS_PSICOMOTORES.map(item => (
                <AspectoItem
                  key={item.key}
                  item={item}
                  opcoes={ESCALA_ASPECTO}
                  value={form.psicomotores[item.key]}
                  onChangeResposta={value => updateAspecto('psicomotores', item.key, 'resposta', value)}
                  onChangeObservacao={value => updateAspecto('psicomotores', item.key, 'observacao', value)}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="7. Aspectos pedagógicos/cognitivos" badge={progressoBadge(form.cognitivos, ASPECTOS_COGNITIVOS)}>
            <div>
              {ASPECTOS_COGNITIVOS.map(item => (
                <AspectoItem
                  key={item.key}
                  item={item}
                  opcoes={ESCALA_ASPECTO}
                  value={form.cognitivos[item.key]}
                  onChangeResposta={value => updateAspecto('cognitivos', item.key, 'resposta', value)}
                  onChangeObservacao={value => updateAspecto('cognitivos', item.key, 'observacao', value)}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="8. Comunicação e linguagem">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Apresenta intenção comunicativa</p>
              <SegmentedToggle value={form.apresentaIntencaoComunicativa} onChange={value => update({ apresentaIntencaoComunicativa: value })} options={OPCOES_SIM_NAO} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Como se comunica</p>
              <CheckboxGroup value={form.comoSeComunica} onChange={value => update({ comoSeComunica: value })} options={COMO_SE_COMUNICA_OPCOES} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Utiliza a comunicação para:</p>
              <CheckboxGroup value={form.utilizaComunicacaoPara} onChange={value => update({ utilizaComunicacaoPara: value })} options={COMUNICACAO_FINALIDADES} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Recursos utilizados para Comunicação Suplementar Alternativa</p>
              <CheckboxGroup value={form.recursosComunicacaoAlternativa} onChange={handleRecursosCSA} options={RECURSOS_COMUNICACAO_ALTERNATIVA} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Expressa-se por/como/com</p>
              <CheckboxGroup value={form.expressaSePor} onChange={value => update({ expressaSePor: value })} options={EXPRESSA_SE_OPCOES} />
            </div>
          </AccordionSection>

          <AccordionSection title="9. Escrita">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Nível/estágio de escrita</p>
              <SegmentedToggle value={form.escritaNivel} onChange={value => update({ escritaNivel: value })} options={ESCRITA_NIVEL_OPCOES} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Características observadas na escrita</p>
              <CheckboxGroup value={form.escritaCaracteristicas} onChange={value => update({ escritaCaracteristicas: value })} options={ESCRITA_CARACTERISTICAS_OPCOES} />
            </div>
            <ObservacaoField value={form.escritaObservacao} onChange={value => update({ escritaObservacao: value })} />
          </AccordionSection>

          <AccordionSection title="10. Leitura">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Condição de leitura predominante</p>
              <SegmentedToggle value={form.leituraNivel} onChange={value => update({ leituraNivel: value })} options={LEITURA_NIVEL_OPCOES} />
            </div>
            <ObservacaoField value={form.leituraObservacao} onChange={value => update({ leituraObservacao: value })} />
          </AccordionSection>

          <div className="flex justify-end"><Button type="submit">Salvar anamnese</Button></div>
        </form>
      </div>
    </MainLayout>
  );
};

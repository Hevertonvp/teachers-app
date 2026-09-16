import { getUserEscolaIds } from './escolas';
import { isDiretora, isGestor, isProfessor, isSecretaria } from './roles';

export const identityKey = (tipo, id) => `${tipo}:${id}`;

const activeSchoolIdsFor = (tipo, id, vinculosEscolares) => vinculosEscolares
  .filter(vinculo => vinculo.usuarioTipo === tipo && vinculo.usuarioId === id && vinculo.status === 'ativo')
  .map(vinculo => vinculo.escolaId);

const sharedSchoolIds = (sender, recipient, vinculosEscolares) => {
  const senderSchools = activeSchoolIdsFor(sender.tipo, sender.id, vinculosEscolares);
  const recipientSchools = activeSchoolIdsFor(recipient.tipo, recipient.id, vinculosEscolares);
  return senderSchools.filter(escolaId => recipientSchools.includes(escolaId));
};

const personOption = (person, tipo, escolaIds = []) => ({
  id: person.id,
  tipo,
  nome: person.nome,
  cargo: person.cargo,
  escolaIds,
  key: identityKey(tipo, person.id),
});

export const getAllowedRecipients = (user, { gestores, diretores, professores, secretarias, vinculosEscolares }) => {
  if (!user) return [];
  const sender = { tipo: user.tipo, id: user.id };

  if (isSecretaria(user)) {
    return diretores
      .filter(diretor => diretor.status === 'ativo')
      .map(diretor => personOption(diretor, 'diretora', activeSchoolIdsFor('diretora', diretor.id, vinculosEscolares)));
  }

  if (isDiretora(user)) {
    const schoolIds = getUserEscolaIds(user, vinculosEscolares) || [];
    return [
      ...secretarias.map(secretaria => personOption(secretaria, 'secretaria')),
      ...gestores
        .filter(gestor => gestor.status === 'ativo')
        .map(gestor => personOption(gestor, 'gestor', sharedSchoolIds(sender, { tipo: 'gestor', id: gestor.id }, vinculosEscolares)))
        .filter(option => option.escolaIds.some(escolaId => schoolIds.includes(escolaId))),
    ];
  }

  if (isGestor(user)) {
    return [
      ...diretores
        .filter(diretor => diretor.status === 'ativo')
        .map(diretor => personOption(diretor, 'diretora', sharedSchoolIds(sender, { tipo: 'diretora', id: diretor.id }, vinculosEscolares)))
        .filter(option => option.escolaIds.length),
      ...professores
        .filter(professor => professor.status === 'ativo')
        .map(professor => personOption(professor, 'professor', sharedSchoolIds(sender, { tipo: 'professor', id: professor.id }, vinculosEscolares)))
        .filter(option => option.escolaIds.length),
    ];
  }

  if (isProfessor(user)) {
    const schoolIds = getUserEscolaIds(user, vinculosEscolares) || [];
    return gestores
      .filter(gestor => gestor.status === 'ativo')
      .map(gestor => personOption(gestor, 'gestor', sharedSchoolIds(sender, { tipo: 'gestor', id: gestor.id }, vinculosEscolares)))
      .filter(option => option.escolaIds.some(escolaId => schoolIds.includes(escolaId)));
  }

  return [];
};

export const canSendMessage = (sender, payload, data) => {
  const recipients = getAllowedRecipients(sender, data);
  const recipient = recipients.find(option => option.key === identityKey(payload.destinatarioTipo, payload.destinatarioId));
  if (!recipient) return false;
  if (payload.escolaId === null || payload.escolaId === undefined || payload.escolaId === '') return recipient.escolaIds.length === 0;
  return recipient.escolaIds.includes(Number(payload.escolaId));
};

export const personName = (tipo, id, { gestores, diretores, professores, secretarias }) => {
  const collections = { gestor: gestores, diretora: diretores, professor: professores, secretaria: secretarias };
  return collections[tipo]?.find(person => person.id === id)?.nome || 'Usuário';
};

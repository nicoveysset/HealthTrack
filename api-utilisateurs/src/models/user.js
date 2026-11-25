/**
 * Modèle Utilisateur pour HealthTrack
 * 
 * Ce modèle représente un utilisateur dans le système (patient ou praticien).
 * Les données sont stockées dans DynamoDB (table healthtrack-utilisateurs).
 */

// Types d'utilisateurs
const UserType = {
  PRATICIEN: 'PRATICIEN',
  PATIENT: 'PATIENT'
};

// Statuts des praticiens
const PraticienStatut = {
  ACTIF: 'ACTIF',
  EN_CONGE: 'EN_CONGE',
  INACTIF: 'INACTIF'
};

// Schéma de validation pour l'inscription
const registrationSchema = {
  required: ['email', 'password', 'type', 'firstName', 'lastName'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    type: { type: 'string', enum: [UserType.PRATICIEN, UserType.PATIENT] },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    // Champs spécifiques aux praticiens
    specialite: { type: 'string' },
    rpps: { type: 'string' },
    // Champs spécifiques aux patients
    dateNaissance: { type: 'string', format: 'date' },
    nss: { type: 'string' },
    medecinTraitantId: { type: 'string' }
  }
};

// Schéma de validation pour le login
const loginSchema = {
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  }
};

// Schéma de validation pour la mise à jour du profil
const updateProfileSchema = {
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    name: { type: 'string' },
    dateNaissance: { type: 'string', format: 'date' },
    nss: { type: 'string' },
    specialite: { type: 'string' },
    rpps: { type: 'string' },
    statut: { type: 'string', enum: [PraticienStatut.ACTIF, PraticienStatut.EN_CONGE, PraticienStatut.INACTIF] }
  }
};

/**
 * Crée un nouvel objet utilisateur avec les champs par défaut
 */
const createUserObject = (data) => {
  const now = new Date().toISOString();
  
  const user = {
    userId: data.userId || '',
    email: data.email,
    passwordHash: data.passwordHash || '',
    name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    type: data.type,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };
  
  // Ajouter les champs spécifiques aux praticiens
  if (data.type === UserType.PRATICIEN) {
    user.specialite = data.specialite || '';
    user.rpps = data.rpps || '';
    user.statut = data.statut || PraticienStatut.ACTIF;
  }
  
  // Ajouter les champs spécifiques aux patients
  if (data.type === UserType.PATIENT) {
    user.dateNaissance = data.dateNaissance || '';
    user.nss = data.nss || '';
    user.medecinTraitantId = data.medecinTraitantId || null;
  }
  
  return user;
};

/**
 * Valide un objet utilisateur selon le schéma
 */
const validateUser = (user, schema) => {
  const errors = [];
  
  // Vérifier les champs requis
  for (const field of schema.required || []) {
    if (!(field in user) || user[field] === undefined || user[field] === null || user[field] === '') {
      errors.push(`${field} est requis`);
    }
  }
  
  // Vérifier le format de l'email
  if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    errors.push('email doit être une adresse email valide');
  }
  
  // Vérifier la longueur du mot de passe
  if (user.password && user.password.length < 8) {
    errors.push('password doit contenir au moins 8 caractères');
  }
  
  // Vérifier le type d'utilisateur
  if (user.type && !Object.values(UserType).includes(user.type)) {
    errors.push(`type doit être ${Object.values(UserType).join(' ou ')}`);
  }
  
  // Vérifier le statut du praticien
  if (user.statut && !Object.values(PraticienStatut).includes(user.statut)) {
    errors.push(`statut doit être ${Object.values(PraticienStatut).join(' ou ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  UserType,
  PraticienStatut,
  registrationSchema,
  loginSchema,
  updateProfileSchema,
  createUserObject,
  validateUser
};

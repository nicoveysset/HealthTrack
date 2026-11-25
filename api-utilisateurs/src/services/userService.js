/**
 * UserService - Couche de service pour la gestion des utilisateurs
 * 
 * Ce service contient la logique métier et les règles de validation.
 * Il utilise le UserRepository pour les opérations de persistance.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const userRepository = require("../repositories/userRepository");
const { UserType, PraticienStatut, validateUser } = require("../models/user");

// Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} user - Utilisateur
 * @returns {string} - Token JWT
 */
function generateToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      type: user.type,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * Hash un mot de passe
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} - Mot de passe hashé
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Vérifie un mot de passe contre un hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash du mot de passe
 * @returns {Promise<boolean>} - true si le mot de passe correspond
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Crée un objet utilisateur à partir des données d'inscription
 * @param {Object} userData - Données d'inscription
 * @returns {Object} - Objet utilisateur formaté
 */
function buildUserFromRegistration(userData) {
  const userId = uuidv4();
  const now = new Date().toISOString();
  
  const user = {
    userId,
    email: userData.email,
    passwordHash: null, // sera rempli après hash
    name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
    firstName: userData.firstName || "",
    lastName: userData.lastName || "",
    type: userData.type,
    createdAt: now,
    updatedAt: now
  };
  
  // Champs spécifiques aux praticiens
  if (userData.type === UserType.PRATICIEN) {
    user.specialite = userData.specialite || "";
    user.rpps = userData.rpps || "";
    user.statut = userData.statut || PraticienStatut.ACTIF;
  }
  
  // Champs spécifiques aux patients
  if (userData.type === UserType.PATIENT) {
    user.dateNaissance = userData.dateNaissance || "";
    user.nss = userData.nss || "";
    user.medecinTraitantId = userData.medecinTraitantId || null;
  }
  
  return user;
}

/**
 * Inscription d'un nouvel utilisateur
 * @param {Object} userData - Données d'inscription
 * @returns {Promise<Object>} - { user, token }
 * @throws {Error} - En cas d'erreur de validation ou de conflit
 */
async function register(userData) {
  // Validation des données
  const validation = validateUser(userData, {
    required: ['email', 'password', 'type', 'firstName', 'lastName'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      type: { type: 'string', enum: [UserType.PRATICIEN, UserType.PATIENT] },
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    }
  });
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Validation spécifique selon le type
  if (userData.type === UserType.PRATICIEN) {
    if (!userData.specialite) {
      throw formatError("ValidationError", "specialite est requis pour un praticien", 400);
    }
    if (!userData.rpps) {
      throw formatError("ValidationError", "rpps est requis pour un praticien", 400);
    }
  }
  
  if (userData.type === UserType.PATIENT) {
    if (!userData.dateNaissance) {
      throw formatError("ValidationError", "dateNaissance est requis pour un patient", 400);
    }
    if (!userData.nss) {
      throw formatError("ValidationError", "nss est requis pour un patient", 400);
    }
  }
  
  // Vérifier si l'email existe déjà
  const emailExists = await userRepository.emailExists(userData.email);
  if (emailExists) {
    throw formatError("EmailAlreadyUsedException", "Un utilisateur avec cet email existe déjà", 409);
  }
  
  // Construire l'objet utilisateur
  const user = buildUserFromRegistration(userData);
  user.passwordHash = await hashPassword(userData.password);
  
  // Sauvegarder en base
  const createdUser = await userRepository.create(user);
  
  // Générer le token
  const token = generateToken(createdUser);
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = createdUser;
  
  return { user: userWithoutPassword, token };
}

/**
 * Connexion d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Promise<Object>} - { user, token }
 * @throws {Error} - En cas d'erreur d'authentification
 */
async function login(email, password) {
  if (!email || !password) {
    throw formatError("ValidationError", "email et password sont requis", 400);
  }
  
  // Récupérer l'utilisateur par email
  const user = await userRepository.getByEmail(email);
  if (!user) {
    throw formatError("InvalidCredentials", "Email ou mot de passe incorrect", 401);
  }
  
  // Vérifier le mot de passe
  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    throw formatError("InvalidCredentials", "Email ou mot de passe incorrect", 401);
  }
  
  // Générer le token
  const token = generateToken(user);
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = user;
  
  return { user: userWithoutPassword, token };
}

/**
 * Récupère le profil de l'utilisateur authentifié
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Profil de l'utilisateur
 * @throws {Error} - Si l'utilisateur n'est pas trouvé
 */
async function getProfile(userId) {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw formatError("NotFound", "Utilisateur non trouvé", 404);
  }
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Met à jour le profil de l'utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} updates - Données à mettre à jour
 * @returns {Promise<Object>} - Profil mis à jour
 * @throws {Error} - En cas d'erreur
 */
async function updateProfile(userId, updates) {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw formatError("NotFound", "Utilisateur non trouvé", 404);
  }
  
  // Validation des données de mise à jour
  const validation = validateUser(updates, {
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
  });
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Ne pas permettre de changer le type ou l'email
  const safeUpdates = { ...updates };
  delete safeUpdates.type;
  delete safeUpdates.email;
  delete safeUpdates.userId;
  delete safeUpdates.passwordHash;
  delete safeUpdates.createdAt;
  
  // Si c'est un praticien et qu'on change le statut
  if (user.type === UserType.PRATICIEN && safeUpdates.statut) {
    if (!Object.values(PraticienStatut).includes(safeUpdates.statut)) {
      throw formatError("ValidationError", `statut doit être ${Object.values(PraticienStatut).join(' ou ')}`, 400);
    }
  }
  
  const updatedUser = await userRepository.update(userId, safeUpdates);
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

/**
 * Désigne un médecin traitant pour un patient
 * @param {string} patientId - ID du patient
 * @param {string} medecinTraitantId - ID du médecin traitant
 * @returns {Promise<Object>} - Profil du patient mis à jour
 * @throws {Error} - En cas d'erreur
 */
async function setMedecinTraitant(patientId, medecinTraitantId) {
  // Vérifier que le patient existe
  const patient = await userRepository.getById(patientId);
  if (!patient) {
    throw formatError("NotFound", "Patient non trouvé", 404);
  }
  
  // Vérifier que c'est bien un patient
  if (patient.type !== UserType.PATIENT) {
    throw formatError("Forbidden", "Seul un patient peut désigner son médecin traitant", 403);
  }
  
  // Vérifier que le médecin existe
  const medecin = await userRepository.getById(medecinTraitantId);
  if (!medecin) {
    throw formatError("NotFound", "Praticien non trouvé", 404);
  }
  
  // Vérifier que c'est bien un praticien
  if (medecin.type !== UserType.PRATICIEN) {
    throw formatError("NotFound", "Praticien non trouvé", 404);
  }
  
  // Vérifier que le médecin est ACTIF
  if (medecin.statut !== PraticienStatut.ACTIF) {
    throw formatError("PractitionerNotAvailableException", "Le praticien n'est pas disponible", 409);
  }
  
  const updatedUser = await userRepository.update(patientId, { medecinTraitantId });
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

/**
 * Met à jour le statut d'un praticien
 * @param {string} praticienId - ID du praticien
 * @param {string} statut - Nouveau statut
 * @returns {Promise<Object>} - Profil du praticien mis à jour
 * @throws {Error} - En cas d'erreur
 */
async function updatePraticienStatut(praticienId, statut) {
  // Vérifier que le praticien existe
  const praticien = await userRepository.getById(praticienId);
  if (!praticien) {
    throw formatError("NotFound", "Praticien non trouvé", 404);
  }
  
  // Vérifier que c'est bien un praticien
  if (praticien.type !== UserType.PRATICIEN) {
    throw formatError("Forbidden", "Seul un praticien peut modifier son statut", 403);
  }
  
  // Valider le statut
  if (!statut || !Object.values(PraticienStatut).includes(statut)) {
    throw formatError("ValidationError", `statut doit être ${Object.values(PraticienStatut).join(' ou ')}`, 400);
  }
  
  const updatedUser = await userRepository.update(praticienId, { statut });
  
  // Retirer le passwordHash de la réponse
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

/**
 * Liste les praticiens avec filtres optionnels
 * @param {Object} filters - Filtres (specialite, statut)
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des praticiens
 */
async function listPraticiens(filters = {}, page = 1, limit = 10) {
  return await userRepository.listPraticiens(filters, page, limit);
}

/**
 * Vérifie si un praticien a eu un RDV TERMINE avec un patient
 * (Pour vérifier l'accès au dossier médical)
 * @param {string} praticienId - ID du praticien
 * @param {string} patientId - ID du patient
 * @returns {Promise<boolean>} - true si accès autorisé
 */
async function hasAccessToPatient(praticienId, patientId) {
  // Cette fonction nécessite d'interroger la table healthtrack-rendezvous
  // qui est gérée par l'API RDV. Dans une architecture serverless avec DynamoDB partagée,
  // on peut directement interroger la table.
  
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
  
  const rdvClient = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
  const rdvDocClient = DynamoDBDocumentClient.from(rdvClient);
  
  const params = {
    TableName: "healthtrack-rendezvous",
    IndexName: "byPraticienAndDate",
    KeyConditionExpression: "praticienId = :praticienId",
    FilterExpression: "patientId = :patientId AND statut = :statut",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":patientId": patientId,
      ":statut": "TERMINE"
    },
    Limit: 1
  };
  
  const result = await rdvDocClient.send(new QueryCommand(params));
  return result.Items && result.Items.length > 0;
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  setMedecinTraitant,
  updatePraticienStatut,
  listPraticiens,
  hasAccessToPatient,
  // Exporter pour les tests
  generateToken,
  hashPassword,
  verifyPassword
};

/**
 * DossierMedicalService - Service pour la gestion des dossiers médicaux
 * 
 * Contient la logique métier pour les dossiers médicaux.
 */

const dossierMedicalRepository = require("../repositories/dossierMedicalRepository");
const { v4: uuidv4 } = require("uuid");

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Crée un dossier médical pour un patient
 * @param {string} patientId - ID du patient
 * @param {Object} data - Données initiales du dossier
 * @returns {Promise<Object>} - Dossier médical créé
 */
async function createDossier(patientId, data = {}) {
  const now = new Date().toISOString();
  
  const dossier = {
    patientId,
    groupeSanguin: data.groupeSanguin || "",
    dateCreation: now,
    updatedAt: now
  };
  
  return await dossierMedicalRepository.create(dossier);
}

/**
 * Récupère un dossier médical
 * @param {string} patientId - ID du patient
 * @returns {Promise<Object|null>} - Dossier médical trouvé ou null
 */
async function getDossier(patientId) {
  return await dossierMedicalRepository.getByPatientId(patientId);
}

/**
 * Récupère ou crée un dossier médical
 * @param {string} patientId - ID du patient
 * @returns {Promise<Object>} - Dossier médical
 */
async function getOrCreateDossier(patientId) {
  const existingDossier = await getDossier(patientId);
  if (existingDossier) {
    return existingDossier;
  }
  
  return await createDossier(patientId);
}

/**
 * Met à jour un dossier médical
 * @param {string} patientId - ID du patient
 * @param {Object} updates - Champs à mettre à jour
 * @returns {Promise<Object>} - Dossier médical mis à jour
 */
async function updateDossier(patientId, updates) {
  return await dossierMedicalRepository.update(patientId, updates);
}

/**
 * Met à jour le groupe sanguin d'un patient
 * @param {string} patientId - ID du patient
 * @param {string} groupeSanguin - Nouveau groupe sanguin
 * @returns {Promise<Object>} - Dossier médical mis à jour
 */
async function updateGroupeSanguin(patientId, groupeSanguin) {
  const validGroupes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  if (!validGroupes.includes(groupeSanguin)) {
    throw formatError(
      "ValidationError",
      `groupeSanguin doit être l'un de : ${validGroupes.join(', ')}`,
      400
    );
  }
  
  return await updateDossier(patientId, { groupeSanguin });
}

/**
 * Vérifie si un praticien a accès au dossier d'un patient
 * @param {string} praticienId - ID du praticien
 * @param {string} patientId - ID du patient
 * @returns {Promise<boolean>} - true si accès autorisé
 */
async function hasAccess(praticienId, patientId) {
  // Vérifier si le praticien a eu un RDV TERMINE avec le patient
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
  
  const client = new DynamoDBClient({ region: process.env.DYNAMODB_REGION || "eu-west-1" });
  const docClient = DynamoDBDocumentClient.from(client);
  
  const params = {
    TableName: "healthtrack-rendezvous",
    FilterExpression: "praticienId = :praticienId AND patientId = :patientId AND statut = :statut",
    ExpressionAttributeValues: {
      ":praticienId": praticienId,
      ":patientId": patientId,
      ":statut": "TERMINE"
    },
    Limit: 1
  };
  
  const result = await docClient.send(new ScanCommand(params));
  return result.Items && result.Items.length > 0;
}

/**
 * Récupère le dossier médical complet d'un patient (avec vérification d'accès)
 * @param {string} patientId - ID du patient
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Dossier médical complet
 */
async function getDossierComplet(patientId, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== patientId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder à ce dossier", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await hasAccess(currentUserId, patientId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas consulté ce patient, accès au dossier refusé",
        403
      );
    }
  }
  
  return await getDossier(patientId);
}

module.exports = {
  createDossier,
  getDossier,
  getOrCreateDossier,
  updateDossier,
  updateGroupeSanguin,
  hasAccess,
  getDossierComplet
};

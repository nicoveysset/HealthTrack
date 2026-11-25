/**
 * AntecedentService - Service pour la gestion des antécédents
 * 
 * Contient la logique métier pour les antécédents médicaux.
 */

const antecedentRepository = require("../repositories/antecedentRepository");
const dossierMedicalService = require("./dossierMedicalService");
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
 * Valide un antécédent
 * @param {Object} antecedent - Antécédent à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateAntecedent(antecedent) {
  const errors = [];
  
  if (!antecedent.libellé) {
    errors.push("libellé est requis");
  }
  
  if (!antecedent.type) {
    errors.push("type est requis");
  } else if (!Object.values(antecedentRepository.ANTECEDENT_TYPE).includes(antecedent.type)) {
    errors.push(`type doit être ${Object.values(antecedentRepository.ANTECEDENT_TYPE).join(' ou ')}`);
  }
  
  if (!antecedent.dossierId) {
    errors.push("dossierId est requis");
  }
  
  if (antecedent.date && isNaN(new Date(antecedent.date).getTime())) {
    errors.push("date doit être une date valide");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée un nouvel antécédent
 * @param {Object} antecedentData - Données de l'antécédent
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Antécédent créé
 */
async function createAntecedent(antecedentData, currentUserId, currentUserType) {
  const validation = validateAntecedent(antecedentData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que le dossier existe
  const dossier = await dossierMedicalService.getDossier(antecedentData.dossierId);
  if (!dossier) {
    throw formatError("NotFound", "Dossier médical non trouvé", 404);
  }
  
  // Vérifier l'accès
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, antecedentData.dossierId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  } else if (currentUserType === 'PATIENT' && currentUserId !== antecedentData.dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à créer un antécédent pour ce dossier", 403);
  }
  
  const now = new Date().toISOString();
  const antecedent = {
    antecedentId: uuidv4(),
    dossierId: antecedentData.dossierId,
    libellé: antecedentData.libellé,
    type: antecedentData.type,
    date: antecedentData.date || now,
    statut: antecedentRepository.ANTECEDENT_STATUT.ACTIF,
    description: antecedentData.description || "",
    createdAt: now,
    updatedAt: now
  };
  
  return await antecedentRepository.create(antecedent);
}

/**
 * Récupère un antécédent par son ID
 * @param {string} antecedentId - ID de l'antécédent
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Antécédent trouvé
 */
async function getAntecedent(antecedentId, currentUserId, currentUserType) {
  const antecedent = await antecedentRepository.getById(antecedentId);
  
  if (!antecedent) {
    throw formatError("NotFound", "Antécédent non trouvé", 404);
  }
  
  // Vérifier l'accès au dossier
  if (currentUserType === 'PATIENT' && currentUserId !== antecedent.dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder à cet antécédent", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, antecedent.dossierId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return antecedent;
}

/**
 * Récupère les antécédents d'un patient
 * @param {string} dossierId - ID du dossier (patientId)
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Array>} - Liste des antécédents
 */
async function getAntecedentsByPatient(dossierId, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder aux antécédents de ce patient", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, dossierId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return await antecedentRepository.getByDossier(dossierId);
}

/**
 * Met à jour un antécédent
 * @param {string} antecedentId - ID de l'antécédent
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Antécédent mis à jour
 */
async function updateAntecedent(antecedentId, updates, currentUserId, currentUserType) {
  const antecedent = await getAntecedent(antecedentId, currentUserId, currentUserType);
  
  // Ne pas permettre de changer le type ou le dossierId
  const safeUpdates = { ...updates };
  delete safeUpdates.antecedentId;
  delete safeUpdates.dossierId;
  delete safeUpdates.type;
  delete safeUpdates.createdAt;
  
  return await antecedentRepository.update(antecedentId, safeUpdates);
}

/**
 * Archive un antécédent
 * @param {string} antecedentId - ID de l'antécédent
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Antécédent archivé
 */
async function archiveAntecedent(antecedentId, currentUserId, currentUserType) {
  const antecedent = await getAntecedent(antecedentId, currentUserId, currentUserType);
  
  // Vérifier que l'antécédent n'est pas CHRONIQUE
  if (antecedent.type === antecedentRepository.ANTECEDENT_TYPE.CHRONIQUE) {
    throw formatError(
      "ChronicConditionCannotBeArchivedException",
      "Un antécédent chronique ne peut pas être archivé",
      409
    );
  }
  
  return await antecedentRepository.archive(antecedentId);
}

/**
 * Récupère les antécédents par type
 * @param {string} dossierId - ID du dossier
 * @param {string} type - Type (CHRONIQUE ou PONCTUEL)
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Array>} - Liste des antécédents de ce type
 */
async function getAntecedentsByType(dossierId, type, currentUserId, currentUserType) {
  const antecedents = await getAntecedentsByPatient(dossierId, currentUserId, currentUserType);
  return antecedents.filter(a => a.type === type);
}

module.exports = {
  ANTECEDENT_TYPE: antecedentRepository.ANTECEDENT_TYPE,
  ANTECEDENT_STATUT: antecedentRepository.ANTECEDENT_STATUT,
  createAntecedent,
  getAntecedent,
  getAntecedentsByPatient,
  getAntecedentsByType,
  updateAntecedent,
  archiveAntecedent,
  // Exporter pour les tests
  validateAntecedent
};

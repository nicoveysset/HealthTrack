/**
 * AllergieService - Service pour la gestion des allergies
 * 
 * Contient la logique métier pour les allergies.
 */

const allergieRepository = require("../repositories/allergieRepository");
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
 * Log dans CloudWatch
 */
const logToCloudWatch = (message, details = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    message,
    details
  }));
};

/**
 * Valide une allergie
 * @param {Object} allergie - Allergie à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateAllergie(allergie) {
  const errors = [];
  
  if (!allergie.patientId) {
    errors.push("patientId est requis");
  }
  
  if (!allergie.medicamentConcerne) {
    errors.push("medicamentConcerne est requis");
  }
  
  if (!allergie.sévérité) {
    errors.push("sévérité est requis");
  } else if (!Object.values(allergieRepository.ALLERGIE_SEVERITE).includes(allergie.sévérité)) {
    errors.push(`sévérité doit être ${Object.values(allergieRepository.ALLERGIE_SEVERITE).join(' ou ')}`);
  }
  
  if (allergie.dateDécouverte && isNaN(new Date(allergie.dateDécouverte).getTime())) {
    errors.push("dateDécouverte doit être une date valide");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée une nouvelle allergie
 * @param {Object} allergieData - Données de l'allergie
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Allergie créée
 */
async function createAllergie(allergieData, currentUserId, currentUserType) {
  const validation = validateAllergie(allergieData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== allergieData.patientId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à créer une allergie pour ce patient", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, allergieData.patientId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  const now = new Date().toISOString();
  const allergie = {
    allergieId: uuidv4(),
    patientId: allergieData.patientId,
    médicamentConcerne: allergieData.medicamentConcerne,
    sévérité: allergieData.sévérité,
    dateDécouverte: allergieData.dateDécouverte || now,
    description: allergieData.description || "",
    createdAt: now,
    updatedAt: now
  };
  
  // Log dans CloudWatch
  logToCloudWatch("Allergie créée", {
    allergieId: allergie.allergieId,
    patientId: allergie.patientId,
    medicamentConcerne: allergie.medicamentConcerne,
    severite: allergie.sévérité
  });
  
  return await allergieRepository.create(allergie);
}

/**
 * Récupère une allergie par son ID
 * @param {string} allergieId - ID de l'allergie
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Allergie trouvée
 */
async function getAllergie(allergieId, currentUserId, currentUserType) {
  const allergie = await allergieRepository.getById(allergieId);
  
  if (!allergie) {
    throw formatError("NotFound", "Allergie non trouvée", 404);
  }
  
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== allergie.patientId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder à cette allergie", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, allergie.patientId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return allergie;
}

/**
 * Récupère les allergies d'un patient
 * @param {string} patientId - ID du patient
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Array>} - Liste des allergies
 */
async function getAllergiesByPatient(patientId, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== patientId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder aux allergies de ce patient", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, patientId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return await allergieRepository.getByPatient(patientId);
}

/**
 * Met à jour une allergie
 * @param {string} allergieId - ID de l'allergie
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Allergie mise à jour
 */
async function updateAllergie(allergieId, updates, currentUserId, currentUserType) {
  const allergie = await getAllergie(allergieId, currentUserId, currentUserType);
  
  // Ne pas permettre de changer le patientId
  const safeUpdates = { ...updates };
  delete safeUpdates.allergieId;
  delete safeUpdates.patientId;
  delete safeUpdates.createdAt;
  
  // Log dans CloudWatch
  logToCloudWatch("Allergie mise à jour", {
    allergieId,
    patientId: allergie.patientId,
    updates: safeUpdates
  });
  
  return await allergieRepository.update(allergieId, safeUpdates);
}

/**
 * Supprime une allergie
 * @param {string} allergieId - ID de l'allergie
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteAllergie(allergieId, currentUserId, currentUserType) {
  const allergie = await getAllergie(allergieId, currentUserId, currentUserType);
  
  // Vérifier que l'allergie n'est pas liée à une ordonnance active
  const isLinked = await allergieRepository.isLinkedToActivePrescription(allergieId);
  if (isLinked) {
    throw formatError(
      "AllergyLinkedToActivePrescriptionException",
      "Cette allergie est liée à une ordonnance active et ne peut pas être supprimée",
      409
    );
  }
  
  // Log dans CloudWatch
  logToCloudWatch("Allergie supprimée", {
    allergieId,
    patientId: allergie.patientId,
    medicamentConcerne: allergie.medicamentConcerne
  });
  
  return await allergieRepository.deleteById(allergieId);
}

/**
 * Vérifie si un patient a une allergie à un médicament
 * @param {string} patientId - ID du patient
 * @param {string} medicamentId - ID du médicament
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<boolean>} - true si allergie trouvée
 */
async function hasAllergieToMedicament(patientId, medicamentId, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== patientId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à vérifier les allergies de ce patient", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, patientId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return await allergieRepository.hasAllergieToMedicament(patientId, medicamentId);
}

module.exports = {
  ALLERGIE_SEVERITE: allergieRepository.ALLERGIE_SEVERITE,
  createAllergie,
  getAllergie,
  getAllergiesByPatient,
  updateAllergie,
  deleteAllergie,
  hasAllergieToMedicament,
  // Exporter pour les tests
  validateAllergie
};

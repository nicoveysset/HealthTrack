/**
 * LignePrescriptionService - Service pour la gestion des lignes de prescription
 * 
 * Contient la logique métier pour les lignes de prescription.
 */

const lignePrescriptionRepository = require("../repositories/lignePrescriptionRepository");
const ordonnanceService = require("./ordonnanceService");
const medicamentService = require("./medicamentService");
const allergieService = require("./allergieService");
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
 * Valide une ligne de prescription
 * @param {Object} ligne - Ligne de prescription à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateLignePrescription(ligne) {
  const errors = [];
  
  if (!ligne.ordonnanceId) {
    errors.push("ordonnanceId est requis");
  }
  
  if (!ligne.medicamentId) {
    errors.push("medicamentId est requis");
  }
  
  if (!ligne.posologie) {
    errors.push("posologie est requis");
  }
  
  if (!ligne.duree || ligne.duree <= 0) {
    errors.push("duree doit être un nombre positif");
  }
  
  // Vérifier que la durée n'est pas excessive (> 90 jours)
  if (ligne.duree && ligne.duree > 90) {
    // Note: Cela n'est pas bloquant mais doit être loggué
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée une nouvelle ligne de prescription
 * @param {Object} ligneData - Données de la ligne de prescription
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @returns {Promise<Object>} - Ligne de prescription créée
 */
async function createLignePrescription(ligneData, currentUserId) {
  const validation = validateLignePrescription(ligneData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que l'ordonnance existe et est accessible
  const ordonnance = await ordonnanceService.getOrdonnance(ligneData.ordonnanceId, currentUserId);
  
  if (!ordonnance) {
    throw formatError("NotFound", "Ordonnance non trouvée", 404);
  }
  
  // Vérifier que l'ordonnance n'est pas expirée
  if (ordonnanceService.isExpired(ordonnance)) {
    throw formatError(
      "PrescriptionExpiredException",
      "L'ordonnance est expirée, impossible d'ajouter une ligne de prescription",
      409
    );
  }
  
  // Vérifier que le médicament existe
  const medicament = await medicamentService.getMedicament(ligneData.medicamentId);
  if (!medicament) {
    throw formatError("NotFound", "Médicament non trouvé", 404);
  }
  
  // Vérifier les conflits d'allergies
  const hasAllergie = await allergieService.hasAllergieToMedicament(
    ordonnance.patientId,
    ligneData.medicamentId,
    currentUserId
  );
  
  if (hasAllergie) {
    // Log dans CloudWatch
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      message: "Tentative de prescription avec conflit d'allergie",
      details: {
        ordonnanceId: ligneData.ordonnanceId,
        medicamentId: ligneData.medicamentId,
        patientId: ordonnance.patientId,
        praticienId: currentUserId
      }
    }));
    
    throw formatError(
      "AllergyConflictException",
      `Le patient a une allergie au médicament ${medicament.nom}`,
      409
    );
  }
  
  const now = new Date().toISOString();
  const ligne = {
    ligneId: uuidv4(),
    ordonnanceId: ligneData.ordonnanceId,
    medicamentId: ligneData.medicamentId,
    posologie: ligneData.posologie,
    duree: ligneData.duree,
    instructions: ligneData.instructions || "",
    createdAt: now,
    updatedAt: now
  };
  
  // Log si durée > 90 jours
  if (ligne.duree > 90) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      message: "Prescription avec durée > 90 jours",
      details: {
        ordonnanceId: ligne.ordonnanceId,
        medicamentId: ligne.medicamentId,
        duree: ligne.duree
      }
    }));
  }
  
  return await lignePrescriptionRepository.create(ligne);
}

/**
 * Récupère une ligne de prescription par son ID
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Ligne de prescription trouvée
 */
async function getLignePrescription(ordonnanceId, ligneId, currentUserId) {
  const ligne = await lignePrescriptionRepository.getById(ordonnanceId, ligneId);
  
  if (!ligne) {
    throw formatError("NotFound", "Ligne de prescription non trouvée", 404);
  }
  
  // Vérifier l'accès via l'ordonnance
  const ordonnance = await ordonnanceService.getOrdonnance(ordonnanceId, currentUserId);
  
  if (!ordonnance) {
    throw formatError("NotFound", "Ordonnance non trouvée", 404);
  }
  
  return ligne;
}

/**
 * Récupère toutes les lignes de prescription d'une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des lignes de prescription
 */
async function getLignesByOrdonnance(ordonnanceId, currentUserId) {
  // Vérifier l'accès
  const ordonnance = await ordonnanceService.getOrdonnance(ordonnanceId, currentUserId);
  
  if (!ordonnance) {
    throw formatError("NotFound", "Ordonnance non trouvée", 404);
  }
  
  return await lignePrescriptionRepository.getByOrdonnance(ordonnanceId);
}

/**
 * Met à jour une ligne de prescription
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Ligne de prescription mise à jour
 */
async function updateLignePrescription(ordonnanceId, ligneId, updates, currentUserId) {
  const ligne = await getLignePrescription(ordonnanceId, ligneId, currentUserId);
  
  // Ne pas permettre de changer certains champs
  const safeUpdates = { ...updates };
  delete safeUpdates.ligneId;
  delete safeUpdates.ordonnanceId;
  delete safeUpdates.createdAt;
  
  return await lignePrescriptionRepository.update(ordonnanceId, ligneId, safeUpdates);
}

/**
 * Supprime une ligne de prescription
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} ligneId - ID de la ligne
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteLignePrescription(ordonnanceId, ligneId, currentUserId) {
  const ligne = await getLignePrescription(ordonnanceId, ligneId, currentUserId);
  return await lignePrescriptionRepository.deleteById(ordonnanceId, ligneId);
}

/**
 * Supprime toutes les lignes d'une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteAllLignesByOrdonnance(ordonnanceId, currentUserId) {
  // Vérifier l'accès
  const ordonnance = await ordonnanceService.getOrdonnance(ordonnanceId, currentUserId);
  
  if (!ordonnance) {
    throw formatError("NotFound", "Ordonnance non trouvée", 404);
  }
  
  return await lignePrescriptionRepository.deleteAllByOrdonnance(ordonnanceId);
}

module.exports = {
  createLignePrescription,
  getLignePrescription,
  getLignesByOrdonnance,
  updateLignePrescription,
  deleteLignePrescription,
  deleteAllLignesByOrdonnance,
  // Exporter pour les tests
  validateLignePrescription
};

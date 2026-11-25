/**
 * OrdonnanceService - Service pour la gestion des ordonnances
 * 
 * Contient la logique métier pour les ordonnances.
 */

const ordonnanceRepository = require("../repositories/ordonnanceRepository");
const lignePrescriptionService = require("./lignePrescriptionService");
const compteRenduService = require("./compteRenduService");
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
 * Valide une ordonnance
 * @param {Object} ordonnance - Ordonnance à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateOrdonnance(ordonnance) {
  const errors = [];
  
  if (!ordonnance.patientId) {
    errors.push("patientId est requis");
  }
  
  if (!ordonnance.praticienId) {
    errors.push("praticienId est requis");
  }
  
  if (!ordonnance.compteRenduId) {
    errors.push("compteRenduId est requis");
  }
  
  if (!ordonnance.rdvId) {
    errors.push("rdvId est requis");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée une nouvelle ordonnance
 * @param {Object} ordonnanceData - Données de l'ordonnance
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @returns {Promise<Object>} - Ordonnance créée
 */
async function createOrdonnance(ordonnanceData, currentUserId) {
  const validation = validateOrdonnance(ordonnanceData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que le compte rendu existe et est accessible
  const compteRendu = await compteRenduService.getCompteRendu(ordonnanceData.compteRenduId, currentUserId);
  if (!compteRendu) {
    throw formatError("NotFound", "Compte rendu non trouvé", 404);
  }
  
  // Vérifier que l'utilisateur est le praticien du compte rendu
  if (compteRendu.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas le praticien de ce compte rendu",
      403
    );
  }
  
  // Vérifier que la consultation est finalisée (via compte rendu)
  if (!compteRendu.dateFinalisation) {
    throw formatError(
      "ConsultationNotFinalizedException",
      "La consultation doit être finalisée pour créer une ordonnance",
      409
    );
  }
  
  const now = new Date().toISOString();
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  
  const ordonnance = {
    ordonnanceId: uuidv4(),
    compteRenduId: ordonnanceData.compteRenduId,
    patientId: ordonnanceData.patientId,
    rdvId: ordonnanceData.rdvId,
    praticienId: ordonnanceData.praticienId,
    dateEmission: now,
    dateValidite: threeMonthsLater.toISOString(),
    statut: ordonnanceRepository.ORDONNANCE_STATUT.ACTIVE,
    createdAt: now,
    updatedAt: now
  };
  
  return await ordonnanceRepository.create(ordonnance);
}

/**
 * Récupère une ordonnance par son ID
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Ordonnance trouvée
 */
async function getOrdonnance(ordonnanceId, currentUserId) {
  let ordonnance = await ordonnanceRepository.getById(ordonnanceId);
  
  if (!ordonnance) {
    throw formatError("NotFound", "Ordonnance non trouvée", 404);
  }
  
  // Appliquer l'expiration paresseuse
  ordonnance = await ordonnanceRepository.checkAndUpdateExpiration(ordonnance);
  
  // Vérifier l'accès
  if (ordonnance.patientId !== currentUserId && ordonnance.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à accéder à cette ordonnance",
      403
    );
  }
  
  return ordonnance;
}

/**
 * Récupère les ordonnances d'un patient
 * @param {string} patientId - ID du patient
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des ordonnances
 */
async function getOrdonnancesByPatient(patientId, currentUserId) {
  // Vérifier l'accès
  if (patientId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à accéder aux ordonnances de ce patient",
      403
    );
  }
  
  let ordonnances = await ordonnanceRepository.getByPatient(patientId);
  
  // Appliquer l'expiration paresseuse
  const updatedOrdonnances = [];
  for (const ordonnance of ordonnances) {
    const checkedOrdonnance = await ordonnanceRepository.checkAndUpdateExpiration(ordonnance);
    updatedOrdonnances.push(checkedOrdonnance);
  }
  
  return updatedOrdonnances;
}

/**
 * Récupère les ordonnances avec filtres optionnels
 * @param {Object} filters - Filtres (patientId, statut, praticienId, dateDebut, dateFin)
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Liste paginée des ordonnances
 */
async function listOrdonnances(filters = {}, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (filters.patientId && filters.patientId !== currentUserId && currentUserType !== 'PRATICIEN') {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à accéder aux ordonnances de ce patient",
      403
    );
  }
  
  if (currentUserType === 'PRATICIEN') {
    filters.praticienId = currentUserId;
  } else if (currentUserType === 'PATIENT') {
    filters.patientId = currentUserId;
  }
  
  const result = await ordonnanceRepository.list(filters);
  
  // Appliquer l'expiration paresseuse
  const updatedItems = [];
  for (const ordonnance of result.items) {
    const checkedOrdonnance = await ordonnanceRepository.checkAndUpdateExpiration(ordonnance);
    updatedItems.push(checkedOrdonnance);
  }
  
  return {
    ...result,
    items: updatedItems
  };
}

/**
 * Met à jour une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Ordonnance mise à jour
 */
async function updateOrdonnance(ordonnanceId, updates, currentUserId) {
  const ordonnance = await getOrdonnance(ordonnanceId, currentUserId);
  
  // Ne pas permettre de changer certains champs
  const safeUpdates = { ...updates };
  delete safeUpdates.ordonnanceId;
  delete safeUpdates.patientId;
  delete safeUpdates.praticienId;
  delete safeUpdates.compteRenduId;
  delete safeUpdates.rdvId;
  delete safeUpdates.dateEmission;
  delete safeUpdates.createdAt;
  
  // Si on met à jour la date de validité, vérifier qu'elle n'est pas dans le passé
  if (updates.dateValidite) {
    const now = new Date().toISOString();
    if (updates.dateValidite < now) {
      safeUpdates.statut = ordonnanceRepository.ORDONNANCE_STATUT.EXPIREE;
    }
  }
  
  const updatedOrdonnance = await ordonnanceRepository.update(ordonnanceId, safeUpdates);
  
  // Appliquer l'expiration paresseuse
  return await ordonnanceRepository.checkAndUpdateExpiration(updatedOrdonnance);
}

/**
 * Supprime une ordonnance
 * @param {string} ordonnanceId - ID de l'ordonnance
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteOrdonnance(ordonnanceId, currentUserId) {
  const ordonnance = await getOrdonnance(ordonnanceId, currentUserId);
  
  // Supprimer toutes les lignes de prescription
  await lignePrescriptionService.deleteAllLignesByOrdonnance(ordonnanceId, currentUserId);
  
  return await ordonnanceRepository.deleteById(ordonnanceId);
}

/**
 * Vérifie si une ordonnance est expirée
 * @param {Object} ordonnance - Ordonnance à vérifier
 * @returns {boolean} - true si l'ordonnance est expirée
 */
function isExpired(ordonnance) {
  const now = new Date().toISOString();
  return ordonnance.statut === ordonnanceRepository.ORDONNANCE_STATUT.EXPIREE ||
         (ordonnance.dateValidite && ordonnance.dateValidite < now);
}

module.exports = {
  ORDONNANCE_STATUT: ordonnanceRepository.ORDONNANCE_STATUT,
  createOrdonnance,
  getOrdonnance,
  getOrdonnancesByPatient,
  listOrdonnances,
  updateOrdonnance,
  deleteOrdonnance,
  isExpired,
  // Exporter pour les tests
  validateOrdonnance
};

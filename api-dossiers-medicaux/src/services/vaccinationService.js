/**
 * VaccinationService - Service pour la gestion des vaccinations
 * 
 * Contient la logique métier pour les vaccinations.
 */

const vaccinationRepository = require("../repositories/vaccinationRepository");
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
 * Valide une vaccination
 * @param {Object} vaccination - Vaccination à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateVaccination(vaccination) {
  const errors = [];
  
  if (!vaccination.dossierId) {
    errors.push("dossierId est requis");
  }
  
  if (!vaccination.nomVaccin) {
    errors.push("nomVaccin est requis");
  }
  
  if (!vaccination.date) {
    errors.push("date est requis");
  } else if (isNaN(new Date(vaccination.date).getTime())) {
    errors.push("date doit être une date valide");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée une nouvelle vaccination
 * @param {Object} vaccinationData - Données de la vaccination
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Vaccination créée
 */
async function createVaccination(vaccinationData, currentUserId, currentUserType) {
  const validation = validateVaccination(vaccinationData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que le dossier existe
  const dossier = await dossierMedicalService.getDossier(vaccinationData.dossierId);
  if (!dossier) {
    throw formatError("NotFound", "Dossier médical non trouvé", 404);
  }
  
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== vaccinationData.dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à créer une vaccination pour ce dossier", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, vaccinationData.dossierId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  const now = new Date().toISOString();
  const vaccination = {
    vaccinationId: uuidv4(),
    dossierId: vaccinationData.dossierId,
    nomVaccin: vaccinationData.nomVaccin,
    date: vaccinationData.date,
    rappelPrévu: vaccinationData.rappelPrévu || null,
    description: vaccinationData.description || "",
    createdAt: now,
    updatedAt: now
  };
  
  return await vaccinationRepository.create(vaccination);
}

/**
 * Récupère une vaccination par son ID
 * @param {string} vaccinationId - ID de la vaccination
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Vaccination trouvée
 */
async function getVaccination(vaccinationId, currentUserId, currentUserType) {
  const vaccination = await vaccinationRepository.getById(vaccinationId);
  
  if (!vaccination) {
    throw formatError("NotFound", "Vaccination non trouvée", 404);
  }
  
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== vaccination.dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder à cette vaccination", 403);
  }
  
  if (currentUserType === 'PRATICIEN') {
    const hasAccessToDossier = await dossierMedicalService.hasAccess(currentUserId, vaccination.dossierId);
    if (!hasAccessToDossier) {
      throw formatError(
        "Forbidden",
        "Vous n'avez pas accès au dossier de ce patient",
        403
      );
    }
  }
  
  return vaccination;
}

/**
 * Récupère les vaccinations d'un patient
 * @param {string} dossierId - ID du dossier (patientId)
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Array>} - Liste des vaccinations
 */
async function getVaccinationsByPatient(dossierId, currentUserId, currentUserType) {
  // Vérifier l'accès
  if (currentUserType === 'PATIENT' && currentUserId !== dossierId) {
    throw formatError("Forbidden", "Vous n'êtes pas autorisé à accéder aux vaccinations de ce patient", 403);
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
  
  return await vaccinationRepository.getByDossier(dossierId);
}

/**
 * Récupère les vaccinations à rappel pour un patient
 * @param {string} dossierId - ID du dossier
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Array>} - Liste des vaccinations nécessitant un rappel
 */
async function getVaccinationsARappel(dossierId, currentUserId, currentUserType) {
  const vaccinations = await getVaccinationsByPatient(dossierId, currentUserId, currentUserType);
  return vaccinations.filter(v => v.rappelPrévu);
}

/**
 * Met à jour une vaccination
 * @param {string} vaccinationId - ID de la vaccination
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Vaccination mise à jour
 */
async function updateVaccination(vaccinationId, updates, currentUserId, currentUserType) {
  const vaccination = await getVaccination(vaccinationId, currentUserId, currentUserType);
  
  // Ne pas permettre de changer le dossierId
  const safeUpdates = { ...updates };
  delete safeUpdates.vaccinationId;
  delete safeUpdates.dossierId;
  delete safeUpdates.createdAt;
  
  return await vaccinationRepository.update(vaccinationId, safeUpdates);
}

/**
 * Supprime une vaccination
 * @param {string} vaccinationId - ID de la vaccination
 * @param {string} currentUserId - ID de l'utilisateur
 * @param {string} currentUserType - Type de l'utilisateur
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteVaccination(vaccinationId, currentUserId, currentUserType) {
  const vaccination = await getVaccination(vaccinationId, currentUserId, currentUserType);
  return await vaccinationRepository.deleteById(vaccinationId);
}

module.exports = {
  createVaccination,
  getVaccination,
  getVaccinationsByPatient,
  getVaccinationsARappel,
  updateVaccination,
  deleteVaccination,
  // Exporter pour les tests
  validateVaccination
};

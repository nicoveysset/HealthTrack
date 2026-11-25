/**
 * CompteRenduService - Service pour la gestion des comptes rendus
 * 
 * Contient la logique métier pour les comptes rendus.
 */

const compteRenduRepository = require("../repositories/compteRenduRepository");
const rendezVousService = require("./rendezVousService");
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
 * Valide un compte rendu
 * @param {Object} cr - Compte rendu à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateCompteRendu(cr) {
  const errors = [];
  
  if (!cr.rdvId) {
    errors.push("rdvId est requis");
  }
  
  if (!cr.praticienId) {
    errors.push("praticienId est requis");
  }
  
  if (!cr.patientId) {
    errors.push("patientId est requis");
  }
  
  if (!cr.contenu) {
    errors.push("contenu est requis");
  } else if (cr.contenu.length < 10) {
    errors.push("contenu doit contenir au moins 10 caractères");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée un nouveau compte rendu
 * @param {Object} crData - Données du compte rendu
 * @param {string} currentUserId - ID de l'utilisateur qui crée le CR
 * @returns {Promise<Object>} - Compte rendu créé
 */
async function createCompteRendu(crData, currentUserId) {
  const validation = validateCompteRendu(crData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que le RDV existe
  const rdv = await rendezVousService.getRendezVous(crData.rdvId);
  
  if (!rdv) {
    throw formatError("NotFound", "Rendez-vous non trouvé", 404);
  }
  
  // Vérifier que le RDV est TERMINE
  if (rdv.statut !== rendezVousService.RDV_STATUT.TERMINE) {
    throw formatError(
      "ConsultationNotFinalizedException",
      "Le rendez-vous doit être TERMINE pour créer un compte rendu",
      409
    );
  }
  
  // Vérifier que l'utilisateur est le praticien du RDV
  if (rdv.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas le praticien de ce rendez-vous",
      403
    );
  }
  
  // Vérifier qu'un compte rendu n'existe pas déjà
  const existingCR = await compteRenduRepository.getByRdvId(crData.rdvId);
  if (existingCR) {
    throw formatError(
      "Conflict",
      "Un compte rendu existe déjà pour ce rendez-vous",
      409
    );
  }
  
  const now = new Date().toISOString();
  const cr = {
    compteRenduId: uuidv4(),
    rdvId: crData.rdvId,
    praticienId: crData.praticienId,
    patientId: crData.patientId,
    contenu: crData.contenu,
    dateFinalisation: now,
    createdAt: now,
    updatedAt: now
  };
  
  return await compteRenduRepository.create(cr);
}

/**
 * Récupère un compte rendu par son ID
 * @param {string} compteRenduId - ID du compte rendu
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getCompteRendu(compteRenduId, currentUserId) {
  const cr = await compteRenduRepository.getById(compteRenduId);
  
  if (!cr) {
    throw formatError("NotFound", "Compte rendu non trouvé", 404);
  }
  
  // Vérifier que l'utilisateur est soit le patient soit le praticien du CR
  if (cr.patientId !== currentUserId && cr.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à consulter ce compte rendu",
      403
    );
  }
  
  return cr;
}

/**
 * Récupère un compte rendu par ID de rendez-vous
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object|null>} - Compte rendu trouvé ou null
 */
async function getCompteRenduByRdv(rdvId, currentUserId) {
  const cr = await compteRenduRepository.getByRdvId(rdvId);
  
  if (!cr) {
    throw formatError("NotFound", "Compte rendu non trouvé", 404);
  }
  
  // Vérifier que l'utilisateur est soit le patient soit le praticien du RDV
  const rdv = await rendezVousService.getRendezVous(rdvId);
  if (!rdv) {
    throw formatError("NotFound", "Rendez-vous non trouvé", 404);
  }
  
  if (rdv.patientId !== currentUserId && rdv.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Vous n'êtes pas autorisé à consulter ce compte rendu",
      403
    );
  }
  
  return cr;
}

/**
 * Récupère les comptes rendus d'un praticien
 * @param {string} praticienId - ID du praticien
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des comptes rendus
 */
async function getComptesRendusByPraticien(praticienId, page = 1, limit = 10) {
  return await compteRenduRepository.getByPraticien(praticienId);
}

/**
 * Récupère les comptes rendus d'un patient
 * @param {string} patientId - ID du patient
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} - Liste paginée des comptes rendus
 */
async function getComptesRendusByPatient(patientId, page = 1, limit = 10) {
  return await compteRenduRepository.getByPatient(patientId);
}

/**
 * Met à jour un compte rendu
 * @param {string} compteRenduId - ID du compte rendu
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} currentUserId - ID de l'utilisateur
 * @returns {Promise<Object>} - Compte rendu mis à jour
 */
async function updateCompteRendu(compteRenduId, updates, currentUserId) {
  const cr = await compteRenduRepository.getById(compteRenduId);
  
  if (!cr) {
    throw formatError("NotFound", "Compte rendu non trouvé", 404);
  }
  
  // Vérifier que l'utilisateur est le praticien du CR
  if (cr.praticienId !== currentUserId) {
    throw formatError(
      "Forbidden",
      "Seul le praticien peut modifier ce compte rendu",
      403
    );
  }
  
  // Valider les mises à jour
  if (updates.contenu && updates.contenu.length < 10) {
    throw formatError("ValidationError", "contenu doit contenir au moins 10 caractères", 400);
  }
  
  return await compteRenduRepository.update(compteRenduId, updates);
}

/**
 * Vérifie si un compte rendu existe pour un RDV
 * @param {string} rdvId - ID du rendez-vous
 * @returns {Promise<boolean>} - true si un compte rendu existe
 */
async function existsCompteRenduForRdv(rdvId) {
  return await compteRenduRepository.existsByRdvId(rdvId);
}

module.exports = {
  createCompteRendu,
  getCompteRendu,
  getCompteRenduByRdv,
  getComptesRendusByPraticien,
  getComptesRendusByPatient,
  updateCompteRendu,
  existsCompteRenduForRdv,
  // Exporter pour les tests
  validateCompteRendu
};

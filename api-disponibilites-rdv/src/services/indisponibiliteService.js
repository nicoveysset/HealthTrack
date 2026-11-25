/**
 * IndisponibiliteService - Service pour la gestion des indisponibilités
 * 
 * Contient la logique métier pour les indisponibilités ponctuelles.
 */

const indisponibiliteRepository = require("../repositories/indisponibiliteRepository");
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
 * Valide une indisponibilité
 * @param {Object} indispo - Indisponibilité à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateIndisponibilite(indispo) {
  const errors = [];
  
  if (!indispo.praticienId) {
    errors.push("praticienId est requis");
  }
  
  if (!indispo.dateDebut) {
    errors.push("dateDebut est requis");
  } else {
    const dateDebut = new Date(indispo.dateDebut);
    if (isNaN(dateDebut.getTime())) {
      errors.push("dateDebut doit être une date valide (format ISO)");
    }
  }
  
  if (!indispo.dateFin) {
    errors.push("dateFin est requis");
  } else {
    const dateFin = new Date(indispo.dateFin);
    if (isNaN(dateFin.getTime())) {
      errors.push("dateFin doit être une date valide (format ISO)");
    }
  }
  
  if (indispo.dateDebut && indispo.dateFin) {
    const dateDebut = new Date(indispo.dateDebut);
    const dateFin = new Date(indispo.dateFin);
    
    if (dateFin <= dateDebut) {
      errors.push("dateFin doit être postérieure à dateDebut");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Vérifie si une date est dans le passé
 * @param {string} dateString - Date au format ISO
 * @returns {boolean} - true si la date est dans le passé
 */
function isPastDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  date.setMilliseconds(0);
  now.setMilliseconds(0);
  return date < now;
}

/**
 * Crée une nouvelle indisponibilité
 * @param {Object} indispoData - Données de l'indisponibilité
 * @returns {Promise<Object>} - Indisponibilité créée
 */
async function createIndisponibilite(indispoData) {
  const validation = validateIndisponibilite(indispoData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  // Vérifier que la date n'est pas dans le passé
  if (isPastDate(indispoData.dateDebut)) {
    throw formatError("PastDateException", "La date de début ne peut pas être dans le passé", 400);
  }
  
  const now = new Date().toISOString();
  const indispo = {
    indispoId: uuidv4(),
    praticienId: indispoData.praticienId,
    dateDebut: indispoData.dateDebut,
    dateFin: indispoData.dateFin,
    motif: indispoData.motif || "",
    récurrente: false,
    createdAt: now,
    updatedAt: now
  };
  
  return await indisponibiliteRepository.create(indispo);
}

/**
 * Récupère les indisponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Array>} - Liste des indisponibilités
 */
async function getIndisponibilitesByPraticien(praticienId) {
  return await indisponibiliteRepository.getByPraticien(praticienId);
}

/**
 * Récupère les indisponibilités d'un praticien pour une date
 * @param {string} praticienId - ID du praticien
 * @param {string} date - Date (format YYYY-MM-DD)
 * @returns {Promise<Array>} - Liste des indisponibilités pour cette date
 */
async function getIndisponibilitesByPraticienAndDate(praticienId, date) {
  return await indisponibiliteRepository.getByPraticienAndDate(praticienId, date);
}

/**
 * Supprime une indisponibilité
 * @param {string} indispoId - ID de l'indisponibilité
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteIndisponibilite(indispoId) {
  return await indisponibiliteRepository.deleteById(indispoId);
}

/**
 * Vérifie si un créneau chevauche avec des indisponibilités
 * @param {string} praticienId - ID du praticien
 * @param {Date} dateDebut - Date/heure de début du créneau
 * @param {Date} dateFin - Date/heure de fin du créneau
 * @returns {Promise<boolean>} - true si indisponible
 */
async function isIndisponible(praticienId, dateDebut, dateFin) {
  return await indisponibiliteRepository.isIndisponible(praticienId, dateDebut, dateFin);
}

module.exports = {
  createIndisponibilite,
  getIndisponibilitesByPraticien,
  getIndisponibilitesByPraticienAndDate,
  deleteIndisponibilite,
  isIndisponible,
  // Exporter pour les tests
  validateIndisponibilite,
  isPastDate
};

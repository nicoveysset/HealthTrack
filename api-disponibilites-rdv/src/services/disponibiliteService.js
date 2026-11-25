/**
 * DisponibiliteService - Service pour la gestion des disponibilités
 * 
 * Contient la logique métier pour les disponibilités hebdomadaires.
 */

const disponibiliteRepository = require("../repositories/disponibiliteRepository");
const { v4: uuidv4 } = require("uuid");

// Jours de la semaine valides
const JOURS_SEMAINE = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

/**
 * Format d'erreur standard
 */
const formatError = (error, message, statusCode) => ({
  error,
  message,
  statusCode
});

/**
 * Valide une disponibilité
 * @param {Object} dispo - Disponibilité à valider
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateDisponibilite(dispo) {
  const errors = [];
  
  if (!dispo.jourSemaine || !JOURS_SEMAINE.includes(dispo.jourSemaine)) {
    errors.push(`jourSemaine doit être l'un de : ${JOURS_SEMAINE.join(', ')}`);
  }
  
  if (!dispo.heureDebut) {
    errors.push("heureDebut est requis");
  } else if (!/^\d{2}:\d{2}$/.test(dispo.heureDebut)) {
    errors.push("heureDebut doit être au format HH:MM");
  }
  
  if (!dispo.heureFin) {
    errors.push("heureFin est requis");
  } else if (!/^\d{2}:\d{2}$/.test(dispo.heureFin)) {
    errors.push("heureFin doit être au format HH:MM");
  }
  
  if (dispo.heureDebut && dispo.heureFin) {
    const [hDebut, mDebut] = dispo.heureDebut.split(':').map(Number);
    const [hFin, mFin] = dispo.heureFin.split(':').map(Number);
    
    if (hDebut > hFin || (hDebut === hFin && mDebut >= mFin)) {
      errors.push("heureFin doit être postérieure à heureDebut");
    }
  }
  
  if (!dispo.praticienId) {
    errors.push("praticienId est requis");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Crée une nouvelle disponibilité
 * @param {Object} dispoData - Données de la disponibilité
 * @returns {Promise<Object>} - Disponibilité créée
 */
async function createDisponibilite(dispoData) {
  const validation = validateDisponibilite(dispoData);
  
  if (!validation.valid) {
    throw formatError("ValidationError", validation.errors.join(", "), 400);
  }
  
  const now = new Date().toISOString();
  const dispo = {
    dispoId: uuidv4(),
    praticienId: dispoData.praticienId,
    jourSemaine: dispoData.jourSemaine,
    heureDebut: dispoData.heureDebut,
    heureFin: dispoData.heureFin,
    récurrente: true,
    createdAt: now,
    updatedAt: now
  };
  
  return await disponibiliteRepository.create(dispo);
}

/**
 * Remplace toutes les disponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @param {Array} newDispos - Nouvelle liste de disponibilités
 * @returns {Promise<Array>} - Liste des disponibilités créées
 */
async function replaceAllDisponibilites(praticienId, newDispos) {
  // Valider toutes les nouvelles disponibilités
  for (const dispo of newDispos) {
    const validation = validateDisponibilite({ ...dispo, praticienId });
    if (!validation.valid) {
      throw formatError("ValidationError", validation.errors.join(", "), 400);
    }
  }
  
  // Supprimer les anciennes
  await disponibiliteRepository.deleteAllByPraticien(praticienId);
  
  // Créer les nouvelles
  const createdDispos = [];
  const now = new Date().toISOString();
  
  for (const dispo of newDispos) {
    const dispoToCreate = {
      dispoId: uuidv4(),
      praticienId,
      jourSemaine: dispo.jourSemaine,
      heureDebut: dispo.heureDebut,
      heureFin: dispo.heureFin,
      récurrente: true,
      createdAt: now,
      updatedAt: now
    };
    const created = await disponibiliteRepository.create(dispoToCreate);
    createdDispos.push(created);
  }
  
  return createdDispos;
}

/**
 * Récupère les disponibilités d'un praticien
 * @param {string} praticienId - ID du praticien
 * @returns {Promise<Array>} - Liste des disponibilités
 */
async function getDisponibilitesByPraticien(praticienId) {
  return await disponibiliteRepository.getByPraticien(praticienId);
}

/**
 * Récupère les disponibilités d'un praticien pour un jour spécifique
 * @param {string} praticienId - ID du praticien
 * @param {string} jourSemaine - Jour de la semaine
 * @returns {Promise<Array>} - Liste des disponibilités pour ce jour
 */
async function getDisponibilitesByPraticienAndJour(praticienId, jourSemaine) {
  if (!JOURS_SEMAINE.includes(jourSemaine)) {
    throw formatError("ValidationError", `jourSemaine doit être l'un de : ${JOURS_SEMAINE.join(', ')}`, 400);
  }
  
  return await disponibiliteRepository.getByPraticienAndJour(praticienId, jourSemaine);
}

/**
 * Supprime une disponibilité
 * @param {string} dispoId - ID de la disponibilité
 * @returns {Promise<Object>} - Résultat de la suppression
 */
async function deleteDisponibilite(dispoId) {
  return await disponibiliteRepository.deleteById(dispoId);
}

module.exports = {
  createDisponibilite,
  replaceAllDisponibilites,
  getDisponibilitesByPraticien,
  getDisponibilitesByPraticienAndJour,
  deleteDisponibilite,
  // Exporter pour les tests
  validateDisponibilite
};
